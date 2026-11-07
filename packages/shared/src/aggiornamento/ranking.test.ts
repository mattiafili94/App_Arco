import { describe, expect, it } from 'vitest'
import { combinazioniRanking } from '../aggiornamento'

const indoor = { tipologia: '18 m', divisione: 'OL' }

describe('combinazioni di ranking da chiedere', () => {
  it('una combinazione per tipo, divisione, classe e genere, senza doppioni', () => {
    const combinazioni = combinazioniRanking([
      {
        id: 'a1',
        classiRanking: { Indoor: 'SM', Outdoor: 'SM', Campagna: 'SM', '3D': 'SM' },
        gare: [
          indoor,
          { tipologia: '25+18 m', divisione: 'OL' },
          { tipologia: '12+12', divisione: 'AN' },
        ],
      },
      { id: 'a2', classiRanking: { Indoor: 'SM' }, gare: [indoor] },
      {
        id: 'a3',
        classiRanking: { Indoor: 'MF' },
        gare: [indoor, { tipologia: '18 m', divisione: 'CO' }],
      },
    ])
    expect(combinazioni).toEqual([
      { tipo: 'I', divisione: 'OL', classe: 'S', genere: 'M', atleti: ['a1', 'a2'] },
      { tipo: 'C', divisione: 'AN', classe: 'S', genere: 'M', atleti: ['a1'] },
      { tipo: 'I', divisione: 'OL', classe: 'M', genere: 'F', atleti: ['a3'] },
      { tipo: 'I', divisione: 'CO', classe: 'M', genere: 'F', atleti: ['a3'] },
    ])
  })

  it('salta classi senza ranking, tipi sconosciuti e gare non gestite', () => {
    expect(
      combinazioniRanking([
        { id: 'a1', classiRanking: { Indoor: 'GM', Altro: 'SM', Outdoor: 'SX' }, gare: [indoor] },
        {
          id: 'a2',
          classiRanking: { Indoor: 'SM' },
          gare: [{ tipologia: 'Altro', divisione: 'OL' }],
        },
      ]),
    ).toEqual([])
  })
})
