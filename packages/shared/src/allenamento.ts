/**
 * L'allenamento settimanale (Fase 6.1): giorni, settimane (da lunedì a domenica), riepilogo e "copia la
 * settimana scorsa". Funzioni pure: nessun accesso a dati, rete o orologio.
 *
 * Le date sono stringhe "AAAA-MM-GG" (il giorno di calendario, senza ora né fuso).
 */
import { formattaDate } from './gare'

/** Un giorno di allenamento com'è salvato sul telefono (tabella `allenamento_giorni`). */
export interface GiornoAllenamento {
  atleta_id: string
  /** "AAAA-MM-GG". */
  giorno: string
  /** Cosa deve fare in quel giorno (testo libero). */
  programma: string
  fatto: boolean
  /** Frecce tirate liberamente (le simulazioni di gara si contano a parte). */
  frecce_libere: number
  nota: string
  /** Quando è stato modificato l'ultima volta (ora del telefono, ISO): vince la più recente. */
  modificato_il: string
}

export const FRECCE_MASSIME = 9999
export const LUNGHEZZA_MASSIMA_PROGRAMMA = 2000
export const LUNGHEZZA_MASSIMA_NOTA = 4000

const MS_GIORNO = 86_400_000
const utc = (giorno: string) => {
  const [anno, mese, g] = giorno.split('-').map(Number) as [number, number, number]
  return Date.UTC(anno, mese - 1, g)
}
const testoGiorno = (ms: number) => new Date(ms).toISOString().slice(0, 10)

/** "2026-11-10" + 7 → "2026-11-17" (anche a cavallo di mesi e anni). */
export const aggiungiGiorni = (giorno: string, n: number) =>
  testoGiorno(utc(giorno) + n * MS_GIORNO)

/** 1 = lunedì … 7 = domenica. */
export function giornoDellaSettimana(giorno: string): number {
  const d = new Date(utc(giorno)).getUTCDay()
  return d === 0 ? 7 : d
}

/** Il lunedì della settimana che contiene il giorno. */
export const inizioSettimana = (giorno: string) =>
  aggiungiGiorni(giorno, -(giornoDellaSettimana(giorno) - 1))

/** I sette giorni della settimana che inizia a `inizio` (un lunedì). */
export const giorniDellaSettimana = (inizio: string): string[] =>
  Array.from({ length: 7 }, (_, i) => aggiungiGiorni(inizio, i))

export const NOMI_GIORNI = [
  'Lunedì',
  'Martedì',
  'Mercoledì',
  'Giovedì',
  'Venerdì',
  'Sabato',
  'Domenica',
] as const

/** "Lunedì". */
export const nomeGiorno = (giorno: string) => NOMI_GIORNI[giornoDellaSettimana(giorno) - 1]!

/** "Lunedì 10 nov" (con l'anno se non è quello indicato). */
export const etichettaGiorno = (giorno: string, annoCorrente?: number) =>
  `${nomeGiorno(giorno)} ${formattaDate(giorno, giorno, annoCorrente)}`

/** "10–16 nov 2026". */
export const descriviSettimana = (inizio: string, annoCorrente?: number) =>
  formattaDate(inizio, aggiungiGiorni(inizio, 6), annoCorrente)

/** Un giorno senza niente dentro (nessun programma, nota, frecce, spunta). */
export const giornoVuoto = (
  g: Pick<GiornoAllenamento, 'programma' | 'fatto' | 'frecce_libere' | 'nota'>,
) => g.programma === '' && g.nota === '' && !g.fatto && g.frecce_libere === 0

/** Frecce di una simulazione di gara fatta in un giorno (le conterà il segnapunti, Fase 6.3). */
export interface FrecceSimulazione {
  giorno: string
  frecce: number
}

/** Le frecce di un giorno: quelle libere più quelle delle simulazioni (senza contarle due volte). */
export const frecceDelGiorno = (
  g: Pick<GiornoAllenamento, 'frecce_libere'> | undefined,
  frecceSimulazioni = 0,
) => (g?.frecce_libere ?? 0) + frecceSimulazioni

export interface RiepilogoSettimana {
  frecceLibere: number
  frecceSimulazioni: number
  frecceTotali: number
  /** Giorni in cui c'è stato allenamento: spunta, frecce libere o una simulazione. */
  giorniAllenati: number
}

/** Il riepilogo di una settimana: frecce libere, in gara e totali, giorni allenati. */
export function riepilogoSettimana(
  giorni: readonly GiornoAllenamento[],
  simulazioni: readonly FrecceSimulazione[] = [],
): RiepilogoSettimana {
  const frecceLibere = giorni.reduce((somma, g) => somma + g.frecce_libere, 0)
  const frecceSimulazioni = simulazioni.reduce((somma, s) => somma + s.frecce, 0)
  const allenati = new Set<string>()
  for (const g of giorni) if (g.fatto || g.frecce_libere > 0) allenati.add(g.giorno)
  for (const s of simulazioni) if (s.frecce > 0) allenati.add(s.giorno)
  return {
    frecceLibere,
    frecceSimulazioni,
    frecceTotali: frecceLibere + frecceSimulazioni,
    giorniAllenati: allenati.size,
  }
}

/**
 * "Copia la settimana scorsa": dai programmi della settimana precedente, quelli da scrivere in questa.
 * Si copia solo il programma (non spunte, frecce o note) e solo nei giorni che non ne hanno già uno:
 * niente si sovrascrive.
 */
export function copiaProgrammaSettimana(
  precedente: readonly Pick<GiornoAllenamento, 'giorno' | 'programma'>[],
  attuale: readonly Pick<GiornoAllenamento, 'giorno' | 'programma'>[],
): { giorno: string; programma: string }[] {
  const presenti = new Set(attuale.filter((g) => g.programma !== '').map((g) => g.giorno))
  return precedente
    .filter((g) => g.programma !== '')
    .map((g) => ({ giorno: aggiungiGiorni(g.giorno, 7), programma: g.programma }))
    .filter((c) => !presenti.has(c.giorno))
    .sort((a, b) => a.giorno.localeCompare(b.giorno))
}

/** Le frecce scritte a mano: un numero intero da 0 a 9999 (vuoto = 0); `null` se non va bene. */
export function leggiFrecce(testo: string): number | null {
  const pulito = testo.trim()
  if (pulito === '') return 0
  if (!/^\d+$/.test(pulito)) return null
  const n = Number(pulito)
  return n <= FRECCE_MASSIME ? n : null
}
