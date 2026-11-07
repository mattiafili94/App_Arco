import { TEMI, type ColoriPerTema, type Tema } from './temi.ts'

/** Luminanza relativa WCAG di un colore `#rrggbb`. */
export function luminanza(hex: string): number {
  const m = /^#([0-9a-f]{6})$/i.exec(hex)
  if (!m?.[1]) throw new Error(`Colore non valido per il calcolo del contrasto: ${hex}`)
  const canali = [0, 2, 4].map((i) => parseInt(m[1]!.slice(i, i + 2), 16) / 255)
  const [r, g, b] = canali.map((c) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  ) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Rapporto di contrasto WCAG tra due colori (da 1 a 21). */
export function rapportoContrasto(a: string, b: string): number {
  const [chiaro, scuro] = [luminanza(a), luminanza(b)].sort((x, y) => y - x) as [number, number]
  return (chiaro + 0.05) / (scuro + 0.05)
}

export interface Coppia {
  testo: string
  sfondo: string
  /** Minimo richiesto: 4.5 per il testo, 3 per bordi significativi, icone e anello del focus. */
  minimo: number
  /** Minimo nel tema alto contrasto (UI Top: testo almeno 7:1, bordi 3:1). */
  minimoAltoContrasto?: number
}

const SFONDI = ['background-canvas', 'background-surface', 'background-elevated']

/** Le coppie di colori che UI Top richiede di verificare in ogni tema. */
export const COPPIE: Coppia[] = [
  ...SFONDI.flatMap((sfondo) => [
    { testo: 'text-primary', sfondo, minimo: 4.5, minimoAltoContrasto: 7 },
    { testo: 'text-secondary', sfondo, minimo: 4.5, minimoAltoContrasto: 7 },
    { testo: 'accent-default', sfondo, minimo: 4.5 },
    { testo: 'status-success', sfondo, minimo: 4.5 },
    { testo: 'status-warning', sfondo, minimo: 4.5 },
    { testo: 'status-error', sfondo, minimo: 4.5 },
    { testo: 'status-info', sfondo, minimo: 4.5 },
    { testo: 'border-strong', sfondo, minimo: 3 },
    { testo: 'focus-ring', sfondo, minimo: 3 },
  ]),
  { testo: 'on-accent', sfondo: 'accent-default', minimo: 4.5 },
  { testo: 'on-accent', sfondo: 'accent-hover', minimo: 4.5 },
  { testo: 'on-accent', sfondo: 'accent-pressed', minimo: 4.5 },
  { testo: 'text-primary', sfondo: 'state-selected', minimo: 4.5 },
  { testo: 'accent-default', sfondo: 'state-selected', minimo: 3 },
  ...(['success', 'warning', 'error', 'info'] as const).flatMap((stato) => [
    { testo: 'text-primary', sfondo: `status-${stato}-subtle`, minimo: 4.5 },
    { testo: `status-${stato}`, sfondo: `status-${stato}-subtle`, minimo: 3 },
  ]),
]

export interface Violazione {
  tema: Tema
  coppia: Coppia
  rapporto: number
  richiesto: number
}

/** Restituisce le coppie che non raggiungono il contrasto minimo, in ogni tema. */
export function verificaContrasti(colori: ColoriPerTema, coppie: Coppia[] = COPPIE): Violazione[] {
  const violazioni: Violazione[] = []
  for (const tema of TEMI) {
    for (const coppia of coppie) {
      const testo = colori.get(coppia.testo)?.[tema]
      const sfondo = colori.get(coppia.sfondo)?.[tema]
      if (!testo || !sfondo)
        throw new Error(`Coppia con token mancante: ${coppia.testo} / ${coppia.sfondo}`)
      const richiesto =
        tema === 'contrast' ? (coppia.minimoAltoContrasto ?? coppia.minimo) : coppia.minimo
      const rapporto = rapportoContrasto(testo, sfondo)
      if (rapporto < richiesto) violazioni.push({ tema, coppia, rapporto, richiesto })
    }
  }
  return violazioni
}
