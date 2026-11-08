import { useLiveQuery } from 'dexie-react-hooks'
import type { Partecipazione, RigaClassifica } from '@arco/shared'
import { useSincronizzazione } from '../sync/contesto'

/** Un atleta com'è salvato sul telefono (tabella `atleti`). */
export interface AtletaSalvato {
  id: string
  matricola: string
  nome: string
  cognome: string
  ruolo: 'atleta' | 'amministratore'
  attivo: boolean
  /** Ha un link di accesso (anche se non è ancora entrato nell'app). */
  ha_accesso: boolean
}

/** "Mario Rossi", come lo scrive l'app ovunque. */
export const nomeAtleta = (a: Pick<AtletaSalvato, 'nome' | 'cognome'>) => `${a.nome} ${a.cognome}`

/** Gli atleti attivi con l'accesso, `undefined` finché si leggono. Si aggiorna da sola. */
export function useAtleti(): AtletaSalvato[] | undefined {
  const { db } = useSincronizzazione()
  return useLiveQuery(async () => {
    const tutti = (await db.atleti.toArray()) as unknown as AtletaSalvato[]
    return tutti.filter((a) => a.attivo && a.ha_accesso)
  }, [db])
}

/** Un atleta: `undefined` finché si legge, `null` se non esiste o non ha l'accesso. */
export function useAtleta(id: string): AtletaSalvato | null | undefined {
  const { db } = useSincronizzazione()
  return useLiveQuery(async () => {
    const a = (await db.atleti.get(id)) as unknown as AtletaSalvato | undefined
    return a && a.attivo && a.ha_accesso ? a : null
  }, [db, id])
}

/** Le gare di tutti gli atleti (storico completo). */
export function usePartecipazioni(): Partecipazione[] | undefined {
  const { db } = useSincronizzazione()
  return useLiveQuery(
    () => db.partecipazioni.toArray() as Promise<unknown> as Promise<Partecipazione[]>,
    [db],
  )
}

/** Le gare di un atleta. */
export function usePartecipazioniDi(atletaId: string): Partecipazione[] | undefined {
  const { db } = useSincronizzazione()
  return useLiveQuery(
    () =>
      db.partecipazioni
        .where('atleta_id')
        .equals(atletaId)
        .toArray() as Promise<unknown> as Promise<Partecipazione[]>,
    [db, atletaId],
  )
}

/** Le righe di classifica di un atleta (solo gare lette dal PDF). */
export function useClassificheDi(atletaId: string): RigaClassifica[] | undefined {
  const { db } = useSincronizzazione()
  return useLiveQuery(
    () =>
      db.classifiche.where('atleta_id').equals(atletaId).toArray() as Promise<unknown> as Promise<
        RigaClassifica[]
      >,
    [db, atletaId],
  )
}
