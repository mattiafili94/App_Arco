/**
 * Lettore della ranking individuale (`call=ranking_gare`, `render=lista_ranking_gare_results`).
 * La posizione è quella nazionale anche quando si filtra per regione.
 * (La versione "excel" non è JSON valido: si usa questa.)
 */
import {
  analizza,
  colonne,
  dataItaliana,
  ErroreFormatoFitarco,
  numero,
  societa,
  testo,
  valore,
  type HTMLElement,
  type Societa,
} from './html.ts'

export interface GaraRanking {
  codice: string
  punti: number
  localita: string
  /** "AAAA-MM-GG". */
  dal: string
  al: string
}

export interface RigaRanking {
  posizione: number
  matricola: string
  nomeCompleto: string
  societa: Societa
  punti: number
  /** Le gare che contano per la ranking (di solito le due migliori). */
  gare: GaraRanking[]
}

export interface CategoriaRanking {
  /** "Arco Ricurvo - Seniores Maschile". */
  nome: string
  righe: RigaRanking[]
}

export interface Ranking {
  /** "Numero totale" dichiarato da Fitarco (serve da controllo). */
  totale: number
  categorie: CategoriaRanking[]
}

function leggiGara(subrow: HTMLElement): GaraRanking {
  const link = subrow.querySelector('[data-call="dett_gara"]')
  const t = testo(subrow)
  const m = /^(\d+)\s*-.*\((\d{2}\/\d{2}\/\d{4})\s*-\s*(\d{2}\/\d{2}\/\d{4})\)$/.exec(t)
  const codice = link?.getAttribute('data-id')?.trim()
  if (!m || !codice) throw new ErroreFormatoFitarco(`Gara della ranking non riconosciuta: "${t}"`)
  return {
    codice,
    punti: Number(m[1]),
    localita: testo(link),
    dal: dataItaliana(m[2]!),
    al: dataItaliana(m[3]!),
  }
}

function leggiRiga(riga: HTMLElement): RigaRanking {
  const cols = colonne(riga)
  const arciere = cols.get('Arciere')
  const link = arciere?.querySelector('[data-call="dett_tesserato"]')
  const matricola = link?.getAttribute('data-id')?.trim()
  if (!arciere || !matricola) throw new ErroreFormatoFitarco('Riga della ranking senza matricola')
  const posizione = numero(valore(cols, 'Posizione'))
  const punti = numero(valore(cols, 'Punti'))
  if (posizione === null || punti === null) {
    throw new ErroreFormatoFitarco(`Posizione o punti mancanti per ${matricola}`)
  }
  return {
    posizione,
    matricola,
    nomeCompleto: valore(cols, 'Arciere').replace(matricola, '').trim(),
    societa: societa(cols.get('Società')),
    punti,
    gare: (cols.get('Gare')?.querySelectorAll('.subrow') ?? []).map(leggiGara),
  }
}

export function leggiRanking(html: string): Ranking {
  const radice = analizza(html).querySelector('.ranking')
  if (!radice) throw new ErroreFormatoFitarco('La ranking non ha il contenitore atteso')
  const totale = /(\d+)/.exec(testo(radice.querySelector('h3.sub')))
  if (!totale) throw new ErroreFormatoFitarco('La ranking non dichiara il numero totale')

  // Dentro il contenitore si alternano titoli di categoria (h5.sub) e righe (div.tab_row).
  const categorie: CategoriaRanking[] = []
  for (const el of radice.querySelectorAll('h5.sub, .tab_row')) {
    if (el.tagName === 'H5') categorie.push({ nome: testo(el), righe: [] })
    else {
      const corrente = categorie.at(-1)
      if (!corrente) throw new ErroreFormatoFitarco('Riga della ranking senza categoria')
      corrente.righe.push(leggiRiga(el))
    }
  }
  return { totale: Number(totale[1]), categorie }
}
