// Funzione del server "crea-accesso": crea o revoca il link personale di un atleta.
// La usa solo l'amministratore dall'app (pagina Amministrazione).
//
// La chiave di servizio (SUPABASE_SERVICE_ROLE_KEY) la fornisce Supabase al server: non sta
// mai nell'app né nella repo. INDIRIZZO_APP si imposta con:
//   npx supabase secrets set INDIRIZZO_APP=https://arcieri-eugubini.pages.dev
import { createClient } from 'npm:@supabase/supabase-js@2.117.3'
import { gestisciCreaAccesso } from '../_shared/crea-accesso.ts'

const ORIGINI_AMMESSE = [
  'https://arcieri-eugubini.pages.dev',
  'http://localhost:5173',
  'http://localhost:4173',
]

function intestazioniCors(origine: string | null): Record<string, string> {
  const ammessa =
    origine &&
    (ORIGINI_AMMESSE.includes(origine) ||
      /^https:\/\/[a-z0-9-]+\.arcieri-eugubini\.pages\.dev$/.test(origine))
  return {
    'Access-Control-Allow-Origin': ammessa ? origine : ORIGINI_AMMESSE[0]!,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
}

Deno.serve(async (req) => {
  const cors = intestazioniCors(req.headers.get('Origin'))
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST')
    return new Response('Metodo non ammesso', { status: 405, headers: cors })

  const url = Deno.env.get('SUPABASE_URL')!
  const chiavePubblica = Deno.env.get('SUPABASE_ANON_KEY')!
  const chiaveServizio = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  // Client "come il chiamante": serve a sapere chi è e se è amministratore (con le sue regole).
  const comeChiamante = createClient(url, chiavePubblica, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    auth: { persistSession: false },
  })
  // Client di servizio: solo per creare/eliminare accessi e collegarli agli atleti.
  const servizio = createClient(url, chiaveServizio, { auth: { persistSession: false } })

  let corpo: unknown = null
  try {
    corpo = await req.json()
  } catch {
    // corpo non valido: lo gestisce la logica come "Richiesta non valida"
  }

  try {
    const risposta = await gestisciCreaAccesso(corpo, {
      indirizzoApp: Deno.env.get('INDIRIZZO_APP') ?? ORIGINI_AMMESSE[0]!,
      async utenteChiamante() {
        const { data } = await comeChiamante.auth.getUser()
        return data.user?.id ?? null
      },
      async chiamanteAmministratore() {
        const { data, error } = await comeChiamante.rpc('e_amministratore')
        return !error && data === true
      },
      async leggiAtleta(id) {
        const { data } = await servizio
          .from('atleti')
          .select('id, matricola, utente_id')
          .eq('id', id)
          .maybeSingle()
        return data ? { id: data.id, matricola: data.matricola, utenteId: data.utente_id } : null
      },
      async eliminaAccesso(utenteId) {
        const { error } = await servizio.auth.admin.deleteUser(utenteId)
        if (error && error.status !== 404) throw error
      },
      async creaAccesso(email, password, atletaId) {
        const { data, error } = await servizio.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          app_metadata: { atleta_id: atletaId },
        })
        if (error || !data.user) throw error ?? new Error('Accesso non creato')
        return data.user.id
      },
      async collegaAccesso(atletaId, utenteId) {
        const { error } = await servizio
          .from('atleti')
          .update({ utente_id: utenteId })
          .eq('id', atletaId)
        if (error) throw error
      },
    })
    return Response.json(risposta.corpo, { status: risposta.stato, headers: cors })
  } catch (e) {
    console.error('crea-accesso', e)
    return Response.json(
      { errore: 'Errore del server. Riprova tra poco.' },
      { status: 500, headers: cors },
    )
  }
})
