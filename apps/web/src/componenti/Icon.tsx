import type { LucideIcon } from 'lucide-react'
import styles from './Icon.module.css'

export interface IconProps {
  /** Icona Lucide, scelta dalla tabella "un concetto = un'icona" (design-system/README.md). */
  icon: LucideIcon
  size?: 'compact' | 'standard' | 'prominent'
  /** Nome accessibile: solo se l'icona da sola porta un significato. Altrimenti è decorativa. */
  label?: string
  className?: string
}

export function Icon({ icon: Componente, size = 'standard', label, className }: IconProps) {
  return (
    <Componente
      className={[styles.icon, styles[size], className].filter(Boolean).join(' ')}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? 'img' : undefined}
      focusable="false"
    />
  )
}
