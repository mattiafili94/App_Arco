import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  applicaSceltaTema,
  CHIAVE_TEMA,
  leggiSceltaTema,
  salvaSceltaTema,
  SCELTE_TEMA,
} from './tema'

afterEach(() => vi.restoreAllMocks())

describe('tema', () => {
  it('senza scelta salvata segue il sistema', () => {
    expect(leggiSceltaTema()).toBe('sistema')
  })

  it('salva e rilegge la scelta', () => {
    salvaSceltaTema('alto-contrasto')
    expect(localStorage.getItem(CHIAVE_TEMA)).toBe('alto-contrasto')
    expect(leggiSceltaTema()).toBe('alto-contrasto')
  })

  it('scegliere "sistema" cancella la scelta salvata', () => {
    salvaSceltaTema('scuro')
    salvaSceltaTema('sistema')
    expect(localStorage.getItem(CHIAVE_TEMA)).toBeNull()
  })

  it('ignora un valore salvato non valido', () => {
    localStorage.setItem(CHIAVE_TEMA, 'viola')
    expect(leggiSceltaTema()).toBe('sistema')
  })

  it('funziona anche se la memoria del browser non è accessibile', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloccata')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloccata')
    })
    expect(leggiSceltaTema()).toBe('sistema')
    expect(() => salvaSceltaTema('scuro')).not.toThrow()
  })

  it('applica l attributo data-theme giusto per ogni scelta', () => {
    const radice = document.documentElement
    applicaSceltaTema('chiaro')
    expect(radice.dataset.theme).toBe('light')
    applicaSceltaTema('scuro')
    expect(radice.dataset.theme).toBe('dark')
    applicaSceltaTema('alto-contrasto')
    expect(radice.dataset.theme).toBe('contrast')
    applicaSceltaTema('sistema')
    expect(radice.hasAttribute('data-theme')).toBe(false)
  })

  it('offre quattro scelte con etichette in italiano', () => {
    expect(SCELTE_TEMA.map((s) => s.etichetta)).toEqual([
      'Come il telefono',
      'Chiaro',
      'Scuro',
      'Alto contrasto',
    ])
  })
})
