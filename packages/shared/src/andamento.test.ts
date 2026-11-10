import { describe, expect, it } from 'vitest'
import {
  anniDellaSerie,
  anniPredefiniti,
  assePunteggi,
  descriviAnni,
  filtraPerAnni,
  idSerie,
  medieAnnuali,
  serieAndamento,
  serieAtleta,
  storicoPerAnnoDellaSerie,
} from './andamento'
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

describe('scheda atleta per prova', () => {
  const prove = [
    p('indoor:18m', 560, '2025-01-10'),
    p('indoor:18m', 570, '2026-02-01'),
    p('indoor:18m', 575, '2026-11-08'),
    p('indoor:25m', 540, '2026-03-01'), // un solo punteggio
    p('outdoor:70m', 600, '2024-06-01', 'CO'),
  ]

  it('tutte le prove con almeno un punteggio, nell’ordine dei record', () => {
    expect(serieAtleta(prove).map((s) => s.etichetta)).toEqual([
      '18 m · Ricurvo',
      '25 m · Ricurvo',
      '70 m · Compound',
    ])
    // L'andamento continua a volerne almeno due.
    expect(serieAndamento(prove).map((s) => s.etichetta)).toEqual(['18 m · Ricurvo'])
  })

  it('l’identificativo della serie', () => {
    expect(idSerie({ chiave: 'indoor:18m', divisione: 'OL' })).toBe('indoor:18m|OL')
  })

  it('gli anni con punteggi, dal più recente', () => {
    expect(anniDellaSerie(prove)).toEqual([2026, 2025, 2024])
    expect(anniDellaSerie([])).toEqual([])
  })

  it('anni di partenza: quello in corso, o il più recente con punteggi', () => {
    expect(anniPredefiniti([2026, 2025], '2026-11-10')).toEqual([2026])
    expect(anniPredefiniti([2024], '2026-11-10')).toEqual([2024])
    expect(anniPredefiniti([], '2026-11-10')).toBe('tutti')
  })

  it('filtrare per anni o tutta la carriera', () => {
    const diciotto = prove.slice(0, 3)
    expect(filtraPerAnni(diciotto, [2026]).map((x) => x.totale)).toEqual([570, 575])
    expect(filtraPerAnni(diciotto, [2025, 2026])).toHaveLength(3)
    expect(filtraPerAnni(diciotto, [])).toEqual([])
    expect(filtraPerAnni(diciotto, 'tutti')).toHaveLength(3)
  })

  it('descrivere la scelta', () => {
    expect(descriviAnni('tutti')).toBe('Tutta la carriera')
    expect(descriviAnni([2026, 2024])).toBe('2024, 2026')
  })

  it('storico della prova anno per anno, dal più recente', () => {
    const r = storicoPerAnnoDellaSerie(prove.slice(0, 3))
    expect(r.map((a) => [a.anno, a.punti.map((x) => x.totale)])).toEqual([
      [2026, [575, 570]],
      [2025, [560]],
    ])
  })
})
