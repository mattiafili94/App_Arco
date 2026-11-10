import type { ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router'
import { Icon } from './Icon'
import styles from './PageHeader.module.css'

export interface PageHeaderProps {
  title: string
  /** Solo se la pagina ha una pagina "genitore". */
  back?: { label: string; href: string; state?: unknown }
  description?: string
  /** Al massimo un'azione principale, a destra del titolo. */
  action?: ReactNode
}

/**
 * L'intestazione unica di ogni pagina: dove sei, come tornare indietro, l'azione principale.
 * Il titolo può ricevere il focus (tabIndex -1) così, cambiando pagina, chi usa un lettore di
 * schermo sente subito dove è arrivato.
 */
export function PageHeader({ title, back, description, action }: PageHeaderProps) {
  return (
    <header className={styles.header}>
      {back && (
        <Link className={styles.back} to={back.href} state={back.state}>
          <Icon icon={ArrowLeft} size="compact" />
          {back.label}
        </Link>
      )}
      <div className={styles.row}>
        <h1 className={`type-page-title ${styles.title}`} tabIndex={-1} data-titolo-pagina>
          {title}
        </h1>
        {action && <div className={styles.action}>{action}</div>}
      </div>
      {description && <p className={styles.description}>{description}</p>}
    </header>
  )
}
