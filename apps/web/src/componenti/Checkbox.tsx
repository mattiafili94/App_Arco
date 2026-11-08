import { useId, type InputHTMLAttributes } from 'react'
import styles from './Checkbox.module.css'

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'type'> {
  label: string
}

/** Casella da spuntare (UI Top): tutta la riga si tocca, almeno 48 px di altezza. */
export function Checkbox({ label, className, ...input }: CheckboxProps) {
  const id = useId()
  return (
    <label htmlFor={id} className={[styles.riga, className].filter(Boolean).join(' ')}>
      <input {...input} id={id} type="checkbox" className={styles.casella} />
      <span>{label}</span>
    </label>
  )
}
