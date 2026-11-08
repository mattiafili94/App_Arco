import styles from './Scelte.module.css'

export interface ScelteProps {
  /** Il nome del gruppo, per i lettori di schermo e come etichetta sopra i pulsanti. */
  label: string
  opzioni: readonly { valore: string; etichetta: string }[]
  valore: string
  onChange(valore: string): void
}

/**
 * Poche scelte alternative, tutte visibili (es. "Tutta Italia" / "Umbria"). La scelta attuale si
 * riconosce dal bordo spesso e dal fondo, non solo dal colore.
 */
export function Scelte({ label, opzioni, valore, onChange }: ScelteProps) {
  return (
    <div className={styles.gruppo}>
      <span className={`type-label ${styles.etichetta}`}>{label}</span>
      <div className={styles.scelte} role="radiogroup" aria-label={label}>
        {opzioni.map((o) => (
          <button
            key={o.valore}
            type="button"
            role="radio"
            aria-checked={o.valore === valore}
            className={styles.scelta}
            onClick={() => onChange(o.valore)}
          >
            {o.etichetta}
          </button>
        ))}
      </div>
    </div>
  )
}
