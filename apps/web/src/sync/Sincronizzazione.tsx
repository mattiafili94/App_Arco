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
  const daRipetere = useRef(false)
  // Dopo l'uscita dalla schermata una sincronizzazione ancora in corso non deve più toccare lo stato.
  const montato = useRef(true)
  useEffect(() => {
    montato.current = true
    return () => {
      montato.current = false
    }
  }, [])

  const aggiorna = useCallback(async () => {
    // Una alla volta, e solo con la rete (altrimenti si resta com'è).
    if (!navigator.onLine) return
    if (inCorso.current) return
    inCorso.current = true
    try {
      do {
        daRipetere.current = false
        if (montato.current) setFase('in-corso')
        try {
          await sincronizza(servizio.remoto, db, Date.now, () => !montato.current)
          const quando = await ultimaSincronizzazione(db)
          if (montato.current) {
            setUltima(quando)
            setFase('ferma')
          }
        } catch {
          if (montato.current) setFase('errore')
        }
      } while (daRipetere.current && montato.current)
    } finally {
      inCorso.current = false
    }
  }, [servizio, db])

  /** Una modifica locale (es. l'allenamento): parte subito, o appena finito il giro in corso. */
  const modificato = useCallback(() => {
    if (inCorso.current) daRipetere.current = true
    else void aggiorna()
  }, [aggiorna])

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
  const valore = useMemo(
    () => ({ stato, db, aggiorna, modificato }),
    [stato, db, aggiorna, modificato],
  )
  return <Contesto.Provider value={valore}>{children}</Contesto.Provider>
}
