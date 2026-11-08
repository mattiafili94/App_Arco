import { useId, type ReactNode } from 'react'
import { Check, ChevronRight, ExternalLink } from 'lucide-react'
import { Link } from 'react-router'
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
  /** Una riga di testo più piccola sotto il nome (es. lo stato di una gara). */
  description?: string
  /** Riga che porta a un'altra pagina: mostra la freccia. */
  href?: string
  /** Con `href`: l'indirizzo è fuori dall'app (sito, email, file): si apre a parte, con l'icona dedicata. */
  esterno?: boolean
  /** Riga di scelta: `selected` indica la scelta attuale, `onSelect` la cambia. */
  selected?: boolean
  onSelect?: () => void
}

/**
 * Riga di elenco (UI Top, ListRows). Tre usi, mai mescolati:
 * destinazione (con freccia), nome-valore, scelta (con segno di spunta).
 */
export function ListRow({
  label,
  value,
  description,
  href,
  esterno,
  selected,
  onSelect,
}: ListRowProps) {
  const contenuto = (
    <>
      <span className={styles.label}>
        {label}
        {description && <span className={`type-caption ${styles.description}`}>{description}</span>}
      </span>
      {value && <span className={styles.value}>{value}</span>}
      {href && <Icon icon={esterno ? ExternalLink : ChevronRight} className={styles.trailing} />}
      {selected !== undefined && (
        <span className={styles.trailing}>{selected && <Icon icon={Check} />}</span>
      )}
    </>
  )

  if (href && esterno) {
    return (
      <a
        className={`${styles.row} ${styles.interactive}`}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
      >
        {contenuto}
      </a>
    )
  }
  if (href) {
    return (
      <Link className={`${styles.row} ${styles.interactive}`} to={href}>
        {contenuto}
      </Link>
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
