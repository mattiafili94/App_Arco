/**
 * Le tabelle condivise che ogni telefono tiene in copia (Fase 3.1). Le legge solo chi è membro;
 * le scrive solo il server (vedi supabase/migrations). Ogni riga ha `aggiornato_il`: si scaricano solo
 * quelle cambiate dall'ultima volta; le eliminazioni arrivano dal registro `eliminazioni`.
 */

export type NomeTabella =
  'atleti' | 'gare' | 'inviti' | 'partecipazioni' | 'classifiche' | 'ranking' | 'allenamento_giorni'

export interface DefinizioneTabella {
  nome: NomeTabella
  /** Colonne della chiave primaria, nell'ordine usato dal database del telefono. */
  chiave: readonly string[]
  /** Colonne da scaricare (`*` = tutte). */
  colonne: string
}

export const TABELLE: readonly DefinizioneTabella[] = [
  {
    nome: 'atleti',
    chiave: ['id'],
    // Niente `utente_id`: il collegamento con l'accesso non serve nell'app (basta `ha_accesso`).
    colonne:
      'id, matricola, nome, cognome, ruolo, attivo, ha_accesso, classe, genere, aggiornato_il',
  },
  { nome: 'gare', chiave: ['codice'], colonne: '*' },
  { nome: 'inviti', chiave: ['gara_codice'], colonne: '*' },
  { nome: 'partecipazioni', chiave: ['atleta_id', 'gara_codice', 'divisione'], colonne: '*' },
  { nome: 'classifiche', chiave: ['gara_codice', 'categoria', 'ordine'], colonne: '*' },
  { nome: 'ranking', chiave: ['atleta_id', 'tipo', 'divisione'], colonne: '*' },
  // Privato: il server restituisce solo le righe dell'atleta collegato. Si scrive anche dal telefono
  // (vedi motore.ts, "inviaModifiche").
  { nome: 'allenamento_giorni', chiave: ['atleta_id', 'giorno'], colonne: '*' },
]

export type Riga = Record<string, unknown>

/** Un'eliminazione dal registro del server. */
export interface Eliminazione {
  id: number
  tabella: string
  chiave: Record<string, unknown>
}

/** La chiave primaria di una riga come la vuole il database del telefono. */
export function chiaveDi(def: DefinizioneTabella, valori: Record<string, unknown>): unknown {
  const parti = def.chiave.map((c) => valori[c])
  return parti.length === 1 ? parti[0] : parti
}
