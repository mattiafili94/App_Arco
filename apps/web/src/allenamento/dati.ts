import { useLiveQuery } from 'dexie-react-hooks'
import {
  aggiungiGiorni,
  simulazioniVisibili,
  type GiornoAllenamento,
  type Simulazione,
} from '@arco/shared'
import { useAtletaCorrente } from '../accesso/contesto'
import { useSincronizzazione } from '../sync/contesto'

/** L'atleta di cui si guarda l'allenamento: quello collegato, o un atleta seguito (allenatore). */
function useAtletaScelto(atletaId?: string): string {
  const { id } = useAtletaCorrente()
  return atletaId ?? id
}

/** I giorni di allenamento di una settimana (da lunedì `inizio`), dal telefono. `undefined` finché si leggono. */
export function useSettimanaAllenamento(
  inizio: string,
  atletaId?: string,
): GiornoAllenamento[] | undefined {
  const { db } = useSincronizzazione()
  const id = useAtletaScelto(atletaId)
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
export function useGiornoAllenamento(
  giorno: string,
  atletaId?: string,
): GiornoAllenamento | null | undefined {
  const { db } = useSincronizzazione()
  const id = useAtletaScelto(atletaId)
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

/** Le simulazioni di un giorno (non cancellate), le più recenti per prime. */
export function useSimulazioniGiorno(giorno: string, atletaId?: string): Simulazione[] | undefined {
  const { db } = useSincronizzazione()
  const id = useAtletaScelto(atletaId)
  return useLiveQuery(
    async () =>
      simulazioniVisibili(
        (await db.simulazioni.where('giorno').equals(giorno).toArray()) as unknown as Simulazione[],
      ).filter((s) => s.atleta_id === id),
    [db, id, giorno],
  )
}

/** Le simulazioni di una settimana (non cancellate): servono alle frecce del riepilogo. */
export function useSimulazioniSettimana(
  inizio: string,
  atletaId?: string,
): Simulazione[] | undefined {
  const { db } = useSincronizzazione()
  const id = useAtletaScelto(atletaId)
  return useLiveQuery(
    async () =>
      simulazioniVisibili(
        (await db.simulazioni
          .where('giorno')
          .between(inizio, aggiungiGiorni(inizio, 6), true, true)
          .toArray()) as unknown as Simulazione[],
      ).filter((s) => s.atleta_id === id),
    [db, id, inizio],
  )
}

/** Una simulazione: `null` se non esiste o è cancellata, `undefined` finché si legge. */
export function useSimulazione(
  idSimulazione: string,
  atletaId?: string,
): Simulazione | null | undefined {
  const { db } = useSincronizzazione()
  const id = useAtletaScelto(atletaId)
  return useLiveQuery(async () => {
    const s = (await db.simulazioni.get(idSimulazione)) as unknown as Simulazione | undefined
    return s && !s.eliminata && s.atleta_id === id ? s : null
  }, [db, id, idSimulazione])
}

/** Tutte le simulazioni dell'atleta (non cancellate): servono al confronto tra le medie. */
export function useSimulazioniAtleta(): Simulazione[] | undefined {
  const { db } = useSincronizzazione()
  const { id } = useAtletaCorrente()
  return useLiveQuery(
    async () =>
      simulazioniVisibili(
        (await db.simulazioni.where('atleta_id').equals(id).toArray()) as unknown as Simulazione[],
      ),
    [db, id],
  )
}
