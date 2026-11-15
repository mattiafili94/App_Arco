import { describe, expect, it } from 'vitest'
import {
  elencoNomi,
  puoAprireSondaggio,
  riepilogoSondaggio,
  sondaggioRispondibile,
  statoSondaggioGara,
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
