import { describe, expect, it } from 'vitest'
import {
  elencoNomi,
  etichettaTurno,
  etichetteTurni,
  partecipantiPerTurno,
  puoAprireSondaggio,
  riepilogoSondaggio,
  sondaggioRispondibile,
  statoSondaggioGara,
  turniPossibili,
} from './sondaggi'

const OGGI = '2026-11-15'
const GARA = { al: '2026-12-12', stato: 'invito' as const, ha_invito: true }

describe('puoAprireSondaggio', () => {
  it('solo gare future (anche di oggi), non annullate, con l’invito', () => {
    expect(puoAprireSondaggio(GARA, OGGI)).toBe(true)
    expect(puoAprireSondaggio({ ...GARA, al: OGGI }, OGGI)).toBe(true)
    expect(puoAprireSondaggio({ ...GARA, al: '2026-11-14' }, OGGI)).toBe(false)
    expect(puoAprireSondaggio({ ...GARA, ha_invito: false }, OGGI)).toBe(false)
    expect(puoAprireSondaggio({ ...GARA, stato: 'annullata' }, OGGI)).toBe(false)
  })
})

describe('sondaggioRispondibile', () => {
  it('aperto e gara non passata', () => {
    expect(sondaggioRispondibile({ aperto: true }, GARA, OGGI)).toBe(true)
    expect(sondaggioRispondibile({ aperto: false }, GARA, OGGI)).toBe(false)
    expect(sondaggioRispondibile({ aperto: true }, { al: '2026-11-01' }, OGGI)).toBe(false)
    expect(sondaggioRispondibile(null, GARA, OGGI)).toBe(false)
    expect(sondaggioRispondibile(undefined, GARA, OGGI)).toBe(false)
  })
})

describe('riepilogoSondaggio', () => {
  const anna = { id: 'a', nome: 'Anna', cognome: 'Verdi' }
  const bruno = { id: 'b', nome: 'Bruno', cognome: 'Bianchi' }
  const carla = { id: 'c', nome: 'Carla', cognome: 'Bianchi' }
  const dario = { id: 'd', nome: 'Dario', cognome: 'Neri' }
  const uscito = { id: 'e', nome: 'Elio', cognome: 'Rossi' }

  it('divide chi partecipa, chi no e chi non ha risposto, per cognome e nome', () => {
    const r = riepilogoSondaggio(
      [
        { atleta_id: 'a', partecipa: true },
        { atleta_id: 'c', partecipa: true },
        { atleta_id: 'b', partecipa: true },
        { atleta_id: 'd', partecipa: false },
        { atleta_id: 'e', partecipa: true },
        { atleta_id: 'sconosciuto', partecipa: true },
      ],
      [anna, bruno, carla, dario],
      [anna, bruno, carla, dario, uscito],
    )
    expect(r.partecipano.map((p) => p.id)).toEqual(['b', 'c', 'e', 'a'])
    expect(r.nonPartecipano).toEqual([dario])
    expect(r.senzaRisposta).toEqual([])
  })

  it('senza risposte: tutti da rispondere', () => {
    const r = riepilogoSondaggio([], [anna, dario, bruno])
    expect(r.partecipano).toEqual([])
    expect(r.senzaRisposta.map((p) => p.id)).toEqual(['b', 'd', 'a'])
  })

  it('elencoNomi', () => {
    expect(elencoNomi([anna, bruno])).toBe('Anna Verdi, Bruno Bianchi')
    expect(elencoNomi([])).toBe('')
  })
})

describe('statoSondaggioGara', () => {
  const aperto = { aperto: true }
  const chiuso = { aperto: false }
  it('sondaggio aperto senza risposta: da rispondere (giallo)', () => {
    expect(statoSondaggioGara(aperto, undefined, GARA, OGGI)).toBe('da-rispondere')
  })
  it('la risposta decide verde o rosso, anche a sondaggio chiuso', () => {
    expect(statoSondaggioGara(aperto, { partecipa: true }, GARA, OGGI)).toBe('partecipi')
    expect(statoSondaggioGara(aperto, { partecipa: false }, GARA, OGGI)).toBe('non-partecipi')
    expect(statoSondaggioGara(chiuso, { partecipa: false }, GARA, OGGI)).toBe('non-partecipi')
  })
  it('niente: senza sondaggio, a sondaggio chiuso senza risposta, a gara passata', () => {
    expect(statoSondaggioGara(null, undefined, GARA, OGGI)).toBeNull()
    expect(statoSondaggioGara(chiuso, undefined, GARA, OGGI)).toBeNull()
    expect(statoSondaggioGara(aperto, { partecipa: true }, { al: '2026-11-14' }, OGGI)).toBeNull()
    expect(statoSondaggioGara(aperto, undefined, { al: '2026-11-14' }, OGGI)).toBeNull()
  })
})

describe('turni', () => {
  it('turniPossibili: mattina e pomeriggio di ogni giorno della gara', () => {
    expect(turniPossibili({ dal: '2026-12-12', al: '2026-12-13' })).toEqual([
      '2026-12-12:mattina',
      '2026-12-12:pomeriggio',
      '2026-12-13:mattina',
      '2026-12-13:pomeriggio',
    ])
    expect(turniPossibili({ dal: '2026-12-31', al: '2027-01-01' })).toHaveLength(4)
    // Una gara lunghissima (o con le date sbagliate) si ferma a 14 giorni.
    expect(turniPossibili({ dal: '2026-01-01', al: '2026-12-31' })).toHaveLength(28)
  })

  it('etichette: "Sabato mattina", con la data se il giorno della settimana si ripete', () => {
    expect(etichettaTurno('2026-12-12:mattina')).toBe('Sabato mattina')
    expect(etichettaTurno('2026-12-13:pomeriggio', true)).toBe('Domenica 13 dic, pomeriggio')
    expect([...etichetteTurni(['2026-12-12:mattina', '2026-12-13:mattina']).values()]).toEqual([
      'Sabato mattina',
      'Domenica mattina',
    ])
    expect([...etichetteTurni(['2026-12-12:mattina', '2026-12-19:mattina']).values()]).toEqual([
      'Sabato 12 dic, mattina',
      'Sabato 19 dic, mattina',
    ])
  })

  it('partecipantiPerTurno: per turno, in ordine, e chi non ha un turno valido', () => {
    const anna = { id: 'a', nome: 'Anna', cognome: 'A' }
    const bruno = { id: 'b', nome: 'Bruno', cognome: 'B' }
    const carla = { id: 'c', nome: 'Carla', cognome: 'C' }
    const r = partecipantiPerTurno(
      [anna, bruno, carla],
      [
        { atleta_id: 'a', partecipa: true, turno: '2026-12-12:pomeriggio' },
        { atleta_id: 'b', partecipa: true, turno: null },
        { atleta_id: 'c', partecipa: true, turno: '2026-12-13:mattina' },
      ],
      ['2026-12-12:mattina', '2026-12-12:pomeriggio'],
    )
    expect(r.perTurno).toEqual([
      { turno: '2026-12-12:mattina', persone: [] },
      { turno: '2026-12-12:pomeriggio', persone: [anna] },
    ])
    expect(r.senzaTurno).toEqual([bruno, carla])
  })

  it('statoSondaggioGara: chi partecipa senza turno a un sondaggio con i turni deve sceglierlo', () => {
    const conTurni = { aperto: true, turni: ['2026-12-12:mattina'] }
    expect(statoSondaggioGara(conTurni, { partecipa: true, turno: null }, GARA, OGGI)).toBe(
      'scegli-turno',
    )
    expect(
      statoSondaggioGara(conTurni, { partecipa: true, turno: '2026-12-12:mattina' }, GARA, OGGI),
    ).toBe('partecipi')
    expect(
      statoSondaggioGara({ ...conTurni, aperto: false }, { partecipa: true }, GARA, OGGI),
    ).toBe('partecipi')
    expect(statoSondaggioGara({ aperto: true }, { partecipa: true }, GARA, OGGI)).toBe('partecipi')
  })
})
