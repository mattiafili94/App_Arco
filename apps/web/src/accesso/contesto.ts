import { createContext, useContext } from 'react'
import type { Atleta, EsitoAccedi, ServizioAccesso } from './servizio'

/** Copia della scheda dell'atleta sul telefono: serve ad aprire l'app anche senza rete. */
export const CHIAVE_PROFILO = 'arco.profilo'

export type Stato =
  | { tipo: 'caricamento' }
  | { tipo: 'ospite'; avviso?: string }
  /** codiceDaLink: c'è solo subito dopo l'accesso dal link, per spiegare come installare l'app. */
  | { tipo: 'membro'; atleta: Atleta; codiceDaLink?: string }

export interface ValoreAccesso {
  stato: Stato
  servizio: ServizioAccesso
  accedi(
    matricola: string,
    codice: string,
    opzioni?: { daLink?: boolean },
  ): Promise<EsitoAccedi | { esito: 'non-membro' }>
  esci(): Promise<void>
}

export const Contesto = createContext<ValoreAccesso | null>(null)

export function useAccesso(): ValoreAccesso {
  const valore = useContext(Contesto)
  if (!valore) throw new Error('useAccesso va usato dentro AccessoProvider')
  return valore
}

/** L'atleta collegato. Da usare solo nelle pagine visibili ai membri. */
export function useAtletaCorrente(): Atleta {
  const { stato } = useAccesso()
  if (stato.tipo !== 'membro') throw new Error('Nessun atleta collegato')
  return stato.atleta
}
