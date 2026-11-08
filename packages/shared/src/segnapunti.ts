/**
 * Il segnapunti per le simulazioni di gara a bersaglio (Fase 6.3a): formati, valori ammessi, volée, prove,
 * punteggi e conteggi. Funzioni pure: nessun accesso a dati, rete o orologio.
 *
 * Regole (Mattia, 11/11/2026, come nelle gare Fitarco):
 * - **Indoor** (18 m, 25 m, 25+18): 3 frecce a volée, 20 volée = 60 frecce per prova, 2 parziali da 30.
 *   Bersaglio singolo (10…1, M) o trispot (10…6, M). Niente X: in fondo si contano i **10 e i 9**.
 * - **Outdoor** (70, 60 o 50 m; doppio): 6 frecce a volée, 12 volée = 72 frecce per prova, 2 parziali da 36.
 *   Bersaglio da 122 cm (X, 10…1, M) o da 80 cm ridotto (X, 10…5, M). In fondo si contano i **10+X e gli X**.
 * - La X vale 10 punti, la M (mancata) zero.
 * - Le gare composte si dividono in prove: il 25+18 fa prima i 25 m poi i 18 m, il doppio fa due prove
 *   alla stessa distanza.
 * - **Campagna** (Hunter & Field, 12+12 e 24+24) e **3D** (Fase 6.3b, Mattia 15/11/2026): si tira per
 *   **piazzola**, 3 frecce a piazzola. Campagna: punteggi 6…1 (e M), 12+12 = 24 piazzole = 72 frecce, 24+24 =
 *   48 piazzole = 144 frecce (una prova sola, non si divide); in fondo si contano **6 e 5**. 3D: 24 piazzole =
 *   72 frecce, punteggi 11, 10, 8, 5 e 0 (M); in fondo si contano **11 e 10**. Solo tastierino, niente timer.
 * Solo i formati ufficiali.
 */

import type { Posizione } from './bersaglio'

export type FormatoSimulazione =
  '18m' | '25m' | '25+18m' | '70m' | 'doppio70m' | '12+12' | '24+24' | '3d'
/** I bersagli che si possono toccare sullo schermo (hanno gli anelli: vedi bersaglio.ts). */
export type BersaglioConAnelli = 'singolo' | 'trispot' | '122' | '80'
/** Campagna e 3D non hanno un bersaglio da toccare: ognuno ha il suo valore fisso. */
export type Bersaglio = BersaglioConAnelli | 'campagna' | '3d'
export type ValoreFreccia =
  'X' | '11' | '10' | '9' | '8' | '7' | '6' | '5' | '4' | '3' | '2' | '1' | 'M'
/** Le distanze dell'outdoor: 70 m, 60 m (Master/Allievi) o 50 m (compound e altri). */
export type DistanzaOutdoor = 70 | 60 | 50

/** Una simulazione di gara com'è salvata sul telefono (tabella `simulazioni`). */
export interface Simulazione {
  /** Generato sul telefono (UUID): la stessa simulazione ha lo stesso id ovunque. */
  id: string
  atleta_id: string
  /** Il giorno di allenamento a cui appartiene ("AAAA-MM-GG"). */
  giorno: string
  formato: FormatoSimulazione
  /** Solo outdoor (campagna e 3D non hanno distanza). */
  distanza: DistanzaOutdoor | null
  bersaglio: Bersaglio
  /** Tutte le frecce segnate, nell'ordine in cui sono state tirate. */
  frecce: ValoreFreccia[]
  /** Solo indoor: arco compound (il 10 vale solo l'anello piccolo al centro). Conta quando si tocca il bersaglio. */
  compound?: boolean
  /** Dove è arrivata ogni freccia, se si è toccato il bersaglio (una per freccia, `null` per il tastierino). */
  posizioni?: (Posizione | null)[]
  /** Note facoltative per volée (vedi `notaVolee`). Le simulazioni vecchie non le hanno. */
  note?: Record<string, string>
  conclusa: boolean
  /** "Cancellata": sparisce dalle liste ma la riga resta (serve alla sincronizzazione). */
  eliminata: boolean
  creata_il: string
  /** Quando è stata modificata l'ultima volta (ora del telefono, ISO): vince la più recente. */
  modificato_il: string
}

export const FORMATI: readonly FormatoSimulazione[] = [
  '18m',
  '25m',
  '25+18m',
  '70m',
  'doppio70m',
  '12+12',
  '24+24',
  '3d',
]

export const ETICHETTE_FORMATO: Record<FormatoSimulazione, string> = {
  '18m': '18 m',
  '25m': '25 m',
  '25+18m': '25+18 m',
  '70m': 'Round 70/60/50 m',
  doppio70m: 'Doppio round 70/60/50 m',
  '12+12': 'Campagna 12+12',
  '24+24': 'Campagna 24+24',
  '3d': '3D',
}

export const ETICHETTE_BERSAGLIO: Record<Bersaglio, string> = {
  singolo: 'Bersaglio singolo',
  trispot: 'Trispot',
  '122': '122 cm',
  '80': '80 cm ridotto',
  campagna: 'Bersagli da campagna',
  '3d': 'Sagome 3D',
}

export const DISTANZE_OUTDOOR: readonly DistanzaOutdoor[] = [70, 60, 50]

export const eIndoor = (formato: FormatoSimulazione) =>
  formato === '18m' || formato === '25m' || formato === '25+18m'

/** Campagna e 3D: si tira per piazzola (3 frecce), niente volée a tempo. */
export const eAPiazzole = (formato: FormatoSimulazione) =>
  formato === '12+12' || formato === '24+24' || formato === '3d'

/** Il timer della volée c'è solo per indoor e outdoor (per campagna e 3D non ci sono tempi). */
export const haTimer = (formato: FormatoSimulazione) => !eAPiazzole(formato)

/** Il bersaglio ha gli anelli (si può toccare sullo schermo). */
export const eBersaglioConAnelli = (b: Bersaglio): b is BersaglioConAnelli =>
  b === 'singolo' || b === 'trispot' || b === '122' || b === '80'

/** Come si chiama il turno di tiro: la "volée" (indoor e outdoor) o la "piazzola" (campagna e 3D). */
export const unitaDiTiro = (
  formato: FormatoSimulazione,
): { minuscolo: string; maiuscolo: string; plurale: string } =>
  eAPiazzole(formato)
    ? { minuscolo: 'piazzola', maiuscolo: 'Piazzola', plurale: 'piazzole' }
    : { minuscolo: 'volée', maiuscolo: 'Volée', plurale: 'volée' }

/** I bersagli tra cui scegliere per un formato. */
export function bersagliAmmessi(formato: FormatoSimulazione): Bersaglio[] {
  if (formato === '3d') return ['3d']
  if (formato === '12+12' || formato === '24+24') return ['campagna']
  return eIndoor(formato) ? ['singolo', 'trispot'] : ['122', '80']
}

const VALORI: Record<Bersaglio, ValoreFreccia[]> = {
  singolo: ['10', '9', '8', '7', '6', '5', '4', '3', '2', '1', 'M'],
  trispot: ['10', '9', '8', '7', '6', 'M'],
  '122': ['X', '10', '9', '8', '7', '6', '5', '4', '3', '2', '1', 'M'],
  '80': ['X', '10', '9', '8', '7', '6', '5', 'M'],
  campagna: ['6', '5', '4', '3', '2', '1', 'M'],
  '3d': ['11', '10', '8', '5', 'M'],
}

/** I valori che si possono segnare su un bersaglio, nell'ordine del tastierino. */
export const valoriAmmessi = (bersaglio: Bersaglio): readonly ValoreFreccia[] => VALORI[bersaglio]

/** Quanti punti vale una freccia (la X vale 10, la M zero). */
export const puntiFreccia = (v: ValoreFreccia): number =>
  v === 'X' ? 10 : v === 'M' ? 0 : Number(v)

/** Una prova: una serie di volée alla stessa distanza. */
export interface Prova {
  /** In metri: 18, 25, 70, 60 o 50. `null` per campagna e 3D (non hanno una distanza sola). */
  distanza: number | null
  frecceTotali: number
  frecceVolee: number
  /** Quante frecce ha ognuno dei due parziali. */
  frecceParziale: number
}

const PROVA_INDOOR = { frecceTotali: 60, frecceVolee: 3, frecceParziale: 30 }
const PROVA_OUTDOOR = { frecceTotali: 72, frecceVolee: 6, frecceParziale: 36 }
// Campagna e 3D: 3 frecce a piazzola. 12+12 e 3D = 24 piazzole; 24+24 = 48 piazzole (due metà da 24).
const PROVA_CAMPAGNA_12 = { distanza: null, frecceTotali: 72, frecceVolee: 3, frecceParziale: 36 }
const PROVA_CAMPAGNA_24 = { distanza: null, frecceTotali: 144, frecceVolee: 3, frecceParziale: 72 }
const PROVA_3D = { distanza: null, frecceTotali: 72, frecceVolee: 3, frecceParziale: 36 }

/** Le prove di un formato, nell'ordine in cui si tirano. */
export function proveDelFormato(
  formato: FormatoSimulazione,
  distanza: DistanzaOutdoor | null = null,
): Prova[] {
  const d = distanza ?? 70
  switch (formato) {
    case '18m':
      return [{ distanza: 18, ...PROVA_INDOOR }]
    case '25m':
      return [{ distanza: 25, ...PROVA_INDOOR }]
    case '25+18m':
      return [
        { distanza: 25, ...PROVA_INDOOR },
        { distanza: 18, ...PROVA_INDOOR },
      ]
    case '70m':
      return [{ distanza: d, ...PROVA_OUTDOOR }]
    case 'doppio70m':
      return [
        { distanza: d, ...PROVA_OUTDOOR },
        { distanza: d, ...PROVA_OUTDOOR },
      ]
    case '12+12':
      return [{ ...PROVA_CAMPAGNA_12 }]
    case '24+24':
      return [{ ...PROVA_CAMPAGNA_24 }]
    case '3d':
      return [{ ...PROVA_3D }]
  }
}

type FormaSimulazione = Pick<Simulazione, 'formato' | 'distanza' | 'bersaglio' | 'frecce'>

/** "18 m", "25+18 m", "70 m", "Doppio 60 m". */
export function nomeSimulazione(s: Pick<Simulazione, 'formato' | 'distanza'>): string {
  if (s.formato === '70m') return `${s.distanza ?? 70} m`
  if (s.formato === 'doppio70m') return `Doppio ${s.distanza ?? 70} m`
  return ETICHETTE_FORMATO[s.formato]
}

export const frecceTotaliSimulazione = (s: Pick<FormaSimulazione, 'formato' | 'distanza'>) =>
  proveDelFormato(s.formato, s.distanza).reduce((somma, p) => somma + p.frecceTotali, 0)

/**
 * In fondo al punteggio (come i PDF Fitarco): "10 e 9" all'indoor, "10+X e X" all'outdoor, "6 e 5" alla
 * campagna, "11 e 10" al 3D.
 */
export function etichetteConteggi(formato: FormatoSimulazione): [string, string] {
  if (formato === '3d') return ['11', '10']
  if (formato === '12+12' || formato === '24+24') return ['6', '5']
  return eIndoor(formato) ? ['10', '9'] : ['10+X', 'X']
}

export interface VoleeCalcolata {
  frecce: ValoreFreccia[]
  totale: number
}

export interface ProvaCalcolata {
  prova: Prova
  volee: VoleeCalcolata[]
  /** I due parziali (la seconda metà di una prova incompleta può essere zero). */
  parziali: [number, number]
  totale: number
  frecceSegnate: number
}

export interface RiepilogoSimulazione {
  prove: ProvaCalcolata[]
  totale: number
  /** I due conteggi in fondo (vedi `etichetteConteggi`). */
  conteggi: [number, number]
  frecceSegnate: number
  frecceTotali: number
  /** Tutte le frecce sono state segnate. */
  completa: boolean
  /** Punti per freccia, con un decimale; `null` senza frecce. */
  media: number | null
}

const somma = (frecce: readonly ValoreFreccia[]) => frecce.reduce((s, v) => s + puntiFreccia(v), 0)

/** Punteggi, parziali, conteggi e media di una simulazione (anche a metà). */
export function riepilogoSimulazione(s: FormaSimulazione): RiepilogoSimulazione {
  const prove = proveDelFormato(s.formato, s.distanza)
  let resto = [...s.frecce]
  const calcolate: ProvaCalcolata[] = prove.map((prova) => {
    const frecce = resto.slice(0, prova.frecceTotali)
    resto = resto.slice(prova.frecceTotali)
    const volee: VoleeCalcolata[] = []
    for (let i = 0; i < frecce.length; i += prova.frecceVolee) {
      const v = frecce.slice(i, i + prova.frecceVolee)
      volee.push({ frecce: v, totale: somma(v) })
    }
    return {
      prova,
      volee,
      parziali: [
        somma(frecce.slice(0, prova.frecceParziale)),
        somma(frecce.slice(prova.frecceParziale)),
      ],
      totale: somma(frecce),
      frecceSegnate: frecce.length,
    }
  })
  const tutte = s.frecce.slice(0, frecceTotaliSimulazione(s))
  const conta = (...valori: ValoreFreccia[]) => tutte.filter((v) => valori.includes(v)).length
  const conteggi: [number, number] =
    s.formato === '3d'
      ? [conta('11'), conta('10')]
      : eAPiazzole(s.formato)
        ? [conta('6'), conta('5')]
        : eIndoor(s.formato)
          ? [conta('10'), conta('9')]
          : [conta('10', 'X'), conta('X')]
  const totale = calcolate.reduce((t, p) => t + p.totale, 0)
  return {
    prove: calcolate,
    totale,
    conteggi,
    frecceSegnate: tutte.length,
    frecceTotali: frecceTotaliSimulazione(s),
    completa: tutte.length === frecceTotaliSimulazione(s),
    media: tutte.length === 0 ? null : Math.round((totale / tutte.length) * 10) / 10,
  }
}

/** Dove si è arrivati a tirare. */
export interface StatoTiro {
  /** Indice della prova (0 = la prima) e quante sono. */
  prova: number
  prove: number
  /** Volée in corso dentro la prova (da 1) e quante ne ha la prova. */
  volee: number
  voleeTotali: number
  /** Posizione della prossima freccia dentro la volée (da 0). */
  frecciaInVolee: number
  /** Distanza della prova in corso (`null` per campagna e 3D). */
  distanza: number | null
  finita: boolean
}

/** Prova, volée e freccia a cui si è arrivati, e cosa viene dopo. */
export function statoTiro(s: FormaSimulazione): StatoTiro {
  const prove = proveDelFormato(s.formato, s.distanza)
  const totali = frecceTotaliSimulazione(s)
  const segnate = Math.min(s.frecce.length, totali)
  let prima = 0
  for (let i = 0; i < prove.length; i++) {
    const p = prove[i]!
    const dentro = segnate - prima
    if (dentro < p.frecceTotali || i === prove.length - 1) {
      const posizione = Math.min(dentro, p.frecceTotali - 1)
      const finita = segnate >= totali
      const volee = Math.floor((finita ? p.frecceTotali - 1 : posizione) / p.frecceVolee)
      return {
        prova: i,
        prove: prove.length,
        volee: volee + 1,
        voleeTotali: p.frecceTotali / p.frecceVolee,
        frecciaInVolee: finita ? p.frecceVolee - 1 : posizione % p.frecceVolee,
        distanza: p.distanza,
        finita,
      }
    }
    prima += p.frecceTotali
  }
  // Non si arriva qui (c'è sempre almeno una prova), ma il tipo lo chiede.
  throw new Error('Simulazione senza prove')
}

/** Aggiunge la prossima freccia. `null` se il valore non è ammesso su questo bersaglio o la gara è finita. */
export function aggiungiFreccia(
  s: FormaSimulazione,
  valore: ValoreFreccia,
): ValoreFreccia[] | null {
  if (!VALORI[s.bersaglio].includes(valore)) return null
  if (s.frecce.length >= frecceTotaliSimulazione(s)) return null
  return [...s.frecce, valore]
}

/** Cambia una freccia già segnata. `null` se l'indice o il valore non vanno bene. */
export function correggiFreccia(
  s: FormaSimulazione,
  indice: number,
  valore: ValoreFreccia,
): ValoreFreccia[] | null {
  if (!VALORI[s.bersaglio].includes(valore)) return null
  if (!Number.isInteger(indice) || indice < 0 || indice >= s.frecce.length) return null
  return s.frecce.map((v, i) => (i === indice ? valore : v))
}

/** Toglie l'ultima freccia segnata (per rimediare a un tocco sbagliato). */
export const togliUltimaFreccia = (s: Pick<FormaSimulazione, 'frecce'>): ValoreFreccia[] =>
  s.frecce.slice(0, -1)

/** Le frecce di una simulazione con quelle dei giorni, per il riepilogo della settimana (senza le cancellate). */
export function frecceDelleSimulazioni(
  simulazioni: readonly Pick<
    Simulazione,
    'giorno' | 'frecce' | 'eliminata' | 'formato' | 'distanza'
  >[],
): { giorno: string; frecce: number }[] {
  return simulazioni
    .filter((s) => !s.eliminata)
    .map((s) => ({
      giorno: s.giorno,
      frecce: Math.min(s.frecce.length, frecceTotaliSimulazione(s)),
    }))
}

/** Le simulazioni da mostrare: non cancellate, le più recenti per prime. */
export const simulazioniVisibili = <T extends Pick<Simulazione, 'eliminata' | 'creata_il'>>(
  simulazioni: readonly T[],
): T[] =>
  simulazioni.filter((s) => !s.eliminata).sort((a, b) => b.creata_il.localeCompare(a.creata_il))

/** Quanto può essere lunga la nota di una volée. */
export const NOTA_VOLEE_MASSIMA = 500

/**
 * La nota di una volée (facoltativa). Le note stanno in un oggetto `{ "3": "vento forte" }`: la chiave è il
 * numero della volée contato da zero su tutta la simulazione (nel 25+18 la prima volée dei 18 m è la 20).
 */
export const notaVolee = (s: Pick<Simulazione, 'note'>, indice: number): string =>
  s.note?.[String(indice)] ?? ''

/** Le note con la nota di una volée cambiata; il testo vuoto la toglie. Non modifica l'originale. */
export function impostaNotaVolee(
  note: Record<string, string> | undefined,
  indice: number,
  testo: string,
): Record<string, string> {
  const nuove = { ...note }
  const pulita = testo.slice(0, NOTA_VOLEE_MASSIMA)
  if (pulita.trim() === '') delete nuove[String(indice)]
  else nuove[String(indice)] = pulita
  return nuove
}

/** Le frecce con la posizione in cui sono arrivate (quando si segna toccando il bersaglio). */
export interface FrecceEPosizioni {
  frecce: ValoreFreccia[]
  /** Una per freccia: il punto toccato, o `null` se la freccia è stata segnata con il tastierino. */
  posizioni: (Posizione | null)[]
}

/** Le posizioni portate alla stessa lunghezza delle frecce (le mancanti sono `null`). */
export const allineaPosizioni = (
  posizioni: readonly (Posizione | null)[] | undefined,
  quante: number,
): (Posizione | null)[] => Array.from({ length: quante }, (_, i) => posizioni?.[i] ?? null)

type ConPosizioni = FormaSimulazione & Pick<Simulazione, 'posizioni'>

/** Come `aggiungiFreccia`, tenendo anche la posizione toccata (`null` con il tastierino). */
export function aggiungiFrecciaConPosizione(
  s: ConPosizioni,
  valore: ValoreFreccia,
  posizione: Posizione | null,
): FrecceEPosizioni | null {
  const frecce = aggiungiFreccia(s, valore)
  if (frecce === null) return null
  return { frecce, posizioni: [...allineaPosizioni(s.posizioni, s.frecce.length), posizione] }
}

/** Come `correggiFreccia`, cambiando anche la posizione (`null` se si corregge con il tastierino). */
export function correggiFrecciaConPosizione(
  s: ConPosizioni,
  indice: number,
  valore: ValoreFreccia,
  posizione: Posizione | null,
): FrecceEPosizioni | null {
  const frecce = correggiFreccia(s, indice, valore)
  if (frecce === null) return null
  const posizioni = allineaPosizioni(s.posizioni, s.frecce.length)
  posizioni[indice] = posizione
  return { frecce, posizioni }
}

/** Toglie l'ultima freccia e la sua posizione. */
export const togliUltimaConPosizione = (s: ConPosizioni): FrecceEPosizioni => ({
  frecce: togliUltimaFreccia(s),
  posizioni: allineaPosizioni(s.posizioni, s.frecce.length).slice(0, -1),
})
