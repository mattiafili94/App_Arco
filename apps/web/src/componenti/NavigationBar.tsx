import type { CSSProperties } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Link } from 'react-router'
import { Icon } from './Icon'
import styles from './NavigationBar.module.css'

export interface Destination {
  id: string
  label: string
  icon: LucideIcon
  href: string
}

export interface NavigationBarProps {
  /** Da 3 a 5 destinazioni, sempre nello stesso ordine. */
  destinations: readonly Destination[]
  /** La destinazione attuale; nessuna (es. nelle Impostazioni) nasconde l'indicatore. */
  current?: string
}

/**
 * Barra di navigazione principale (UI Top, NavigationBar): la selezione si vede in tre modi
 * insieme (indicatore dietro l'icona, icona nel colore principale, etichetta in grassetto).
 */
export function NavigationBar({ destinations, current }: NavigationBarProps) {
  const indice = destinations.findIndex((d) => d.id === current)
  const variabili = {
    '--indice': Math.max(0, indice),
    '--numero': destinations.length,
  } as CSSProperties

  return (
    <nav className={styles.bar} aria-label="Navigazione principale">
      <ul className={styles.list} style={variabili}>
        {indice >= 0 && (
          <li className={styles.indicatorTrack} aria-hidden="true">
            <span className={styles.indicator} />
          </li>
        )}
        {destinations.map((d) => {
          const attiva = d.id === current
          return (
            <li key={d.id} className={styles.item}>
              <Link
                to={d.href}
                className={[styles.link, attiva && styles.active].filter(Boolean).join(' ')}
                aria-current={attiva ? 'page' : undefined}
              >
                <Icon icon={d.icon} />
                <span className={`type-label ${styles.label}`}>{d.label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
