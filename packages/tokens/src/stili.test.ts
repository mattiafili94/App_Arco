import { describe, expect, it } from 'vitest'
import {
  tokenNonDefiniti,
  trovaColoriGrezzi,
  trovaEmoji,
  variabiliDefinite,
  variabiliUsate,
} from './stili.ts'

describe('trovaColoriGrezzi', () => {
  it('trova esadecimali, rgb e hsl scritti a mano, con il numero di riga', () => {
    const css =
      '.a { color: var(--text-primary); }\n.b { color: #fff; }\n.c { background: rgba(0,0,0,.5); }\n.d { color: hsl(0 0% 0%); }'
    expect(trovaColoriGrezzi('x.css', css).map((s) => s.riga)).toEqual([2, 3, 4])
  })

  it('ignora i link con ancora e i commenti', () => {
    const tsx = '<a href="#gare">Gare</a>\n// colore #fff solo nel commento\n/* #000 */ const a = 1'
    expect(trovaColoriGrezzi('x.tsx', tsx)).toEqual([])
  })
})

describe('trovaEmoji', () => {
  it('trova emoji e il carattere di sostituzione', () => {
    expect(trovaEmoji('x.tsx', 'Bravo 🎯\nok\nrotto �').map((s) => s.riga)).toEqual([1, 3])
  })

  it('accetta testo italiano con accenti', () => {
    expect(trovaEmoji('x.tsx', 'Città, perché, volée')).toEqual([])
  })
})

describe('variabili CSS', () => {
  it('distingue variabili usate e definite', () => {
    const css =
      ':root {\n  --space-8: 8px;\n}\n.a { gap: var(--space-8); color: var(--text-primary); }'
    expect([...variabiliUsate(css)].sort()).toEqual(['space-8', 'text-primary'])
    expect([...variabiliDefinite(css)]).toEqual(['space-8'])
  })

  it('riconosce le variabili definite in linea in un componente', () => {
    const tsx = "<div style={{ '--indice': 2 } as CSSProperties} />"
    expect(variabiliDefinite(tsx).has('indice')).toBe(true)
  })

  it('elenca i token usati ma non definiti', () => {
    expect(tokenNonDefiniti(new Set(['a', 'b', 'c']), new Set(['b']))).toEqual(['a', 'c'])
  })
})
