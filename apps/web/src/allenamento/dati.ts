import { useLiveQuery } from 'dexie-react-hooks'
import { aggiungiGiorni, type GiornoAllenamento } from '@arco/shared'
import { useAtletaCorrente } from '../accesso/contesto'
import { useSincronizzazione } from '../sync/contesto'

/** I giorni di allenamento di una settimana (da lunedì `inizio`), dal telefono. `undefined` finché si leggono. */
export function useSettimanaAllenamento(inizio: string): GiornoAllenamento[] | undefined {
  const { db } = useSincronizzazione()
  const { id } = useAtletaCorrente()
  return useLiveQuery(
    () =>
      db.allenamento_giorni
        .where('[atleta_id+giorno]')
        .between([id, inizio], [id, aggiungiGiorni(inizio, 6)], true, true)
        .toArray() as Promise<unknown> as Promise<GiornoAllenamento[]>,
    [db, id, inizio],
  )
}

/** Un giorno: `null` se non c'è ancora niente, `undefined` finché si legge. */
export function useGiornoAllenamento(giorno: string): GiornoAllenamento | null | undefined {
  const { db } = useSincronizzazione()
  const { id } = useAtletaCorrente()
  return useLiveQuery(
    async () =>
      ((await db.allenamento_giorni.get([id, giorno])) as unknown as
        GiornoAllenamento | undefined) ?? null,
    [db, id, giorno],
  )
}

/** Quanti giorni hanno modifiche non ancora arrivate al server. */
export function useModificheDaInviare(): number | undefined {
  const { db } = useSincronizzazione()
  return useLiveQuery(() => db.allenamento_giorni.where('da_inviare').equals(1).count(), [db])
}
