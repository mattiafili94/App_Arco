import { createClient, FunctionsHttpError, type SupabaseClient } from '@supabase/supabase-js'
import { emailTecnica } from '@arco/shared'
import type { Atleta, ServizioAccesso } from './servizio'

interface RigaAtleta {
  id: string
  matricola: string
  nome: string
  cognome: string
  ruolo: 'atleta' | 'amministratore'
  attivo: boolean
  utente_id: string | null
}

const COLONNE = 'id, matricola, nome, cognome, ruolo, attivo, utente_id'

const daRiga = (r: RigaAtleta): Atleta => ({
  id: r.id,
  matricola: r.matricola,
  nome: r.nome,
  cognome: r.cognome,
  ruolo: r.ruolo,
  attivo: r.attivo,
  haAccesso: r.utente_id !== null,
})

const senzaRete = () => typeof navigator !== 'undefined' && !navigator.onLine

/** Implementazione vera, con Supabase. Indirizzo e chiave pubblica arrivano dalla build. */
export function creaServizioSupabase(url: string, chiavePubblica: string): ServizioAccesso {
  const supabase: SupabaseClient = createClient(url, chiavePubblica, {
    auth: {
      storageKey: 'arco.sessione',
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  })

  return {
    async sessioneSalvata() {
      const { data } = await supabase.auth.getSession()
      return data.session ? { utenteId: data.session.user.id } : null
    },

    async accedi(matricola, codice) {
      if (senzaRete()) return { esito: 'offline' }
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: emailTecnica(matricola),
          password: codice,
        })
        if (error) return { esito: error.status === 400 ? 'errato' : 'errore' }
        return { esito: 'ok', utenteId: data.user.id }
      } catch {
        return { esito: senzaRete() ? 'offline' : 'errore' }
      }
    },

    async esci() {
      await supabase.auth.signOut({ scope: 'local' })
    },

    async profilo(utenteId) {
      const { data, error } = await supabase
        .from('atleti')
        .select(COLONNE)
        .eq('utente_id', utenteId)
        .maybeSingle<RigaAtleta>()
      if (error) throw new Error(error.message)
      return data && data.attivo ? daRiga(data) : null
    },

    quandoEsce(avvisa) {
      const { data } = supabase.auth.onAuthStateChange((evento) => {
        if (evento === 'SIGNED_OUT') avvisa()
      })
      return () => data.subscription.unsubscribe()
    },

    async elencoAtleti() {
      const { data, error } = await supabase
        .from('atleti')
        .select(COLONNE)
        .order('cognome')
        .order('nome')
        .returns<RigaAtleta[]>()
      if (error) throw new Error(error.message)
      return data.map(daRiga)
    },

    async aggiungiAtleta(dati) {
      const { error } = await supabase.from('atleti').insert(dati)
      if (!error) return { esito: 'ok' }
      return { esito: error.code === '23505' ? 'duplicato' : 'errore' }
    },

    async generaLink(atletaId) {
      return chiamaCreaAccesso<{ link: string; codice: string }>(supabase, {
        azione: 'genera',
        atletaId,
      })
    },

    async revocaAccesso(atletaId) {
      await chiamaCreaAccesso(supabase, { azione: 'revoca', atletaId })
    },
  }
}

async function chiamaCreaAccesso<T>(supabase: SupabaseClient, corpo: object): Promise<T> {
  if (senzaRete()) throw new Error('Serve la rete. Riprova quando sei connesso.')
  const { data, error } = await supabase.functions.invoke<T>('crea-accesso', { body: corpo })
  if (error) {
    let messaggio = 'Operazione non riuscita. Riprova tra poco.'
    if (error instanceof FunctionsHttpError) {
      const dettaglio = (await error.context.json().catch(() => null)) as { errore?: string } | null
      if (dettaglio?.errore) messaggio = dettaglio.errore
    }
    throw new Error(messaggio)
  }
  return data as T
}
