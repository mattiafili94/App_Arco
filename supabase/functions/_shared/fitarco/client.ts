/**
 * Client "educato" per Fitarco:
 * - una richiesta alla volta, con una pausa tra una e l'altra;
 * - le risposte buone restano in memoria per un po' (non si rilegge ciò che si è appena letto);
 * - nessun nuovo tentativo automatico: se il sito non risponde ci si ferma e si riprova un altro giorno;
 * - client HTTP standard: MAI aggiungere User-Agent o intestazioni "da browser" (regola in CLAUDE.md).
 */
import { leggiRisposta, type RichiestaFitarco, type RispostaFitarco } from './richieste.ts'

export interface OpzioniClient {
  /** Il `fetch` da usare (nei test uno finto). */
  fetch?: typeof fetch
  /** Pausa minima tra la fine di una richiesta e l'inizio della successiva. */
  pausaMs?: number
  /** Quanto restano valide le risposte in memoria. */
  cacheMs?: number
  /** Tempo massimo di attesa di una risposta. */
  timeoutMs?: number
  /** Orologio e attesa (nei test finti). */
  adesso?: () => number
  attendi?: (ms: number) => Promise<void>
}

export interface ClientFitarco {
  leggi(richiesta: RichiestaFitarco): Promise<RispostaFitarco>
  /** Quante richieste sono davvero partite verso Fitarco (per i controlli e i test). */
  readonly richiesteFatte: number
}

export const PAUSA_PREDEFINITA_MS = 2000
export const CACHE_PREDEFINITA_MS = 10 * 60 * 1000
export const TIMEOUT_PREDEFINITO_MS = 30 * 1000

const attesaVera = (ms: number) => new Promise<void>((fine) => setTimeout(fine, ms))

export function creaClientFitarco(opzioni: OpzioniClient = {}): ClientFitarco {
  const {
    fetch: f = globalThis.fetch,
    pausaMs = PAUSA_PREDEFINITA_MS,
    cacheMs = CACHE_PREDEFINITA_MS,
    timeoutMs = TIMEOUT_PREDEFINITO_MS,
    adesso = Date.now,
    attendi = attesaVera,
  } = opzioni

  const cache = new Map<string, { scade: number; risposta: RispostaFitarco }>()
  let coda: Promise<unknown> = Promise.resolve()
  let ultimaFine: number | null = null
  let richiesteFatte = 0

  async function esegui({ url, corpo }: RichiestaFitarco): Promise<RispostaFitarco> {
    const chiave = `${url}\n${corpo.toString()}`
    const salvata = cache.get(chiave)
    if (salvata && salvata.scade > adesso()) return salvata.risposta

    if (ultimaFine !== null) {
      const mancano = ultimaFine + pausaMs - adesso()
      if (mancano > 0) await attendi(mancano)
    }

    const stop = new AbortController()
    const timer = setTimeout(() => stop.abort(), timeoutMs)
    richiesteFatte++
    try {
      const risposta = await f(url, { method: 'POST', body: corpo, signal: stop.signal })
      const testo = await risposta.text()
      if (!risposta.ok) return { ok: false, motivo: 'http', dettaglio: String(risposta.status) }
      const letta = leggiRisposta(testo)
      if (letta.ok) cache.set(chiave, { scade: adesso() + cacheMs, risposta: letta })
      return letta
    } catch (errore) {
      return { ok: false, motivo: 'rete', dettaglio: String(errore) }
    } finally {
      clearTimeout(timer)
      ultimaFine = adesso()
    }
  }

  return {
    leggi(richiesta) {
      const risultato = coda.then(() => esegui(richiesta))
      coda = risultato.catch(() => undefined)
      return risultato
    },
    get richiesteFatte() {
      return richiesteFatte
    },
  }
}
