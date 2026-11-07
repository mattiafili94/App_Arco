import { useEffect, type ReactNode } from 'react'
import { WifiOff } from 'lucide-react'
import { StatusLine } from '../componenti/StatusLine'
import { useOnline } from '../stato/useOnline'
import styles from '../Shell.module.css'

/** Struttura delle pagine senza barra dei tab (es. Accedi, prima dell'accesso). */
export function PaginaSemplice({ children }: { children: ReactNode }) {
  const online = useOnline()
  useEffect(() => {
    document.title = 'Accedi · Arcieri Eugubini'
  }, [])
  return (
    <div className={styles.shell}>
      <div className={styles.page}>
        {!online && <StatusLine icon={WifiOff}>Offline.</StatusLine>}
        <main className={styles.content}>{children}</main>
      </div>
    </div>
  )
}
