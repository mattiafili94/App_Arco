/**
 * Cosa serve all'app per l'accesso e l'amministrazione. L'implementazione vera usa Supabase
 * (servizioSupabase.ts); i test ne usano una finta.
 */

import type { ServizioClassifica } from '../classifica/servizio'
import type { Remoto } from '../sync/remoto'

export interface Atleta {
  id: string
  matricola: string
  nome: string
  cognome: string
  ruolo: 'atleta' | 'amministratore'
  attivo: boolean
  /** Vero se l'atleta ha un accesso (un link personale valido). */
  haAccesso: boolean
  /** Ha anche il ruolo di allenatore (Fase 7). */
  allenatore?: boolean
}

export type EsitoAccedi =
  { esito: 'ok'; utenteId: string } | { esito: 'errato' | 'offline' | 'errore' }

export type EsitoAggiungi = { esito: 'ok' } | { esito: 'duplicato' | 'errore' }

/** Un telefono che riceve le notifiche push: indirizzo del servizio push e chiavi di cifratura. */
export interface IscrizionePush {
  endpoint: string
  p256dh: string
  auth: string
}

export interface ServizioAccesso {
  /** I dati condivisi (gare, risultati…) da tenere in copia sul telefono. */
  remoto: Remoto
  /** Le classifiche (ranking) complete: lette dal nostro database, aggiornate da Fitarco col pulsante. */
  classifica: ServizioClassifica
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
  /** Registra questo telefono per le notifiche (a nome di chi è collegato). Lancia un errore se non riesce. */
  registraPush(iscrizione: IscrizionePush): Promise<void>
  /** Toglie la registrazione di questo telefono. */
  rimuoviPush(endpoint: string): Promise<void>
  /** L'allenatore collegato inizia o smette di seguire un atleta. Lancia un errore con un messaggio da mostrare. */
  seguiAtleta(atletaId: string, segui: boolean): Promise<void>
  /** L'amministratore dà o toglie il ruolo di allenatore. Lancia un errore se non riesce. */
  impostaAllenatore(atletaId: string, allenatore: boolean): Promise<void>
}

export const nomeCompleto = (a: Pick<Atleta, 'nome' | 'cognome'>) => `${a.nome} ${a.cognome}`
