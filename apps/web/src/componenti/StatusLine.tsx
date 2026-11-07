import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Icon } from './Icon'
import styles from './StatusLine.module.css'

export interface StatusLineProps {
  icon: LucideIcon
  children: ReactNode
  /** Al massimo un'azione (es. "Ricarica"). */
  action?: ReactNode
}

/**
 * Riga di stato dell'app (UI Top, States): una riga calma con icona e parola, mai una finestra
 * o un banner rosso. Esempi: offline, nuova versione pronta.
 */
export function StatusLine({ icon, children, action }: StatusLineProps) {
  return (
    <div className={styles.line} role="status">
      <Icon icon={icon} size="compact" className={styles.icon} />
      <span className={`type-caption ${styles.text}`}>{children}</span>
      {action}
    </div>
  )
}
