import { describe, expect, it } from 'vitest'
import {
  distanzaOutdoor,
  nomeDivisione,
  nomeProva,
  partecipazioniConPdf,
  proveDiAtleta,
  recordPersonali,
  storicoAtleta,
  ultimaGara,
  type Partecipazione,
} from './atleti'
import type { Gara } from './gare'
import type { RigaClassifica } from './risultati'

const gara = (codice: string, dal: string, tipologia: string, dati: Partial<Gara> = {}): Gara => ({
  codice,
  dal,
  al: dal,
  calendario: 'Interregionale',
  regione: 'Umbria',
  localita: 'Gubbio (PG)',
  tipologia,
  dettaglio: null,
  societa_codice: '11003',
  societa_nome: 'Arcieri Eugubini',
  stato: 'omologata',
  in_calendario_umbria: true,
  ha_invito: false,
  url_risultati: null,
  ...dati,
})

const part = (codice: string, dati: Partial<Partecipazione> = {}): Partecipazione => ({
  atleta_id: 'a1',
  gara_codice: codice,
  divisione: 'OL',
  classe: 'SM',
  posizione: 3,
  totale: 500,
  ...dati,
})

const colonne = (nome: string) => [
  { colonna: `${nome}-1`, punti: 0, posizione: 1 },
  { colonna: `${nome}-2`, punti: 0, posizione: 1 },
]

const riga = (codice: string, dati: Partial<RigaClassifica> = {}): RigaClassifica => ({
  gara_codice: codice,
  categoria: 'Arco Ricurvo - Senior Maschile',
  divisione: 'OL',
  ordine: 1,
  posizione: 3,
  esito: '3',
  cognome: 'ROSSI',
  nome: 'Mario',
  societa_codice: '11003',
  societa_nome: 'Arcieri Eugubini',
  parziali: colonne('18m'),
  prove: [],
  totale: 540,
  conteggi: [10, 20],
  colonne_conteggi: ['10', '9'],
  atleta_id: 'a1',
  provvisoria: false,
  ...dati,
})

describe('distanza outdoor da divisione e classe', () => {
  it.each([
    ['OL', 'SM', 70],
    ['OL', 'JF', 70],
    ['OL', 'MM', 60],
    ['OL', 'AM', 60],
    ['OL', 'RM', 40],
    ['OL', 'GF', 25],
    ['CO', 'SM', 50],
    ['CO', 'MF', 50],
    ['CO', 'JM', 50],
    ['CO', 'RM', 40],
    ['AN', 'SM', 50],
    ['AN', 'AM', 40],
    ['AN', 'RM', 25],
    ['LB', 'MM', 50],
  ])('%s %s → %i m', (divisione, classe, attesa) => {
    expect(distanzaOutdoor(divisione, classe)).toBe(attesa)
  })

  it('combinazioni mai viste o divisioni paralimpiche: nessuna distanza', () => {
    expect(distanzaOutdoor('CO', 'AM')).toBeNull()
    expect(distanzaOutdoor('W1', 'SM')).toBeNull()
    expect(distanzaOutdoor('OL', 'XX')).toBeNull()
  })
})

describe('proveDiAtleta', () => {
  it('gara semplice con PDF: il punteggio della riga, con la distanza dalle colonne', () => {
    const prove = proveDiAtleta(
      'a1',
      [part('G1', { divisione: 'CO' })],
      [gara('G1', '2026-06-01', '70/60mt Round - 50mt Round')],
      [riga('G1', { divisione: 'CO', parziali: colonne('50m'), totale: 640 })],
    )
    expect(prove).toEqual([
      expect.objectContaining({ chiave: 'outdoor:50m', divisione: 'CO', totale: 640 }),
    ])
  })

  it('un 70 m con PDF di un Master prende la distanza dal PDF (60 m)', () => {
    const prove = proveDiAtleta(
      'a1',
      [part('G1', { classe: 'MM' })],
      [gara('G1', '2026-06-01', '70/60mt Round - 50mt Round')],
      [riga('G1', { parziali: colonne('60m'), totale: 600 })],
    )
    expect(prove[0]).toMatchObject({ chiave: 'outdoor:60m', totale: 600 })
  })

  it('25+18 con PDF: due prove, 25 m e 18 m', () => {
    const prove = proveDiAtleta(
      'a1',
      [part('G1')],
      [gara('G1', '2026-01-10', '25+18 m')],
      [
        riga('G1', {
          totale: 1100,
          prove: [
            { parziali: colonne('25m'), totale: 540 },
            { parziali: colonne('18m'), totale: 560 },
          ],
        }),
      ],
    )
    expect(prove.map((p) => [p.chiave, p.totale])).toEqual([
      ['indoor:25m', 540],
      ['indoor:18m', 560],
    ])
  })

  it('doppio 70 m con PDF: due prove da 70 m', () => {
    const prove = proveDiAtleta(
      'a1',
      [part('G1')],
      [gara('G1', '2026-06-01', 'Doppio 70/60mt Round - Doppio 50mt Round')],
      [
        riga('G1', {
          prove: [
            { parziali: colonne('70m'), totale: 640 },
            { parziali: colonne('70m'), totale: 650 },
          ],
          totale: 1290,
        }),
      ],
    )
    expect(prove.map((p) => [p.chiave, p.totale])).toEqual([
      ['outdoor:70m', 640],
      ['outdoor:70m', 650],
    ])
  })

  it('senza distanza nelle colonne si usa la prova della tipologia', () => {
    const composta = proveDiAtleta(
      'a1',
      [part('G1')],
      [gara('G1', '2026-01-10', '25+18 m')],
      [
        riga('G1', {
          prove: [
            { parziali: [], totale: 500 },
            { parziali: [], totale: 550 },
          ],
        }),
      ],
    )
    expect(composta.map((p) => p.chiave)).toEqual(['indoor:25m', 'indoor:18m'])
    const semplice = proveDiAtleta(
      'a1',
      [part('G2')],
      [gara('G2', '2026-01-10', '18 m')],
      [riga('G2', { parziali: [] })],
    )
    expect(semplice[0]!.chiave).toBe('indoor:18m')
  })

  it('campagna e 3D: la prova è quella della tipologia, qualunque sia la colonna del PDF', () => {
    const prove = proveDiAtleta(
      'a1',
      [
        part('G1', { divisione: 'AN' }),
        part('G2', { divisione: 'AN' }),
        part('G3', { divisione: 'AN' }),
      ],
      [
        gara('G1', '2026-05-01', '12+12'),
        gara('G2', '2026-05-02', '24+24'),
        gara('G3', '2026-05-03', '3D'),
      ],
      [
        riga('G1', {
          divisione: 'AN',
          parziali: [{ colonna: 'H&F', punti: 200, posizione: 1 }],
          totale: 200,
        }),
        riga('G2', {
          divisione: 'AN',
          parziali: [{ colonna: 'Hunter Field', punti: 400, posizione: 1 }],
          totale: 400,
        }),
        riga('G3', {
          divisione: 'AN',
          parziali: [{ colonna: 'Perc.', punti: 300, posizione: 1 }],
          totale: 300,
        }),
      ],
    )
    expect(prove.map((p) => [p.chiave, p.totale])).toEqual([
      ['campagna:12+12', 200],
      ['campagna:24+24', 400],
      ['3d:3d', 300],
    ])
  })

  it('il provvisorio del PDF si porta dietro la scritta', () => {
    const prove = proveDiAtleta(
      'a1',
      [part('G1')],
      [gara('G1', '2026-11-01', '18 m', { stato: 'da-omologare' })],
      [riga('G1', { provvisoria: true })],
    )
    expect(prove[0]!.provvisoria).toBe(true)
  })

  it('un ritirato (DNF) non conta', () => {
    expect(
      proveDiAtleta(
        'a1',
        [part('G1')],
        [gara('G1', '2026-01-10', '18 m')],
        [riga('G1', { esito: 'DNF', posizione: null })],
      ),
    ).toEqual([])
  })

  it('gara vecchia senza PDF: il totale dello storico, solo se è a prova unica', () => {
    const gare = [
      gara('V1', '2019-02-01', '18 m'),
      gara('V2', '2019-03-01', '25+18 m'),
      gara('V3', '2019-06-01', '70/60mt Round - 50mt Round'),
      gara('V4', '2019-07-01', '3D', { stato: 'da-omologare' }),
    ]
    const prove = proveDiAtleta(
      'a1',
      [
        part('V1', { totale: 520 }),
        part('V2', { totale: 1000 }),
        part('V3', { totale: 600, classe: 'MM' }),
        part('V4', { totale: 280, divisione: 'AN' }),
      ],
      gare,
      [],
    )
    expect(prove.map((p) => [p.chiave, p.totale, p.provvisoria])).toEqual([
      ['indoor:18m', 520, false],
      ['outdoor:60m', 600, false],
      ['3d:3d', 280, true],
    ])
  })

  it('gara vecchia senza totale, outdoor di classe sconosciuta o tipologia non gestita: saltate', () => {
    expect(
      proveDiAtleta(
        'a1',
        [
          part('V1', { totale: null }),
          part('V2', { divisione: 'CO', classe: 'AM', totale: 600 }),
          part('V3', { totale: 100 }),
          part('V5', { totale: 100 }),
        ],
        [
          gara('V1', '2019-02-01', '18 m'),
          gara('V2', '2019-06-01', '70/60mt Round - 50mt Round'),
          gara('V3', '2019-06-02', 'Trofeo Pinocchio'),
        ],
        [],
      ),
    ).toEqual([])
  })

  it('usa solo le righe dell’atleta e solo quella dell’arco giusto', () => {
    const prove = proveDiAtleta(
      'a1',
      [part('G1', { divisione: 'OL' }), part('G1', { divisione: 'CO', totale: 600 })],
      [gara('G1', '2026-01-10', '18 m')],
      [
        riga('G1', { divisione: 'OL', totale: 520 }),
        riga('G1', { divisione: 'CO', totale: 590 }),
        riga('G1', { atleta_id: 'altro', totale: 999 }),
      ],
    )
    expect(prove.map((p) => [p.divisione, p.totale])).toEqual([
      ['OL', 520],
      ['CO', 590],
    ])
    // Lo storico di un altro atleta non entra.
    expect(proveDiAtleta('a2', [part('G1')], [gara('G1', '2026-01-10', '18 m')], [])).toEqual([])
  })
})

describe('recordPersonali', () => {
  const p = (chiave: string, totale: number, data: string, divisione = 'OL') => {
    const [famiglia, prova] = chiave.split(':') as [
      'indoor' | 'outdoor' | 'campagna' | '3d',
      string,
    ]
    return {
      chiave,
      famiglia,
      prova,
      divisione,
      gara_codice: `G${data}`,
      data,
      totale,
      provvisoria: false,
    }
  }

  it('il migliore per prova e arco; a parità il primo ottenuto', () => {
    const r = recordPersonali([
      p('indoor:18m', 540, '2026-01-01'),
      p('indoor:18m', 560, '2026-02-01'),
      p('indoor:18m', 560, '2025-02-01'),
      p('indoor:18m', 500, '2026-03-01', 'CO'),
    ])
    expect(r.map((x) => [x.divisione, x.totale, x.data])).toEqual([
      ['CO', 500, '2026-03-01'],
      ['OL', 560, '2025-02-01'],
    ])
  })

  it('ordine: indoor (18, 25), outdoor (dalla distanza maggiore), campagna, 3D', () => {
    const r = recordPersonali([
      p('3d:3d', 300, '2026-05-01'),
      p('campagna:24+24', 400, '2026-05-01'),
      p('campagna:12+12', 200, '2026-05-01'),
      p('outdoor:60m', 600, '2026-05-01'),
      p('outdoor:70m', 650, '2026-05-01'),
      p('indoor:25m', 500, '2026-05-01'),
      p('indoor:18m', 550, '2026-05-01'),
    ])
    expect(r.map((x) => x.chiave)).toEqual([
      'indoor:18m',
      'indoor:25m',
      'outdoor:70m',
      'outdoor:60m',
      'campagna:12+12',
      'campagna:24+24',
      '3d:3d',
    ])
  })
})

describe('nomi', () => {
  it('prove', () => {
    expect(nomeProva({ famiglia: 'indoor', prova: '18m' })).toBe('18 m')
    expect(nomeProva({ famiglia: 'indoor', prova: '25m' })).toBe('25 m')
    expect(nomeProva({ famiglia: 'outdoor', prova: '70m' })).toBe('70 m')
    expect(nomeProva({ famiglia: 'outdoor', prova: '25m' })).toBe('25 m outdoor')
    expect(nomeProva({ famiglia: 'campagna', prova: '12+12' })).toBe('12+12')
    expect(nomeProva({ famiglia: '3d', prova: '3d' })).toBe('3D')
  })
  it('divisioni', () => {
    expect(nomeDivisione('OL')).toBe('Ricurvo')
    expect(nomeDivisione('CO')).toBe('Compound')
    expect(nomeDivisione('W1')).toBe('W1')
  })
})

describe('storico e ultima gara', () => {
  const gare = [
    gara('G1', '2026-01-10', '18 m'),
    gara('G2', '2026-03-10', '25+18 m'),
    gara('G3', '2026-12-12', '18 m', { stato: 'invito' }),
  ]
  const partecipazioni = [
    part('G1'),
    part('G2'),
    part('G2', { divisione: 'CO' }),
    part('G3'),
    part('GX'),
    part('G1', { atleta_id: 'a2' }),
  ]

  it('le gare dell’atleta dalla più recente; le gare mancanti e quelle degli altri no', () => {
    const s = storicoAtleta('a1', partecipazioni, gare)
    expect(s.map((r) => [r.gara.codice, r.divisione])).toEqual([
      ['G3', 'OL'],
      ['G2', 'CO'],
      ['G2', 'OL'],
      ['G1', 'OL'],
    ])
  })

  it('l’ultima gara è l’ultima già disputata', () => {
    const s = storicoAtleta('a1', partecipazioni, gare)
    expect(ultimaGara(s, '2026-11-10')?.codice).toBe('G2')
    expect(ultimaGara(s, '2026-03-10')?.codice).toBe('G2')
    expect(ultimaGara(s, '2025-01-01')).toBeNull()
  })
})

describe('storico con le gare che si conoscono solo dal PDF', () => {
  it('una riga del PDF collegata all’atleta, senza la gara nello storico, diventa una partecipazione', () => {
    const r = partecipazioniConPdf([part('G1')], [riga('G2', { posizione: 4, totale: 533 })])
    expect(r).toEqual([
      part('G1'),
      {
        atleta_id: 'a1',
        gara_codice: 'G2',
        divisione: 'OL',
        classe: '',
        posizione: 4,
        totale: 533,
        dalPdf: true,
      },
    ])
  })

  it('quando la gara c’è già nello storico (stessa gara e stesso arco) vale quella: niente doppioni', () => {
    expect(partecipazioniConPdf([part('G1')], [riga('G1', { totale: 999 })])).toEqual([part('G1')])
  })

  it('la stessa gara con un altro arco è un’altra partecipazione', () => {
    const r = partecipazioniConPdf([part('G1')], [riga('G1', { divisione: 'CO' })])
    expect(r.map((p) => p.divisione)).toEqual(['OL', 'CO'])
  })

  it('le righe di chi non è nell’app (non collegate) non contano; un ritirato non ha punteggio', () => {
    const r = partecipazioniConPdf(
      [],
      [riga('G1', { atleta_id: null }), riga('G2', { esito: 'DNF', posizione: null, totale: 300 })],
    )
    expect(r).toEqual([
      expect.objectContaining({ gara_codice: 'G2', posizione: null, totale: null }),
    ])
  })

  it('una riga ripetuta nel PDF conta una volta sola', () => {
    expect(partecipazioniConPdf([], [riga('G1'), riga('G1', { ordine: 2 })])).toHaveLength(1)
  })

  it('con le prove e i record: la gara dal PDF conta come le altre (anche provvisoria)', () => {
    const gare = [gara('G1', '2026-11-08', '18 m', { stato: 'da-omologare' })]
    const classifiche = [riga('G1', { totale: 533, provvisoria: true })]
    const prove = proveDiAtleta('a1', partecipazioniConPdf([], classifiche), gare, classifiche)
    expect(prove).toEqual([
      expect.objectContaining({ chiave: 'indoor:18m', totale: 533, provvisoria: true }),
    ])
    expect(storicoAtleta('a1', partecipazioniConPdf([], classifiche), gare)).toEqual([
      expect.objectContaining({ totale: 533, posizione: 3 }),
    ])
  })
})
