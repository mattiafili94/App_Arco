/// <reference types="node" />
// Esempi di risposte Fitarco per i test: formato e punteggi veri, nomi/matricole/contatti finti
// (anonimizzati prima di entrare nella repo, regola di CLAUDE.md).
import { readFileSync } from 'node:fs'
import type { RigaTesto } from '../fitarco'

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

/** Righe di testo estratte dai PDF veri dei risultati (una per tipo di gara), anonimizzate. */
export type EsempioRisultati = '18m' | '70m' | '12+12' | '3d' | 'doppio-70m' | '24+24' | '25+18'

/** Formato del file: una riga per riga del PDF, `pagina<TAB>altezza<TAB>testo`. */
export function esempioRisultati(nome: EsempioRisultati): RigaTesto[] {
  const testo = readFileSync(new URL(`./esempi/risultati-${nome}.txt`, import.meta.url), 'utf8')
  return testo
    .split('\n')
    .filter((r) => r !== '')
    .map((r) => {
      const [pagina, y, ...resto] = r.split('\t')
      return { pagina: Number(pagina), y: Number(y), testo: resto.join('\t') }
    })
}
