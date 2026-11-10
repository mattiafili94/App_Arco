// Funzione del server "aggiorna-atleta": legge subito la scheda Fitarco di un atleta appena aggiunto
// (la chiama l'app quando l'amministratore aggiunge un atleta). Solo l'amministratore.
// Regole in _shared/aggiornamento/aggiorna-atleta.ts.
// Pubblicazione: npx supabase functions deploy aggiorna-atleta --use-api
import { createClient } from 'npm:@supabase/supabase-js@2.117.3'
import { gestisciAggiornaAtleta, giornoItaliano } from '../_shared/aggiornamento/index.ts'
import { creaClientFitarco } from '../_shared/fitarco/index.ts'
import { archivioSupabase } from '../aggiorna-fitarco/archivio.ts'

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
  // Client "come il chiamante": serve a sapere se è l'amministratore (con le sue regole).
  const comeChiamante = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    auth: { persistSession: false },
  })
  // Client di servizio: legge e salva i dati Fitarco, scrive il diario.
  const servizio = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  try {
    const { stato, corpo } = await gestisciAggiornaAtleta({
      ctx: {
        archivio: archivioSupabase(servizio),
        fonte: creaClientFitarco(),
        oggi: giornoItaliano(new Date()),
      },
      async chiamanteAmministratore() {
        const { data, error } = await comeChiamante.rpc('e_amministratore')
        return !error && data === true
      },
      adesso: () => Date.now(),
    })
    return Response.json(corpo, { status: stato, headers: cors })
  } catch (e) {
    console.error('aggiorna-atleta', e)
    return Response.json(
      { errore: 'Errore del server. Riprova tra poco.' },
      { status: 500, headers: cors },
    )
  }
})
