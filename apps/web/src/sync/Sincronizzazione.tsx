import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useAccesso } from '../accesso/contesto'
import { Contesto, type FaseSincronizzazione, type StatoSincronizzazione } from './contesto'
import { dbPredefinito, type ArcoDb } from './db'
import { sincronizza, ultimaSincronizzazione } from './motore'

/** Ogni quanto si controllano le novità mentre l'app è aperta. */
export const INTERVALLO_MS = 5 * 60 * 1000

/**
 * Tiene aggiornata la copia dei dati sul telefono (Fase 3.1). Si sincronizza all'apertura, quando torna
 * la rete, quando l'app torna in primo piano e ogni pochi minuti. Senza rete non fa niente: l'app usa
 * quello che c'è già. Da usare solo per chi ha fatto l'accesso.
 */
export function Sincronizzazione({
  db = dbPredefinito(),
  intervalloMs = INTERVALLO_MS,
  children,
}: {
  db?: ArcoDb
  intervalloMs?: number
  children: ReactNode
}) {
  const { servizio } = useAccesso()
  const [fase, setFase] = useState<FaseSincronizzazione>('ferma')
  const [ultima, setUltima] = useState<number | null>(null)
  const inCorso = useRef(false)

  const aggiorna = useCallback(async () => {
    // Una alla volta, e solo con la rete (altrimenti si resta com'è).
    if (inCorso.current || !navigator.onLine) return
    inCorso.current = true
    setFase('in-corso')
    try {
      await sincronizza(servizio.remoto, db)
      setUltima(await ultimaSincronizzazione(db))
      setFase('ferma')
    } catch {
      setFase('errore')
    } finally {
      inCorso.current = false
    }
  }, [servizio, db])

  useEffect(() => {
    let attivo = true
    // Subito: quando è stato l'ultimo aggiornamento (si vede anche senza rete).
    void ultimaSincronizzazione(db).then((u) => attivo && setUltima(u))
    // Subito dopo il primo disegno dello schermo.
    const avvio = window.setTimeout(() => void aggiorna(), 0)

    const alRitorno = () => {
      if (document.visibilityState === 'visible') void aggiorna()
    }
    const ogniTanto = window.setInterval(() => {
      if (document.visibilityState === 'visible') void aggiorna()
    }, intervalloMs)
    window.addEventListener('online', alRitorno)
    document.addEventListener('visibilitychange', alRitorno)
    return () => {
      attivo = false
      window.clearTimeout(avvio)
      window.clearInterval(ogniTanto)
      window.removeEventListener('online', alRitorno)
      document.removeEventListener('visibilitychange', alRitorno)
    }
  }, [aggiorna, db, intervalloMs])

  const stato = useMemo<StatoSincronizzazione>(() => ({ fase, ultima }), [fase, ultima])
  const valore = useMemo(() => ({ stato, db, aggiorna }), [stato, db, aggiorna])
  return <Contesto.Provider value={valore}>{children}</Contesto.Provider>
}
