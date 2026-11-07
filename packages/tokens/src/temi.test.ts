import { describe, expect, it } from 'vitest'
import { risolviColori, type TokensUiTop } from './temi.ts'

const base = (colori: TokensUiTop['color']['tokens']): TokensUiTop =>
  ({ color: { tokens: colori } }) as TokensUiTop

describe('risolviColori', () => {
  it('usa il tema chiaro quando manca il valore per l alto contrasto', () => {
    const colori = risolviColori(
      base([{ name: 'text-primary', value: { light: '#111111', dark: '#eeeeee' } }]),
      { color: {} },
    )
    expect(colori.get('text-primary')).toEqual({
      light: '#111111',
      dark: '#eeeeee',
      contrast: '#111111',
    })
  })

  it('applica lo stesso valore a tutti i temi quando è una stringa', () => {
    const colori = risolviColori(base([{ name: 'target-gold', value: '#ffe552' }]), { color: {} })
    expect(colori.get('target-gold')).toEqual({
      light: '#ffe552',
      dark: '#ffe552',
      contrast: '#ffe552',
    })
  })

  it('dà la precedenza ai valori del progetto e aggiunge i token nuovi', () => {
    const colori = risolviColori(
      base([{ name: 'accent-default', value: { light: '#1d5bd6', dark: '#7aa7ff' } }]),
      {
        color: {
          'accent-default': { light: '#1e4fa8', dark: '#8cb2ff', contrast: '#0f3070' },
          'target-red': '#f65058',
        },
      },
    )
    expect(colori.get('accent-default')?.light).toBe('#1e4fa8')
    expect(colori.get('accent-default')?.contrast).toBe('#0f3070')
    expect(colori.get('target-red')?.dark).toBe('#f65058')
  })

  it('risolve i riferimenti a un altro token, tema per tema', () => {
    const colori = risolviColori(
      base([
        {
          name: 'border-subtle',
          value: { light: '#e2e2df', dark: '#2c2f34', contrast: '#6b7076' },
        },
        { name: 'chart-grid', value: { light: '{border-subtle}', dark: '{border-subtle}' } },
      ]),
      { color: {} },
    )
    expect(colori.get('chart-grid')).toEqual({
      light: '#e2e2df',
      dark: '#2c2f34',
      contrast: '#6b7076',
    })
  })

  it('segnala un riferimento a un token che non esiste', () => {
    expect(() =>
      risolviColori(base([{ name: 'a', value: '{inesistente}' }]), { color: {} }),
    ).toThrow('Token di colore sconosciuto: inesistente')
  })

  it('segnala un riferimento circolare', () => {
    expect(() =>
      risolviColori(
        base([
          { name: 'a', value: '{b}' },
          { name: 'b', value: '{a}' },
        ]),
        { color: {} },
      ),
    ).toThrow('Riferimento circolare')
  })
})
