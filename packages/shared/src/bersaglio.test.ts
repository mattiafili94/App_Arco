import { describe, expect, it } from 'vitest'
import {
  anelli,
  arrotondaPosizione,
  DISTANZA_MASSIMA,
  distanzaDalCentro,
  limitaPosizione,
  posizioneValida,
  raggioMancata,
  valoreDaPosizione,
  type Posizione,
} from './bersaglio'
import {
  aggiungiFrecciaConPosizione,
  allineaPosizioni,
  correggiFrecciaConPosizione,
  togliUltimaConPosizione,
  type BersaglioConAnelli,
  type Simulazione,
  type ValoreFreccia,
} from './segnapunti'

const a = (b: BersaglioConAnelli, compound = false) =>
  anelli(b, compound).map((x) => [x.valore, x.raggio])

describe('gli anelli di ogni bersaglio', () => {
  it('singolo indoor: 10 anelli larghi uguale, il 10 al centro; niente X', () => {
    const r = anelli('singolo')
    expect(r.map((x) => x.valore)).toEqual(['10', '9', '8', '7', '6', '5', '4', '3', '2', '1'])
    expect(r[0]!.raggio).toBeCloseTo(0.1)
    expect(r[9]!.raggio).toBeCloseTo(1)
  })

  it('trispot: solo 5 anelli (10…6) che arrivano al bordo', () => {
    const r = anelli('trispot')
    expect(r.map((x) => x.valore)).toEqual(['10', '9', '8', '7', '6'])
    expect(r[0]!.raggio).toBeCloseTo(0.2)
    expect(r[4]!.raggio).toBeCloseTo(1)
  })

  it('122 cm: X (metà del 10) e 10 anelli', () => {
    const r = anelli('122')
    expect(r.map((x) => x.valore)).toEqual(['X', '10', '9', '8', '7', '6', '5', '4', '3', '2', '1'])
    expect(r[0]!.raggio).toBeCloseTo(0.05)
    expect(r[1]!.raggio).toBeCloseTo(0.1)
    expect(r[10]!.raggio).toBeCloseTo(1)
  })

  it('80 cm ridotto: X e anelli da 10 a 5', () => {
    const r = anelli('80')
    expect(r.map((x) => x.valore)).toEqual(['X', '10', '9', '8', '7', '6', '5'])
    expect(r[0]!.raggio).toBeCloseTo(1 / 12)
    expect(r[1]!.raggio).toBeCloseTo(1 / 6)
    expect(r[6]!.raggio).toBeCloseTo(1)
  })

  it('compound indoor: il 10 è solo la metà interna, il resto dell’anello vale 9', () => {
    expect(a('singolo', true).slice(0, 3)).toEqual([
      ['10', 0.05],
      ['9', 0.2],
      ['8', expect.closeTo(0.3)],
    ])
    expect(
      anelli('trispot', true)
        .slice(0, 3)
        .map((x) => [x.valore, x.raggio]),
    ).toEqual([
      ['10', expect.closeTo(0.1)],
      ['9', expect.closeTo(0.4)],
      ['8', expect.closeTo(0.6)],
    ])
    // Gli anelli esterni non cambiano.
    expect(anelli('singolo', true)).toHaveLength(10)
    expect(anelli('singolo', true).at(-1)!.raggio).toBeCloseTo(1)
  })

  it('compound all’outdoor: non cambia niente (c’è la X)', () => {
    expect(anelli('122', true)).toEqual(anelli('122', false))
    expect(anelli('80', true)).toEqual(anelli('80', false))
  })
})

describe('il valore dal punto toccato', () => {
  const v = (b: BersaglioConAnelli, x: number, y: number, compound = false) =>
    valoreDaPosizione(b, compound, [x, y])

  it('il centro vale il massimo, e la distanza conta in tutte le direzioni', () => {
    expect(v('singolo', 0, 0)).toBe('10')
    expect(v('122', 0, 0)).toBe('X')
    expect(v('singolo', 0.05, 0.05)).toBe('10') // r = 0,0707
    expect(v('singolo', 0.1, 0.1)).toBe('9') // r = 0,1414
    expect(v('singolo', -0.15, 0)).toBe('9')
    expect(v('singolo', 0, -0.15)).toBe('9')
  })

  it('singolo: un anello per volta fino al bordo, poi M', () => {
    expect(v('singolo', 0.25, 0)).toBe('8')
    expect(v('singolo', 0.95, 0)).toBe('1')
    expect(v('singolo', 1, 0)).toBe('1') // sul filo vale l'anello più alto
    expect(v('singolo', 1.01, 0)).toBe('M')
    expect(v('singolo', 3, 0)).toBe('M')
  })

  it('trispot: il bordo vale 6, fuori è mancata', () => {
    expect(v('trispot', 0.1, 0)).toBe('10')
    expect(v('trispot', 0.3, 0)).toBe('9')
    expect(v('trispot', 0.9, 0)).toBe('6')
    expect(v('trispot', 1.1, 0)).toBe('M')
  })

  it('122 cm: la X è la metà del 10', () => {
    expect(v('122', 0.04, 0)).toBe('X')
    expect(v('122', 0.07, 0)).toBe('10')
    expect(v('122', 0.15, 0)).toBe('9')
    expect(v('122', 0.5, 0)).toBe('6')
    expect(v('122', 0.99, 0)).toBe('1')
    expect(v('122', 1.2, 0)).toBe('M')
  })

  it('80 cm: arriva fino al 5, poi è mancata', () => {
    expect(v('80', 0.05, 0)).toBe('X')
    expect(v('80', 0.12, 0)).toBe('10')
    expect(v('80', 0.9, 0)).toBe('5')
    expect(v('80', 1.05, 0)).toBe('M')
  })

  it('compound indoor: solo il centro vale 10, la parte esterna dell’anello vale 9', () => {
    expect(v('singolo', 0.03, 0, true)).toBe('10')
    expect(v('singolo', 0.07, 0, true)).toBe('9') // sarebbe 10 per un ricurvo
    expect(v('singolo', 0.07, 0, false)).toBe('10')
    expect(v('trispot', 0.15, 0, true)).toBe('9')
    expect(v('trispot', 0.15, 0, false)).toBe('10')
    // All'outdoor il flag compound non cambia niente.
    expect(v('122', 0.07, 0, true)).toBe('10')
  })

  it('i valori che escono dal tocco sono sempre ammessi sul bersaglio', () => {
    for (const b of ['singolo', 'trispot', '122', '80'] as const) {
      const ammessi = new Set<ValoreFreccia>([...anelli(b).map((x) => x.valore), 'M'])
      for (let i = 0; i < 400; i++) {
        const x = (i % 20) / 10 - 1
        const y = Math.floor(i / 20) / 10 - 1
        expect(ammessi.has(valoreDaPosizione(b, false, [x, y]))).toBe(true)
        expect(ammessi.has(valoreDaPosizione(b, true, [x, y]))).toBe(true)
      }
    }
  })
})

describe('posizioni', () => {
  it('distanza dal centro', () => {
    expect(distanzaDalCentro([3, 4])).toBe(5)
  })

  it('una posizione valida: due numeri finiti non troppo lontani', () => {
    expect(posizioneValida([0.2, -0.4])).toBe(true)
    expect(posizioneValida([0, DISTANZA_MASSIMA])).toBe(true)
    expect(posizioneValida([2, 2])).toBe(false)
    expect(posizioneValida([NaN, 0])).toBe(false)
    expect(posizioneValida([Infinity, 0])).toBe(false)
    expect(posizioneValida([0.1])).toBe(false)
    expect(posizioneValida(['a', 'b'])).toBe(false)
    expect(posizioneValida(null)).toBe(false)
    expect(posizioneValida(undefined)).toBe(false)
  })

  it('arrotondare a tre decimali', () => {
    expect(arrotondaPosizione([0.123456, -0.98765])).toEqual([0.123, -0.988])
  })

  it('un tocco lontanissimo si riporta al limite, senza cambiare direzione', () => {
    expect(limitaPosizione([0.5, 0.5])).toEqual([0.5, 0.5])
    const [x, y] = limitaPosizione([30, 40])
    expect(Math.hypot(x, y)).toBeCloseTo(DISTANZA_MASSIMA)
    expect(y / x).toBeCloseTo(4 / 3)
  })
})

describe('frecce con la posizione', () => {
  const s = (frecce: ValoreFreccia[], posizioni?: (Posizione | null)[]): Simulazione => ({
    id: 'x',
    atleta_id: 'a',
    giorno: '2026-11-12',
    formato: '18m',
    distanza: null,
    bersaglio: 'trispot',
    frecce,
    posizioni,
    conclusa: false,
    eliminata: false,
    creata_il: '2026-11-12T08:00:00.000Z',
    modificato_il: '2026-11-12T08:00:00.000Z',
  })

  it('allineare le posizioni alle frecce', () => {
    expect(allineaPosizioni(undefined, 2)).toEqual([null, null])
    expect(allineaPosizioni([[0.1, 0.1]], 3)).toEqual([[0.1, 0.1], null, null])
    expect(
      allineaPosizioni(
        [
          [0.1, 0.1],
          [0.2, 0.2],
        ],
        1,
      ),
    ).toEqual([[0.1, 0.1]])
  })

  it('aggiungere una freccia toccata: valore e posizione insieme', () => {
    const r = aggiungiFrecciaConPosizione(s(['10']), '9', [0.3, 0])
    expect(r).toEqual({ frecce: ['10', '9'], posizioni: [null, [0.3, 0]] })
  })

  it('una freccia col tastierino non ha posizione', () => {
    expect(aggiungiFrecciaConPosizione(s(['10'], [[0.1, 0]]), '9', null)?.posizioni).toEqual([
      [0.1, 0],
      null,
    ])
  })

  it('un valore che non esiste sul bersaglio non si aggiunge', () => {
    expect(aggiungiFrecciaConPosizione(s([]), '1', [0.9, 0])).toBeNull()
  })

  it('correggere cambia valore e posizione; col tastierino toglie la posizione', () => {
    const base = s(
      ['10', '9'],
      [
        [0.1, 0],
        [0.3, 0],
      ],
    )
    expect(correggiFrecciaConPosizione(base, 1, '8', [0.5, 0])).toEqual({
      frecce: ['10', '8'],
      posizioni: [
        [0.1, 0],
        [0.5, 0],
      ],
    })
    expect(correggiFrecciaConPosizione(base, 1, 'M', null)?.posizioni).toEqual([[0.1, 0], null])
    expect(correggiFrecciaConPosizione(base, 5, '8', null)).toBeNull()
  })

  it('togliere l’ultima toglie anche la posizione', () => {
    expect(
      togliUltimaConPosizione(
        s(
          ['10', '9'],
          [
            [0.1, 0],
            [0.3, 0],
          ],
        ),
      ),
    ).toEqual({
      frecce: ['10'],
      posizioni: [[0.1, 0]],
    })
    expect(togliUltimaConPosizione(s([]))).toEqual({ frecce: [], posizioni: [] })
  })
})

describe('anello della mancata', () => {
  it('largo come un anello del bersaglio', () => {
    expect(raggioMancata('singolo')).toBeCloseTo(1.1)
    expect(raggioMancata('122')).toBeCloseTo(1.1)
    expect(raggioMancata('trispot')).toBeCloseTo(1.2)
    expect(raggioMancata('80')).toBeCloseTo(1 + 1 / 6)
  })

  it('un punto si può riportare entro un limite a scelta', () => {
    const [x, y] = limitaPosizione([3, 4], 1.1)
    expect(Math.hypot(x, y)).toBeCloseTo(1.1)
    expect(limitaPosizione([0.3, 0.4], 1.1)).toEqual([0.3, 0.4])
  })
})
