/**
 * Logica della funzione del server `crea-accesso`, separata dal collegamento a Supabase
 * così si può testare (packages/shared/src/crea-accesso.test.ts).
 *
 * Azioni (solo per l'amministratore):
 * - "genera": crea un accesso nuovo per l'atleta e restituisce link e codice. Se ne aveva già
 *   uno, quello vecchio viene eliminato: il telefono che lo usava viene scollegato.
 * - "revoca": elimina l'accesso dell'atleta.
 */
import { emailTecnica, generaCodice, linkAccesso } from './accesso.ts'

export interface AtletaPerAccesso {
  id: string
  matricola: string
  utenteId: string | null
}

/** Operazioni sul database e sugli accessi, fornite da chi usa la logica (server vero o test). */
export interface Dipendenze {
  /** Id dell'utente che fa la richiesta, `null` se non ha fatto l'accesso. */
  utenteChiamante(): Promise<string | null>
  /** Vero se l'utente che fa la richiesta è un amministratore attivo. */
  chiamanteAmministratore(): Promise<boolean>
  leggiAtleta(id: string): Promise<AtletaPerAccesso | null>
  eliminaAccesso(utenteId: string): Promise<void>
  creaAccesso(email: string, password: string, atletaId: string): Promise<string>
  collegaAccesso(atletaId: string, utenteId: string | null): Promise<void>
  indirizzoApp: string
  generaCodice?: () => string
}

export type Richiesta = { azione: 'genera' | 'revoca'; atletaId: string }

export type Risposta =
  | { stato: 200; corpo: { link: string; codice: string } | { revocato: true } }
  | { stato: 400 | 401 | 403 | 404 | 409; corpo: { errore: string } }

const errore = (stato: 400 | 401 | 403 | 404 | 409, messaggio: string): Risposta => ({
  stato,
  corpo: { errore: messaggio },
})

export function leggiRichiesta(corpo: unknown): Richiesta | null {
  if (typeof corpo !== 'object' || corpo === null) return null
  const { azione, atletaId } = corpo as Record<string, unknown>
  if ((azione !== 'genera' && azione !== 'revoca') || typeof atletaId !== 'string') return null
  return /^[0-9a-f-]{36}$/i.test(atletaId) ? { azione, atletaId } : null
}

export async function gestisciCreaAccesso(corpo: unknown, d: Dipendenze): Promise<Risposta> {
  const chiamante = await d.utenteChiamante()
  if (!chiamante) return errore(401, 'Accesso necessario.')
  if (!(await d.chiamanteAmministratore())) {
    return errore(403, "Solo l'amministratore può gestire gli accessi.")
  }

  const richiesta = leggiRichiesta(corpo)
  if (!richiesta) return errore(400, 'Richiesta non valida.')

  const atleta = await d.leggiAtleta(richiesta.atletaId)
  if (!atleta) return errore(404, 'Atleta non trovato.')

  if (richiesta.azione === 'revoca') {
    if (atleta.utenteId === chiamante) {
      return errore(409, 'Non puoi revocare il tuo stesso accesso.')
    }
    if (atleta.utenteId) await d.eliminaAccesso(atleta.utenteId)
    await d.collegaAccesso(atleta.id, null)
    return { stato: 200, corpo: { revocato: true } }
  }

  // genera: il vecchio accesso va eliminato prima, perché l'email tecnica è la stessa.
  if (atleta.utenteId === chiamante) {
    return errore(409, 'Per il tuo accesso usa il comando dal Terminale (vedi supabase/README.md).')
  }
  if (atleta.utenteId) await d.eliminaAccesso(atleta.utenteId)
  const codice = (d.generaCodice ?? generaCodice)()
  const utenteId = await d.creaAccesso(emailTecnica(atleta.matricola), codice, atleta.id)
  await d.collegaAccesso(atleta.id, utenteId)
  return {
    stato: 200,
    corpo: { link: linkAccesso(d.indirizzoApp, atleta.matricola, codice), codice },
  }
}
