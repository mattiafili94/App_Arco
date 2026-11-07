/**
 * Tipologie di gara Fitarco e regole per record e statistiche (vedi CLAUDE.md,
 * "Regole di record e statistiche").
 *
 * Una gara può essere composta da più **prove**: record, andamento e medie si
 * calcolano per prova. Esempi: il 25+18 è una prova 25 m + una prova 18 m;
 * il doppio 70 m sono due prove da 70 m; il 24+24 resta una prova unica.
 */

/** Famiglia di gara: corrisponde alla ranking Fitarco in cui la gara conta. */
export type Famiglia = 'indoor' | 'outdoor' | 'campagna' | '3d'

/** Tipo di prova: è la "chiave" dei record personali. */
export type TipoProva = '18m' | '25m' | '70m' | '12+12' | '24+24' | '3d'

export type IdTipologia = '18m' | '25m' | '25+18m' | '70m' | 'doppio70m' | '12+12' | '24+24' | '3d'

export interface Tipologia {
  id: IdTipologia
  /** Nome esatto usato dal sito Fitarco (calendario, scheda atleta). */
  nomeFitarco: string
  /** Nome breve da mostrare nell'app. */
  etichetta: string
  famiglia: Famiglia
  /** Prove di cui è composta la gara, nell'ordine in cui compaiono nel PDF dei risultati. */
  prove: readonly TipoProva[]
}

export const TIPOLOGIE: readonly Tipologia[] = [
  { id: '18m', nomeFitarco: '18 m', etichetta: '18 m', famiglia: 'indoor', prove: ['18m'] },
  { id: '25m', nomeFitarco: '25 m', etichetta: '25 m', famiglia: 'indoor', prove: ['25m'] },
  {
    id: '25+18m',
    nomeFitarco: '25+18 m',
    etichetta: '25+18 m',
    famiglia: 'indoor',
    prove: ['25m', '18m'],
  },
  {
    id: '70m',
    nomeFitarco: '70/60mt Round - 50mt Round',
    etichetta: '70 m',
    famiglia: 'outdoor',
    prove: ['70m'],
  },
  {
    id: 'doppio70m',
    nomeFitarco: 'Doppio 70/60mt Round - Doppio 50mt Round',
    etichetta: 'Doppio 70 m',
    famiglia: 'outdoor',
    prove: ['70m', '70m'],
  },
  { id: '12+12', nomeFitarco: '12+12', etichetta: '12+12', famiglia: 'campagna', prove: ['12+12'] },
  { id: '24+24', nomeFitarco: '24+24', etichetta: '24+24', famiglia: 'campagna', prove: ['24+24'] },
  { id: '3d', nomeFitarco: '3D', etichetta: '3D', famiglia: '3d', prove: ['3d'] },
]

const normalizza = (testo: string): string => testo.trim().replace(/\s+/g, ' ').toLowerCase()

const PER_NOME = new Map(TIPOLOGIE.map((t) => [normalizza(t.nomeFitarco), t]))

/**
 * Riconosce la tipologia a partire dal testo di Fitarco.
 *
 * Ignora l'indicazione degli scontri diretti che il calendario aggiunge in coda
 * (es. "18 m O.R. Individuale+Squadre"). Restituisce `null` per le tipologie che
 * l'app non gestisce (es. "Altro", "Trofeo Pinocchio").
 */
export function riconosciTipologia(testoFitarco: string): Tipologia | null {
  const senzaScontri = testoFitarco.replace(/\s*O\.R\..*$/i, '')
  return PER_NOME.get(normalizza(senzaScontri)) ?? null
}
