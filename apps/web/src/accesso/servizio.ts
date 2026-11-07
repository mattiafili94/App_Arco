/**
 * Cosa serve all'app per l'accesso e l'amministrazione. L'implementazione vera usa Supabase
 * (servizioSupabase.ts); i test ne usano una finta.
 */

export interface Atleta {
  id: string
  matricola: string
  nome: string
  cognome: string
  ruolo: 'atleta' | 'amministratore'
  attivo: boolean
  /** Vero se l'atleta ha un accesso (un link personale valido). */
  haAccesso: boolean
}

export type EsitoAccedi =
  { esito: 'ok'; utenteId: string } | { esito: 'errato' | 'offline' | 'errore' }

export type EsitoAggiungi = { esito: 'ok' } | { esito: 'duplicato' | 'errore' }

export interface ServizioAccesso {
  /** Accesso già fatto su questo telefono (si legge anche offline), oppure `null`. */
  sessioneSalvata(): Promise<{ utenteId: string } | null>
  accedi(matricola: string, codice: string): Promise<EsitoAccedi>
  esci(): Promise<void>
  /** Scheda dell'atleta collegato; `null` se non è (più) un atleta attivo. Lancia un errore senza rete. */
  profilo(utenteId: string): Promise<Atleta | null>
  /** Avvisa quando l'accesso termina da solo (es. revocato dall'amministratore). */
  quandoEsce(avvisa: () => void): () => void
  elencoAtleti(): Promise<Atleta[]>
  aggiungiAtleta(dati: { matricola: string; nome: string; cognome: string }): Promise<EsitoAggiungi>
  /** Genera il link personale di un atleta. Lancia un errore con un messaggio da mostrare. */
  generaLink(atletaId: string): Promise<{ link: string; codice: string }>
  revocaAccesso(atletaId: string): Promise<void>
}

export const nomeCompleto = (a: Pick<Atleta, 'nome' | 'cognome'>) => `${a.nome} ${a.cognome}`
