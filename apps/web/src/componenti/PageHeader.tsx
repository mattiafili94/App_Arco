import type { ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Icon } from './Icon'
import styles from './PageHeader.module.css'

export interface PageHeaderProps {
  title: string
  /** Solo se la pagina ha una pagina "genitore". */
  back?: { label: string; href: string }
  description?: string
  /** Al massimo un'azione principale, a destra del titolo. */
  action?: ReactNode
}

/** L'intestazione unica di ogni pagina: dove sei, come tornare indietro, l'azione principale. */
export function PageHeader({ title, back, description, action }: PageHeaderProps) {
  return (
    <header className={styles.header}>
      {back && (
        <a className={styles.back} href={back.href}>
          <Icon icon={ArrowLeft} size="compact" />
          {back.label}
        </a>
      )}
      <div className={styles.row}>
        <h1 className={`type-page-title ${styles.title}`}>{title}</h1>
        {action && <div className={styles.action}>{action}</div>}
      </div>
      {description && <p className={styles.description}>{description}</p>}
    </header>
  )
}
