import { describe, expect, it } from 'vitest'
import type { ProvaGara } from './atleti'
import { chiaveProva, confrontoMedie, GARE_NEL_CONFRONTO } from './confronto'
import type { FormatoSimulazione, Simulazione, ValoreFreccia } from './segnapunti'

const ripeti = (v: ValoreFreccia, n: number): ValoreFreccia[] => Array(n).fill(v)

const sim = (
  id: string,
  formato: FormatoSimulazione,
  frecce: ValoreFreccia[],
  extra: Partial<Simulazione> = {},
): Simulazione => ({
  id,
  atleta_id: 'a1',
  giorno: '2026-11-15',
  formato,
  distanza: formato === '70m' || formato === 'doppio70m' ? 70 : null,
  bersaglio:
    formato === '3d'
      ? '3d'
      : formato === '12+12' || formato === '24+24'
        ? 'campagna'
        : formato === '70m' || formato === 'doppio70m'
          ? '122'
          : 'trispot',
  frecce,
  conclusa: false,
  eliminata: false,
  creata_il: '2026-11-15T10:00:00.000Z',
  modificato_il: '2026-11-15T10:00:00.000Z',
  ...extra,
})

const gara = (
  chiave: string,
  codice: string,
  data: string,
  totale: number,
  divisione = 'OL',
): ProvaGara => {
  const [famiglia, prova] = chiave.split(':') as [ProvaGara['famiglia'], string]
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

describe('chiave della prova', () => {
  it('come quella delle prove delle gare', () => {
    expect(chiaveProva('18m', { distanza: 18 })).toBe('indoor:18m')
    expect(chiaveProva('25+18m', { distanza: 25 })).toBe('indoor:25m')
    expect(chiaveProva('70m', { distanza: 60 })).toBe('outdoor:60m')
    expect(chiaveProva('doppio70m', { distanza: 50 })).toBe('outdoor:50m')
    expect(chiaveProva('12+12', { distanza: null })).toBe('campagna:12+12')
    expect(chiaveProva('24+24', { distanza: null })).toBe('campagna:24+24')
    expect(chiaveProva('3d', { distanza: null })).toBe('3d:3d')
  })
})

describe('confronto tra le medie', () => {
  it('senza altre simulazioni né gare: solo questa', () => {
    const s = sim('s1', '3d', ['11', '10', '8'])
    expect(confrontoMedie(s, [s], [])).toEqual([
      { nome: '3D', questa: 9.67, allenamento: null, gare: null },
    ])
  })

  it('senza frecce: nessuna media di questa simulazione', () => {
    const s = sim('s1', '12+12', [])
    expect(confrontoMedie(s, [], [])[0]).toMatchObject({ nome: '12+12', questa: null })
  })

  it('media delle altre simulazioni: solo quelle dello stesso tipo, concluse, non cancellate, non questa', () => {
    const s = sim('s1', '12+12', ripeti('5', 10))
    const altre = [
      s, // questa: non conta
      sim('s2', '12+12', ripeti('6', 72)), // 432 / 72
      sim('s3', '12+12', ripeti('4', 72)), // 288 / 72
      sim('s4', '12+12', ripeti('6', 30)), // a metà: non conta
      sim('s5', '12+12', ripeti('1', 72), { eliminata: true }), // cancellata: non conta
      sim('s6', '24+24', ripeti('1', 144)), // altro formato: non conta
      sim('s7', '3d', ripeti('11', 72)), // altro formato: non conta
    ]
    const c = confrontoMedie(s, altre, [])[0]!
    expect(c.allenamento).toEqual({ media: 5, quanti: 2 })
    expect(c.questa).toBe(5)
  })

  it('il compound e il bersaglio distinguono le simulazioni indoor', () => {
    const s = sim('s1', '18m', ripeti('9', 6), { compound: true })
    const altre = [
      sim('s2', '18m', ripeti('10', 60), { compound: true }),
      sim('s3', '18m', ripeti('1', 60)), // non compound
      sim('s4', '18m', ripeti('1', 60), { bersaglio: 'singolo', compound: true }), // altro bersaglio
    ]
    expect(confrontoMedie(s, altre, [])[0]!.allenamento).toEqual({ media: 10, quanti: 1 })
  })

  it('la distanza distingue le simulazioni outdoor', () => {
    const s = sim('s1', '70m', ripeti('9', 6))
    const altre = [
      sim('s2', '70m', ripeti('8', 72)),
      sim('s3', '70m', ripeti('1', 72), { distanza: 60 }),
    ]
    expect(confrontoMedie(s, altre, [])[0]!.allenamento).toEqual({ media: 8, quanti: 1 })
  })

  it('gare: media per freccia dello stesso tipo di prova', () => {
    const s = sim('s1', '12+12', ripeti('6', 3))
    const gare = [
      gara('campagna:12+12', 'g1', '2026-05-01', 288, 'OL'), // 288 / 72 = 4
      gara('campagna:12+12', 'g2', '2026-06-01', 360, 'OL'), // 360 / 72 = 5
      gara('campagna:24+24', 'g3', '2026-07-01', 100, 'OL'), // altra prova: non conta
      gara('3d:3d', 'g4', '2026-08-01', 100, 'OL'), // altra prova: non conta
    ]
    expect(confrontoMedie(s, [], gare)[0]!.gare).toEqual({ divisione: 'OL', media: 4.5, quanti: 2 })
  })

  it('gare: il 24+24 si divide per 144 frecce', () => {
    const s = sim('s1', '24+24', ripeti('6', 3))
    const gare = [gara('campagna:24+24', 'g1', '2026-05-01', 432)]
    expect(confrontoMedie(s, [], gare)[0]!.gare).toEqual({ divisione: 'OL', media: 3, quanti: 1 })
  })

  it('gare: solo le ultime cinque', () => {
    const s = sim('s1', '3d', ['11'])
    const gare = Array.from({ length: 7 }, (_, i) =>
      // le due più vecchie valgono 0 e non devono contare
      gara('3d:3d', `g${i}`, `2026-0${i + 1}-01`, i < 2 ? 0 : 720),
    )
    const c = confrontoMedie(s, [], gare)[0]!
    expect(GARE_NEL_CONFRONTO).toBe(5)
    expect(c.gare).toEqual({ divisione: 'OL', media: 10, quanti: 5 })
  })

  it('gare: un solo arco, quello dell’ultima gara', () => {
    const s = sim('s1', '12+12', ['6'])
    const gare = [
      gara('campagna:12+12', 'g1', '2026-03-01', 72, 'CO'), // 1 per freccia
      gara('campagna:12+12', 'g2', '2026-05-01', 360, 'OL'), // 5 per freccia
      gara('campagna:12+12', 'g3', '2026-06-01', 432, 'OL'), // 6 per freccia, la più recente
    ]
    expect(confrontoMedie(s, [], gare)[0]!.gare).toEqual({ divisione: 'OL', media: 5.5, quanti: 2 })
  })

  it('gare: una simulazione compound si confronta con le gare compound', () => {
    const s = sim('s1', '18m', ['10'], { compound: true })
    const gare = [
      gara('indoor:18m', 'g1', '2026-03-01', 540, 'CO'), // 9 per freccia
      gara('indoor:18m', 'g2', '2026-06-01', 300, 'OL'), // la più recente, ma non compound
    ]
    expect(confrontoMedie(s, [], gare)[0]!.gare).toEqual({ divisione: 'CO', media: 9, quanti: 1 })
  })

  it('gare: una simulazione compound senza gare compound non ha confronto con le gare', () => {
    const s = sim('s1', '18m', ['10'], { compound: true })
    expect(
      confrontoMedie(s, [], [gara('indoor:18m', 'g1', '2026-06-01', 300, 'OL')])[0]!.gare,
    ).toBeNull()
  })

  it('25+18: una riga per prova, ognuna con le sue gare e le sue simulazioni', () => {
    const s = sim('s1', '25+18m', [...ripeti('9', 60), ...ripeti('10', 6)])
    const altra = sim('s2', '25+18m', [...ripeti('8', 60), ...ripeti('9', 60)])
    const gare = [
      gara('indoor:25m', 'g1', '2026-03-01', 540),
      gara('indoor:18m', 'g1', '2026-03-01', 570),
    ]
    const c = confrontoMedie(s, [altra], gare)
    expect(c.map((r) => r.nome)).toEqual(['25 m', '18 m'])
    expect(c[0]).toEqual({
      nome: '25 m',
      questa: 9,
      allenamento: { media: 8, quanti: 1 },
      gare: { divisione: 'OL', media: 9, quanti: 1 },
    })
    expect(c[1]).toEqual({
      nome: '18 m',
      questa: 10,
      allenamento: { media: 9, quanti: 1 },
      gare: { divisione: 'OL', media: 9.5, quanti: 1 },
    })
  })

  it('doppio 70 m: una sola riga, con le due prove insieme; le gare contano per prova', () => {
    const s = sim('s1', 'doppio70m', ripeti('9', 72))
    const altra = sim('s2', 'doppio70m', [...ripeti('8', 72), ...ripeti('6', 72)])
    const gare = [
      gara('outdoor:70m', 'g1', '2026-03-01', 504), // 7 per freccia
      gara('outdoor:70m', 'g1', '2026-03-01', 432), // 6 per freccia
    ]
    const c = confrontoMedie(s, [altra], gare)
    expect(c).toHaveLength(1)
    expect(c[0]!.nome).toBe('70 m')
    expect(c[0]!.questa).toBe(9)
    // 72*8 + 72*6 = 1008 punti su 144 frecce
    expect(c[0]!.allenamento).toEqual({ media: 7, quanti: 1 })
    // una gara sola con due prove: 936 punti su 144 frecce = 6,5
    expect(c[0]!.gare).toEqual({ divisione: 'OL', media: 6.5, quanti: 1 })
  })

  it('il doppio con una sola prova tirata nell’altra simulazione non conta', () => {
    const s = sim('s1', 'doppio70m', ['9'])
    const altra = sim('s2', 'doppio70m', ripeti('8', 72))
    expect(confrontoMedie(s, [altra], [])[0]!.allenamento).toBeNull()
  })
})
