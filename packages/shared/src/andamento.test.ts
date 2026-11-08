import { describe, expect, it } from 'vitest'
import { assePunteggi, medieAnnuali, serieAndamento } from './andamento'
import type { ProvaGara } from './atleti'

const p = (
  chiave: string,
  totale: number,
  data: string,
  divisione = 'OL',
  codice = `G${data}`,
): ProvaGara => {
  const [famiglia, prova] = chiave.split(':') as ['indoor' | 'outdoor', string]
  return {
    chiave,
    famiglia,
    prova,
    divisione,
    gara_codice: codice,
    data,
    totale,
    provvisoria: false,
  }
}

describe('serieAndamento', () => {
  it('una serie per prova e arco, con almeno due punteggi, in ordine di data', () => {
    const serie = serieAndamento([
      p('indoor:18m', 540, '2026-02-01'),
      p('indoor:18m', 520, '2025-01-10'),
      p('indoor:18m', 500, '2026-03-01', 'CO'),
      p('outdoor:70m', 600, '2026-06-01'),
      p('outdoor:70m', 610, '2026-07-01'),
    ])
    expect(serie.map((s) => [s.id, s.etichetta, s.punti.map((x) => x.totale)])).toEqual([
      ['indoor:18m|OL', '18 m · Ricurvo', [520, 540]],
      ['outdoor:70m|OL', '70 m · Ricurvo', [600, 610]],
    ])
  })

  it('a parità di data si ordina per codice gara; con un solo punteggio non c’è andamento', () => {
    const serie = serieAndamento([
      p('indoor:18m', 530, '2026-02-01', 'OL', 'GB'),
      p('indoor:18m', 520, '2026-02-01', 'OL', 'GA'),
      p('indoor:25m', 500, '2026-02-01'),
    ])
    expect(serie).toHaveLength(1)
    expect(serie[0]!.punti.map((x) => x.gara_codice)).toEqual(['GA', 'GB'])
    expect(serieAndamento([])).toEqual([])
  })
})

describe('medieAnnuali', () => {
  it('media per anno solare con un decimale, dall’anno più recente', () => {
    const medie = medieAnnuali([
      p('indoor:18m', 540, '2026-02-01'),
      p('indoor:18m', 531, '2026-03-01'),
      p('indoor:18m', 520, '2025-01-10'),
    ])
    expect(medie).toEqual([
      { anno: 2026, media: 535.5, gare: 2 },
      { anno: 2025, media: 520, gare: 1 },
    ])
  })

  it('arrotonda a un decimale', () => {
    expect(
      medieAnnuali([
        p('indoor:18m', 500, '2026-01-01'),
        p('indoor:18m', 501, '2026-01-02'),
        p('indoor:18m', 501, '2026-01-03'),
      ])[0]!.media,
    ).toBe(500.7)
  })

  it('senza punteggi: nessuna media', () => {
    expect(medieAnnuali([])).toEqual([])
  })
})

describe('assePunteggi', () => {
  it('estremi tondi che contengono tutti i valori, con 3-5 tacche', () => {
    const { min, max, tacche } = assePunteggi([520, 548, 561])
    expect(min).toBeLessThanOrEqual(520)
    expect(max).toBeGreaterThanOrEqual(561)
    expect(tacche[0]).toBe(min)
    expect(tacche.at(-1)).toBe(max)
    expect(tacche.length).toBeGreaterThanOrEqual(3)
    expect(tacche.length).toBeLessThanOrEqual(6)
  })

  it('tutti uguali: un asse con almeno un passo', () => {
    const { min, max, tacche } = assePunteggi([540, 540])
    expect(max).toBeGreaterThan(min)
    expect(min).toBeLessThanOrEqual(540)
    expect(max).toBeGreaterThanOrEqual(540)
    expect(tacche.length).toBeGreaterThanOrEqual(2)
  })

  it('valori molto vicini o molto distanti', () => {
    expect(assePunteggi([100, 101]).tacche.length).toBeGreaterThanOrEqual(2)
    const grande = assePunteggi([200, 1290])
    expect(grande.min).toBeLessThanOrEqual(200)
    expect(grande.max).toBeGreaterThanOrEqual(1290)
  })
})
