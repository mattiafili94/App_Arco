import { useId, type ReactNode } from 'react'
import { Check, ChevronRight } from 'lucide-react'
import { Icon } from './Icon'
import styles from './List.module.css'

export interface ListGroupProps {
  title: string
  /** "radiogroup" quando le righe sono scelte alternative (es. il tema). */
  role?: 'radiogroup'
  children: ReactNode
}

/** Gruppo di righe: fondo `background-surface` sul fondo della pagina, con un titolo breve. */
export function ListGroup({ title, role, children }: ListGroupProps) {
  const id = useId()
  return (
    <section className={styles.group} aria-labelledby={id}>
      <h2 id={id} className={`type-label ${styles.groupTitle}`}>
        {title}
      </h2>
      <div className={styles.rows} role={role} aria-labelledby={role ? id : undefined}>
        {children}
      </div>
    </section>
  )
}

export interface ListRowProps {
  label: string
  /** Valore attuale, a destra (es. "Chiaro"). */
  value?: string
  /** Riga che porta a un'altra pagina: mostra la freccia. */
  href?: string
  /** Riga di scelta: `selected` indica la scelta attuale, `onSelect` la cambia. */
  selected?: boolean
  onSelect?: () => void
}

/**
 * Riga di elenco (UI Top, ListRows). Tre usi, mai mescolati:
 * destinazione (con freccia), nome-valore, scelta (con segno di spunta).
 */
export function ListRow({ label, value, href, selected, onSelect }: ListRowProps) {
  const contenuto = (
    <>
      <span className={styles.label}>{label}</span>
      {value && <span className={styles.value}>{value}</span>}
      {href && <Icon icon={ChevronRight} className={styles.trailing} />}
      {selected !== undefined && (
        <span className={styles.trailing}>{selected && <Icon icon={Check} />}</span>
      )}
    </>
  )

  if (href) {
    return (
      <a className={`${styles.row} ${styles.interactive}`} href={href}>
        {contenuto}
      </a>
    )
  }
  if (onSelect) {
    return (
      <button
        type="button"
        className={`${styles.row} ${styles.interactive}`}
        role={selected !== undefined ? 'radio' : undefined}
        aria-checked={selected}
        onClick={onSelect}
      >
        {contenuto}
      </button>
    )
  }
  return <div className={styles.row}>{contenuto}</div>
}
