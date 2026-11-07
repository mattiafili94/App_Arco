/** Lettore della ricerca tesserati (`call=tesserati`, `render=lista_tesserati_results`). */
import { analizza, colonne, ErroreFormatoFitarco, societa, valore, type Societa } from './html.ts'

export interface Tesserato {
  matricola: string
  /** "Cognome Nome" come lo scrive Fitarco (non si divide: i cognomi doppi lo renderebbero ambiguo). */
  nomeCompleto: string
  societa: Societa
}

export function leggiTesserati(html: string): Tesserato[] {
  const doc = analizza(html)
  if (!doc.querySelector('.tesserati')) {
    throw new ErroreFormatoFitarco("L'elenco tesserati non ha il contenitore atteso")
  }
  return doc.querySelectorAll('.tab_row').map((riga) => {
    const cols = colonne(riga)
    const matricola = riga
      .querySelector('[data-call="dett_tesserato"]')
      ?.getAttribute('data-id')
      ?.trim()
    if (!matricola) throw new ErroreFormatoFitarco('Tesserato senza matricola')
    return {
      matricola,
      nomeCompleto: valore(cols, 'Cognome e Nome'),
      societa: societa(cols.get('Società')),
    }
  })
}
