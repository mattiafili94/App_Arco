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
      { atleta_id: 'a1', divisione: 'OL', totale: 534 },
      { atleta_id: null, divisione: 'OL', totale: 552 },
      { atleta_id: 'a3', divisione: 'OL', totale: 500 },
    ]
    expect(
      controllaClassifica(righe, [
        { atletaId: 'a1', divisione: 'OL', totale: 534 },
        { atletaId: 'a2', divisione: 'OL', totale: 520 },
        { atletaId: 'a3', divisione: 'OL', totale: 501 },
        { atletaId: 'a3', divisione: 'OL', totale: null },
      ]),
    ).toEqual([
      { atletaId: 'a2', divisione: 'OL', motivo: 'non-trovato' },
      { atletaId: 'a3', divisione: 'OL', motivo: 'totale-diverso' },
    ])
  })

  it('stesso arciere, stessa gara, due archi: ogni arco col suo totale', () => {
    // Due sessioni: ricurvo (534) e nudo (480).
    const righe = [
      { atleta_id: 'a1', divisione: 'OL', totale: 534 },
      { atleta_id: 'a1', divisione: 'AN', totale: 480 },
    ]
    const attesi = [
      { atletaId: 'a1', divisione: 'OL', totale: 534 },
      { atletaId: 'a1', divisione: 'AN', totale: 480 },
    ]
    expect(controllaClassifica(righe, attesi)).toEqual([])
    // Se i totali fossero confrontati senza guardare l'arco, uno scambio non si noterebbe.
    const scambiati = [
      { atleta_id: 'a1', divisione: 'OL', totale: 480 },
      { atleta_id: 'a1', divisione: 'AN', totale: 534 },
    ]
    expect(controllaClassifica(scambiati, attesi).map((a) => a.divisione)).toEqual(['OL', 'AN'])
    // Manca la riga del secondo arco.
    expect(controllaClassifica(righe.slice(0, 1), attesi)).toEqual([
      { atletaId: 'a1', divisione: 'AN', motivo: 'non-trovato' },
    ])
  })
})
