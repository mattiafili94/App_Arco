import { describe, expect, it } from 'vitest'
import {
  AVVISO_MS,
  DURATA_INDOOR_MS,
  DURATA_OUTDOOR_MS,
  durataTiroMs,
  eventiTimer,
  eventiTra,
  FISCHI,
  formattaTempo,
  PREPARAZIONE_MS,
  statoTimer,
} from './timer'

describe('durata del tiro', () => {
  it('2 minuti all’indoor, 4 all’outdoor', () => {
    expect(durataTiroMs('18m')).toBe(120_000)
    expect(durataTiroMs('25m')).toBe(120_000)
    expect(durataTiroMs('25+18m')).toBe(120_000)
    expect(durataTiroMs('70m')).toBe(240_000)
    expect(durataTiroMs('doppio70m')).toBe(240_000)
  })
})

describe('la sequenza di fischi', () => {
  it('1 fischio all’avvio, 1 al via del tiro, avviso a 30 secondi, 2 fischi alla fine', () => {
    expect(FISCHI).toEqual({ inizio: 1, tiro: 1, avviso: 0, fine: 2 })
    expect(eventiTimer(DURATA_INDOOR_MS)).toEqual([
      { tempo: 0, evento: 'inizio' },
      { tempo: 10_000, evento: 'tiro' },
      { tempo: 100_000, evento: 'avviso' }, // 10 s + 120 s - 30 s
      { tempo: 130_000, evento: 'fine' },
    ])
    expect(eventiTimer(DURATA_OUTDOOR_MS).map((e) => e.tempo)).toEqual([
      0, 10_000, 220_000, 250_000,
    ])
  })

  it('gli eventi tra due istanti: l’inizio è escluso, la fine inclusa; l’avvio solo da -1', () => {
    expect(eventiTra(DURATA_INDOOR_MS, -1, 0)).toEqual(['inizio'])
    expect(eventiTra(DURATA_INDOOR_MS, 0, 9_999)).toEqual([])
    expect(eventiTra(DURATA_INDOOR_MS, 0, 10_000)).toEqual(['tiro'])
    // Un istante in ritardo (il telefono era in pausa): tutti gli eventi saltati arrivano, in ordine.
    expect(eventiTra(DURATA_INDOOR_MS, 5_000, 135_000)).toEqual(['tiro', 'avviso', 'fine'])
    expect(eventiTra(DURATA_INDOOR_MS, 130_000, 140_000)).toEqual([])
  })
})

describe('le fasi', () => {
  const stato = (t: number) => statoTimer(DURATA_INDOOR_MS, t)

  it('preparazione: 10 secondi per andare in linea', () => {
    expect(stato(0)).toEqual({
      fase: 'preparazione',
      restante: PREPARAZIONE_MS,
      etichetta: 'Preparazione',
    })
    expect(stato(9_999).fase).toBe('preparazione')
    expect(stato(9_999).restante).toBe(1)
  })

  it('tiro: parte al secondo fischio e dura 2 minuti', () => {
    expect(stato(10_000)).toEqual({ fase: 'tiro', restante: 120_000, etichetta: 'Tiro' })
    expect(stato(99_999).fase).toBe('tiro')
  })

  it('ultimi 30 secondi', () => {
    expect(stato(100_000)).toEqual({
      fase: 'ultimi30',
      restante: AVVISO_MS,
      etichetta: 'Ultimi 30 secondi',
    })
    expect(stato(129_999).fase).toBe('ultimi30')
  })

  it('tempo scaduto', () => {
    expect(stato(130_000)).toEqual({ fase: 'finito', restante: 0, etichetta: 'Tempo scaduto' })
    expect(stato(500_000).fase).toBe('finito')
  })

  it('all’outdoor il tiro dura 4 minuti', () => {
    expect(statoTimer(DURATA_OUTDOOR_MS, 10_000).restante).toBe(240_000)
    expect(statoTimer(DURATA_OUTDOOR_MS, 219_999).fase).toBe('tiro')
    expect(statoTimer(DURATA_OUTDOOR_MS, 220_000).fase).toBe('ultimi30')
  })
})

describe('formattaTempo', () => {
  it('minuti e secondi, arrotondando per eccesso', () => {
    expect(formattaTempo(120_000)).toBe('2:00')
    expect(formattaTempo(119_001)).toBe('2:00')
    expect(formattaTempo(119_000)).toBe('1:59')
    expect(formattaTempo(7_000)).toBe('0:07')
    expect(formattaTempo(1)).toBe('0:01')
    expect(formattaTempo(0)).toBe('0:00')
    expect(formattaTempo(-50)).toBe('0:00')
    expect(formattaTempo(240_000)).toBe('4:00')
  })
})
