import { useLiveQuery } from 'dexie-react-hooks'
import { useAtletaCorrente } from '../accesso/contesto'
import { nomeAtleta, type AtletaSalvato } from '../atleti/dati'
import { useSincronizzazione } from '../sync/contesto'

/** Una riga di "chi segue chi" com'è sul telefono (tabella `allenatori_atleti`). */
export interface Seguito {
  allenatore_id: string
  atleta_id: string
}

/** L'atleta collegato ha il ruolo di allenatore? `undefined` finché si legge (dai dati sincronizzati). */
export function useSonoAllenatore(): boolean | undefined {
  const { db } = useSincronizzazione()
  const { id } = useAtletaCorrente()
  return useLiveQuery(async () => {
    const io = (await db.atleti.get(id)) as unknown as { allenatore?: boolean } | undefined
    return io?.allenatore === true
  }, [db, id])
}

const perCognome = (a: AtletaSalvato, b: AtletaSalvato) =>
  a.cognome.localeCompare(b.cognome) || a.nome.localeCompare(b.nome)

/** Gli atleti che l'allenatore collegato segue (attivi), per cognome. `undefined` finché si leggono. */
export function useAtletiSeguiti(): AtletaSalvato[] | undefined {
  const { db } = useSincronizzazione()
  const { id } = useAtletaCorrente()
  return useLiveQuery(async () => {
    const righe = (await db.allenatori_atleti
      .where('allenatore_id')
      .equals(id)
      .toArray()) as unknown as Seguito[]
    const atleti = (await db.atleti.bulkGet(righe.map((r) => r.atleta_id))) as unknown as (
      AtletaSalvato | undefined
    )[]
    return atleti.filter((a): a is AtletaSalvato => a !== undefined && a.attivo).sort(perCognome)
  }, [db, id])
}

/** Chi segue l'atleta collegato ("Ti seguono: …"): i nomi, per cognome. */
export function useChiMiSegue(): string[] | undefined {
  const { db } = useSincronizzazione()
  const { id } = useAtletaCorrente()
  return useLiveQuery(async () => {
    const righe = (await db.allenatori_atleti
      .where('atleta_id')
      .equals(id)
      .toArray()) as unknown as Seguito[]
    const allenatori = (await db.atleti.bulkGet(righe.map((r) => r.allenatore_id))) as unknown as (
      AtletaSalvato | undefined
    )[]
    return allenatori
      .filter((a): a is AtletaSalvato => a !== undefined && a.attivo)
      .sort(perCognome)
      .map(nomeAtleta)
  }, [db, id])
}

/** Un atleta che l'allenatore collegato segue: `null` se non lo segue (o non esiste), `undefined` finché si legge. */
export function useAtletaSeguito(atletaId: string): AtletaSalvato | null | undefined {
  const seguiti = useAtletiSeguiti()
  if (seguiti === undefined) return undefined
  return seguiti.find((a) => a.id === atletaId) ?? null
}

/** I nomi di tutti gli atleti (per scrivere chi ha modificato un programma). */
export function useNomiAtleti(): Map<string, string> | undefined {
  const { db } = useSincronizzazione()
  return useLiveQuery(async () => {
    const atleti = (await db.atleti.toArray()) as unknown as AtletaSalvato[]
    return new Map(atleti.map((a) => [a.id, nomeAtleta(a)]))
  }, [db])
}
