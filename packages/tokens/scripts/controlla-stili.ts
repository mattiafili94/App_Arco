/**
 * Controlli del design system sul codice dell'app (npm run check:design):
 * - nessun colore scritto a mano fuori da tokens.css;
 * - nessuna variabile CSS usata senza essere definita;
 * - nessuna emoji o carattere rotto nei file dell'interfaccia.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  tokenNonDefiniti,
  trovaColoriGrezzi,
  trovaEmoji,
  variabiliDefinite,
  variabiliUsate,
  type Segnalazione,
} from '../src/stili.ts'

const radice = fileURLToPath(new URL('../../../', import.meta.url))
const cartella = join(radice, 'apps/web/src')

const elencaFile = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((voce) => {
    const percorso = join(dir, voce.name)
    return voce.isDirectory() ? elencaFile(percorso) : [percorso]
  })

const file = elencaFile(cartella).filter((f) => /\.(css|tsx?)$/.test(f) && !/\.test\.tsx?$/.test(f))
const contenuti = new Map(
  file.map((f) => [relative(radice, f).replace(/\\/g, '/'), readFileSync(f, 'utf8')]),
)

const colori: Segnalazione[] = []
const emoji: Segnalazione[] = []
const usate = new Set<string>()
const definite = new Set<string>()
for (const [nome, testo] of contenuti) {
  if (!nome.endsWith('styles/tokens.css')) colori.push(...trovaColoriGrezzi(nome, testo))
  emoji.push(...trovaEmoji(nome, testo))
  variabiliUsate(testo).forEach((v) => usate.add(v))
  variabiliDefinite(testo).forEach((v) => definite.add(v))
}
const mancanti = tokenNonDefiniti(usate, definite)

const stampa = (titolo: string, elenco: Segnalazione[]) => {
  if (elenco.length === 0) return
  console.error(titolo)
  for (const s of elenco) console.error(`  ${s.file}:${s.riga}  ${s.testo}`)
}
stampa('Colori scritti a mano (usa i token):', colori)
stampa('Emoji o caratteri rotti:', emoji)
if (mancanti.length > 0) console.error(`Token usati ma non definiti: ${mancanti.join(', ')}`)

if (colori.length + emoji.length + mancanti.length > 0) process.exit(1)
console.log(`Design system OK: ${contenuti.size} file controllati.`)
