/**
 * Sostituto di `virtual:pwa-register/react` nei test. Di base non c'è nessuna nuova versione;
 * un test può simularla con `simulaNuovaVersione()`.
 */
let nuova = false
export const chiamateAggiorna: boolean[] = []

export function simulaNuovaVersione(valore = true) {
  nuova = valore
}

export function useRegisterSW() {
  return {
    needRefresh: [nuova, () => {}] as [boolean, (v: boolean) => void],
    offlineReady: [false, () => {}] as [boolean, (v: boolean) => void],
    updateServiceWorker: async (ricaricaPagina?: boolean) => {
      chiamateAggiorna.push(Boolean(ricaricaPagina))
    },
  }
}
