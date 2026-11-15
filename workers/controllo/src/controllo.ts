/**
 * Controllo automatico (Fase 2.5): a ogni chiamata del cron chiama la funzione Supabase
 * `aggiorna-fitarco`, che fa al massimo qualche lettura da Fitarco (vedi CLAUDE.md).
 * Tiene anche sveglio Supabase (il piano gratuito va in pausa dopo una settimana senza attività).
 *
 * Orario scelto da Mattia (9/11/2026): ogni 15 minuti dalle 7:00 alle 22:45, ora italiana.
 * Dal 15/11/2026 il lunedì ogni 5 minuti (è il giorno delle classifiche): il cron sveglia il Worker ogni 5 minuti
 * e gli altri giorni si chiama la funzione solo ai minuti 0, 15, 30 e 45.
 * Dal 15/11/2026 (Mattia) il cron sveglia il Worker ogni minuto: tra un giro e l'altro chiede alla funzione di
 * mandare solo le notifiche in coda (`{"azione":"notifiche"}`, nessuna richiesta a Fitarco), così sondaggi, inviti
 * e avvisi del programma arrivano entro un minuto.
 */

export interface Ambiente {
  /** Indirizzo della funzione aggiorna-fitarco (in wrangler.toml). */
  URL_FUNZIONE: string
  /** Chiave della funzione: segreto del Worker, mai nel codice. */
  AGGIORNA_CHIAVE?: string
}

export const ORA_INIZIO = 7
/** Esclusa: l'ultima chiamata è alle 22:45. */
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

/** È lunedì in Italia? */
export function eLunedi(istante: Date): boolean {
  return (
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Rome', weekday: 'short' }).format(
      istante,
    ) === 'Mon'
  )
}

/** Minuti tra due chiamate: 5 il lunedì, 15 gli altri giorni. */
export const MINUTI_LUNEDI = 5
export const MINUTI_ALTRI_GIORNI = 15

/** Questo risveglio del cron (ogni minuto) deve fare un giro di letture? */
export function daChiamare(istante: Date): boolean {
  if (!inOrario(istante)) return false
  // I minuti sono gli stessi in Italia e in UTC (il fuso cambia di ore intere).
  const passo = eLunedi(istante) ? MINUTI_LUNEDI : MINUTI_ALTRI_GIORNI
  return istante.getUTCMinutes() % passo === 0
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

interface RiepilogoInvio {
  inviate?: number
}

interface RispostaNotifiche {
  notifiche?: string | { errore?: string; [tipo: string]: RiepilogoInvio | string | undefined }
}

/** "Solo notifiche: 2 inviate" (o perché non sono partite). */
function riassumiNotifiche(r: RispostaNotifiche): string {
  const n = r.notifiche
  if (typeof n === 'string') return `Solo notifiche: ${n}`
  if (n?.errore) return `Solo notifiche: errore ${n.errore}`
  const inviate = Object.values(n ?? {}).reduce(
    (somma, v) => somma + (typeof v === 'object' ? (v.inviate ?? 0) : 0),
    0,
  )
  return `Solo notifiche: ${inviate} inviate`
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
  // Ai minuti del giro: letture + notifiche; gli altri minuti solo le notifiche.
  const giro = daChiamare(istante)
  try {
    const risposta = await f(env.URL_FUNZIONE, {
      method: 'POST',
      headers: { 'x-aggiorna-chiave': env.AGGIORNA_CHIAVE, 'content-type': 'application/json' },
      body: giro ? '{}' : '{"azione":"notifiche"}',
    })
    const testo = await risposta.text()
    if (!risposta.ok) {
      return {
        chiamata: true,
        esito: `La funzione ha risposto ${risposta.status}: ${testo.slice(0, 200)}`,
      }
    }
    if (!giro)
      return { chiamata: true, esito: riassumiNotifiche(JSON.parse(testo) as RispostaNotifiche) }
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
