import { useSyncExternalStore } from 'react'

const iscrivi = (avvisa: () => void) => {
  window.addEventListener('online', avvisa)
  window.addEventListener('offline', avvisa)
  return () => {
    window.removeEventListener('online', avvisa)
    window.removeEventListener('offline', avvisa)
  }
}

/** `true` quando il telefono ha la rete, `false` quando è offline. Si aggiorna da solo. */
export function useOnline(): boolean {
  return useSyncExternalStore(iscrivi, () => navigator.onLine)
}
