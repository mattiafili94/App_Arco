/**
 * Regole dell'accesso con link personale (vedi CLAUDE.md, "Utenti e accesso").
 *
 * Questo file è usato sia dall'app (tramite packages/shared) sia dalla funzione del server
 * `crea-accesso` (Deno): per questo sta qui e non dipende da nessuna libreria.
 */

/** Caratteri del codice: niente 0/O e 1/I/L, che si confondono quando si scrivono a mano. */
export const ALFABETO_CODICE = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'
export const LUNGHEZZA_CODICE = 10

/** Genera un codice personale casuale (circa 50 bit di casualità). */
export function generaCodice(
  casuali: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n)),
): string {
  const alfabeto = ALFABETO_CODICE
  const limite = 256 - (256 % alfabeto.length) // scarta i valori che renderebbero alcuni caratteri più probabili
  let codice = ''
  while (codice.length < LUNGHEZZA_CODICE) {
    for (const byte of casuali(LUNGHEZZA_CODICE)) {
      if (byte < limite && codice.length < LUNGHEZZA_CODICE)
        codice += alfabeto[byte % alfabeto.length]
    }
  }
  return codice
}

/** Mostra il codice a gruppi, più facile da leggere e ricopiare: `K7PM3-XQR9A`. */
export function formattaCodice(codice: string): string {
  return `${codice.slice(0, 5)}-${codice.slice(5)}`
}

/** Pulisce il codice scritto dall'atleta: maiuscole, senza spazi né trattini. */
export function normalizzaCodice(testo: string): string {
  return testo.toUpperCase().replace(/[\s-]/g, '')
}

export function codiceValido(codice: string): boolean {
  return codice.length === LUNGHEZZA_CODICE && [...codice].every((c) => ALFABETO_CODICE.includes(c))
}

/** Pulisce la matricola Fitarco scritta dall'atleta: solo cifre. */
export function normalizzaMatricola(testo: string): string {
  return testo.replace(/\D/g, '')
}

export function matricolaValida(matricola: string): boolean {
  return /^[0-9]{1,8}$/.test(matricola)
}

/**
 * Indirizzo email "tecnico" dell'accesso di un atleta. Supabase richiede un'email: questa non
 * riceve mai messaggi (le conferme sono disattivate) e serve solo a identificare l'accesso.
 */
export function emailTecnica(matricola: string): string {
  return `matricola-${matricola}@accesso.arcieri-eugubini.pages.dev`
}

/**
 * Link personale. Matricola e codice stanno dopo il `#`: quella parte non viene mai inviata
 * ai server né salvata nei loro registri.
 */
export function linkAccesso(indirizzoApp: string, matricola: string, codice: string): string {
  return `${indirizzoApp.replace(/\/+$/, '')}/accesso#m=${matricola}&c=${codice}`
}

/** Legge matricola e codice dalla parte dopo il `#` del link; `null` se mancano o non sono validi. */
export function leggiLinkAccesso(frammento: string): { matricola: string; codice: string } | null {
  const parametri = new URLSearchParams(frammento.replace(/^#/, ''))
  const matricola = normalizzaMatricola(parametri.get('m') ?? '')
  const codice = normalizzaCodice(parametri.get('c') ?? '')
  return matricolaValida(matricola) && codiceValido(codice) ? { matricola, codice } : null
}
