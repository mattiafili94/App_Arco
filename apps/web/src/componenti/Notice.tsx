import type { ReactNode } from 'react'
import { CircleCheck, CircleX, Info, TriangleAlert, type LucideIcon } from 'lucide-react'
import { Icon } from './Icon'
import styles from './Notice.module.css'

export type NoticeStatus = 'success' | 'warning' | 'error' | 'info'

const ICONE: Record<NoticeStatus, LucideIcon> = {
  success: CircleCheck,
  warning: TriangleAlert,
  error: CircleX,
  info: Info,
}

export interface NoticeProps {
  status: NoticeStatus
  /** Le prime parole dicono cosa è successo, il resto cosa fare. */
  children: ReactNode
}

/**
 * Avviso in linea (UI Top, Notice), vicino a ciò che riguarda. Lo stato si capisce anche
 * senza colore, grazie all'icona. Gli errori restano finché non sono risolti.
 */
export function Notice({ status, children }: NoticeProps) {
  return (
    <div
      className={`${styles.notice} ${styles[status]}`}
      role={status === 'error' ? 'alert' : 'status'}
    >
      <Icon icon={ICONE[status]} className={styles.icon} />
      <div className={styles.text}>{children}</div>
    </div>
  )
}
