import { useId, type TextareaHTMLAttributes } from 'react'
import styles from './Textarea.module.css'

export interface TextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> {
  label: string
  /** Suggerimento sotto l'etichetta. */
  hint?: string
}

/** Testo libero su più righe (UI Top, Field): etichetta sempre visibile. */
export function Textarea({ label, hint, className, rows = 4, ...area }: TextareaProps) {
  const id = useId()
  const idAiuto = `${id}-aiuto`
  return (
    <div className={[styles.campo, className].filter(Boolean).join(' ')}>
      <label htmlFor={id} className={`type-label ${styles.etichetta}`}>
        {label}
      </label>
      {hint && (
        <p id={idAiuto} className={`type-caption ${styles.aiuto}`}>
          {hint}
        </p>
      )}
      <textarea
        {...area}
        id={id}
        rows={rows}
        className={styles.area}
        aria-describedby={hint ? idAiuto : undefined}
      />
    </div>
  )
}
