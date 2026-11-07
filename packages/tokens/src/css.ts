import { risolviColori, type Tema, type TokensUiTop, type ValoriProgetto } from './temi.ts'

/**
 * Converte i pixel in rem (16px = 1rem), così i testi seguono la dimensione del testo
 * scelta dall'atleta sul telefono (UI Top: "Respect the user's text size").
 */
export function inRem(valore: string): string {
  const px = /^(\d+(?:\.\d+)?)px$/.exec(valore)
  return px?.[1] ? `${Number(px[1]) / 16}rem` : valore
}

/**
 * Genera `tokens.css`: tutte le variabili CSS dei token e le classi dei ruoli di testo.
 *
 * Temi: senza attributo `data-theme` sulla radice si segue il sistema (chiaro o scuro);
 * con `data-theme="light" | "dark" | "contrast"` si forza il tema scelto dall'atleta.
 */
export function generaCss(tokens: TokensUiTop, progetto: ValoriProgetto): string {
  const colori = risolviColori(tokens, progetto)
  const righeColori = (tema: Tema, rientro: string) =>
    [...colori].map(([nome, valori]) => `${rientro}--${nome}: ${valori[tema]};`).join('\n')

  const semplici: string[] = []
  const ombreScure: string[] = []
  const gruppi = [
    tokens.spacing,
    tokens.radius,
    tokens.shadow,
    tokens.duration,
    tokens.easing,
    tokens.size,
    tokens.zIndex,
    tokens.opacity,
    tokens.layout,
    tokens.scale,
  ]
  for (const gruppo of gruppi) {
    for (const t of gruppo.tokens) {
      if (typeof t.value === 'string') {
        semplici.push(`  --${t.name}: ${t.value};`)
      } else {
        semplici.push(`  --${t.name}: ${t.value.light};`)
        ombreScure.push(`  --${t.name}: ${t.value.dark};`)
      }
    }
  }

  const famiglie = Object.entries(tokens.type.families).map(
    ([nome, valore]) => `  --font-${nome}: ${valore};`,
  )

  const classiTesto: string[] = []
  for (const gruppo of tokens.type.groups) {
    for (const s of gruppo.styles) {
      const proprieta = [
        `font-family: var(--font-${gruppo.family});`,
        `font-size: ${inRem(s.fontSize)};`,
        `line-height: ${inRem(s.lineHeight)};`,
        `font-weight: ${s.fontWeight};`,
        s.letterSpacing ? `letter-spacing: ${s.letterSpacing};` : '',
        s.name === 'numeric' ? 'font-variant-numeric: tabular-nums;' : '',
      ].filter(Boolean)
      classiTesto.push(`.type-${s.name} {\n  ${proprieta.join('\n  ')}\n}`)
    }
  }

  const scuro = `${righeColori('dark', '  ')}\n${ombreScure.join('\n')}`

  return `/*
 * FILE GENERATO: non modificare a mano.
 * Fonte: design-system/tokens.json (UI Top) + design-system/progetto.json.
 * Per rigenerarlo: npm run tokens
 */

:root {
${semplici.join('\n')}
${famiglie.join('\n')}
}

:root,
:root[data-theme='light'] {
  color-scheme: light;
${righeColori('light', '  ')}
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme]) {
    color-scheme: dark;
${righeColori('dark', '    ')}
${ombreScure.map((r) => `  ${r}`).join('\n')}
  }
}

:root[data-theme='dark'] {
  color-scheme: dark;
${scuro}
}

:root[data-theme='contrast'] {
  color-scheme: light;
${righeColori('contrast', '  ')}
}

${classiTesto.join('\n\n')}
`
}
