import { describe, expect, it } from 'vitest'
import { componiRighe, ErroreFormatoFitarco, estraiRighe } from '../fitarco'
import { pdfDiProva } from './pdf-di-prova'

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

  it('non consuma il file ricevuto: si può rileggere (pdf.js "stacca" i dati che riceve)', async () => {
    const dati = pdfDiProva([{ testo: 'Gara di prova', x: 50, y: 800 }])
    await estraiRighe(dati)
    expect(dati.byteLength).toBeGreaterThan(0)
    expect((await estraiRighe(dati)).map((r) => r.testo)).toEqual(['Gara di prova'])
  })

  it('si ferma se il file non è un PDF (es. pagina "404" di una gara annullata)', async () => {
    const html = new TextEncoder().encode('<!DOCTYPE HTML><title>404 Not Found</title>')
    await expect(estraiRighe(html)).rejects.toThrow(ErroreFormatoFitarco)
  })
})
