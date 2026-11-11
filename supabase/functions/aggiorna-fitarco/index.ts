// Funzione del server "aggiorna-fitarco": legge i dati pubblici Fitarco un pezzo alla volta e li salva
// (motore in _shared/aggiornamento/motore.ts, piano in CLAUDE.md, Fase 2.4).
//
// Chi la chiama deve conoscere AGGIORNA_CHIAVE (header `x-aggiorna-chiave`): il controllo giornaliero
// (Cloudflare Worker, Fase 2.5) e, per le prove, l'amministratore dal Terminale. Si imposta con:
//   npx supabase secrets set AGGIORNA_CHIAVE=<lettere a caso>
//
// Corpo della richiesta (JSON, facoltativo):
//   {}                      → un giro: pianifica e fa qualche lettura dalla lista;
//   { "azione": "ranking" } → mette in lista le classifiche (ranking) dei nostri atleti.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.117.3'
import {
  accodaRanking,
  giornoItaliano,
  giro,
  inviaAvvisiProgramma,
  inviaNotifiche,
} from '../_shared/aggiornamento/index.ts'
import { creaClientFitarco } from '../_shared/fitarco/index.ts'
import { archivioAvvisiSupabase, archivioNotificheSupabase, archivioSupabase } from './archivio.ts'
import { creaInviatorePush } from './push.ts'

/** Limiti di ogni chiamata: il piano gratuito dà poco tempo di calcolo, e Fitarco va trattato bene. */
const LETTURE_PER_CHIAMATA = 6
const LETTURE_PESANTI_PER_CHIAMATA = 1
const TEMPO_MASSIMO_MS = 40_000

Deno.serve(async (req) => {
  const chiave = Deno.env.get('AGGIORNA_CHIAVE')
  if (req.method !== 'POST') return new Response('Usa POST', { status: 405 })
  if (!chiave || req.headers.get('x-aggiorna-chiave') !== chiave) {
    return new Response('Non autorizzato', { status: 401 })
  }

  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  )
  const ctx = {
    archivio: archivioSupabase(db),
    fonte: creaClientFitarco(),
    oggi: giornoItaliano(new Date()),
  }

  try {
    const corpo = (await req.json().catch(() => ({}))) as { azione?: string }
    if (corpo.azione === 'ranking') {
      return Response.json({ accodate: await accodaRanking(ctx) })
    }
    const riepilogo = await giro(ctx, {
      massimo: LETTURE_PER_CHIAMATA,
      massimoPesanti: LETTURE_PESANTI_PER_CHIAMATA,
      scadenza: Date.now() + TEMPO_MASSIMO_MS,
    })
    // Le notifiche partono dopo la lettura; se falliscono, la lettura resta valida.
    const notifiche = await mandaNotifiche(db)
    return Response.json({
      ...riepilogo,
      richiesteFitarco: ctx.fonte.richiesteFatte,
      notifiche,
    })
  } catch (errore) {
    return Response.json(
      { errore: errore instanceof Error ? errore.message : String(errore) },
      { status: 500 },
    )
  }
})

/** Manda le notifiche in coda. Senza chiavi VAPID non fa niente (restano in coda). */
async function mandaNotifiche(db: SupabaseClient) {
  try {
    const invia = creaInviatorePush()
    if (!invia) return 'chiavi VAPID mancanti'
    const adesso = new Date()
    return {
      inviti: await inviaNotifiche(archivioNotificheSupabase(db), invia, adesso),
      // Gli avvisi all'atleta quando un suo allenatore cambia il programma (Fase 7.3).
      programma: await inviaAvvisiProgramma(archivioAvvisiSupabase(db), invia, adesso),
    }
  } catch (errore) {
    return { errore: errore instanceof Error ? errore.message : String(errore) }
  }
}
