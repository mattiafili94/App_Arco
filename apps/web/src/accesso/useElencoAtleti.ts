import { useCallback, useEffect, useState } from 'react'
import { useAccesso } from './contesto'
import type { Atleta } from './servizio'

export const ERRORE_CARICAMENTO =
  'Impossibile caricare gli atleti. Controlla la connessione e riprova.'

/**
 * Elenco degli atleti della compagnia, con stato di caricamento ed errore.
 * `carica()` lo richiede di nuovo (es. dopo un'aggiunta o con "Riprova").
 */
export function useElencoAtleti() {
  const { servizio } = useAccesso()
  const [elenco, setElenco] = useState<Atleta[] | null>(null)
  const [errore, setErrore] = useState(false)
  const [richiesta, setRichiesta] = useState(0)

  useEffect(() => {
    let attiva = true
    servizio.elencoAtleti().then(
      (atleti) => {
        if (!attiva) return
        setElenco(atleti)
        setErrore(false)
      },
      () => {
        if (attiva) setErrore(true)
      },
    )
    return () => {
      attiva = false
    }
  }, [servizio, richiesta])

  const carica = useCallback(() => setRichiesta((n) => n + 1), [])
  return { elenco, errore, carica }
}
