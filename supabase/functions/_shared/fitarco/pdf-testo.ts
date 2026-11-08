/**
 * Dal PDF dei risultati alle righe di testo, come le vede una persona.
 *
 * pdf.js (libreria `unpdf`) restituisce i pezzi di testo con la loro posizione. I pezzi di una stessa
 * riga possono avere altezze leggermente diverse (es. 717 e 716): si uniscono quelli a meno di
 * TOLLERANZA_RIGA punti e si ordinano da sinistra a destra. Verificato l'8/11/2026 sui PDF veri:
 * per le gare semplici il risultato è identico a `pdftotext -raw`.
 */
import { getDocumentProxy } from 'unpdf'
import { ErroreFormatoFitarco } from './html.ts'

export interface RigaTesto {
  pagina: number
  /** Altezza nella pagina (più grande = più in alto). Serve ad abbinare le righe delle gare composte. */
  y: number
  testo: string
}

export const TOLLERANZA_RIGA = 3

interface Pezzo {
  testo: string
  x: number
  y: number
}

/** Raggruppa i pezzi di una pagina in righe (dall'alto in basso, da sinistra a destra). */
export function componiRighe(pagina: number, pezzi: Pezzo[]): RigaTesto[] {
  const ordinati = pezzi.filter((p) => p.testo.trim() !== '').sort((a, b) => b.y - a.y || a.x - b.x)
  const gruppi: { y: number; pezzi: Pezzo[] }[] = []
  for (const p of ordinati) {
    const ultimo = gruppi.at(-1)
    if (ultimo && ultimo.y - p.y <= TOLLERANZA_RIGA) ultimo.pezzi.push(p)
    else gruppi.push({ y: p.y, pezzi: [p] })
  }
  return gruppi.map((g) => ({
    pagina,
    y: Math.round(g.y),
    testo: g.pezzi
      .sort((a, b) => a.x - b.x)
      .map((p) => p.testo.trim())
      .join(' ')
      .replace(/\s+/g, ' '),
  }))
}

/** Tutte le righe di testo di un PDF. Errore se il file non è un PDF (es. pagina "404"). */
export async function estraiRighe(dati: Uint8Array): Promise<RigaTesto[]> {
  const intestazione = new TextDecoder().decode(dati.subarray(0, 5))
  if (intestazione !== '%PDF-') throw new ErroreFormatoFitarco('Il file dei risultati non è un PDF')

  // pdf.js "stacca" (consuma) i dati che riceve: gli si passa una copia, così il file resta usabile.
  const pdf = await getDocumentProxy(dati.slice())
  const righe: RigaTesto[] = []
  for (let n = 1; n <= pdf.numPages; n++) {
    const contenuto = await (await pdf.getPage(n)).getTextContent()
    const pezzi = contenuto.items.flatMap((item) =>
      'str' in item ? [{ testo: item.str, x: item.transform[4], y: item.transform[5] }] : [],
    )
    righe.push(...componiRighe(n, pezzi))
  }
  return righe
}
