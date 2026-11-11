import { useEffect, useRef, useState } from 'react'
import { eventiTra, FISCHI, PREPARAZIONE_MS, statoTimer, type EventoTimer } from '@arco/shared'
import { creaSuoni, type Suoni } from '../allenamento/suoni'

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

/** Il timer della volée: se sta andando, come avviarlo e fermarlo, e la fase in corso. */
export interface Timer {
  attivo: boolean
  avvia(): void
  ferma(): void
  stato: ReturnType<typeof statoTimer>
}

/**
 * Il timer della volée, facoltativo. Si avvia con un tocco, segue la sequenza di gara (1 fischio, 10 secondi
 * per andare in linea, 1 fischio, tempo di tiro, avviso a 30 secondi, 2 fischi) e si può fermare quando si
 * vuole. Il pulsante per avviarlo e il riquadro con il tempo possono stare in punti diversi della pagina
 * (Mattia, 11/11/2026: "Avvia timer" accanto al titolo): per questo è un hook.
 */
export function useTimerVolee({ durataTiro, suoni, ora = Date.now }: TimerVoleeProps): Timer {
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

  return { attivo: inizio !== null, avvia, ferma, stato: statoTimer(durataTiro, trascorso) }
}
