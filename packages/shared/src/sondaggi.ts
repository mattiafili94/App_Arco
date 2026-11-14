/**
 * Il sondaggio "Partecipo / Non partecipo" di una gara (Fase 3.5, Mattia 15/11/2026): regole pure per l'app.
 * - L'amministratore lo apre per una gara futura, non annullata, con l'invito; lo chiude quando vuole.
 * - Ogni atleta risponde solo per sé e può cambiare idea finché il sondaggio è aperto e la gara non è passata.
 * - Tutti vedono le risposte.
 */
import { garaPassata, type Gara } from './gare'

/** Un sondaggio com'è sul telefono (tabella `sondaggi`). */
export interface Sondaggio {
  gara_codice: string
  aperto: boolean
  aperto_da: string | null
  aperto_il: string
  chiuso_il: string | null
  aggiornato_il: string
}

/** Una risposta com'è sul telefono (tabella `risposte_sondaggio`). */
export interface RispostaSondaggio {
  gara_codice: string
  atleta_id: string
  partecipa: boolean
  /** Ora del telefono quando l'atleta ha risposto: vince la più recente. */
  modificato_il: string
  /** Ora del server; manca finché la risposta non è arrivata al server. */
  aggiornato_il?: string
}

/** Si può aprire il sondaggio di questa gara? (come `apri_sondaggio` sul server) */
export function puoAprireSondaggio(
  g: Pick<Gara, 'al' | 'stato' | 'ha_invito'>,
  oggi: string,
): boolean {
  return g.ha_invito && g.stato !== 'annullata' && !garaPassata(g, oggi)
}

/** Si può ancora rispondere? (come `rispondi_sondaggio` sul server) */
export function sondaggioRispondibile(
  s: Pick<Sondaggio, 'aperto'> | null | undefined,
  g: Pick<Gara, 'al'>,
  oggi: string,
): boolean {
  return !!s?.aperto && !garaPassata(g, oggi)
}

export interface PersonaSondaggio {
  id: string
  nome: string
  cognome: string
}

export interface RiepilogoSondaggio<P extends PersonaSondaggio> {
  partecipano: P[]
  nonPartecipano: P[]
  /** Chi è nell'elenco degli atleti e non ha ancora risposto. */
  senzaRisposta: P[]
}

const perCognome = (a: PersonaSondaggio, b: PersonaSondaggio) =>
  a.cognome.localeCompare(b.cognome, 'it') || a.nome.localeCompare(b.nome, 'it')

/**
 * Chi partecipa, chi no e chi non ha risposto, in ordine di cognome. `atleti` = chi può rispondere (gli atleti
 * attivi con l'accesso); chi ha risposto e poi è uscito dall'elenco resta tra le risposte se è tra `tutti`.
 */
export function riepilogoSondaggio<P extends PersonaSondaggio>(
  risposte: readonly Pick<RispostaSondaggio, 'atleta_id' | 'partecipa'>[],
  atleti: readonly P[],
  tutti: readonly P[] = atleti,
): RiepilogoSondaggio<P> {
  const perId = new Map([...tutti, ...atleti].map((a) => [a.id, a]))
  const risposto = new Map(risposte.map((r) => [r.atleta_id, r.partecipa]))
  const con = (partecipa: boolean) =>
    risposte
      .filter((r) => r.partecipa === partecipa)
      .map((r) => perId.get(r.atleta_id))
      .filter((a): a is P => a !== undefined)
      .sort(perCognome)
  return {
    partecipano: con(true),
    nonPartecipano: con(false),
    senzaRisposta: atleti.filter((a) => !risposto.has(a.id)).sort(perCognome),
  }
}

/** "Mario Rossi, Anna Verdi" (nome e cognome, nell'ordine dato). */
export const elencoNomi = (persone: readonly PersonaSondaggio[]) =>
  persone.map((p) => `${p.nome} ${p.cognome}`).join(', ')
