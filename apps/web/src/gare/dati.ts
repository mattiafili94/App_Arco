import { useAtletaCorrente } from '../accesso/contesto'
import { useLiveQuery } from 'dexie-react-hooks'
import type { Gara } from '@arco/shared'
import { useSincronizzazione } from '../sync/contesto'

/** Un invito com'è salvato sul telefono (tabella `inviti`). */
export interface Invito {
  gara_codice: string
  testo: string
  luogo: string | null
  riferimento: string | null
  email: string | null
  web: string | null
  verificato: boolean
}

/** Oggi come "AAAA-MM-GG", nell'ora del telefono. */
export function oggi(adesso: Date = new Date()): string {
  const due = (n: number) => String(n).padStart(2, '0')
  return `${adesso.getFullYear()}-${due(adesso.getMonth() + 1)}-${due(adesso.getDate())}`
}

/** Tutte le gare salvate sul telefono; `undefined` finché si leggono. Si aggiorna da sola. */
export function useGare(): Gara[] | undefined {
  const { db } = useSincronizzazione()
  return useLiveQuery(() => db.gare.toArray() as Promise<unknown> as Promise<Gara[]>, [db])
}

/** Una gara: `undefined` finché si legge, `null` se non esiste. */
export function useGara(codice: string): Gara | null | undefined {
  const { db } = useSincronizzazione()
  return useLiveQuery(
    async () => ((await db.gare.get(codice)) as unknown as Gara | undefined) ?? null,
    [db, codice],
  )
}

/** L'invito di una gara: `undefined` finché si legge, `null` se non c'è. */
export function useInvito(codice: string): Invito | null | undefined {
  const { db } = useSincronizzazione()
  return useLiveQuery(
    async () => ((await db.inviti.get(codice)) as unknown as Invito | undefined) ?? null,
    [db, codice],
  )
}

/** I codici delle gare a cui ha partecipato l'atleta collegato. */
export function useMieGare(): Set<string> | undefined {
  const { db } = useSincronizzazione()
  const { id } = useAtletaCorrente()
  return useLiveQuery(async () => {
    const righe = await db.partecipazioni.where('atleta_id').equals(id).toArray()
    return new Set(righe.map((r) => r.gara_codice as string))
  }, [db, id])
}
