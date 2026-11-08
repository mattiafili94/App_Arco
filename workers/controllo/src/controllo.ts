/**
 * Controllo automatico (Fase 2.5): a ogni chiamata del cron chiama la funzione Supabase
 * `aggiorna-fitarco`, che fa al massimo qualche lettura da Fitarco (vedi CLAUDE.md).
 * Tiene anche sveglio Supabase (il piano gratuito va in pausa dopo una settimana senza attività).
 *
 * Orario scelto da Mattia (9/11/2026): ogni 30 minuti dalle 7:00 alle 22:30, ora italiana.
 */

export interface Ambiente {
  /** Indirizzo della funzione aggiorna-fitarco (in wrangler.toml). */
  URL_FUNZIONE: string
  /** Chiave della funzione: segreto del Worker, mai nel codice. */
  AGGIORNA_CHIAVE?: string
}

export const ORA_INIZIO = 7
/** Esclusa: l'ultima chiamata è alle 22:30. */
export const ORA_FINE = 23

/** L'ora (0–23) in Italia, con l'ora legale. */
export function oraItaliana(istante: Date): number {
  const ora = new Intl.DateTimeFormat('it-IT', {
    timeZone: 'Europe/Rome',
    hour: 'numeric',
    hourCycle: 'h23',
  }).format(istante)
  return Number(ora)
}

export function inOrario(istante: Date): boolean {
  const ora = oraItaliana(istante)
  return ora >= ORA_INIZIO && ora < ORA_FINE
}

export interface EsitoControllo {
  /** La funzione è stata chiamata. */
  chiamata: boolean
  /** Riassunto per i log di Cloudflare. */
  esito: string
}

interface RiepilogoFunzione {
  eseguite?: { esito: string }[]
  richiesteFitarco?: number
  fermato?: string | null
}

export async function controlla(
  env: Ambiente,
  istante: Date,
  f: typeof fetch = fetch,
): Promise<EsitoControllo> {
  if (!inOrario(istante)) return { chiamata: false, esito: 'Fuori orario: niente da fare' }
  if (!env.AGGIORNA_CHIAVE) {
    return { chiamata: false, esito: 'Manca il segreto AGGIORNA_CHIAVE del Worker' }
  }
  try {
    const risposta = await f(env.URL_FUNZIONE, {
      method: 'POST',
      headers: { 'x-aggiorna-chiave': env.AGGIORNA_CHIAVE, 'content-type': 'application/json' },
      body: '{}',
    })
    const testo = await risposta.text()
    if (!risposta.ok) {
      return {
        chiamata: true,
        esito: `La funzione ha risposto ${risposta.status}: ${testo.slice(0, 200)}`,
      }
    }
    const r = JSON.parse(testo) as RiepilogoFunzione
    const letture = r.eseguite?.length ?? 0
    const errori = r.eseguite?.filter((e) => e.esito === 'errore').length ?? 0
    return {
      chiamata: true,
      esito:
        `${letture} letture (${errori} con errore), ${r.richiesteFitarco ?? 0} richieste a Fitarco` +
        (r.fermato ? `. Fermato: ${r.fermato}` : ''),
    }
  } catch (errore) {
    return { chiamata: true, esito: `Funzione non raggiungibile: ${String(errore)}` }
  }
}
