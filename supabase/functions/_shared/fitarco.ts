/**
 * Richieste al sito pubblico Fitarco (riferimento tecnico in CLAUDE.md).
 * Usato dalle funzioni del server (Deno) e, tramite packages/shared, dai test.
 *
 * Regole: solo dati pubblici, poche richieste, client HTTP standard (MAI cambiare lo User-Agent
 * o travestirsi da browser per aggirare filtri).
 */

const BASE = 'https://www.fitarco.it/index.php?option=com_tesseramentofiv&format=json'

/** Elenchi (calendario, ranking, tesserati) e dettagli (schede, invito). */
export const URL_ELENCHI = `${BASE}&view=risultati`
export const URL_DETTAGLI = `${BASE}&view=dettaglio`

export interface RichiestaFitarco {
  url: string
  corpo: URLSearchParams
}

/** Ogni richiesta dati è un POST con i campi `call`, `render` e `params` (JSON). */
export function richiesta(
  url: string,
  call: string,
  render: string,
  params: Record<string, string>,
): RichiestaFitarco {
  return { url, corpo: new URLSearchParams({ call, render, params: JSON.stringify(params) }) }
}

/** Calendario di un anno per un comitato regionale (11 = Umbria). */
export function richiestaCalendario(anno: number, comitato = '11'): RichiestaFitarco {
  return richiesta(URL_ELENCHI, 'calendario', 'lista_calendario_results', {
    idPeriodo: String(anno),
    idComitato: comitato,
    mese: '',
    idClasseEvento: '',
    idsTipoGare: '',
    idMatchRound: '',
  })
}

export type RispostaFitarco =
  | { ok: true; html: string }
  | { ok: false; motivo: 'non-json' | 'stato' | 'vuota'; dettaglio: string }

/** La risposta buona è `{"status":"OK","content":"<html…>"}`; tutto il resto è un problema. */
export function leggiRisposta(testo: string): RispostaFitarco {
  let dati: unknown
  try {
    dati = JSON.parse(testo)
  } catch {
    return { ok: false, motivo: 'non-json', dettaglio: testo.slice(0, 200) }
  }
  const { status, content } = (dati ?? {}) as { status?: unknown; content?: unknown }
  if (status !== 'OK') return { ok: false, motivo: 'stato', dettaglio: String(status) }
  if (typeof content !== 'string' || content.trim() === '') {
    return { ok: false, motivo: 'vuota', dettaglio: '' }
  }
  return { ok: true, html: content }
}

/** Quante gare (codici con il loro link alla scheda) ci sono in un calendario. */
export function contaGareCalendario(html: string): number {
  return html.split('data-call="dett_gara"').length - 1
}
