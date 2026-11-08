/**
 * Classifiche (ranking) complete: quali, quando e con che limiti si chiedono a Fitarco (Fase 5).
 *
 * Regole (Mattia, 10/11/2026):
 * - cercare con i filtri, nell'app, legge solo il nostro database: mai Fitarco;
 * - Fitarco si chiama solo il lunedì alle 10:00 (una classifica per volta, a distanza di 15 minuti: è
 *   il ritmo del controllo automatico) e con il pulsante "Aggiorna";
 * - la stessa classifica si può rileggere con il pulsante al massimo ogni 6 ore.
 *
 * Funzioni pure: database e orologio arrivano dall'esterno.
 */
import type { TipoRanking } from '../fitarco/richieste.ts'
import type { CombinazioneRanking } from './ranking.ts'
import type { Lettura } from './pianifica.ts'

/** Le scelte dei filtri, come le conosce Fitarco. */
export const TIPI_RANKING: readonly TipoRanking[] = ['I', 'T', 'C', '3']
export const DIVISIONI_RANKING = ['OL', 'CO', 'AN', 'AI', 'LB'] as const
export const CLASSI_RANKING = ['M', 'S', 'J', 'A', 'R'] as const
export const GENERI_RANKING = ['M', 'F'] as const

/** Una classifica: tipo di gara, arco, classe e genere. */
export interface FiltroClassifica {
  tipo: TipoRanking
  divisione: string
  classe: string
  genere: 'M' | 'F'
}

/** La richiesta contiene solo valori ammessi? (Il pulsante "Aggiorna" arriva da fuori: si controlla.) */
export function filtroValido(
  f: Partial<Record<keyof FiltroClassifica, unknown>>,
): f is FiltroClassifica {
  return (
    (TIPI_RANKING as readonly unknown[]).includes(f.tipo) &&
    (DIVISIONI_RANKING as readonly unknown[]).includes(f.divisione) &&
    (CLASSI_RANKING as readonly unknown[]).includes(f.classe) &&
    (GENERI_RANKING as readonly unknown[]).includes(f.genere)
  )
}

/** "I|OL|S|M": la chiave della classifica nella lista di lavoro e nel diario. */
export const chiaveClassifica = (f: FiltroClassifica) =>
  `${f.tipo}|${f.divisione}|${f.classe}|${f.genere}`

/** Il contrario di `chiaveClassifica`; `null` se la chiave non è valida. */
export function filtroDaChiave(chiave: string): FiltroClassifica | null {
  const [tipo, divisione, classe, genere, ...altro] = chiave.split('|')
  const f = { tipo, divisione, classe, genere }
  return altro.length === 0 && filtroValido(f) ? f : null
}

/** Una classifica già scaricata: quando è stata letta da Fitarco per l'ultima volta (ISO). */
export interface ClassificaScaricata extends FiltroClassifica {
  letta_il: string
}

const FORMATO_ITALIA = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Rome',
  weekday: 'short',
  hour: '2-digit',
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** Giorno ("AAAA-MM-GG"), giorno della settimana (1 = lunedì … 7 = domenica) e ora in Italia. */
export function dataItaliana(istante: Date): { giorno: string; settimana: number; ora: number } {
  const parti = Object.fromEntries(
    FORMATO_ITALIA.formatToParts(istante).map((p) => [p.type, p.value]),
  )
  const settimana = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(parti.weekday!) + 1
  return {
    giorno: `${parti.year}-${parti.month}-${parti.day}`,
    settimana,
    ora: Number(parti.hour),
  }
}

/** Ora (italiana) da cui, il lunedì, partono le letture settimanali. */
export const ORA_LETTURA_SETTIMANALE = 10

/** Priorità della lettura di una classifica nella lista di lavoro. */
export const PRIORITA_CLASSIFICA = 25

/**
 * Le classifiche da mettere in lista:
 * - sempre, se una delle nostre non è mai stata scaricata (così il tab funziona da subito);
 * - il lunedì dalle 10:00, quelle dei nostri atleti e quelle già scaricate con il pulsante, se non sono
 *   già state lette oggi. Il motore ne fa una per giro (ogni 15 minuti).
 */
export function pianificaClassifiche(
  adesso: Date,
  nostre: readonly CombinazioneRanking[],
  scaricate: readonly ClassificaScaricata[],
): Lettura[] {
  const { giorno, settimana, ora } = dataItaliana(adesso)
  const lunedi = settimana === 1 && ora >= ORA_LETTURA_SETTIMANALE
  const lette = new Map(scaricate.map((s) => [chiaveClassifica(s), s.letta_il]))
  const lista = new Map<string, Lettura>()
  const aggiungi = (chiave: string) =>
    lista.set(chiave, { tipo: 'ranking', chiave, priorita: PRIORITA_CLASSIFICA })

  for (const n of nostre) {
    const chiave = chiaveClassifica(n)
    const letta = lette.get(chiave)
    if (letta === undefined || (lunedi && dataItaliana(new Date(letta)).giorno < giorno)) {
      aggiungi(chiave)
    }
  }
  if (lunedi) {
    for (const [chiave, letta] of lette) {
      if (dataItaliana(new Date(letta)).giorno < giorno) aggiungi(chiave)
    }
  }
  return [...lista.values()]
}

/** Tempo minimo tra due letture della stessa classifica col pulsante "Aggiorna". */
export const ORE_TRA_LETTURE = 6
/** Quante letture di classifiche al massimo in un'ora, per tutta la compagnia (freno di sicurezza). */
export const MASSIMO_LETTURE_ORA = 10
/** Se il tetto orario è raggiunto, quanto aspettare prima di riprovare. */
const ATTESA_TETTO_MS = 15 * 60_000

export type Valutazione =
  | { consentita: true }
  | {
      consentita: false
      motivo: 'troppo-presto' | 'troppe-richieste' | 'fitarco-non-risponde'
      /** Istante (ISO) dopo il quale riprovare. */
      riprovaDopo: string
    }

/**
 * Il pulsante "Aggiorna" può leggere questa classifica da Fitarco adesso?
 * `lettaIl`: ultima lettura di questa classifica (ISO) o `null`; `lettureUltimaOra`: quante classifiche
 * sono state lette in tutto nell'ultima ora; `ultimoBlocco`: istante (ms) in cui Fitarco non ha risposto.
 */
export function valutaAggiornamento(dati: {
  adesso: Date
  lettaIl: string | null
  lettureUltimaOra: number
  ultimoBlocco: number | null
  pausaDopoBloccoMs: number
}): Valutazione {
  const ora = dati.adesso.getTime()
  const rifiuta = (
    motivo: 'troppo-presto' | 'troppe-richieste' | 'fitarco-non-risponde',
    fino: number,
  ) => ({ consentita: false, motivo, riprovaDopo: new Date(fino).toISOString() }) as const

  if (dati.ultimoBlocco !== null && ora < dati.ultimoBlocco + dati.pausaDopoBloccoMs) {
    return rifiuta('fitarco-non-risponde', dati.ultimoBlocco + dati.pausaDopoBloccoMs)
  }
  if (dati.lettaIl !== null) {
    const fino = Date.parse(dati.lettaIl) + ORE_TRA_LETTURE * 3_600_000
    if (ora < fino) return rifiuta('troppo-presto', fino)
  }
  if (dati.lettureUltimaOra >= MASSIMO_LETTURE_ORA) {
    return rifiuta('troppe-richieste', ora + ATTESA_TETTO_MS)
  }
  return { consentita: true }
}
