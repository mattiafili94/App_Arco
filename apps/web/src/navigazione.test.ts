import { describe, expect, it } from 'vitest'
import { leggiIndietro } from './navigazione'

describe('dove torna la freccia indietro', () => {
  it('legge "da dove vengo" dallo stato del collegamento', () => {
    expect(
      leggiIndietro({ indietro: { label: '18 m · Ricurvo', href: '/atleti/a/prova/x' } }),
    ).toEqual({ label: '18 m · Ricurvo', href: '/atleti/a/prova/x', state: undefined })
    expect(
      leggiIndietro({ indietro: { label: 'Gara', href: '/gare/R1', state: { altro: 1 } } }),
    ).toEqual({ label: 'Gara', href: '/gare/R1', state: { altro: 1 } })
  })

  it('senza stato, o con uno stato strano, niente (la pagina usa il suo genitore)', () => {
    expect(leggiIndietro(null)).toBeNull()
    expect(leggiIndietro(undefined)).toBeNull()
    expect(leggiIndietro('ciao')).toBeNull()
    expect(leggiIndietro({})).toBeNull()
    expect(leggiIndietro({ indietro: null })).toBeNull()
    expect(leggiIndietro({ indietro: { label: 3, href: '/x' } })).toBeNull()
    // Mai fuori dall'app.
    expect(leggiIndietro({ indietro: { label: 'X', href: 'https://esempio.it' } })).toBeNull()
  })
})
