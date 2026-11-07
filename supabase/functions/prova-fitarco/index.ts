// Funzione TEMPORANEA "prova-fitarco" (Fase 2.1): il sito Fitarco risponde alle richieste che
// partono dal cloud? Fa UNA sola richiesta (calendario Umbria) con il client standard di Deno,
// senza cambiare lo User-Agent, e dice cosa è successo. Non salva niente.
// Si pubblica, si prova una volta e si elimina (vedi supabase/README.md, "Prova di lettura").
//
// Protezione: risponde solo a chi conosce PROVA_FITARCO_CHIAVE (segreto usa e getta).
import {
  contaGareCalendario,
  leggiRisposta,
  richiestaCalendario,
} from '../_shared/fitarco/index.ts'

Deno.serve(async (req) => {
  const chiave = Deno.env.get('PROVA_FITARCO_CHIAVE')
  if (!chiave || req.headers.get('x-prova') !== chiave) {
    return new Response('Non autorizzato', { status: 401 })
  }

  const { url, corpo } = richiestaCalendario(new Date().getFullYear())
  const inizio = Date.now()
  try {
    const risposta = await fetch(url, { method: 'POST', body: corpo })
    const testo = await risposta.text()
    const letta = leggiRisposta(testo)
    return Response.json({
      stato_http: risposta.status,
      millisecondi: Date.now() - inizio,
      lunghezza: testo.length,
      lettura: letta.ok ? 'ok' : letta.motivo,
      gare: letta.ok ? contaGareCalendario(letta.html) : null,
      dettaglio: letta.ok ? null : letta.dettaglio,
    })
  } catch (errore) {
    return Response.json({ errore: String(errore), millisecondi: Date.now() - inizio })
  }
})
