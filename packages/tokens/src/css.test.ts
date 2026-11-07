import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { generaCss } from './css.ts'
import type { TokensUiTop, ValoriProgetto } from './temi.ts'

const leggi = <T>(percorso: string): T =>
  JSON.parse(readFileSync(new URL(`../../../${percorso}`, import.meta.url), 'utf8')) as T

const css = generaCss(
  leggi<TokensUiTop>('design-system/tokens.json'),
  leggi<ValoriProgetto>('design-system/progetto.json'),
)

describe('generaCss', () => {
  it('definisce i tre temi e il tema di sistema', () => {
    expect(css).toContain(":root[data-theme='light']")
    expect(css).toContain(":root[data-theme='dark']")
    expect(css).toContain(":root[data-theme='contrast']")
    expect(css).toContain('@media (prefers-color-scheme: dark)')
    expect(css).toContain(':root:not([data-theme])')
  })

  it('usa il blu società nel tema chiaro e nell alto contrasto', () => {
    const chiaro = css.split(":root[data-theme='light']")[1]!.split('}')[0]!
    const altoContrasto = css.split(":root[data-theme='contrast']")[1]!.split('}')[0]!
    expect(chiaro).toContain('--accent-default: #1e4fa8;')
    expect(altoContrasto).toContain('--accent-default: #0f3070;')
  })

  it('include i colori del bersaglio e le misure del design system', () => {
    expect(css).toContain('--target-gold: #ffe552;')
    expect(css).toContain('--control-touch: 48px;')
    expect(css).toContain('--space-16: 16px;')
  })

  it('usa le ombre del tema scuro nel tema scuro', () => {
    const scuro = css.split(":root[data-theme='dark']")[1]!.split('}')[0]!
    expect(scuro).toContain('--shadow-floating: 0 1px 2px rgba(0,0,0,0.4)')
  })

  it('crea le classi dei ruoli di testo, con cifre tabellari per i numeri', () => {
    expect(css).toContain('.type-page-title {')
    expect(css).toMatch(/\.type-numeric \{[^}]*font-variant-numeric: tabular-nums;/)
    expect(css).toMatch(/\.type-page-title \{[^}]*letter-spacing: -0\.02em;/)
  })

  it('coincide con il file tokens.css salvato nella repo', () => {
    const salvato = readFileSync(
      new URL('../../../apps/web/src/styles/tokens.css', import.meta.url),
      'utf8',
    ).replace(/\r\n/g, '\n')
    expect(salvato).toBe(css)
  })
})
