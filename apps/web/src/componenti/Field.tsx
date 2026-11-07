import { useId, type InputHTMLAttributes } from 'react'
import styles from './Field.module.css'

export interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string
  /** Suggerimento sotto l'etichetta (es. il formato atteso). */
  hint?: string
  /** Errore accanto al campo: cosa non va e come correggerlo. */
  error?: string
}

/** Campo di testo (UI Top, Field): etichetta sempre visibile, errore accanto al campo. */
export function Field({ label, hint, error, className, ...input }: FieldProps) {
  const id = useId()
  const idAiuto = `${id}-aiuto`
  const idErrore = `${id}-errore`
  const descritto = [hint && idAiuto, error && idErrore].filter(Boolean).join(' ') || undefined

  return (
    <div className={[styles.field, className].filter(Boolean).join(' ')}>
      <label htmlFor={id} className={`type-label ${styles.label}`}>
        {label}
      </label>
      {hint && (
        <p id={idAiuto} className={`type-caption ${styles.hint}`}>
          {hint}
        </p>
      )}
      <input
        {...input}
        id={id}
        className={styles.input}
        aria-invalid={error ? true : undefined}
        aria-describedby={descritto}
      />
      {error && (
        <p id={idErrore} className={`type-caption ${styles.error}`}>
          {error}
        </p>
      )}
    </div>
  )
}
