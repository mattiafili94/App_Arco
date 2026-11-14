/**
 * Notifiche push "nuovo invito" (Fase 3.4): quando mandarle e come inviarle.
 *
 * Regole (Mattia, 10/11/2026): a tutti i telefoni registrati, solo per l'invito NUOVO di una gara
 * FUTURA. Gli inviti già salvati e quelli cambiati non mandano niente.
 *
 * Database e servizio push arrivano dall'esterno (`ArchivioNotifiche`, `Inviatore`): la funzione del
 * server passa quelli veri, i test quelli finti.
 */
import { formattaDate } from '../date.ts'
import { riconosciTipologia } from '../tipologie.ts'

/** Una notifica in coda (tabella `notifiche`). */
export interface NotificaInvito {
  gara_codice: string
  titolo: string
  testo: string
}

/** Quanto resta valida una notifica non ancora partita: poi non ha più senso mandarla. */
export const VALIDITA_NOTIFICA_MS = 2 * 24 * 3_600_000

interface GaraPerNotifica {
  codice: string
  dal: string
  al: string
  localita: string
  tipologia: string
  stato: string
}

/** Va notificato l'invito appena letto? Solo se è nuovo e la gara non è né passata né annullata. */
export function vaNotificato(
  g: Pick<GaraPerNotifica, 'al' | 'stato'>,
  invitoGiaSalvato: boolean,
  oggi: string,
): boolean {
  return !invitoGiaSalvato && g.al >= oggi && g.stato !== 'annullata'
}

/** Il messaggio: dice solo quale gara; gli orari si leggono nell'invito, nella scheda della gara. */
export function notificaInvito(g: GaraPerNotifica): NotificaInvito {
  const tipo = riconosciTipologia(g.tipologia)?.etichetta ?? g.tipologia
  return {
    gara_codice: g.codice,
    titolo: 'Nuovo invito',
    testo: `È arrivato l'invito di ${tipo} · ${g.localita} (${formattaDate(g.dal, g.al)}). Tocca per leggerlo.`,
  }
}

// --- Invio ----------------------------------------------------------------------------------------

/** Un telefono registrato (tabella `iscrizioni_push`). */
export interface Iscrizione {
  endpoint: string
  p256dh: string
  auth: string
}

export interface NotificaDaInviare extends NotificaInvito {
  id: number
  creata_il: string
}

export interface ArchivioNotifiche {
  daInviare(): Promise<NotificaDaInviare[]>
  iscrizioni(): Promise<Iscrizione[]>
  segnaInviata(id: number): Promise<void>
  togliIscrizioni(endpoint: string[]): Promise<void>
}

/** Manda un messaggio a un telefono. "scaduta": il telefono non esiste più (registrazione da togliere). */
export type Inviatore = (
  iscrizione: Iscrizione,
  messaggio: string,
) => Promise<'ok' | 'scaduta' | 'errore'>

export interface RiepilogoInvio {
  notifiche: number
  inviate: number
  scadute: number
  errori: number
}

/** Cosa riceve il telefono: il service worker apre `url` al tocco. */
export const messaggioPush = (n: NotificaInvito) =>
  JSON.stringify({ titolo: n.titolo, testo: n.testo, url: `/gare/${n.gara_codice}` })

/**
 * Manda le notifiche in coda a tutti i telefoni registrati.
 * - Se non c'è nessun telefono, la notifica si chiude lo stesso (chi si registra dopo non riceve il passato).
 * - Se la consegna fallisce per tutti (rete, servizio push giù), resta in coda e riprova al prossimo giro,
 *   ma solo per 2 giorni.
 */
export async function inviaNotifiche(
  archivio: ArchivioNotifiche,
  invia: Inviatore,
  adesso: Date,
): Promise<RiepilogoInvio> {
  const riepilogo: RiepilogoInvio = { notifiche: 0, inviate: 0, scadute: 0, errori: 0 }
  const coda = await archivio.daInviare()
  if (coda.length === 0) return riepilogo
  const iscrizioni = await archivio.iscrizioni()
  const scadute = new Set<string>()

  for (const n of coda) {
    riepilogo.notifiche++
    if (adesso.getTime() - Date.parse(n.creata_il) > VALIDITA_NOTIFICA_MS) {
      await archivio.segnaInviata(n.id)
      continue
    }
    const messaggio = messaggioPush(n)
    let riuscite = 0
    let fallite = 0
    for (const i of iscrizioni) {
      if (scadute.has(i.endpoint)) continue
      const esito = await invia(i, messaggio).catch(() => 'errore' as const)
      if (esito === 'ok') riuscite++
      else if (esito === 'scaduta') scadute.add(i.endpoint)
      else fallite++
    }
    riepilogo.inviate += riuscite
    riepilogo.errori += fallite
    if (riuscite > 0 || fallite === 0) await archivio.segnaInviata(n.id)
  }

  riepilogo.scadute = scadute.size
  if (scadute.size > 0) await archivio.togliIscrizioni([...scadute])
  return riepilogo
}

// --- Avvisi del programma (Fase 7.3) --------------------------------------------------------------------

/**
 * L'avviso parte quando l'allenatore ha finito di scrivere: dall'ultima modifica deve passare almeno questo tempo
 * (tante modifiche di fila diventano un avviso solo).
 */
export const ATTESA_AVVISO_PROGRAMMA_MS = 10 * 60_000

/** Un avviso in coda (tabella `avvisi_programma`), con il nome dell'allenatore. */
export interface AvvisoProgramma {
  id: number
  atleta_id: string
  /** "Mattia Rossi". */
  allenatore: string
  /** Il lunedì della settimana ("AAAA-MM-GG"). */
  settimana: string
  creato_il: string
  ultima_modifica_il: string
}

export interface ArchivioAvvisi {
  /** Gli avvisi non ancora mandati con l'ultima modifica prima di `primaDi`. */
  avvisiDaInviare(primaDi: Date): Promise<AvvisoProgramma[]>
  /** I telefoni di un atleta con gli avvisi del programma accesi. */
  iscrizioniDi(atletaId: string): Promise<Iscrizione[]>
  segnaAvvisoInviato(id: number): Promise<void>
  togliIscrizioni(endpoint: string[]): Promise<void>
}

/** La domenica della settimana che inizia il lunedì indicato. */
const domenica = (lunedi: string) =>
  new Date(Date.parse(`${lunedi}T00:00:00Z`) + 6 * 86_400_000).toISOString().slice(0, 10)

/** Cosa riceve il telefono: toccando si apre la settimana del programma. */
export function messaggioAvvisoProgramma(a: Pick<AvvisoProgramma, 'allenatore' | 'settimana'>) {
  return JSON.stringify({
    titolo: 'Programma aggiornato',
    testo: `${a.allenatore} ha aggiornato il tuo programma della settimana ${formattaDate(a.settimana, domenica(a.settimana))}. Tocca per vederlo.`,
    url: `/allenamento?settimana=${a.settimana}`,
  })
}

/**
 * Manda gli avvisi del programma, ognuno SOLO ai telefoni dell'atleta interessato (con l'avviso acceso).
 * Come le notifiche degli inviti: senza telefoni l'avviso si chiude; se la consegna fallisce per tutti riprova al
 * giro dopo, ma per 2 giorni al massimo; i telefoni che non esistono più si tolgono.
 */
export async function inviaAvvisiProgramma(
  archivio: ArchivioAvvisi,
  invia: Inviatore,
  adesso: Date,
): Promise<RiepilogoInvio> {
  const riepilogo: RiepilogoInvio = { notifiche: 0, inviate: 0, scadute: 0, errori: 0 }
  const coda = await archivio.avvisiDaInviare(
    new Date(adesso.getTime() - ATTESA_AVVISO_PROGRAMMA_MS),
  )
  const scadute = new Set<string>()
  for (const a of coda) {
    riepilogo.notifiche++
    if (adesso.getTime() - Date.parse(a.creato_il) > VALIDITA_NOTIFICA_MS) {
      await archivio.segnaAvvisoInviato(a.id)
      continue
    }
    const messaggio = messaggioAvvisoProgramma(a)
    let riuscite = 0
    let fallite = 0
    for (const i of await archivio.iscrizioniDi(a.atleta_id)) {
      if (scadute.has(i.endpoint)) continue
      const esito = await invia(i, messaggio).catch(() => 'errore' as const)
      if (esito === 'ok') riuscite++
      else if (esito === 'scaduta') scadute.add(i.endpoint)
      else fallite++
    }
    riepilogo.inviate += riuscite
    riepilogo.errori += fallite
    if (riuscite > 0 || fallite === 0) await archivio.segnaAvvisoInviato(a.id)
  }
  riepilogo.scadute = scadute.size
  if (scadute.size > 0) await archivio.togliIscrizioni([...scadute])
  return riepilogo
}

// --- Avvisi dei sondaggi "Partecipo / Non partecipo" (Fase 3.5) -------------------------------------------

/** Un avviso in coda (tabella `avvisi_sondaggio`), con i dati della gara. */
export interface AvvisoSondaggio {
  id: number
  /** "aperto": a tutti (tranne chi l'ha aperto); "risposte": agli amministratori. */
  tipo: 'aperto' | 'risposte'
  gara: Omit<GaraPerNotifica, 'stato'>
  /** Il sondaggio è ancora aperto? Se nel frattempo è stato chiuso, l'avviso "aperto" non parte più. */
  aperto: boolean
  /** Chi non riceve l'avviso "aperto" (chi ha aperto il sondaggio). */
  escluso_id: string | null
  /** Quante risposte nuove (solo "risposte"). */
  risposte: number
  creato_il: string
}

export interface ArchivioSondaggi {
  avvisiSondaggioDaInviare(): Promise<AvvisoSondaggio[]>
  /** I telefoni con l'avviso acceso: "aperto" = tutti tranne `escluso_id`; "risposte" = gli amministratori. */
  destinatariSondaggio(avviso: AvvisoSondaggio): Promise<Iscrizione[]>
  segnaAvvisoSondaggioInviato(id: number): Promise<void>
  togliIscrizioni(endpoint: string[]): Promise<void>
}

/** Cosa riceve il telefono: toccando si apre la scheda della gara, dove c'è il sondaggio. */
export function messaggioAvvisoSondaggio(a: Pick<AvvisoSondaggio, 'tipo' | 'gara' | 'risposte'>) {
  const g = a.gara
  const gara = `${riconosciTipologia(g.tipologia)?.etichetta ?? g.tipologia} · ${g.localita} (${formattaDate(g.dal, g.al)})`
  const url = `/gare/${g.codice}`
  if (a.tipo === 'aperto') {
    return JSON.stringify({
      titolo: 'Partecipi alla gara?',
      testo: `È aperto il sondaggio per ${gara}. Tocca per rispondere.`,
      url,
    })
  }
  const quante = a.risposte === 1 ? '1 nuova risposta' : `${a.risposte} nuove risposte`
  return JSON.stringify({
    titolo: 'Risposte al sondaggio',
    testo: `${quante} al sondaggio di ${gara}. Tocca per vederle.`,
    url,
  })
}

/**
 * Manda gli avvisi dei sondaggi. Stesse regole delle altre notifiche: senza telefoni l'avviso si chiude; se la
 * consegna fallisce per tutti riprova al giro dopo, ma per 2 giorni al massimo; i telefoni che non esistono più
 * si tolgono. L'avviso "sondaggio aperto" di un sondaggio già chiuso non parte.
 */
export async function inviaAvvisiSondaggi(
  archivio: ArchivioSondaggi,
  invia: Inviatore,
  adesso: Date,
): Promise<RiepilogoInvio> {
  const riepilogo: RiepilogoInvio = { notifiche: 0, inviate: 0, scadute: 0, errori: 0 }
  const scadute = new Set<string>()
  for (const a of await archivio.avvisiSondaggioDaInviare()) {
    riepilogo.notifiche++
    const vecchio = adesso.getTime() - Date.parse(a.creato_il) > VALIDITA_NOTIFICA_MS
    if (vecchio || (a.tipo === 'aperto' && !a.aperto)) {
      await archivio.segnaAvvisoSondaggioInviato(a.id)
      continue
    }
    const messaggio = messaggioAvvisoSondaggio(a)
    let riuscite = 0
    let fallite = 0
    for (const i of await archivio.destinatariSondaggio(a)) {
      if (scadute.has(i.endpoint)) continue
      const esito = await invia(i, messaggio).catch(() => 'errore' as const)
      if (esito === 'ok') riuscite++
      else if (esito === 'scaduta') scadute.add(i.endpoint)
      else fallite++
    }
    riepilogo.inviate += riuscite
    riepilogo.errori += fallite
    if (riuscite > 0 || fallite === 0) await archivio.segnaAvvisoSondaggioInviato(a.id)
  }
  riepilogo.scadute = scadute.size
  if (scadute.size > 0) await archivio.togliIscrizioni([...scadute])
  return riepilogo
}
