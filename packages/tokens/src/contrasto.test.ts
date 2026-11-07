import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { rapportoContrasto, luminanza, verificaContrasti, COPPIE } from './contrasto.ts'
import { risolviColori, type TokensUiTop, type ValoriProgetto } from './temi.ts'

const leggi = <T>(percorso: string): T =>
  JSON.parse(readFileSync(new URL(`../../../${percorso}`, import.meta.url), 'utf8')) as T

describe('rapportoContrasto', () => {
  it('vale 21 tra nero e bianco e 1 tra due colori uguali', () => {
    expect(rapportoContrasto('#000000', '#ffffff')).toBeCloseTo(21, 5)
    expect(rapportoContrasto('#ffffff', '#000000')).toBeCloseTo(21, 5)
    expect(rapportoContrasto('#1e4fa8', '#1e4fa8')).toBe(1)
  })

  it('calcola il valore WCAG noto per il grigio #767676 su bianco', () => {
    expect(rapportoContrasto('#767676', '#ffffff')).toBeCloseTo(4.54, 2)
  })

  it('rifiuta un colore che non è #rrggbb', () => {
    expect(() => luminanza('rgba(0,0,0,0.5)')).toThrow('Colore non valido')
  })
})

describe('verificaContrasti', () => {
  it('trova una coppia con contrasto insufficiente, indicando il tema', () => {
    const colori = new Map([
      ['testo', { light: '#999999', dark: '#ffffff', contrast: '#000000' }],
      ['sfondo', { light: '#ffffff', dark: '#000000', contrast: '#ffffff' }],
    ])
    const violazioni = verificaContrasti(colori, [
      { testo: 'testo', sfondo: 'sfondo', minimo: 4.5 },
    ])
    expect(violazioni).toHaveLength(1)
    expect(violazioni[0]?.tema).toBe('light')
  })

  it('nel tema alto contrasto applica il minimo più severo', () => {
    const colori = new Map([
      ['testo', { light: '#6a6a6a', dark: '#ffffff', contrast: '#6a6a6a' }],
      ['sfondo', { light: '#ffffff', dark: '#000000', contrast: '#ffffff' }],
    ])
    const violazioni = verificaContrasti(colori, [
      { testo: 'testo', sfondo: 'sfondo', minimo: 4.5, minimoAltoContrasto: 7 },
    ])
    expect(violazioni.map((v) => v.tema)).toEqual(['contrast'])
  })

  it('segnala una coppia che usa un token inesistente', () => {
    expect(() => verificaContrasti(new Map(), [{ testo: 'x', sfondo: 'y', minimo: 3 }])).toThrow(
      'Coppia con token mancante',
    )
  })

  it('i colori reali del progetto rispettano tutte le coppie nei 3 temi', () => {
    const colori = risolviColori(
      leggi<TokensUiTop>('design-system/tokens.json'),
      leggi<ValoriProgetto>('design-system/progetto.json'),
    )
    expect(verificaContrasti(colori)).toEqual([])
    expect(COPPIE.length).toBeGreaterThan(30)
  })
})
