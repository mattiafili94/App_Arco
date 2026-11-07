/**
 * Controlli automatici del design system sul codice dell'app (sezione Checks di UI Top):
 * niente colori scritti a mano, niente token usati senza essere definiti, niente emoji.
 */

export interface Segnalazione {
  file: string
  riga: number
  testo: string
}

const COLORE_GREZZO = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/g
const EMOJI_O_ROTTI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FFFD}]/u

/** Trova colori scritti a mano (`#abc`, `rgb(`, `hsl(`) fuori dal file dei token. */
export function trovaColoriGrezzi(file: string, contenuto: string): Segnalazione[] {
  const segnalazioni: Segnalazione[] = []
  contenuto.split('\n').forEach((riga, i) => {
    // Gli ancoraggi `href="#..."` e i commenti non sono colori.
    const pulita = riga.replace(/href=["'`]#[^"'`]*["'`]/g, '').replace(/\/\/.*$|\/\*.*?\*\//g, '')
    if (COLORE_GREZZO.test(pulita)) segnalazioni.push({ file, riga: i + 1, testo: riga.trim() })
    COLORE_GREZZO.lastIndex = 0
  })
  return segnalazioni
}

/** Trova emoji e caratteri rotti (U+FFFD) nei testi dell'interfaccia. */
export function trovaEmoji(file: string, contenuto: string): Segnalazione[] {
  const segnalazioni: Segnalazione[] = []
  contenuto.split('\n').forEach((riga, i) => {
    if (EMOJI_O_ROTTI.test(riga)) segnalazioni.push({ file, riga: i + 1, testo: riga.trim() })
  })
  return segnalazioni
}

/** Nomi delle variabili CSS usate con `var(--nome)`. */
export function variabiliUsate(contenuto: string): Set<string> {
  return new Set([...contenuto.matchAll(/var\(--([a-z0-9-]+)/g)].map((m) => m[1]!))
}

/** Nomi delle variabili CSS definite (`--nome:`). */
export function variabiliDefinite(contenuto: string): Set<string> {
  return new Set(
    [...contenuto.matchAll(/(?:^|[\s{;'"])--([a-z0-9-]+)['"]?\s*:/gm)].map((m) => m[1]!),
  )
}

/** Variabili usate ma mai definite: l'elemento non riceverebbe nessun valore. */
export function tokenNonDefiniti(usate: Set<string>, definite: Set<string>): string[] {
  return [...usate].filter((nome) => !definite.has(nome)).sort()
}
