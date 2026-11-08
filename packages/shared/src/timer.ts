/**
 * Il timer della volée (Fase 6.3a-2), facoltativo: si usa volée per volée solo se si vuole.
 * Funzioni pure: il tempo arriva da fuori (millisecondi passati dall'avvio).
 *
 * Sequenza, come in gara (Mattia, 11/11/2026):
 * 1. avvio → **1 fischio**: **10 secondi** per andare in linea di tiro ("Preparazione", rosso);
 * 2. **1 fischio** → parte il tempo di tiro: **2 minuti** all'indoor, **4 minuti** all'outdoor ("Tiro", verde);
 * 3. **30 secondi** dalla fine → "Ultimi 30 secondi" (giallo) con un breve avviso sonoro, diverso dal fischio;
 * 4. tempo scaduto → **2 fischi**: fine della volée.
 */
import { eIndoor, type FormatoSimulazione } from './segnapunti'

export const PREPARAZIONE_MS = 10_000
export const AVVISO_MS = 30_000
export const DURATA_INDOOR_MS = 120_000
export const DURATA_OUTDOOR_MS = 240_000

/** Quanto dura il tempo di tiro di una volée per questo formato. */
export const durataTiroMs = (formato: FormatoSimulazione) =>
  eIndoor(formato) ? DURATA_INDOOR_MS : DURATA_OUTDOOR_MS

export type FaseTimer = 'preparazione' | 'tiro' | 'ultimi30' | 'finito'
export type EventoTimer = 'inizio' | 'tiro' | 'avviso' | 'fine'

/** Quanti fischi fa ogni evento (l'avviso è un breve segnale, non un fischio). */
export const FISCHI: Record<EventoTimer, number> = { inizio: 1, tiro: 1, avviso: 0, fine: 2 }

export const ETICHETTE_FASE: Record<FaseTimer, string> = {
  preparazione: 'Preparazione',
  tiro: 'Tiro',
  ultimi30: 'Ultimi 30 secondi',
  finito: 'Tempo scaduto',
}

/** Gli eventi sonori della volée, con il momento in cui avvengono (ms dall'avvio). */
export function eventiTimer(durataTiro: number): { tempo: number; evento: EventoTimer }[] {
  return [
    { tempo: 0, evento: 'inizio' },
    { tempo: PREPARAZIONE_MS, evento: 'tiro' },
    { tempo: PREPARAZIONE_MS + durataTiro - AVVISO_MS, evento: 'avviso' },
    { tempo: PREPARAZIONE_MS + durataTiro, evento: 'fine' },
  ]
}

/** Gli eventi che cadono dopo `da` (escluso) e fino ad `a` (incluso), in ordine. Con `da = -1` c'è anche l'avvio. */
export const eventiTra = (durataTiro: number, da: number, a: number): EventoTimer[] =>
  eventiTimer(durataTiro)
    .filter((e) => e.tempo > da && e.tempo <= a)
    .map((e) => e.evento)

export interface StatoTimer {
  fase: FaseTimer
  /** Millisecondi che mancano alla fine della fase (per "Preparazione") o del tempo di tiro. */
  restante: number
  etichetta: string
}

/** In che fase si è, `trascorso` millisecondi dopo l'avvio. */
export function statoTimer(durataTiro: number, trascorso: number): StatoTimer {
  const fineTiro = PREPARAZIONE_MS + durataTiro
  let fase: FaseTimer
  let restante: number
  if (trascorso < PREPARAZIONE_MS) {
    fase = 'preparazione'
    restante = PREPARAZIONE_MS - trascorso
  } else if (trascorso < fineTiro - AVVISO_MS) {
    fase = 'tiro'
    restante = fineTiro - trascorso
  } else if (trascorso < fineTiro) {
    fase = 'ultimi30'
    restante = fineTiro - trascorso
  } else {
    fase = 'finito'
    restante = 0
  }
  return { fase, restante, etichetta: ETICHETTE_FASE[fase] }
}

/** "1:59", "0:07": i secondi che mancano, arrotondati per eccesso (a 0:00 il tempo è finito). */
export function formattaTempo(ms: number): string {
  const secondi = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(secondi / 60)}:${String(secondi % 60).padStart(2, '0')}`
}
