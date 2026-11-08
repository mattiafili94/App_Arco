import { useId, type SelectHTMLAttributes } from 'react'
import styles from './Select.module.css'

export interface SelectProps extends Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  'id' | 'onChange'
> {
  label: string
  opzioni: readonly { valore: string; etichetta: string }[]
  valore: string
  onChange(valore: string): void
}

/** Scelta da un elenco (UI Top, Field): etichetta sempre visibile, menu nativo del telefono. */
export function Select({ label, opzioni, valore, onChange, className, ...select }: SelectProps) {
  const id = useId()
  return (
    <div className={[styles.campo, className].filter(Boolean).join(' ')}>
      <label htmlFor={id} className={`type-label ${styles.etichetta}`}>
        {label}
      </label>
      <select
        {...select}
        id={id}
        className={styles.select}
        value={valore}
        onChange={(e) => onChange(e.target.value)}
      >
        {opzioni.map((o) => (
          <option key={o.valore} value={o.valore}>
            {o.etichetta}
          </option>
        ))}
      </select>
    </div>
  )
}
