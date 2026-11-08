import { useCallback, useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type {
  ClassificaRanking,
  FiltroClassifica,
  MiaPosizione,
  RispostaAggiorna,
} from '@arco/shared'
import { useAccesso } from '../accesso/contesto'
import { useOnline } from '../stato/useOnline'
import { useSincronizzazione } from '../sync/contesto'

/**
 * Le tue posizioni nelle classifiche (la tua riga di ognuna), dalla copia sul telefono; con la rete si
 * rinfrescano dal server. `undefined` finché si legge la copia. Senza rete restano quelle salvate.
 */
export function useMiePosizioni(matricola: string) {
  const { db } = useSincronizzazione()
  const { servizio } = useAccesso()
  const online = useOnline()
  const posizioni = useLiveQuery(
    () => db.mie_posizioni.toArray() as Promise<unknown> as Promise<MiaPosizione[]>,
    [db],
  )

  useEffect(() => {
    if (!online) return
    let attivo = true
    servizio.classifica
      .miePosizioni(matricola)
      .then(async (nuove) => {
        if (!attivo) return
        await db.transaction('rw', db.mie_posizioni, async () => {
          await db.mie_posizioni.clear()
          await db.mie_posizioni.bulkPut(nuove as unknown as Record<string, unknown>[])
        })
      })
      .catch(() => {
        // Senza il server si tengono le posizioni già salvate.
      })
    return () => {
      attivo = false
    }
  }, [db, servizio, matricola, online])

  return { posizioni }
}

/**
 * Una classifica completa: si apre subito la copia che il telefono ha già (anche offline) e, con la rete,
 * si controlla sul nostro database se è cambiata. `aggiorna` è il pulsante: rilegge da Fitarco.
 * `verificata`: il server ha risposto per questa classifica (se la copia manca, non è ancora scaricata);
 * `errore`: il server è stato interrogato ma non ha risposto.
 */
export function useClassificaCompleta({ tipo, divisione, classe, genere }: FiltroClassifica) {
  const { db } = useSincronizzazione()
  const { servizio } = useAccesso()
  const online = useOnline()
  const cache = useLiveQuery(
    async () =>
      ((await db.classifiche_ranking.get([tipo, divisione, classe, genere])) ??
        null) as ClassificaRanking | null,
    [db, tipo, divisione, classe, genere],
  )
  // L'esito è legato alla classifica a cui si riferisce: cambiando classifica non vale più.
  const id = `${tipo}|${divisione}|${classe}|${genere}`
  const [esito, setEsito] = useState<{ id: string; errore: boolean } | null>(null)
  const [inCorso, setInCorso] = useState(false)

  /** Controlla il nostro database e aggiorna la copia sul telefono. Restituisce `true` se non ci riesce. */
  const carica = useCallback(async (): Promise<boolean> => {
    try {
      const copia = (await db.classifiche_ranking.get([tipo, divisione, classe, genere])) as
        ClassificaRanking | undefined
      const r = await servizio.classifica.leggi(
        { tipo, divisione, classe, genere },
        copia?.aggiornato_il ?? null,
      )
      if (r && r !== 'invariata') {
        await db.classifiche_ranking.put(r as unknown as Record<string, unknown>)
      }
      return false
    } catch {
      return true
    }
  }, [db, servizio, tipo, divisione, classe, genere])

  useEffect(() => {
    if (!online) return
    let attivo = true
    void carica().then((errore) => {
      if (attivo) setEsito({ id, errore })
    })
    return () => {
      attivo = false
    }
  }, [online, carica, id])

  const aggiorna = useCallback(async (): Promise<RispostaAggiorna> => {
    setInCorso(true)
    try {
      const r = await servizio.classifica.aggiorna({
        tipo,
        divisione,
        classe,
        genere,
      } as FiltroClassifica)
      if (r.esito === 'ok') setEsito({ id, errore: await carica() })
      return r
    } finally {
      setInCorso(false)
    }
  }, [servizio, carica, id, tipo, divisione, classe, genere])

  const valido = esito?.id === id
  return {
    classifica: cache,
    verificata: valido && !esito.errore,
    errore: valido && esito.errore,
    inCorso,
    aggiorna,
  }
}
