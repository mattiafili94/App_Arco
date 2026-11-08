import { useCallback, useEffect, useRef } from 'react'
import { useSincronizzazione } from '../sync/contesto'

/** Dopo l'ultima modifica si aspetta un attimo prima di inviare al server (non a ogni tocco). */
export const ATTESA_INVIO_MS = 1500

/**
 * Restituisce una funzione da chiamare dopo ogni modifica salvata sul telefono: l'invio al server parte un
 * attimo dopo l'ultima modifica, e comunque lasciando la pagina.
 */
export function useInvioDifferito(): () => void {
  const { modificato } = useSincronizzazione()
  const timer = useRef<number | null>(null)
  const inAttesa = useRef(false)

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current)
      if (inAttesa.current) modificato()
    },
    [modificato],
  )

  return useCallback(() => {
    inAttesa.current = true
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      inAttesa.current = false
      modificato()
    }, ATTESA_INVIO_MS)
  }, [modificato])
}
