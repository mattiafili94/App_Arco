import type { LucideIcon } from 'lucide-react'
import { Link } from 'react-router'
import { Icon } from './Icon'
import styles from './IconLink.module.css'

export interface IconLinkProps {
  icon: LucideIcon
  /** Nome della destinazione, letto dai lettori di schermo (l'icona da sola non ha testo). */
  label: string
  to: string
  /** Dati da passare alla pagina di destinazione (es. da dove si arriva). */
  state?: unknown
}

/** Collegamento a un'altra pagina fatto solo di un'icona (es. Impostazioni). */
export function IconLink({ icon, label, to, state }: IconLinkProps) {
  return (
    <Link className={styles.iconLink} to={to} state={state} aria-label={label}>
      <Icon icon={icon} size="prominent" />
    </Link>
  )
}
