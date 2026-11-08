/**
 * Notifiche push "nuovo invito" sul telefono (Fase 3.4).
 *
 * `creaServizioNotifiche` contiene le regole (che stato mostrare, cosa fare quando si accende o
 * si spegne l'interruttore); il browser vero sta in `browser.ts`, nei test se ne usa uno finto.
 */
import type { IscrizionePush } from '../accesso/servizio'

export type StatoNotifiche =
  /** Non si sa ancora (si controlla il browser). */
  | 'caricamento'
  /** Questo browser non sa fare le notifiche push, o la build non ha la chiave. */
  | 'non-supportate'
  /** iPhone: funzionano solo con l'app aggiunta alla schermata Home. */
  | 'serve-home'
  /** L'atleta ha negato il permesso nelle impostazioni del telefono. */
  | 'bloccate'
  | 'spente'
  | 'accese'

export type EsitoAttiva = 'ok' | 'negato' | 'errore'

export interface ServizioNotifiche {
  stato(): Promise<StatoNotifiche>
  attiva(): Promise<EsitoAttiva>
  disattiva(): Promise<void>
}

/** Cosa serve dal browser (Notification, Service Worker, PushManager). */
export interface Ambiente {
  /** Servono service worker, PushManager e Notification. */
  supportato(): boolean
  /** iPhone/iPad con l'app aperta da Safari invece che dalla schermata Home. */
  daAggiungereAllaHome(): boolean
  permesso(): NotificationPermission
  chiediPermesso(): Promise<NotificationPermission>
  /** Registrazione di questo telefono, se c'è già. */
  iscrizione(): Promise<IscrizionePush | null>
  iscrivi(chiavePubblica: string): Promise<IscrizionePush>
  annulla(): Promise<void>
}

/** Cosa serve per registrare o togliere il telefono sul server. */
export interface RegistroPush {
  registraPush(iscrizione: IscrizionePush): Promise<void>
  rimuoviPush(endpoint: string): Promise<void>
}

export function creaServizioNotifiche(
  registro: RegistroPush,
  ambiente: Ambiente,
  /** Chiave pubblica VAPID (non è un segreto). Senza, le notifiche non si possono accendere. */
  chiavePubblica: string | undefined,
): ServizioNotifiche {
  return {
    async stato() {
      if (ambiente.daAggiungereAllaHome()) return 'serve-home'
      if (!ambiente.supportato() || !chiavePubblica) return 'non-supportate'
      const permesso = ambiente.permesso()
      if (permesso === 'denied') return 'bloccate'
      if (permesso === 'granted' && (await ambiente.iscrizione())) return 'accese'
      return 'spente'
    },

    async attiva() {
      if (!chiavePubblica) return 'errore'
      try {
        if ((await ambiente.chiediPermesso()) !== 'granted') return 'negato'
        const iscrizione = await ambiente.iscrivi(chiavePubblica)
        await registro.registraPush(iscrizione)
        return 'ok'
      } catch {
        return 'errore'
      }
    },

    async disattiva() {
      const iscrizione = await ambiente.iscrizione()
      await ambiente.annulla()
      // Senza rete la registrazione resta sul server: sparirà al primo invio (telefono non più valido).
      if (iscrizione) await registro.rimuoviPush(iscrizione.endpoint).catch(() => {})
    },
  }
}
