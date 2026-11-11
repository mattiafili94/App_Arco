import { createClient, FunctionsHttpError, type SupabaseClient } from '@supabase/supabase-js'
import { emailTecnica } from '@arco/shared'
import { dbPredefinito, svuotaDb } from '../sync/db'
import { creaServizioClassifica } from '../classifica/servizioSupabase'
import { creaRemotoSupabase } from '../sync/remotoSupabase'
import type { Atleta, ServizioAccesso } from './servizio'

interface RigaAtleta {
  id: string
  matricola: string
  nome: string
  cognome: string
  ruolo: 'atleta' | 'amministratore'
  attivo: boolean
  utente_id: string | null
  allenatore?: boolean
}

const COLONNE = 'id, matricola, nome, cognome, ruolo, attivo, allenatore, utente_id'

const daRiga = (r: RigaAtleta): Atleta => ({
  id: r.id,
  matricola: r.matricola,
  nome: r.nome,
  cognome: r.cognome,
  ruolo: r.ruolo,
  attivo: r.attivo,
  haAccesso: r.utente_id !== null,
  allenatore: r.allenatore ?? false,
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

  // La copia dei dati sul telefono non deve restare a chi non ha più l'accesso.
  const svuotaCopia = () => svuotaDb(dbPredefinito()).catch(() => {})

  return {
    remoto: creaRemotoSupabase(supabase),
    classifica: creaServizioClassifica(supabase),

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
      // Chi esce non deve più ricevere le notifiche su questo telefono (se non c'è rete, pazienza).
      await togliNotifichePush(supabase)
      await supabase.auth.signOut({ scope: 'local' })
      await svuotaCopia()
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
        if (evento !== 'SIGNED_OUT') return
        void svuotaCopia()
        avvisa()
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
      if (!error) {
        // Il server legge subito la scheda Fitarco del nuovo atleta (senza aspettare il giro automatico).
        // Non si aspetta e un errore non conta: la lettura parte comunque al prossimo giro.
        void supabase.functions.invoke('aggiorna-atleta', { body: {} }).catch(() => undefined)
        return { esito: 'ok' }
      }
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

    async registraPush(i) {
      const { error } = await supabase.rpc('registra_push', {
        p_endpoint: i.endpoint,
        p_p256dh: i.p256dh,
        p_auth: i.auth,
      })
      if (error) throw new Error(error.message)
    },

    async seguiAtleta(atletaId, segui) {
      if (senzaRete()) throw new Error('Serve la rete. Riprova quando sei connesso.')
      const { error } = await supabase.rpc('segui_atleta', { p_atleta: atletaId, p_segui: segui })
      if (error) throw new Error('Non riuscito. Riprova tra poco.')
    },

    async impostaAllenatore(atletaId, allenatore) {
      if (senzaRete()) throw new Error('Serve la rete. Riprova quando sei connesso.')
      const { error } = await supabase.from('atleti').update({ allenatore }).eq('id', atletaId)
      if (error) throw new Error('Non riuscito. Riprova tra poco.')
    },

    async rimuoviPush(endpoint) {
      const { error } = await supabase.rpc('rimuovi_push', { p_endpoint: endpoint })
      if (error) throw new Error(error.message)
    },
  }
}

/** Toglie la registrazione push di questo telefono, sul server e nel browser. Non lancia mai errori. */
async function togliNotifichePush(supabase: SupabaseClient) {
  try {
    const registrazione = await navigator.serviceWorker?.getRegistration()
    const iscrizione = await registrazione?.pushManager?.getSubscription()
    if (!iscrizione) return
    if (!senzaRete()) await supabase.rpc('rimuovi_push', { p_endpoint: iscrizione.endpoint })
    await iscrizione.unsubscribe()
  } catch {
    // L'uscita deve riuscire comunque.
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
