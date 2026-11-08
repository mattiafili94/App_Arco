// Invio vero delle notifiche push (Web Push con chiavi VAPID). Le chiavi si creano una volta sola con
//   npx web-push generate-vapid-keys
// e si mettono tra i segreti: VAPID_PUBLIC_KEY e VAPID_PRIVATE_KEY (vedi supabase/README.md).
import webpush from 'web-push'
import type { Inviatore } from '../_shared/aggiornamento/index.ts'

/** Chi manda le notifiche si presenta con l'indirizzo dell'app (richiesto dallo standard). */
const OGGETTO_VAPID = 'https://arcieri-eugubini.pages.dev'

/** L'invio vero, oppure null se le chiavi VAPID non sono (ancora) impostate. */
export function creaInviatorePush(): Inviatore | null {
  const pubblica = Deno.env.get('VAPID_PUBLIC_KEY')
  const privata = Deno.env.get('VAPID_PRIVATE_KEY')
  if (!pubblica || !privata) return null
  webpush.setVapidDetails(OGGETTO_VAPID, pubblica, privata)
  return async (iscrizione, messaggio) => {
    try {
      await webpush.sendNotification(
        {
          endpoint: iscrizione.endpoint,
          keys: { p256dh: iscrizione.p256dh, auth: iscrizione.auth },
        },
        messaggio,
        { TTL: 2 * 24 * 3600, urgency: 'normal' },
      )
      return 'ok'
    } catch (errore) {
      // 404 e 410: il telefono ha disinstallato l'app o tolto il permesso.
      const stato = (errore as { statusCode?: number }).statusCode
      return stato === 404 || stato === 410 ? 'scaduta' : 'errore'
    }
  }
}
