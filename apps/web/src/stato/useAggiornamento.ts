import { useRegisterSW } from 'virtual:pwa-register/react'

/**
 * Nuova versione dell'app (UI Top, States › Updates): non interrompe mai il lavoro.
 * Quando è pronta, l'app lo dice e si ricarica solo se l'atleta lo sceglie.
 */
export function useAggiornamento(): { nuovaVersione: boolean; ricarica: () => void } {
  const {
    needRefresh: [nuovaVersione],
    updateServiceWorker,
  } = useRegisterSW()
  return { nuovaVersione, ricarica: () => void updateServiceWorker(true) }
}
