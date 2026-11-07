/**
 * Lettura dei token di UI Top (`design-system/tokens.json`) e dei valori del progetto
 * (`design-system/progetto.json`), con la risoluzione dei colori nei tre temi.
 */

export const TEMI = ['light', 'dark', 'contrast'] as const
export type Tema = (typeof TEMI)[number]

/** Valore di un colore: uguale in tutti i temi, oppure uno per tema (il tema alto contrasto può mancare). */
export type ValoreColore = string | { light: string; dark: string; contrast?: string }

export interface TokenSemplice {
  name: string
  value: string | { light: string; dark: string; contrast?: string }
}

export interface StileTesto {
  name: string
  fontSize: string
  lineHeight: string
  fontWeight: number
  letterSpacing?: string
}

/** La parte di `tokens.json` che usiamo. */
export interface TokensUiTop {
  color: { tokens: { name: string; value: ValoreColore }[] }
  type: { families: Record<string, string>; groups: { family: string; styles: StileTesto[] }[] }
  spacing: { tokens: TokenSemplice[] }
  radius: { tokens: TokenSemplice[] }
  shadow: { tokens: TokenSemplice[] }
  duration: { tokens: TokenSemplice[] }
  easing: { tokens: TokenSemplice[] }
  size: { tokens: TokenSemplice[] }
  zIndex: { tokens: TokenSemplice[] }
  opacity: { tokens: TokenSemplice[] }
  layout: { tokens: TokenSemplice[] }
  scale: { tokens: TokenSemplice[] }
}

export interface ValoriProgetto {
  color: Record<string, ValoreColore>
}

/** Un colore con il suo valore già risolto in ciascuno dei tre temi. */
export type ColoriPerTema = Map<string, Record<Tema, string>>

const RIFERIMENTO = /^\{([a-z0-9-]+)\}$/

/**
 * Unisce i colori di UI Top con quelli del progetto (che vincono) e risolve:
 * - il tema alto contrasto mancante, che eredita dal tema chiaro;
 * - i riferimenti come `{border-subtle}`, che diventano il valore di quel token.
 */
export function risolviColori(tokens: TokensUiTop, progetto: ValoriProgetto): ColoriPerTema {
  const grezzi = new Map<string, ValoreColore>()
  for (const t of tokens.color.tokens) grezzi.set(t.name, t.value)
  for (const [nome, valore] of Object.entries(progetto.color)) grezzi.set(nome, valore)

  const perTema = (valore: ValoreColore, tema: Tema): string => {
    if (typeof valore === 'string') return valore
    if (tema === 'contrast') return valore.contrast ?? valore.light
    return valore[tema]
  }

  const risolvi = (nome: string, tema: Tema, visti: string[]): string => {
    const valore = grezzi.get(nome)
    if (valore === undefined) throw new Error(`Token di colore sconosciuto: ${nome}`)
    if (visti.includes(nome))
      throw new Error(`Riferimento circolare: ${[...visti, nome].join(' → ')}`)
    const v = perTema(valore, tema)
    const rif = RIFERIMENTO.exec(v)
    return rif?.[1] ? risolvi(rif[1], tema, [...visti, nome]) : v
  }

  const risultato: ColoriPerTema = new Map()
  for (const nome of grezzi.keys()) {
    risultato.set(nome, {
      light: risolvi(nome, 'light', []),
      dark: risolvi(nome, 'dark', []),
      contrast: risolvi(nome, 'contrast', []),
    })
  }
  return risultato
}
