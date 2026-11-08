/**
 * La geometria dei bersagli (Fase 6.3a-2b): dato il punto in cui si tocca, che valore ha la freccia.
 * Funzioni pure.
 *
 * Le posizioni sono **normalizzate**: (0, 0) è il centro, 1 è il bordo esterno della faccia (il cerchio più
 * grande che dà punti), x cresce verso destra e y verso il basso. Così valgono su qualsiasi schermo e per
 * qualsiasi dimensione del bersaglio.
 *
 * Anelli (tutti della stessa larghezza, come sul bersaglio vero):
 * - bersaglio singolo indoor: 10 anelli, il 10 è l'anello più interno;
 * - trispot: 5 anelli (10…6); la faccia è il trispot, una freccia per faccia ma tutte si segnano sulla stessa;
 * - 122 cm: 10 anelli, più la **X** (la metà interna del 10);
 * - 80 cm ridotto: 6 anelli (10…5), più la X.
 * - **Compound all'indoor**: conta come 10 solo l'anello piccolo interno (la metà del 10); il resto dell'anello
 *   del 10 vale 9. All'outdoor non cambia niente (c'è la X).
 */
import type { BersaglioConAnelli, ValoreFreccia } from './segnapunti'

/** Un punto sul bersaglio: [x, y] normalizzati. */
export type Posizione = readonly [number, number]

/** Un anello del bersaglio: il valore e il suo raggio esterno (normalizzato), dal centro verso l'esterno. */
export interface Anello {
  valore: ValoreFreccia
  raggio: number
}

const VALORI_ANELLI: ValoreFreccia[] = ['10', '9', '8', '7', '6', '5', '4', '3', '2', '1']

/** Quanti anelli ha la faccia di ogni bersaglio (senza contare la X). */
const NUMERO_ANELLI: Record<BersaglioConAnelli, number> = {
  singolo: 10,
  trispot: 5,
  '122': 10,
  '80': 6,
}

/** Il bersaglio ha la X (gli anelli del 10 e della X). */
const HA_X: Record<BersaglioConAnelli, boolean> = {
  singolo: false,
  trispot: false,
  '122': true,
  '80': true,
}

/** Gli anelli di un bersaglio, dal centro all'esterno. `compound` vale solo per l'indoor. */
export function anelli(bersaglio: BersaglioConAnelli, compound = false): Anello[] {
  const n = NUMERO_ANELLI[bersaglio]
  const larghezza = 1 / n
  const risultato: Anello[] = []
  if (HA_X[bersaglio]) risultato.push({ valore: 'X', raggio: larghezza / 2 })
  VALORI_ANELLI.slice(0, n).forEach((valore, i) => {
    risultato.push({ valore, raggio: larghezza * (i + 1) })
  })
  if (compound && !HA_X[bersaglio]) {
    // Indoor, compound: il 10 è solo la metà interna dell'anello; il resto vale 9.
    risultato[0] = { valore: '10', raggio: larghezza / 2 }
    risultato[1] = { valore: '9', raggio: larghezza * 2 }
  }
  return risultato
}

const TOLLERANZA = 1e-9

/** Il raggio del punto (la distanza dal centro). */
export const distanzaDalCentro = (p: Posizione) => Math.hypot(p[0], p[1])

/** Il valore di una freccia che cade in questo punto: la mancata (M) fuori dalla faccia. */
export function valoreDaPosizione(
  bersaglio: BersaglioConAnelli,
  compound: boolean,
  p: Posizione,
): ValoreFreccia {
  const r = distanzaDalCentro(p)
  for (const anello of anelli(bersaglio, compound)) {
    if (r <= anello.raggio + TOLLERANZA) return anello.valore
  }
  return 'M'
}

/** Quanto lontano dal bersaglio può stare una freccia mancata (per non salvare valori assurdi). */
export const DISTANZA_MASSIMA = 2

/** Una posizione valida: due numeri finiti, non più lontani di `DISTANZA_MASSIMA` dal centro. */
export const posizioneValida = (p: unknown): p is Posizione =>
  Array.isArray(p) &&
  p.length === 2 &&
  p.every((n) => typeof n === 'number' && Number.isFinite(n)) &&
  Math.hypot(p[0] as number, p[1] as number) <= DISTANZA_MASSIMA

/** Arrotonda a tre decimali (basta e avanza, e pesa poco). */
export const arrotondaPosizione = (p: Posizione): Posizione => [
  Math.round(p[0] * 1000) / 1000,
  Math.round(p[1] * 1000) / 1000,
]

/** Porta un punto troppo lontano al limite (un tocco lontano dal bersaglio resta una mancata vicina). */
export function limitaPosizione(p: Posizione): Posizione {
  const r = distanzaDalCentro(p)
  if (r <= DISTANZA_MASSIMA) return p
  return [(p[0] / r) * DISTANZA_MASSIMA, (p[1] / r) * DISTANZA_MASSIMA]
}
