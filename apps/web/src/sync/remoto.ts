import type { GiornoAllenamento, Simulazione } from '@arco/shared'
import type { Eliminazione, NomeTabella, Riga } from './tabelle'

/** Cosa serve alla sincronizzazione dal server. L'implementazione vera usa Supabase; i test una finta. */
export interface Remoto {
  /**
   * Righe di una tabella cambiate da `dal` (data ISO, `null` = tutte), in ordine stabile, a pagine:
   * `quante` righe a partire dalla riga numero `da`.
   */
  cambiamenti(tabella: NomeTabella, dal: string | null, da: number, quante: number): Promise<Riga[]>
  /** Eliminazioni registrate dopo quella con questo `id` (le più vecchie per prime). */
  eliminazioni(dopoId: number, quante: number): Promise<Eliminazione[]>
  /** `id` dell'ultima eliminazione registrata (0 se non ce ne sono). */
  ultimaEliminazione(): Promise<number>
  /**
   * Salva un giorno di allenamento. Se sul server c'è già una modifica più recente, resta quella.
   * Restituisce la riga che vale adesso (con `aggiornato_il` del server).
   */
  salvaAllenamento(giorno: GiornoAllenamento): Promise<Riga>
  /** Come `salvaAllenamento`, per una simulazione di gara: vince la modifica più recente. */
  salvaSimulazione(simulazione: Simulazione): Promise<Riga>
}
