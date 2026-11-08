import { describe, expect, it } from 'vitest'
import {
  inviaNotifiche,
  messaggioPush,
  notificaInvito,
  vaNotificato,
  VALIDITA_NOTIFICA_MS,
  type ArchivioNotifiche,
  type Inviatore,
  type Iscrizione,
  type NotificaDaInviare,
} from '../aggiornamento'

const GARA = {
  codice: 'R2611040',
  dal: '2026-12-12',
  al: '2026-12-12',
  localita: 'Gubbio (PG)',
  tipologia: '25+18 m',
  stato: 'invito',
}
const ADESSO = new Date('2026-11-10T08:00:00Z')

describe('vaNotificato', () => {
  it('solo invito nuovo di una gara non passata e non annullata', () => {
    expect(vaNotificato(GARA, false, '2026-11-10')).toBe(true)
    expect(vaNotificato(GARA, true, '2026-11-10')).toBe(false)
    expect(vaNotificato(GARA, false, '2026-12-13')).toBe(false)
    expect(vaNotificato(GARA, false, '2026-12-12')).toBe(true)
    expect(vaNotificato({ ...GARA, stato: 'annullata' }, false, '2026-11-10')).toBe(false)
  })
})

describe('testo della notifica', () => {
  it('dice la gara e porta alla sua scheda', () => {
    const n = notificaInvito(GARA)
    expect(n.titolo).toBe('Nuovo invito')
    expect(n.testo).toBe(
      "È arrivato l'invito di 25+18 m · Gubbio (PG) (12 dic 2026). Tocca per leggerlo.",
    )
    expect(JSON.parse(messaggioPush(n))).toEqual({
      titolo: 'Nuovo invito',
      testo: n.testo,
      url: '/gare/R2611040',
    })
  })

  it('tipologia sconosciuta: resta il nome di Fitarco', () => {
    expect(notificaInvito({ ...GARA, tipologia: 'Trofeo Pinocchio' }).testo).toContain(
      'Trofeo Pinocchio',
    )
  })
})

const tel = (n: number): Iscrizione => ({
  endpoint: `https://push.prova/${n}`,
  p256dh: 'k',
  auth: 'a',
})

function archivioFinto(notifiche: NotificaDaInviare[], iscrizioni: Iscrizione[]) {
  const stato = { inviate: [] as number[], tolte: [] as string[] }
  const archivio: ArchivioNotifiche = {
    daInviare: async () => notifiche.filter((n) => !stato.inviate.includes(n.id)),
    iscrizioni: async () => iscrizioni,
    segnaInviata: async (id) => void stato.inviate.push(id),
    togliIscrizioni: async (e) => void stato.tolte.push(...e),
  }
  return { archivio, stato }
}

const notifica = (id: number, creata_il = ADESSO.toISOString()): NotificaDaInviare => ({
  id,
  creata_il,
  ...notificaInvito({ ...GARA, codice: `R261104${id}` }),
})

describe('inviaNotifiche', () => {
  it('manda a tutti i telefoni e chiude la notifica', async () => {
    const { archivio, stato } = archivioFinto([notifica(1)], [tel(1), tel(2)])
    const mandati: string[] = []
    const invia: Inviatore = async (i) => (mandati.push(i.endpoint), 'ok')
    const r = await inviaNotifiche(archivio, invia, ADESSO)
    expect(mandati).toEqual(['https://push.prova/1', 'https://push.prova/2'])
    expect(r).toEqual({ notifiche: 1, inviate: 2, scadute: 0, errori: 0 })
    expect(stato.inviate).toEqual([1])
  })

  it('niente in coda: non legge nemmeno i telefoni', async () => {
    const { archivio } = archivioFinto([], [tel(1)])
    archivio.iscrizioni = async () => {
      throw new Error('non doveva leggerli')
    }
    expect(await inviaNotifiche(archivio, async () => 'ok', ADESSO)).toEqual({
      notifiche: 0,
      inviate: 0,
      scadute: 0,
      errori: 0,
    })
  })

  it('senza telefoni registrati chiude la notifica (chi arriva dopo non riceve il passato)', async () => {
    const { archivio, stato } = archivioFinto([notifica(1)], [])
    await inviaNotifiche(archivio, async () => 'ok', ADESSO)
    expect(stato.inviate).toEqual([1])
  })

  it('toglie i telefoni scaduti, una volta sola anche con più notifiche', async () => {
    const { archivio, stato } = archivioFinto([notifica(1), notifica(2)], [tel(1), tel(2)])
    const chiamate: string[] = []
    const invia: Inviatore = async (i) => {
      chiamate.push(i.endpoint)
      return i.endpoint.endsWith('/1') ? 'scaduta' : 'ok'
    }
    const r = await inviaNotifiche(archivio, invia, ADESSO)
    expect(chiamate.filter((c) => c.endsWith('/1'))).toHaveLength(1)
    expect(r.scadute).toBe(1)
    expect(stato.tolte).toEqual(['https://push.prova/1'])
    expect(stato.inviate).toEqual([1, 2])
  })

  it('consegna fallita per tutti: resta in coda per riprovare', async () => {
    const { archivio, stato } = archivioFinto([notifica(1)], [tel(1), tel(2)])
    const r = await inviaNotifiche(archivio, async () => 'errore', ADESSO)
    expect(r).toMatchObject({ inviate: 0, errori: 2 })
    expect(stato.inviate).toEqual([])
  })

  it('un errore dell’invio (eccezione) conta come consegna fallita', async () => {
    const { archivio, stato } = archivioFinto([notifica(1)], [tel(1)])
    const invia: Inviatore = async () => {
      throw new Error('rete')
    }
    await inviaNotifiche(archivio, invia, ADESSO)
    expect(stato.inviate).toEqual([])
  })

  it('consegna riuscita solo ad alcuni: si chiude (gli altri non ricevono doppioni)', async () => {
    const { archivio, stato } = archivioFinto([notifica(1)], [tel(1), tel(2)])
    const invia: Inviatore = async (i) => (i.endpoint.endsWith('/1') ? 'ok' : 'errore')
    await inviaNotifiche(archivio, invia, ADESSO)
    expect(stato.inviate).toEqual([1])
  })

  it('una notifica troppo vecchia non parte: si chiude', async () => {
    const vecchia = new Date(ADESSO.getTime() - VALIDITA_NOTIFICA_MS - 1000).toISOString()
    const { archivio, stato } = archivioFinto([notifica(1, vecchia)], [tel(1)])
    let mandate = 0
    await inviaNotifiche(archivio, async () => (mandate++, 'ok'), ADESSO)
    expect(mandate).toBe(0)
    expect(stato.inviate).toEqual([1])
  })
})
