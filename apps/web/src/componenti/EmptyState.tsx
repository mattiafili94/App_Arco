import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Icon } from './Icon'
import styles from './EmptyState.module.css'

export interface EmptyStateProps {
  /** Cosa è vuoto. */
  title: string
  /** Perché è vuoto e cosa fare. */
  description: string
  /** Un'icona solo se aiuta a capire. */
  icon?: LucideIcon
  /** Al massimo un'azione principale. */
  action?: ReactNode
}

/** Stato vuoto (UI Top, EmptyState): cosa è vuoto, perché, cosa fare. Niente illustrazioni. */
export function EmptyState({ title, description, icon, action }: EmptyStateProps) {
  return (
    <div className={styles.empty}>
      {icon && <Icon icon={icon} size="prominent" className={styles.icon} />}
      <h2 className="type-section-heading">{title}</h2>
      <p className={styles.description}>{description}</p>
      {action && <div className={styles.action}>{action}</div>}
    </div>
  )
}
