/**
 * Genera apps/web/src/styles/tokens.css e verifica i contrasti.
 *
 *   npm run tokens          → scrive il file
 *   npm run tokens:check    → controlla che il file sia aggiornato (usato su GitHub)
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { generaCss } from '../src/css.ts'
import { verificaContrasti } from '../src/contrasto.ts'
import { risolviColori, type TokensUiTop, type ValoriProgetto } from '../src/temi.ts'

const radice = fileURLToPath(new URL('../../../', import.meta.url))
const leggiJson = <T>(percorso: string): T =>
  JSON.parse(readFileSync(radice + percorso, 'utf8')) as T

const tokens = leggiJson<TokensUiTop>('design-system/tokens.json')
const progetto = leggiJson<ValoriProgetto>('design-system/progetto.json')
const destinazione = radice + 'apps/web/src/styles/tokens.css'

const violazioni = verificaContrasti(risolviColori(tokens, progetto))
if (violazioni.length > 0) {
  console.error('Contrasto insufficiente:')
  for (const v of violazioni) {
    console.error(
      `  [${v.tema}] ${v.coppia.testo} su ${v.coppia.sfondo}: ${v.rapporto.toFixed(2)} (minimo ${v.richiesto})`,
    )
  }
  process.exit(1)
}

const css = generaCss(tokens, progetto)

if (process.argv.includes('--check')) {
  let attuale = ''
  try {
    attuale = readFileSync(destinazione, 'utf8')
  } catch {
    // il file non esiste ancora
  }
  if (attuale.replace(/\r\n/g, '\n') !== css) {
    console.error('tokens.css non è aggiornato. Esegui: npm run tokens')
    process.exit(1)
  }
  console.log('tokens.css aggiornato, contrasti OK nei 3 temi.')
} else {
  writeFileSync(destinazione, css)
  console.log('Scritto apps/web/src/styles/tokens.css, contrasti OK nei 3 temi.')
}
