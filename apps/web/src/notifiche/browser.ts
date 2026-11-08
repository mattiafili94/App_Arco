import type { IscrizionePush } from '../accesso/servizio'
import { appInstallata } from '../stato/installata'
import type { Ambiente } from './servizio'

/** La chiave pubblica VAPID arriva in formato testo "url-safe"; il browser la vuole in byte. */
export function chiaveInByte(chiave: string): Uint8Array<ArrayBuffer> {
  const base64 = (chiave + '='.repeat((4 - (chiave.length % 4)) % 4))
    .replace(/-/g, '+')
    .replace(/_/g, '/')
  const testo = atob(base64)
  const byte = new Uint8Array(new ArrayBuffer(testo.length))
  for (let i = 0; i < testo.length; i++) byte[i] = testo.charCodeAt(i)
  return byte
}

/** Dal browser alle tre stringhe che servono al server per scrivere a questo telefono. */
export function daSottoscrizione(s: PushSubscription): IscrizionePush {
  const { endpoint, keys } = s.toJSON()
  if (!endpoint || !keys?.p256dh || !keys.auth) throw new Error('Sottoscrizione incompleta')
  return { endpoint, p256dh: keys.p256dh, auth: keys.auth }
}

const èApple = () =>
  /iPhone|iPad|iPod/.test(navigator.userAgent) ||
  // iPad con "sito desktop": si presenta come Mac, ma ha lo schermo a tocco.
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

const registrazione = () => navigator.serviceWorker.ready

/** Il browser vero. */
export const ambienteBrowser: Ambiente = {
  supportato: () =>
    'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window,
  daAggiungereAllaHome: () => èApple() && !appInstallata(),
  permesso: () => Notification.permission,
  chiediPermesso: () => Notification.requestPermission(),
  async iscrizione() {
    const s = await (await registrazione()).pushManager.getSubscription()
    return s ? daSottoscrizione(s) : null
  },
  async iscrivi(chiavePubblica) {
    const r = await registrazione()
    const s = await r.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: chiaveInByte(chiavePubblica),
    })
    return daSottoscrizione(s)
  },
  async annulla() {
    const s = await (await registrazione()).pushManager.getSubscription()
    await s?.unsubscribe()
  },
}
