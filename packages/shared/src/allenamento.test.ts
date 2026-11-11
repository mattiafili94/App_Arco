import { describe, expect, it } from 'vitest'
import {
  programmiDaCopiare,
  aggiungiGiorni,
  copiaProgrammaSettimana,
  descriviSettimana,
  etichettaGiorno,
  frecceDelGiorno,
  giornoDellaSettimana,
  giornoVuoto,
  giorniDellaSettimana,
  inizioSettimana,
  leggiFrecce,
  nomeGiorno,
  riepilogoSettimana,
  type GiornoAllenamento,
} from './allenamento'

const g = (giorno: string, dati: Partial<GiornoAllenamento> = {}): GiornoAllenamento => ({
  atleta_id: 'a1',
  giorno,
  programma: '',
  fatto: false,
  frecce_libere: 0,
  nota: '',
  modificato_il: '2026-11-10T10:00:00.000Z',
  ...dati,
})

describe('giorni e settimane', () => {
  it('aggiungere giorni, anche a cavallo di mesi, anni e ora legale', () => {
    expect(aggiungiGiorni('2026-11-10', 7)).toBe('2026-11-17')
    expect(aggiungiGiorni('2026-11-28', 5)).toBe('2026-12-03')
    expect(aggiungiGiorni('2026-12-30', 3)).toBe('2027-01-02')
    expect(aggiungiGiorni('2026-03-01', -1)).toBe('2026-02-28')
    // Cambio dell'ora legale (29 marzo 2026): i giorni restano 24 ore di calendario.
    expect(aggiungiGiorni('2026-03-28', 2)).toBe('2026-03-30')
    expect(aggiungiGiorni('2026-10-24', 2)).toBe('2026-10-26')
  })

  it('giorno della settimana: lunedì è 1, domenica è 7', () => {
    expect(giornoDellaSettimana('2026-11-09')).toBe(1) // lunedì
    expect(giornoDellaSettimana('2026-11-15')).toBe(7) // domenica
    expect(giornoDellaSettimana('2026-11-10')).toBe(2)
  })

  it('la settimana inizia di lunedì', () => {
    expect(inizioSettimana('2026-11-09')).toBe('2026-11-09')
    expect(inizioSettimana('2026-11-15')).toBe('2026-11-09')
    expect(inizioSettimana('2026-11-16')).toBe('2026-11-16')
    expect(inizioSettimana('2027-01-01')).toBe('2026-12-28') // a cavallo d'anno
  })

  it('i sette giorni, da lunedì a domenica', () => {
    const giorni = giorniDellaSettimana('2026-11-09')
    expect(giorni).toHaveLength(7)
    expect(giorni[0]).toBe('2026-11-09')
    expect(giorni[6]).toBe('2026-11-15')
    expect(giorni.map(nomeGiorno)).toEqual([
      'Lunedì',
      'Martedì',
      'Mercoledì',
      'Giovedì',
      'Venerdì',
      'Sabato',
      'Domenica',
    ])
  })

  it('testi: giorno e settimana', () => {
    expect(etichettaGiorno('2026-11-10', 2026)).toBe('Martedì 10 nov')
    expect(etichettaGiorno('2025-12-31')).toBe('Mercoledì 31 dic 2025')
    expect(descriviSettimana('2026-11-09')).toBe('9–15 nov 2026')
    expect(descriviSettimana('2026-11-09', 2026)).toBe('9–15 nov')
    expect(descriviSettimana('2026-10-26')).toBe('26 ott – 1 nov 2026')
  })
})

describe('giorno vuoto e frecce', () => {
  it('un giorno è vuoto se non ha niente dentro', () => {
    expect(giornoVuoto(g('2026-11-09'))).toBe(true)
    expect(giornoVuoto(g('2026-11-09', { programma: 'x' }))).toBe(false)
    expect(giornoVuoto(g('2026-11-09', { nota: 'x' }))).toBe(false)
    expect(giornoVuoto(g('2026-11-09', { fatto: true }))).toBe(false)
    expect(giornoVuoto(g('2026-11-09', { frecce_libere: 10 }))).toBe(false)
  })

  it('le frecce del giorno: libere più simulazioni, anche senza giorno scritto', () => {
    expect(frecceDelGiorno(g('2026-11-09', { frecce_libere: 100 }), 100)).toBe(200)
    expect(frecceDelGiorno(g('2026-11-09', { frecce_libere: 60 }))).toBe(60)
    expect(frecceDelGiorno(undefined, 60)).toBe(60)
    expect(frecceDelGiorno(undefined)).toBe(0)
  })

  it('leggere le frecce scritte a mano', () => {
    expect(leggiFrecce('120')).toBe(120)
    expect(leggiFrecce(' 120 ')).toBe(120)
    expect(leggiFrecce('')).toBe(0)
    expect(leggiFrecce('0')).toBe(0)
    expect(leggiFrecce('9999')).toBe(9999)
    expect(leggiFrecce('10000')).toBeNull()
    expect(leggiFrecce('-5')).toBeNull()
    expect(leggiFrecce('12,5')).toBeNull()
    expect(leggiFrecce('abc')).toBeNull()
  })
})

describe('riepilogo della settimana', () => {
  const settimana = [
    g('2026-11-09', { frecce_libere: 100, fatto: true }),
    g('2026-11-10', { fatto: true }),
    g('2026-11-11', { programma: 'riposo' }),
    g('2026-11-12', { frecce_libere: 60 }),
  ]

  it('frecce libere e giorni allenati (spunta o frecce)', () => {
    expect(riepilogoSettimana(settimana)).toEqual({
      frecceLibere: 160,
      frecceSimulazioni: 0,
      frecceTotali: 160,
      giorniAllenati: 3,
    })
  })

  it('con le simulazioni: si sommano senza contare due volte il giorno', () => {
    const r = riepilogoSettimana(settimana, [
      { giorno: '2026-11-09', frecce: 100 }, // stesso giorno delle frecce libere: un solo giorno allenato
      { giorno: '2026-11-13', frecce: 60 }, // un giorno senza altro
      { giorno: '2026-11-14', frecce: 0 }, // simulazione senza frecce: non conta come allenamento
    ])
    expect(r).toEqual({
      frecceLibere: 160,
      frecceSimulazioni: 160,
      frecceTotali: 320,
      giorniAllenati: 4,
    })
  })

  it('settimana vuota', () => {
    expect(riepilogoSettimana([])).toEqual({
      frecceLibere: 0,
      frecceSimulazioni: 0,
      frecceTotali: 0,
      giorniAllenati: 0,
    })
  })
})

describe('copia la settimana scorsa', () => {
  const scorsa = [
    g('2026-11-02', {
      programma: '60 frecce a 18 m',
      fatto: true,
      frecce_libere: 60,
      nota: 'bene',
    }),
    g('2026-11-03'),
    g('2026-11-04', { programma: 'riposo' }),
    g('2026-11-06', { programma: 'gara' }),
  ]

  it('copia solo i programmi, spostati di sette giorni e in ordine', () => {
    expect(copiaProgrammaSettimana(scorsa, [])).toEqual([
      { giorno: '2026-11-09', programma: '60 frecce a 18 m' },
      { giorno: '2026-11-11', programma: 'riposo' },
      { giorno: '2026-11-13', programma: 'gara' },
    ])
  })

  it('non sovrascrive i giorni che hanno già un programma', () => {
    const attuale = [g('2026-11-09', { programma: 'già scritto' }), g('2026-11-11')]
    expect(copiaProgrammaSettimana(scorsa, attuale).map((c) => c.giorno)).toEqual([
      '2026-11-11',
      '2026-11-13',
    ])
  })

  it('una settimana scorsa vuota non copia niente', () => {
    expect(
      copiaProgrammaSettimana([g('2026-11-02'), g('2026-11-03', { fatto: true })], []),
    ).toEqual([])
  })
})

describe('copia del programma su un altro atleta', () => {
  const g = (giorno: string, programma: string) => ({ giorno, programma })
  const sorgente = [
    g('2026-11-16', '60 frecce a 18 m'),
    g('2026-11-17', ''),
    g('2026-11-18', 'Riposo attivo'),
    g('2026-11-19', 'Simulazione 18 m'),
  ]

  it('copia i programmi negli stessi giorni, saltando quelli vuoti', () => {
    expect(programmiDaCopiare(sorgente, [], false)).toEqual([
      g('2026-11-16', '60 frecce a 18 m'),
      g('2026-11-18', 'Riposo attivo'),
      g('2026-11-19', 'Simulazione 18 m'),
    ])
  })

  it('i giorni già scritti restano com’erano, a meno di sostituirli', () => {
    const destinazione = [g('2026-11-16', 'Il suo programma'), g('2026-11-18', '  ')]
    expect(programmiDaCopiare(sorgente, destinazione, false).map((x) => x.giorno)).toEqual([
      '2026-11-18',
      '2026-11-19',
    ])
    expect(programmiDaCopiare(sorgente, destinazione, true).map((x) => x.giorno)).toEqual([
      '2026-11-16',
      '2026-11-18',
      '2026-11-19',
    ])
  })

  it('un programma già uguale non si riscrive', () => {
    expect(programmiDaCopiare(sorgente, [g('2026-11-19', 'Simulazione 18 m')], true)).toHaveLength(
      2,
    )
  })
})
