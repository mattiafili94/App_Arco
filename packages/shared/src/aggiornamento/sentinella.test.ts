import { describe, expect, it } from 'vitest'
import { controllaCalendario, controllaClassifica, controllaStorico } from '../aggiornamento'

describe('sentinella', () => {
  it('avvisa se il calendario si svuota o si dimezza', () => {
    expect(controllaCalendario(51, 0)).toContain('vuoto')
    expect(controllaCalendario(51, 20)).toContain('controllare')
    expect(controllaCalendario(51, 52)).toBeNull()
    expect(controllaCalendario(0, 0)).toBeNull()
  })

  it('avvisa se lo storico di un atleta si accorcia', () => {
    expect(controllaStorico(43, 40)).toContain('40 gare')
    expect(controllaStorico(43, 44)).toBeNull()
  })

  it('controlla che gli atleti attesi siano nel PDF con lo stesso totale', () => {
    const righe = [
      { atleta_id: 'a1', totale: 534 },
      { atleta_id: null, totale: 552 },
      { atleta_id: 'a3', totale: 500 },
    ]
    expect(
      controllaClassifica(righe, [
        { atletaId: 'a1', totale: 534 },
        { atletaId: 'a2', totale: 520 },
        { atletaId: 'a3', totale: 501 },
        { atletaId: 'a3', totale: null },
      ]),
    ).toEqual([
      { atletaId: 'a2', motivo: 'non-trovato' },
      { atletaId: 'a3', motivo: 'totale-diverso' },
    ])
  })
})
