import { formattaTempo } from '@arco/shared'
import { Button } from './Button'
import styles from './TimerVolee.module.css'
import { useTimerVolee, type Timer, type TimerVoleeProps } from './useTimerVolee'

/** Il pulsante "Avvia timer" (si mostra solo quando il timer è fermo). */
export function PulsanteTimer({ timer }: { timer: Timer }) {
  if (timer.attivo) return null
  return (
    <Button variant="secondary" onClick={timer.avvia}>
      Avvia timer
    </Button>
  )
}

/**
 * Il riquadro del timer mentre va: fase, tempo e "Ferma il timer". Le fasi si distinguono dal colore, dalla
 * scritta grande e dai suoni, non solo dal colore.
 */
export function PannelloTimer({ timer }: { timer: Timer }) {
  if (!timer.attivo) return null
  const { stato, ferma } = timer
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

/** Pulsante e riquadro insieme, uno sotto l'altro. */
export function TimerVolee(props: TimerVoleeProps) {
  const timer = useTimerVolee(props)
  return (
    <>
      <PulsanteTimer timer={timer} />
      <PannelloTimer timer={timer} />
    </>
  )
}
