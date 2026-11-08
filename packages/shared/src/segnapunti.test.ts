import { describe, expect, it } from 'vitest'
import {
  aggiungiFreccia,
  bersagliAmmessi,
  correggiFreccia,
  etichetteConteggi,
  frecceDelleSimulazioni,
  frecceTotaliSimulazione,
  impostaNotaVolee,
  NOTA_VOLEE_MASSIMA,
  nomeSimulazione,
  notaVolee,
  proveDelFormato,
  puntiFreccia,
  riepilogoSimulazione,
  simulazioniVisibili,
  statoTiro,
  togliUltimaFreccia,
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
  distanza: Simulazione['distanza'] = null,
): Simulazione => ({
  id: 's1',
  atleta_id: 'a1',
  giorno: '2026-11-12',
  formato,
  distanza,
  bersaglio,
  frecce,
  conclusa: false,
  eliminata: false,
  creata_il: '2026-11-12T10:00:00.000Z',
  modificato_il: '2026-11-12T10:00:00.000Z',
})

const ripeti = (v: ValoreFreccia, n: number): ValoreFreccia[] => Array(n).fill(v)

describe('formati e prove', () => {
  it('indoor: prove da 60 frecce, volée da 3, parziali da 30', () => {
    expect(proveDelFormato('18m')).toEqual([
      { distanza: 18, frecceTotali: 60, frecceVolee: 3, frecceParziale: 30 },
    ])
    expect(proveDelFormato('25m')[0]!.distanza).toBe(25)
  })

  it('25+18: prima i 25 m, poi i 18 m', () => {
    expect(proveDelFormato('25+18m').map((p) => p.distanza)).toEqual([25, 18])
    expect(frecceTotaliSimulazione({ formato: '25+18m', distanza: null })).toBe(120)
  })

  it('outdoor: prove da 72 frecce, volée da 6, parziali da 36', () => {
    expect(proveDelFormato('70m', 60)).toEqual([
      { distanza: 60, frecceTotali: 72, frecceVolee: 6, frecceParziale: 36 },
    ])
    expect(proveDelFormato('70m')[0]!.distanza).toBe(70)
  })

  it('il doppio: due prove alla stessa distanza', () => {
    expect(proveDelFormato('doppio70m', 50).map((p) => p.distanza)).toEqual([50, 50])
    expect(frecceTotaliSimulazione({ formato: 'doppio70m', distanza: 50 })).toBe(144)
  })

  it('i nomi', () => {
    expect(nomeSimulazione({ formato: '18m', distanza: null })).toBe('18 m')
    expect(nomeSimulazione({ formato: '25+18m', distanza: null })).toBe('25+18 m')
    expect(nomeSimulazione({ formato: '70m', distanza: 60 })).toBe('60 m')
    expect(nomeSimulazione({ formato: '70m', distanza: null })).toBe('70 m')
    expect(nomeSimulazione({ formato: 'doppio70m', distanza: 50 })).toBe('Doppio 50 m')
    expect(nomeSimulazione({ formato: 'doppio70m', distanza: null })).toBe('Doppio 70 m')
  })
})

describe('bersagli e valori', () => {
  it('quali bersagli per formato', () => {
    expect(bersagliAmmessi('18m')).toEqual(['singolo', 'trispot'])
    expect(bersagliAmmessi('25+18m')).toEqual(['singolo', 'trispot'])
    expect(bersagliAmmessi('70m')).toEqual(['122', '80'])
    expect(bersagliAmmessi('doppio70m')).toEqual(['122', '80'])
  })

  it('indoor: niente X; singolo 10…1 e M, trispot 10…6 e M', () => {
    expect(valoriAmmessi('singolo')).toEqual([
      '10',
      '9',
      '8',
      '7',
      '6',
      '5',
      '4',
      '3',
      '2',
      '1',
      'M',
    ])
    expect(valoriAmmessi('trispot')).toEqual(['10', '9', '8', '7', '6', 'M'])
    expect(valoriAmmessi('singolo')).not.toContain('X')
    expect(valoriAmmessi('trispot')).not.toContain('X')
  })

  it('outdoor: 122 cm da X a 1 e M; 80 cm da X a 5 e M', () => {
    expect(valoriAmmessi('122')).toEqual([
      'X',
      '10',
      '9',
      '8',
      '7',
      '6',
      '5',
      '4',
      '3',
      '2',
      '1',
      'M',
    ])
    expect(valoriAmmessi('80')).toEqual(['X', '10', '9', '8', '7', '6', '5', 'M'])
  })

  it('punti: la X vale 10, la M zero', () => {
    expect(puntiFreccia('X')).toBe(10)
    expect(puntiFreccia('10')).toBe(10)
    expect(puntiFreccia('7')).toBe(7)
    expect(puntiFreccia('M')).toBe(0)
  })

  it('i conteggi in fondo: 10 e 9 all’indoor, 10+X e X all’outdoor', () => {
    expect(etichetteConteggi('18m')).toEqual(['10', '9'])
    expect(etichetteConteggi('25+18m')).toEqual(['10', '9'])
    expect(etichetteConteggi('70m')).toEqual(['10+X', 'X'])
    expect(etichetteConteggi('doppio70m')).toEqual(['10+X', 'X'])
  })
})

describe('riepilogo di una simulazione', () => {
  it('senza frecce: tutto a zero, nessuna media', () => {
    const r = riepilogoSimulazione(sim('18m', 'singolo'))
    expect(r).toMatchObject({
      totale: 0,
      conteggi: [0, 0],
      frecceSegnate: 0,
      frecceTotali: 60,
      completa: false,
      media: null,
    })
    expect(r.prove[0]!.volee).toEqual([])
  })

  it('volée, parziali e totale di un 18 m completo', () => {
    // 30 frecce da 10 (tre 10 a volée), poi 30 da 9.
    const frecce = [...ripeti('10', 30), ...ripeti('9', 30)]
    const r = riepilogoSimulazione(sim('18m', 'singolo', frecce))
    expect(r.completa).toBe(true)
    expect(r.prove[0]!.volee).toHaveLength(20)
    expect(r.prove[0]!.volee[0]).toEqual({ frecce: ['10', '10', '10'], totale: 30 })
    expect(r.prove[0]!.volee[19]!.totale).toBe(27)
    expect(r.prove[0]!.parziali).toEqual([300, 270])
    expect(r.totale).toBe(570)
    expect(r.conteggi).toEqual([30, 30]) // trenta 10 e trenta 9
    expect(r.media).toBe(9.5)
  })

  it('indoor: la X non esiste, ma se ci fosse nei dati vale 10 e non si conta tra i 10', () => {
    // Un dato che arriva da fuori: si calcola comunque senza rompersi.
    const r = riepilogoSimulazione(sim('18m', 'singolo', ['X', '10', '9']))
    expect(r.totale).toBe(29)
    expect(r.conteggi).toEqual([1, 1])
  })

  it('una simulazione a metà: parziali e conteggi parziali, media sulle frecce segnate', () => {
    const r = riepilogoSimulazione(sim('18m', 'trispot', ['10', '9', 'M', '8', '8', '10']))
    expect(r.frecceSegnate).toBe(6)
    expect(r.completa).toBe(false)
    expect(r.prove[0]!.volee.map((v) => v.totale)).toEqual([19, 26])
    expect(r.prove[0]!.parziali).toEqual([45, 0])
    expect(r.conteggi).toEqual([2, 1])
    expect(r.media).toBe(7.5)
  })

  it('una volée incompleta ha il suo totale', () => {
    const r = riepilogoSimulazione(sim('25m', 'singolo', ['10', '9']))
    expect(r.prove[0]!.volee).toEqual([{ frecce: ['10', '9'], totale: 19 }])
  })

  it('outdoor: la X vale 10 e si conta tra i 10+X e tra gli X; parziali da 36 frecce', () => {
    const frecce: ValoreFreccia[] = [
      'X',
      'X',
      '10',
      '9',
      '9',
      'M', // volée 1: 10+10+10+9+9+0 = 48
      ...ripeti('8', 30), // fino a 36 frecce: primo parziale = 48 + 240 = 288
      ...ripeti('7', 36), // secondo parziale: 252
    ]
    const r = riepilogoSimulazione(sim('70m', '122', frecce, 70))
    expect(r.completa).toBe(true)
    expect(r.prove[0]!.volee).toHaveLength(12)
    expect(r.prove[0]!.volee[0]).toEqual({ frecce: ['X', 'X', '10', '9', '9', 'M'], totale: 48 })
    expect(r.prove[0]!.parziali).toEqual([288, 252])
    expect(r.totale).toBe(540)
    expect(r.conteggi).toEqual([3, 2]) // tre tra X e 10, due X
  })

  it('25+18: le frecce si dividono in due prove, ognuna con i suoi parziali', () => {
    const frecce = [...ripeti('10', 60), ...ripeti('9', 60)]
    const r = riepilogoSimulazione(sim('25+18m', 'singolo', frecce))
    expect(r.prove.map((p) => [p.prova.distanza, p.totale])).toEqual([
      [25, 600],
      [18, 540],
    ])
    expect(r.prove[1]!.parziali).toEqual([270, 270])
    expect(r.totale).toBe(1140)
    expect(r.conteggi).toEqual([60, 60])
  })

  it('doppio: due prove da 72 frecce', () => {
    const frecce = [...ripeti('X', 72), ...ripeti('10', 72)]
    const r = riepilogoSimulazione(sim('doppio70m', '122', frecce, 60))
    expect(r.prove.map((p) => p.totale)).toEqual([720, 720])
    expect(r.totale).toBe(1440)
    expect(r.conteggi).toEqual([144, 72])
    expect(r.completa).toBe(true)
  })

  it('frecce in più di quelle previste non contano', () => {
    const r = riepilogoSimulazione(sim('18m', 'singolo', ripeti('10', 70)))
    expect(r.frecceSegnate).toBe(60)
    expect(r.totale).toBe(600)
  })
})

describe('dove si è arrivati', () => {
  it('all’inizio: prima prova, prima volée, prima freccia', () => {
    expect(statoTiro(sim('18m', 'singolo'))).toEqual({
      prova: 0,
      prove: 1,
      volee: 1,
      voleeTotali: 20,
      frecciaInVolee: 0,
      distanza: 18,
      finita: false,
    })
  })

  it('a metà di una volée', () => {
    const s = statoTiro(sim('18m', 'singolo', ripeti('9', 7)))
    expect(s).toMatchObject({ volee: 3, frecciaInVolee: 1 })
    expect(statoTiro(sim('70m', '122', ripeti('9', 13), 70))).toMatchObject({
      volee: 3,
      voleeTotali: 12,
      frecciaInVolee: 1,
    })
  })

  it('finita una volée si passa alla prossima', () => {
    expect(statoTiro(sim('18m', 'singolo', ripeti('9', 3)))).toMatchObject({
      volee: 2,
      frecciaInVolee: 0,
    })
  })

  it('25+18: finita la prima prova si passa alla seconda, ai 18 m', () => {
    expect(statoTiro(sim('25+18m', 'singolo', ripeti('9', 59)))).toMatchObject({
      prova: 0,
      volee: 20,
      frecciaInVolee: 2,
      distanza: 25,
    })
    expect(statoTiro(sim('25+18m', 'singolo', ripeti('9', 60)))).toMatchObject({
      prova: 1,
      prove: 2,
      volee: 1,
      frecciaInVolee: 0,
      distanza: 18,
      finita: false,
    })
    expect(statoTiro(sim('25+18m', 'singolo', ripeti('9', 63)))).toMatchObject({
      prova: 1,
      volee: 2,
      frecciaInVolee: 0,
    })
  })

  it('finita la gara: ultima volée, ultima freccia, finita', () => {
    expect(statoTiro(sim('18m', 'singolo', ripeti('9', 60)))).toMatchObject({
      volee: 20,
      frecciaInVolee: 2,
      finita: true,
    })
    expect(statoTiro(sim('25+18m', 'singolo', ripeti('9', 120)))).toMatchObject({
      prova: 1,
      volee: 20,
      finita: true,
    })
  })
})

describe('segnare e correggere', () => {
  it('aggiungere la prossima freccia', () => {
    expect(aggiungiFreccia(sim('18m', 'singolo', ['10']), '9')).toEqual(['10', '9'])
  })

  it('un valore che sul bersaglio non esiste non si segna (niente X all’indoor, niente 4 sul trispot)', () => {
    expect(aggiungiFreccia(sim('18m', 'singolo'), 'X')).toBeNull()
    expect(aggiungiFreccia(sim('18m', 'trispot'), '5')).toBeNull()
    expect(aggiungiFreccia(sim('70m', '80', [], 70), '4')).toBeNull()
    expect(aggiungiFreccia(sim('70m', '122', [], 70), 'X')).toEqual(['X'])
  })

  it('finita la gara non si aggiunge altro', () => {
    expect(aggiungiFreccia(sim('18m', 'singolo', ripeti('9', 60)), '9')).toBeNull()
    expect(aggiungiFreccia(sim('18m', 'singolo', ripeti('9', 59)), '9')).toHaveLength(60)
  })

  it('correggere una freccia già segnata', () => {
    const s = sim('18m', 'singolo', ['10', '9', '8'])
    expect(correggiFreccia(s, 1, '7')).toEqual(['10', '7', '8'])
    expect(s.frecce).toEqual(['10', '9', '8']) // l'originale non cambia
    expect(correggiFreccia(s, 3, '7')).toBeNull() // non ancora tirata
    expect(correggiFreccia(s, -1, '7')).toBeNull()
    expect(correggiFreccia(s, 0.5, '7')).toBeNull()
    expect(correggiFreccia(s, 1, 'X')).toBeNull() // niente X all'indoor
  })

  it('togliere l’ultima freccia', () => {
    expect(togliUltimaFreccia({ frecce: ['10', '9'] })).toEqual(['10'])
    expect(togliUltimaFreccia({ frecce: [] })).toEqual([])
  })
})

describe('frecce nel giorno e nella settimana', () => {
  const s = (giorno: string, frecce: ValoreFreccia[], dati: Partial<Simulazione> = {}) => ({
    ...sim('18m', 'singolo', frecce),
    giorno,
    ...dati,
  })

  it('una voce per simulazione, senza le cancellate', () => {
    expect(
      frecceDelleSimulazioni([
        s('2026-11-09', ripeti('9', 60)),
        s('2026-11-09', ripeti('9', 12)),
        s('2026-11-10', ripeti('9', 30), { eliminata: true }),
      ]),
    ).toEqual([
      { giorno: '2026-11-09', frecce: 60 },
      { giorno: '2026-11-09', frecce: 12 },
    ])
  })

  it('mai più delle frecce previste dal formato', () => {
    expect(frecceDelleSimulazioni([s('2026-11-09', ripeti('9', 70))])).toEqual([
      { giorno: '2026-11-09', frecce: 60 },
    ])
  })

  it('le simulazioni visibili: non cancellate, le più recenti per prime', () => {
    const elenco = [
      s('2026-11-09', [], { id: 'a', creata_il: '2026-11-09T10:00:00Z' }),
      s('2026-11-09', [], { id: 'b', creata_il: '2026-11-09T12:00:00Z' }),
      s('2026-11-09', [], { id: 'c', creata_il: '2026-11-09T11:00:00Z', eliminata: true }),
    ]
    expect(simulazioniVisibili(elenco).map((x) => x.id)).toEqual(['b', 'a'])
  })
})

describe('note per volée', () => {
  it('senza note: testo vuoto', () => {
    expect(notaVolee(sim('18m', 'singolo'), 0)).toBe('')
    expect(notaVolee({ note: { '3': 'vento forte' } }, 3)).toBe('vento forte')
    expect(notaVolee({ note: { '3': 'vento forte' } }, 4)).toBe('')
  })

  it('impostare, cambiare e togliere una nota, senza toccare l’originale', () => {
    const originale = { '1': 'prima' }
    const a = impostaNotaVolee(originale, 2, 'vento')
    expect(a).toEqual({ '1': 'prima', '2': 'vento' })
    expect(originale).toEqual({ '1': 'prima' })
    expect(impostaNotaVolee(a, 2, 'molto vento')).toEqual({ '1': 'prima', '2': 'molto vento' })
    expect(impostaNotaVolee(a, 2, '')).toEqual({ '1': 'prima' })
    expect(impostaNotaVolee(a, 2, '   ')).toEqual({ '1': 'prima' })
    expect(impostaNotaVolee(undefined, 0, 'x')).toEqual({ '0': 'x' })
  })

  it('la nota non supera la lunghezza massima', () => {
    const lunga = impostaNotaVolee({}, 0, 'a'.repeat(NOTA_VOLEE_MASSIMA + 50))
    expect(lunga['0']).toHaveLength(NOTA_VOLEE_MASSIMA)
  })
})
