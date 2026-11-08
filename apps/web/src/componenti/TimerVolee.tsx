import { useEffect, useRef, useState } from 'react'
import {
  eventiTra,
  FISCHI,
  formattaTempo,
  PREPARAZIONE_MS,
  statoTimer,
  type EventoTimer,
} from '@arco/shared'
import { creaSuoni, type Suoni } from '../allenamento/suoni'
import { Button } from './Button'
import styles from './TimerVolee.module.css'

/** Ogni quanto si ricalcola il tempo (il tempo vero si legge dall'orologio, quindi non "deriva"). */
const INTERVALLO_MS = 200
/** Dopo il "tempo scaduto" lo schermo resta così, poi il timer si ferma da solo. */
const CODA_MS = 5_000

export interface TimerVoleeProps {
  /** Quanto dura il tempo di tiro (2 o 4 minuti). */
  durataTiro: number
  /** Solo per i test: suoni e orologio finti. */
  suoni?: Suoni
  ora?: () => number
}

/** Un oggetto con `release`, come il blocco dello schermo del browser. */
interface BloccoSchermo {
  release(): Promise<void>
}

/**
 * Il timer della volée, facoltativo. Si avvia con un tocco, segue la sequenza di gara (1 fischio, 10 secondi
 * per andare in linea, 1 fischio, tempo di tiro, avviso a 30 secondi, 2 fischi) e si può fermare quando si
 * vuole. Le fasi si distinguono dal colore, dalla scritta grande e dai suoni, non solo dal colore.
 */
export function TimerVolee({ durataTiro, suoni, ora = Date.now }: TimerVoleeProps) {
  const [inizio, setInizio] = useState<number | null>(null)
  const [trascorso, setTrascorso] = useState(0)
  const suoniRef = useRef<Suoni | null>(suoni ?? null)
  const ultimo = useRef(-1)
  const blocco = useRef<BloccoSchermo | null>(null)

  const suona = (evento: EventoTimer) => {
    const s = suoniRef.current
    if (!s) return
    if (evento === 'avviso') s.avviso()
    else s.fischi(FISCHI[evento])
  }

  const rilascia = () => {
    void blocco.current?.release().catch(() => {})
    blocco.current = null
  }

  const avvia = () => {
    suoniRef.current ??= creaSuoni()
    suoniRef.current.sblocca()
    ultimo.current = -1
    // Lo schermo non deve spegnersi mentre si tira (dove il telefono lo permette).
    const wakeLock = (
      navigator as unknown as { wakeLock?: { request(t: 'screen'): Promise<BloccoSchermo> } }
    ).wakeLock
    void wakeLock
      ?.request('screen')
      .then((b) => (blocco.current = b))
      .catch(() => {})
    for (const e of eventiTra(durataTiro, -1, 0)) suona(e)
    ultimo.current = 0
    setTrascorso(0)
    setInizio(ora())
  }

  const ferma = () => {
    rilascia()
    setInizio(null)
  }

  useEffect(() => {
    if (inizio === null) return
    const id = window.setInterval(() => {
      const t = ora() - inizio
      for (const e of eventiTra(durataTiro, ultimo.current, t)) suona(e)
      ultimo.current = t
      if (t >= PREPARAZIONE_MS + durataTiro + CODA_MS) {
        rilascia()
        setInizio(null)
        return
      }
      setTrascorso(t)
    }, INTERVALLO_MS)
    return () => window.clearInterval(id)
  }, [inizio, durataTiro, ora])

  // All'uscita dalla pagina: si libera l'audio e lo schermo.
  useEffect(
    () => () => {
      suoniRef.current?.chiudi()
      void blocco.current?.release().catch(() => {})
    },
    [],
  )

  if (inizio === null) {
    return (
      <div className={styles.fermo}>
        <Button variant="secondary" onClick={avvia}>
          Avvia timer
        </Button>
        <p className={`type-caption ${styles.aiuto}`}>
          Facoltativo: 1 fischio, 10 secondi per andare in linea, 1 fischio e parte il tempo.
        </p>
      </div>
    )
  }

  const stato = statoTimer(durataTiro, trascorso)
  return (
    <section className={styles.timer} data-fase={stato.fase} aria-label="Timer della volée">
      <p className={styles.fase}>{stato.etichetta}</p>
      <p className={styles.tempo} role="timer">
        {formattaTempo(stato.restante)}
      </p>
      {/* Chi usa un lettore di schermo sente solo il cambio di fase, non ogni secondo. */}
      <p className="visually-hidden" aria-live="assertive">
        {stato.etichetta}
      </p>
      <Button variant="secondary" onClick={ferma}>
        {stato.fase === 'finito' ? 'Chiudi' : 'Ferma il timer'}
      </Button>
    </section>
  )
}
