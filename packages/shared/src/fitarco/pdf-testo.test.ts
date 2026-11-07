import { describe, expect, it } from 'vitest'
import { componiRighe, ErroreFormatoFitarco, estraiRighe } from '../fitarco'

/**
 * Un PDF minimo costruito qui (nessun dato vero): una pagina con pezzi di testo nelle posizioni date.
 * Riproduce il caso dei PDF Fitarco: pezzi della stessa riga ad altezze leggermente diverse.
 */
function pdfDiProva(pezzi: { testo: string; x: number; y: number }[]): Uint8Array {
  const flusso = pezzi.map((p) => `BT /F1 10 Tf ${p.x} ${p.y} Td (${p.testo}) Tj ET`).join('\n')
  const oggetti = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${flusso.length} >>\nstream\n${flusso}\nendstream`,
  ]
  let testo = '%PDF-1.4\n'
  const posizioni: number[] = []
  oggetti.forEach((o, i) => {
    posizioni.push(testo.length)
    testo += `${i + 1} 0 obj\n${o}\nendobj\n`
  })
  const xref = testo.length
  testo += `xref\n0 ${oggetti.length + 1}\n0000000000 65535 f \n`
  testo += posizioni.map((p) => `${String(p).padStart(10, '0')} 00000 n \n`).join('')
  testo += `trailer\n<< /Size ${oggetti.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return new TextEncoder().encode(testo)
}

describe('dal PDF alle righe di testo', () => {
  it('unisce i pezzi di una riga anche se sono ad altezze leggermente diverse', () => {
    const righe = componiRighe(1, [
      { testo: '552', x: 400, y: 716 },
      { testo: 'PROVA Mario', x: 100, y: 717 },
      { testo: '1', x: 20, y: 716 },
      { testo: '  ', x: 50, y: 716 },
      { testo: '2', x: 20, y: 705 },
    ])
    expect(righe).toEqual([
      { pagina: 1, y: 717, testo: '1 PROVA Mario 552' },
      { pagina: 1, y: 705, testo: '2' },
    ])
  })

  it('legge un PDF vero e proprio', async () => {
    const righe = await estraiRighe(
      pdfDiProva([
        { testo: 'Gara di prova', x: 50, y: 800 },
        { testo: '280/ 1', x: 300, y: 717 },
        { testo: 'PROVA Mario', x: 80, y: 716 },
        { testo: '1', x: 30, y: 716 },
        { testo: 'Seconda pagina?', x: 50, y: 600 },
      ]),
    )
    expect(righe.map((r) => r.testo)).toEqual([
      'Gara di prova',
      '1 PROVA Mario 280/ 1',
      'Seconda pagina?',
    ])
    expect(righe.map((r) => r.pagina)).toEqual([1, 1, 1])
  })

  it('si ferma se il file non è un PDF (es. pagina "404" di una gara annullata)', async () => {
    const html = new TextEncoder().encode('<!DOCTYPE HTML><title>404 Not Found</title>')
    await expect(estraiRighe(html)).rejects.toThrow(ErroreFormatoFitarco)
  })
})
