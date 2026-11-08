import { useCallback, useEffect, useState } from 'react'
import { useServizioNotifiche } from './contesto'
import type { EsitoAttiva, StatoNotifiche } from './servizio'

/** Stato dell'interruttore "Nuovi inviti" e azione per cambiarlo. */
export function useNotifiche() {
  const servizio = useServizioNotifiche()
  const [stato, setStato] = useState<StatoNotifiche>('caricamento')
  const [occupato, setOccupato] = useState(false)
  const [errore, setErrore] = useState<EsitoAttiva | null>(null)

  const leggi = useCallback(
    () => servizio.stato().catch(() => 'spente' as StatoNotifiche),
    [servizio],
  )

  useEffect(() => {
    let attivo = true
    void leggi().then((s) => {
      if (attivo) setStato(s)
    })
    return () => {
      attivo = false
    }
  }, [leggi])

  const cambia = useCallback(async () => {
    setOccupato(true)
    setErrore(null)
    try {
      if (stato === 'accese') await servizio.disattiva()
      else {
        const esito = await servizio.attiva()
        if (esito !== 'ok') setErrore(esito)
      }
      setStato(await leggi())
    } finally {
      setOccupato(false)
    }
  }, [stato, servizio, leggi])

  return { stato, occupato, errore, cambia }
}
