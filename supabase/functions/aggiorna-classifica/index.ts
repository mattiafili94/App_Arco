// Funzione del server "aggiorna-classifica": il pulsante "Aggiorna" del tab Classifica (Fase 5).
// Rilegge da Fitarco una classifica (ranking) completa e la salva, se è consentito: solo i membri,
// la stessa classifica al massimo ogni 6 ore (regole in _shared/aggiornamento/aggiorna-classifica.ts).
//
// Corpo della richiesta: { "tipo": "I", "divisione": "OL", "classe": "S", "genere": "M" }
// Pubblicazione: npx supabase functions deploy aggiorna-classifica --use-api
import { createClient } from 'npm:@supabase/supabase-js@2.117.3'
import { gestisciAggiornaClassifica, giornoItaliano } from '../_shared/aggiornamento/index.ts'
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
  // Client "come il chiamante": serve a sapere se è un atleta attivo (con le sue regole).
  const comeChiamante = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    auth: { persistSession: false },
  })
  // Client di servizio: legge e salva le classifiche, scrive il diario.
  const servizio = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  let corpo: unknown = null
  try {
    corpo = await req.json()
  } catch {
    // corpo non valido: lo gestisce la logica come "Classifica non valida"
  }

  try {
    const { stato, corpo: esito } = await gestisciAggiornaClassifica(corpo, {
      ctx: {
        archivio: archivioSupabase(servizio),
        fonte: creaClientFitarco(),
        oggi: giornoItaliano(new Date()),
      },
      async chiamanteMembro() {
        const { data, error } = await comeChiamante.rpc('e_membro')
        return !error && data === true
      },
      adesso: () => new Date(),
    })
    return Response.json(esito, { status: stato, headers: cors })
  } catch (e) {
    console.error('aggiorna-classifica', e)
    return Response.json(
      { errore: 'Errore del server. Riprova tra poco.' },
      { status: 500, headers: cors },
    )
  }
})
