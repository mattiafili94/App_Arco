import { createContext, useContext, useMemo } from 'react'
import { useAccesso } from '../accesso/contesto'
import { ambienteBrowser } from './browser'
import { creaServizioNotifiche, type ServizioNotifiche } from './servizio'

/** Nei test si può mettere un servizio finto; di base si usa il browser vero. */
export const ContestoNotifiche = createContext<ServizioNotifiche | null>(null)

export function useServizioNotifiche(): ServizioNotifiche {
  const finto = useContext(ContestoNotifiche)
  const { servizio } = useAccesso()
  return useMemo(
    () =>
      finto ??
      creaServizioNotifiche(servizio, ambienteBrowser, import.meta.env.VITE_VAPID_PUBLIC_KEY),
    [finto, servizio],
  )
}
