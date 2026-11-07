import type { ButtonHTMLAttributes, MouseEvent, ReactNode } from 'react'
import { LoaderCircle, type LucideIcon } from 'lucide-react'
import { Icon } from './Icon'
import styles from './Button.module.css'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Un solo "primary" per zona; "destructive" per le azioni che cancellano. */
  variant?: 'primary' | 'secondary' | 'text' | 'destructive'
  /** Icona prima dell'etichetta, solo se aiuta a riconoscere l'azione. */
  icon?: LucideIcon
  /** In corso: il pulsante mantiene la larghezza e mostra l'avanzamento. */
  loading?: boolean
  children: ReactNode
}

export function Button({
  variant = 'secondary',
  icon,
  loading = false,
  type = 'button',
  className,
  children,
  onClick,
  ...altro
}: ButtonProps) {
  const gestisciClic = (evento: MouseEvent<HTMLButtonElement>) => {
    // Mentre è in corso, un secondo tocco non deve ripetere l'azione.
    if (loading) {
      evento.preventDefault()
      return
    }
    onClick?.(evento)
  }

  return (
    <button
      {...altro}
      type={type}
      className={[styles.button, styles[variant], loading && styles.loading, className]
        .filter(Boolean)
        .join(' ')}
      aria-busy={loading || undefined}
      onClick={gestisciClic}
    >
      <span className={styles.content}>
        {icon && <Icon icon={icon} />}
        <span>{children}</span>
      </span>
      {loading && (
        <span className={styles.progress}>
          <Icon icon={LoaderCircle} className={styles.spinner} />
          <span className="visually-hidden">In corso</span>
        </span>
      )}
    </button>
  )
}
