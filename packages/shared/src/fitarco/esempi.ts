/// <reference types="node" />
// Esempi di risposte Fitarco per i test: formato e punteggi veri, nomi/matricole/contatti finti
// (anonimizzati prima di entrare nella repo, regola di CLAUDE.md).
import { readFileSync } from 'node:fs'

export type Esempio =
  | 'calendario'
  | 'scheda-gara'
  | 'scheda-gara-futura'
  | 'invito'
  | 'scheda-atleta'
  | 'tesserati'
  | 'ranking'

export function esempio(nome: Esempio): string {
  return readFileSync(new URL(`./esempi/${nome}.html`, import.meta.url), 'utf8')
}
