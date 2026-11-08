import { describe, expect, it } from 'vitest'
import {
  aggiungiFreccia,
  bersagliAmmessi,
  eAPiazzole,
  eBersaglioConAnelli,
  etichetteConteggi,
  FORMATI,
  frecceTotaliSimulazione,
  haTimer,
  nomeSimulazione,
  proveDelFormato,
  puntiFreccia,
  riepilogoSimulazione,
  statoTiro,
  unitaDiTiro,
  valoriAmmessi,
  type Bersaglio,
  type FormatoSimulazione,
  type Simulazione,
  type ValoreFreccia,
} from './segnapunti'

const sim = (
  formato: FormatoSimulazione,
  bersaglio: Bersaglio,
  frecce: ValoreFreccia[] = [],
): Simulazione => ({
  id: 's1',
  atleta_id: 'a1',
  giorno: '2026-11-15',
  formato,
  distanza: null,
  bersaglio,
  frecce,
  conclusa: false,
  eliminata: false,
  creata_il: '2026-11-15T10:00:00.000Z',
  modificato_il: '2026-11-15T10:00:00.000Z',
})

const ripeti = (v: ValoreFreccia, n: number): ValoreFreccia[] => Array(n).fill(v)

describe('campagna e 3D: struttura', () => {
  it('i formati nuovi sono nell’elenco e a piazzole', () => {
    expect(FORMATI).toEqual(expect.arrayContaining(['12+12', '24+24', '3d']))
    for (const f of ['12+12', '24+24', '3d'] as const) {
      expect(eAPiazzole(f)).toBe(true)
      expect(haTimer(f)).toBe(false)
    }
    for (const f of ['18m', '25m', '25+18m', '70m', 'doppio70m'] as const) {
      expect(eAPiazzole(f)).toBe(false)
      expect(haTimer(f)).toBe(true)
    }
  })

  it('12+12: 24 piazzole da 3 frecce = 72 frecce, una prova sola, due metà da 36', () => {
    expect(proveDelFormato('12+12')).toEqual([
      { distanza: null, frecceTotali: 72, frecceVolee: 3, frecceParziale: 36 },
    ])
    expect(frecceTotaliSimulazione({ formato: '12+12', distanza: null })).toBe(72)
  })

  it('24+24: 48 piazzole = 144 frecce, una prova sola (non si divide), due metà da 72', () => {
    expect(proveDelFormato('24+24')).toEqual([
      { distanza: null, frecceTotali: 144, frecceVolee: 3, frecceParziale: 72 },
    ])
  })

  it('3D: 24 piazzole da 3 frecce = 72 frecce', () => {
    expect(proveDelFormato('3d')).toEqual([
      { distanza: null, frecceTotali: 72, frecceVolee: 3, frecceParziale: 36 },
    ])
  })

  it('la distanza scelta non cambia campagna e 3D', () => {
    expect(proveDelFormato('3d', 50)).toEqual(proveDelFormato('3d'))
  })

  it('i nomi', () => {
    expect(nomeSimulazione({ formato: '12+12', distanza: null })).toBe('Campagna 12+12')
    expect(nomeSimulazione({ formato: '24+24', distanza: null })).toBe('Campagna 24+24')
    expect(nomeSimulazione({ formato: '3d', distanza: null })).toBe('3D')
  })

  it('si chiama piazzola, non volée', () => {
    expect(unitaDiTiro('3d')).toEqual({
      minuscolo: 'piazzola',
      maiuscolo: 'Piazzola',
      plurale: 'piazzole',
    })
    expect(unitaDiTiro('24+24').minuscolo).toBe('piazzola')
    expect(unitaDiTiro('18m')).toEqual({ minuscolo: 'volée', maiuscolo: 'Volée', plurale: 'volée' })
    expect(unitaDiTiro('doppio70m').minuscolo).toBe('volée')
  })
})

describe('campagna e 3D: bersagli e valori', () => {
  it('un solo bersaglio per formato, senza anelli da toccare', () => {
    expect(bersagliAmmessi('12+12')).toEqual(['campagna'])
    expect(bersagliAmmessi('24+24')).toEqual(['campagna'])
    expect(bersagliAmmessi('3d')).toEqual(['3d'])
    expect(eBersaglioConAnelli('campagna')).toBe(false)
    expect(eBersaglioConAnelli('3d')).toBe(false)
    expect(eBersaglioConAnelli('singolo')).toBe(true)
    expect(eBersaglioConAnelli('80')).toBe(true)
  })

  it('campagna: 6…1 e M', () => {
    expect(valoriAmmessi('campagna')).toEqual(['6', '5', '4', '3', '2', '1', 'M'])
  })

  it('3D: 11, 10, 8, 5 e M (zero)', () => {
    expect(valoriAmmessi('3d')).toEqual(['11', '10', '8', '5', 'M'])
    expect(puntiFreccia('11')).toBe(11)
    expect(puntiFreccia('M')).toBe(0)
  })

  it('i conteggi in fondo: 6 e 5 alla campagna, 11 e 10 al 3D', () => {
    expect(etichetteConteggi('12+12')).toEqual(['6', '5'])
    expect(etichetteConteggi('24+24')).toEqual(['6', '5'])
    expect(etichetteConteggi('3d')).toEqual(['11', '10'])
  })

  it('un valore di un altro bersaglio non si segna', () => {
    expect(aggiungiFreccia(sim('12+12', 'campagna'), '10')).toBeNull()
    expect(aggiungiFreccia(sim('12+12', 'campagna'), 'X')).toBeNull()
    expect(aggiungiFreccia(sim('3d', '3d'), '9')).toBeNull()
    expect(aggiungiFreccia(sim('3d', '3d'), '6')).toBeNull()
    expect(aggiungiFreccia(sim('3d', '3d'), '11')).toEqual(['11'])
    expect(aggiungiFreccia(sim('12+12', 'campagna'), '6')).toEqual(['6'])
  })

  it('finita la gara non si aggiunge altro', () => {
    expect(aggiungiFreccia(sim('3d', '3d', ripeti('11', 72)), '5')).toBeNull()
    expect(aggiungiFreccia(sim('24+24', 'campagna', ripeti('6', 143)), '5')).toEqual([
      ...ripeti('6', 143),
      '5',
    ])
    expect(aggiungiFreccia(sim('24+24', 'campagna', ripeti('6', 144)), '5')).toBeNull()
  })
})

describe('campagna e 3D: riepilogo', () => {
  it('12+12 perfetto: 72 frecce da 6 = 432, tutti 6, nessun 5', () => {
    const r = riepilogoSimulazione(sim('12+12', 'campagna', ripeti('6', 72)))
    expect(r.totale).toBe(432)
    expect(r.completa).toBe(true)
    expect(r.conteggi).toEqual([72, 0])
    expect(r.media).toBe(6)
    expect(r.prove).toHaveLength(1)
    expect(r.prove[0]!.volee).toHaveLength(24)
    expect(r.prove[0]!.parziali).toEqual([216, 216])
  })

  it('campagna: parziali (12 Hunter + 12 Field) e conteggi 6 e 5', () => {
    // Prime 36 frecce: 6 e 5 alternati (3 frecce a piazzola: 6,5,6 poi 5,6,5…); seconde 36: tutte 4.
    const prima = Array.from({ length: 36 }, (_, i): ValoreFreccia => (i % 2 === 0 ? '6' : '5'))
    const r = riepilogoSimulazione(sim('12+12', 'campagna', [...prima, ...ripeti('4', 36)]))
    expect(r.prove[0]!.parziali).toEqual([18 * 6 + 18 * 5, 36 * 4])
    expect(r.conteggi).toEqual([18, 18])
    expect(r.totale).toBe(18 * 6 + 18 * 5 + 36 * 4)
  })

  it('24+24: 144 frecce, una prova, parziali da 72', () => {
    const r = riepilogoSimulazione(
      sim('24+24', 'campagna', [...ripeti('5', 72), ...ripeti('M', 72)]),
    )
    expect(r.prove).toHaveLength(1)
    expect(r.prove[0]!.volee).toHaveLength(48)
    expect(r.prove[0]!.parziali).toEqual([360, 0])
    expect(r.frecceTotali).toBe(144)
    expect(r.completa).toBe(true)
    expect(r.conteggi).toEqual([0, 72])
  })

  it('3D: 11 e 10 si contano, l’8, il 5 e la mancata no', () => {
    const r = riepilogoSimulazione(sim('3d', '3d', ['11', '11', '10', '8', '5', 'M']))
    expect(r.totale).toBe(11 + 11 + 10 + 8 + 5)
    expect(r.conteggi).toEqual([2, 1])
    expect(r.prove[0]!.volee.map((v) => v.totale)).toEqual([32, 13])
    expect(r.frecceTotali).toBe(72)
    expect(r.completa).toBe(false)
    expect(r.media).toBe(Math.round(((11 + 11 + 10 + 8 + 5) / 6) * 10) / 10)
  })

  it('3D completo: tutti 11 = 792', () => {
    const r = riepilogoSimulazione(sim('3d', '3d', ripeti('11', 72)))
    expect(r.totale).toBe(792)
    expect(r.completa).toBe(true)
    expect(r.conteggi).toEqual([72, 0])
  })
})

describe('campagna e 3D: dove si è arrivati', () => {
  it('all’inizio: prima piazzola, prima freccia, nessuna distanza', () => {
    const t = statoTiro(sim('3d', '3d'))
    expect(t).toMatchObject({
      prova: 0,
      prove: 1,
      volee: 1,
      voleeTotali: 24,
      frecciaInVolee: 0,
      distanza: null,
      finita: false,
    })
  })

  it('a metà piazzola e alla piazzola dopo', () => {
    expect(statoTiro(sim('12+12', 'campagna', ['6', '5']))).toMatchObject({
      volee: 1,
      frecciaInVolee: 2,
    })
    expect(statoTiro(sim('12+12', 'campagna', ['6', '5', '4']))).toMatchObject({
      volee: 2,
      frecciaInVolee: 0,
    })
  })

  it('24+24: 48 piazzole', () => {
    expect(statoTiro(sim('24+24', 'campagna', ripeti('6', 90)))).toMatchObject({
      volee: 31,
      voleeTotali: 48,
    })
  })

  it('finita la gara: ultima piazzola, finita', () => {
    expect(statoTiro(sim('3d', '3d', ripeti('10', 72)))).toMatchObject({
      volee: 24,
      voleeTotali: 24,
      frecciaInVolee: 2,
      finita: true,
    })
  })
})
