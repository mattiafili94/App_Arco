/**
 * Richieste al sito pubblico Fitarco (riferimento tecnico in CLAUDE.md).
 *
 * Regole: solo dati pubblici, poche richieste, client HTTP standard (MAI cambiare lo User-Agent
 * o travestirsi da browser per aggirare filtri).
 */

const BASE = 'https://www.fitarco.it/index.php?option=com_tesseramentofiv&format=json'

/** Elenchi (calendario, ranking, tesserati) e dettagli (schede, invito). */
export const URL_ELENCHI = `${BASE}&view=risultati`
export const URL_DETTAGLI = `${BASE}&view=dettaglio`

/** Comitato regionale dell'Umbria. */
export const COMITATO_UMBRIA = '11'

/** Per la ranking, tutta Italia = nessun comitato (verificato il 10/11/2026: "00" non dà risultati). */
export const TUTTA_ITALIA = ''

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

/** Calendario di un anno per un comitato regionale. */
export function richiestaCalendario(anno: number, comitato = COMITATO_UMBRIA): RichiestaFitarco {
  return richiesta(URL_ELENCHI, 'calendario', 'lista_calendario_results', {
    idPeriodo: String(anno),
    idComitato: comitato,
    mese: '',
    idClasseEvento: '',
    idsTipoGare: '',
    idMatchRound: '',
  })
}

/** Scheda di una gara: stato e link ai PDF dei risultati. */
export function richiestaSchedaGara(codice: string): RichiestaFitarco {
  return richiesta(URL_DETTAGLI, 'calendario', 'scheda_gara_result', { codice })
}

/** Invito di una gara (testo libero con date e modalità di iscrizione). */
export function richiestaInvito(codiceGara: string): RichiestaFitarco {
  return richiesta(URL_DETTAGLI, 'invito', 'scheda_invito_result', { codiceGara })
}

/** Scheda di un atleta: anagrafica, ranking e storico gare. */
export function richiestaSchedaAtleta(matricola: string): RichiestaFitarco {
  return richiesta(URL_DETTAGLI, 'scheda_tesserato', 'scheda_tesserato_result', { matricola })
}

/** Ricerca tesserati (per esempio tutti quelli di una società). */
export function richiestaTesserati(filtro: {
  nome?: string
  cognome?: string
  matricola?: string
  societa?: string
}): RichiestaFitarco {
  return richiesta(URL_ELENCHI, 'tesserati', 'lista_tesserati_results', {
    tesserato_nome: filtro.nome ?? '',
    tesserato_cognome: filtro.cognome ?? '',
    tesserato_matricola: filtro.matricola ?? '',
    nome_societa: filtro.societa ?? '',
  })
}

/** Tipo di ranking: I indoor, T targa (outdoor), C campagna, 3 3D. */
export type TipoRanking = 'I' | 'T' | 'C' | '3'

/** Ranking individuale per tipo, divisione, classe e genere (la posizione è sempre nazionale). */
export function richiestaRanking(filtro: {
  tipo: TipoRanking
  divisione: string
  classe: string
  genere: 'M' | 'F'
  /** Di base tutta Italia (la lista nazionale completa); con un comitato solo i suoi atleti. */
  comitato?: string
}): RichiestaFitarco {
  return richiesta(URL_ELENCHI, 'ranking_gare', 'lista_ranking_gare_results', {
    idRankingTipo: filtro.tipo,
    idDivisione: filtro.divisione,
    idClasse: filtro.classe,
    idGenere: filtro.genere,
    idTipoSquadra: '0',
    idComitato: filtro.comitato ?? TUTTA_ITALIA,
  })
}

export type RispostaFitarco =
  | { ok: true; html: string }
  | { ok: false; motivo: 'rete' | 'http' | 'non-json' | 'stato' | 'vuota'; dettaglio: string }

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
