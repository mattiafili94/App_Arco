import { createContext, useContext } from 'react'
import type { ArcoDb } from './db'

export type FaseSincronizzazione = 'ferma' | 'in-corso' | 'errore'

export interface StatoSincronizzazione {
  fase: FaseSincronizzazione
  /** Quando la copia sul telefono è stata aggiornata l'ultima volta (ms), `null` se mai. */
  ultima: number | null
}

export interface ValoreSincronizzazione {
  stato: StatoSincronizzazione
  /** Il database sul telefono, per le schermate. */
  db: ArcoDb
  /** Scarica le novità adesso (pulsante "Aggiorna"). Non fa niente se è già in corso o senza rete. */
  aggiorna(): Promise<void>
  /**
   * Segnala che sul telefono c'è una modifica da inviare (allenamento): la sincronizzazione parte subito,
   * oppure appena finito il giro già in corso.
   */
  modificato(): void
}

export const Contesto = createContext<ValoreSincronizzazione | null>(null)

export function useSincronizzazione(): ValoreSincronizzazione {
  const valore = useContext(Contesto)
  if (!valore) throw new Error('useSincronizzazione va usato dentro Sincronizzazione')
  return valore
}
