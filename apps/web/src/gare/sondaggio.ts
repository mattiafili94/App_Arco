/**
 * Il sondaggio "Partecipo / Non partecipo" sul telefono (Fase 3.5): lettura dei dati sincronizzati e salvataggio
 * della propria risposta (anche offline: la invia la sincronizzazione).
 */
import { useLiveQuery } from 'dexie-react-hooks'
import type { RispostaSondaggio, Sondaggio } from '@arco/shared'
import { useAtletaCorrente } from '../accesso/contesto'
import type { ArcoDb } from '../sync/db'
import { useSincronizzazione } from '../sync/contesto'

/** Una risposta sul telefono: `da_inviare` (1) finché non è arrivata al server. */
export type RispostaSalvata = RispostaSondaggio & { da_inviare?: number }

/** Il sondaggio di una gara: `undefined` finché si legge, `null` se non c'è. */
export function useSondaggio(codice: string): Sondaggio | null | undefined {
  const { db } = useSincronizzazione()
  return useLiveQuery(
    async () => ((await db.sondaggi.get(codice)) as unknown as Sondaggio | undefined) ?? null,
    [db, codice],
  )
}

/** Le risposte al sondaggio di una gara (di tutti); `undefined` finché si leggono. */
export function useRisposte(codice: string): RispostaSalvata[] | undefined {
  const { db } = useSincronizzazione()
  return useLiveQuery(
    () =>
      db.risposte_sondaggio
        .where('gara_codice')
        .equals(codice)
        .toArray() as Promise<unknown> as Promise<RispostaSalvata[]>,
    [db, codice],
  )
}

/** Per una gara: il suo sondaggio è aperto? E la risposta dell’atleta collegato (se c’è). */
export interface SondaggioPerMe {
  aperto: boolean
  partecipa?: boolean
}

const NESSUNO: ReadonlyMap<string, SondaggioPerMe> = new Map()

/**
 * Per ogni gara con un sondaggio o una risposta dell’atleta collegato: se il sondaggio è aperto e cosa ha risposto
 * (vuoto finché si legge). Serve ai colori degli elenchi (`statoSondaggioGara`).
 */
export function useSondaggiPerMe(): ReadonlyMap<string, SondaggioPerMe> {
  const { db } = useSincronizzazione()
  const { id } = useAtletaCorrente()
  return (
    useLiveQuery(async () => {
      const sondaggi = (await db.sondaggi.toArray()) as unknown as Sondaggio[]
      const mie = (await db.risposte_sondaggio
        .where('atleta_id')
        .equals(id)
        .toArray()) as unknown as RispostaSondaggio[]
      const mappa = new Map<string, SondaggioPerMe>(
        sondaggi.map((x) => [x.gara_codice, { aperto: x.aperto }]),
      )
      for (const r of mie) {
        mappa.set(r.gara_codice, {
          aperto: mappa.get(r.gara_codice)?.aperto ?? false,
          partecipa: r.partecipa,
        })
      }
      return mappa
    }, [db, id]) ?? NESSUNO
  )
}

/**
 * Salva sul telefono la risposta dell'atleta e la segna "da inviare" (la manda la sincronizzazione). L'ora cresce
 * sempre, anche se l'orologio del telefono va indietro: due risposte di fila non si confondono.
 */
export async function salvaRisposta(
  db: ArcoDb,
  garaCodice: string,
  atletaId: string,
  partecipa: boolean,
  adesso: Date = new Date(),
): Promise<RispostaSalvata> {
  return db.transaction('rw', db.risposte_sondaggio, async () => {
    const attuale = (await db.risposte_sondaggio.get([garaCodice, atletaId])) as unknown as
      RispostaSalvata | undefined
    const prima = attuale ? Date.parse(attuale.modificato_il) : 0
    const nuova: RispostaSalvata = {
      ...attuale,
      gara_codice: garaCodice,
      atleta_id: atletaId,
      partecipa,
      modificato_il: new Date(Math.max(adesso.getTime(), prima + 1)).toISOString(),
      da_inviare: 1,
    }
    await db.risposte_sondaggio.put(nuova as unknown as Record<string, unknown>)
    return nuova
  })
}
