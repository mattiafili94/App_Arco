import { useCallback, useState } from 'react'
import { applicaSceltaTema, leggiSceltaTema, salvaSceltaTema, type SceltaTema } from './tema'

/** Tema corrente e funzione per cambiarlo: applica e salva subito la nuova scelta. */
export function useTema(): [SceltaTema, (scelta: SceltaTema) => void] {
  const [scelta, setScelta] = useState<SceltaTema>(leggiSceltaTema)

  const imposta = useCallback((nuova: SceltaTema) => {
    applicaSceltaTema(nuova)
    salvaSceltaTema(nuova)
    setScelta(nuova)
  }, [])

  return [scelta, imposta]
}
