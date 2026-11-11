import { useEffect, useRef } from 'react'
import { RefreshCw, WifiOff } from 'lucide-react'
import { Outlet, useLocation } from 'react-router'
import { Button } from './componenti/Button'
import { NavigationBar } from './componenti/NavigationBar'
import { StatusLine } from './componenti/StatusLine'
import { useSonoAllenatore } from './allenatore/dati'
import { destinazioneDi, destinazioniPer, titoloDocumento } from './navigazione'
import { useAggiornamento } from './stato/useAggiornamento'
import { useOnline } from './stato/useOnline'
import styles from './Shell.module.css'

/** Struttura di ogni pagina: righe di stato in alto, contenuto, barra dei tab in basso. */
export function Shell() {
  const { pathname } = useLocation()
  const online = useOnline()
  const { nuovaVersione, ricarica } = useAggiornamento()
  const primaVolta = useRef(true)
  // Il quinto tab "I miei atleti" solo per chi ha il ruolo di allenatore.
  const allenatore = useSonoAllenatore() === true

  useEffect(() => {
    document.title = titoloDocumento(pathname)
    if (primaVolta.current) {
      primaVolta.current = false
      return
    }
    // Cambiando pagina: si riparte dall'alto e il lettore di schermo legge il nuovo titolo.
    window.scrollTo(0, 0)
    document.querySelector<HTMLElement>('[data-titolo-pagina]')?.focus()
  }, [pathname])

  return (
    <div className={styles.shell}>
      <div className={styles.page}>
        {!online && (
          <StatusLine icon={WifiOff}>
            Offline. L'app usa quello che è salvato sul telefono.
          </StatusLine>
        )}
        {nuovaVersione && (
          <StatusLine
            icon={RefreshCw}
            action={
              <Button variant="text" onClick={ricarica}>
                Ricarica
              </Button>
            }
          >
            Nuova versione pronta.
          </StatusLine>
        )}
        <main key={pathname} className={styles.content}>
          <Outlet />
        </main>
      </div>
      <NavigationBar
        destinations={destinazioniPer(allenatore)}
        current={destinazioneDi(pathname)?.id}
      />
    </div>
  )
}
