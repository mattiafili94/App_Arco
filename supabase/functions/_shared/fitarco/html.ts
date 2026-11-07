/** Strumenti comuni per leggere l'HTML delle risposte Fitarco. */
import { parse, type HTMLElement } from 'node-html-parser'

export type { HTMLElement }

/**
 * Il formato di una risposta non è quello atteso (Fitarco ha cambiato qualcosa?).
 * Meglio fermarsi e avvisare che salvare dati sbagliati (la "sentinella").
 */
export class ErroreFormatoFitarco extends Error {
  constructor(messaggio: string) {
    super(messaggio)
    this.name = 'ErroreFormatoFitarco'
  }
}

export function analizza(html: string): HTMLElement {
  return parse(html)
}

/** Testo visibile di un elemento, con gli spazi sistemati. */
export function testo(el: HTMLElement | null | undefined): string {
  return el ? el.text.replace(/\s+/g, ' ').trim() : ''
}

/** "03/01/2026" → "2026-01-03". */
export function dataItaliana(valore: string): string {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(valore.trim())
  if (!m) throw new ErroreFormatoFitarco(`Data non riconosciuta: "${valore}"`)
  return `${m[3]}-${m[2]}-${m[1]}`
}

const MESI_BREVI: Record<string, string> = {
  gen: '01',
  feb: '02',
  mar: '03',
  apr: '04',
  mag: '05',
  giu: '06',
  lug: '07',
  ago: '08',
  set: '09',
  ott: '10',
  nov: '11',
  dic: '12',
}

/** "24 Ott 2026" → "2026-10-24". */
export function dataConMese(valore: string): string {
  const m = /^(\d{1,2}) ([a-z]{3})[a-z]* (\d{4})$/i.exec(valore.replace(/\s+/g, ' ').trim())
  const mese = m && MESI_BREVI[m[2]!.toLowerCase()]
  if (!m || !mese) throw new ErroreFormatoFitarco(`Data non riconosciuta: "${valore}"`)
  return `${m[3]}-${mese}-${m[1]!.padStart(2, '0')}`
}

/** "1.107" → 1107; "" → null. */
export function numero(valore: string): number | null {
  const pulito = valore.replace(/\./g, '').trim()
  if (pulito === '') return null
  if (!/^\d+$/.test(pulito)) throw new ErroreFormatoFitarco(`Numero non riconosciuto: "${valore}"`)
  return Number(pulito)
}

export interface Societa {
  codice: string
  nome: string
}

/** Società da un blocco tipo `<a data-call="dett_soc">11003</a> - Arcieri Eugubini`. */
export function societa(el: HTMLElement | null | undefined): Societa {
  const link = el?.querySelector('[data-call="dett_soc"]')
  const codice = link?.getAttribute('data-id')?.trim() ?? ''
  if (!el || !/^\d{5}$/.test(codice)) throw new ErroreFormatoFitarco('Società senza codice')
  let nome = testo(el)
  // Toglie l'etichetta della colonna ("Società", "Società Organizzatrice") e il codice.
  for (const etichetta of el.querySelectorAll('.head, .lbl'))
    nome = nome.replace(testo(etichetta), '')
  nome = nome
    .replace(codice, '')
    .replace(/^\s*-?\s*/, '')
    .trim()
  return { codice, nome }
}

/**
 * Le righe degli elenchi Fitarco sono `div.tab_row` con colonne `div.tab_col`, ognuna con
 * un'intestazione `span.head` e un valore. Restituisce le colonne per intestazione.
 */
export function colonne(riga: HTMLElement): Map<string, HTMLElement> {
  const mappa = new Map<string, HTMLElement>()
  for (const col of riga.querySelectorAll('.tab_col')) {
    mappa.set(testo(col.querySelector('.head')), col)
  }
  return mappa
}

/** Il valore di una colonna (senza l'intestazione); errore se la colonna manca. */
export function valore(cols: Map<string, HTMLElement>, intestazione: string): string {
  const col = cols.get(intestazione)
  if (!col) throw new ErroreFormatoFitarco(`Manca la colonna "${intestazione}"`)
  const v = col.querySelector('.value')
  return v ? testo(v) : testo(col).replace(intestazione, '').trim()
}

/** Le coppie etichetta/valore delle schede (`span.lbl` + `span.vle`). */
export function etichette(radice: HTMLElement, selettore: string): Map<string, HTMLElement> {
  const mappa = new Map<string, HTMLElement>()
  for (const p of radice.querySelectorAll(selettore)) {
    const lbl = testo(p.querySelector('.lbl'))
    if (lbl) mappa.set(lbl, p)
  }
  return mappa
}

/** Il primo `span.vle` di un'etichetta (testo), errore se l'etichetta manca. */
export function vle(mappa: Map<string, HTMLElement>, etichetta: string): string {
  const p = mappa.get(etichetta)
  if (!p) throw new ErroreFormatoFitarco(`Manca il campo "${etichetta}"`)
  return testo(p.querySelector('.vle'))
}
