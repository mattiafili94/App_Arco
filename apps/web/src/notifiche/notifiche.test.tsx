import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { AccessoProvider } from '../accesso/AccessoContext'
import type { IscrizionePush } from '../accesso/servizio'
import { App } from '../App'
import { RemotoFinto } from '../test/remotoFinto'
import { AMMINISTRATORE, ATLETA, servizioFinto } from '../test/servizioFinto'
import { chiaveInByte, daSottoscrizione } from './browser'
import { ContestoNotifiche } from './contesto'
import {
  creaServizioNotifiche,
  memoriaBrowser,
  type Ambiente,
  type Avvisi,
  type ServizioNotifiche,
  type StatoNotifiche,
} from './servizio'

const TELEFONO: IscrizionePush = {
  endpoint: 'https://push.prova.invalid/1',
  p256dh: 'k',
  auth: 'a',
}

function ambienteFinto(parziale: Partial<Ambiente> = {}) {
  let iscrizione: IscrizionePush | null = null
  const ambiente: Ambiente = {
    supportato: () => true,
    daAggiungereAllaHome: () => false,
    permesso: () => 'default',
    chiediPermesso: vi.fn(async () => 'granted' as NotificationPermission),
    iscrizione: vi.fn(async () => iscrizione),
    iscrivi: vi.fn(async () => (iscrizione = TELEFONO)),
    annulla: vi.fn(async () => void (iscrizione = null)),
    ...parziale,
  }
  return ambiente
}

describe('servizio notifiche: stato', () => {
  const stato = (a: Partial<Ambiente>, chiave: string | null = 'chiave') =>
    creaServizioNotifiche(servizioFinto().servizio, ambienteFinto(a), chiave ?? undefined).stato()

  it('iPhone senza app sulla Home: prima va aggiunta', async () => {
    expect(await stato({ daAggiungereAllaHome: () => true, supportato: () => false })).toBe(
      'serve-home',
    )
  })
  it('browser senza notifiche o build senza chiave: non supportate', async () => {
    expect(await stato({ supportato: () => false })).toBe('non-supportate')
    expect(await stato({}, null)).toBe('non-supportate')
  })
  it('permesso negato: bloccate', async () => {
    expect(await stato({ permesso: () => 'denied' })).toBe('bloccate')
  })
  it('permesso dato ma telefono non registrato: spente', async () => {
    expect(await stato({ permesso: () => 'granted' })).toBe('spente')
    expect(await stato({})).toBe('spente')
  })
  it('permesso dato e telefono registrato: accese', async () => {
    expect(await stato({ permesso: () => 'granted', iscrizione: async () => TELEFONO })).toBe(
      'accese',
    )
  })
})

describe('servizio notifiche: accendere e spegnere', () => {
  it('accende: chiede il permesso, registra il telefono sul server', async () => {
    const { servizio } = servizioFinto()
    const ambiente = ambienteFinto()
    const n = creaServizioNotifiche(servizio, ambiente, 'chiave')
    expect(await n.attiva()).toBe('ok')
    expect(ambiente.iscrivi).toHaveBeenCalledWith('chiave')
    expect(servizio.registraPush).toHaveBeenCalledWith(TELEFONO)
  })

  it('permesso negato: non registra niente', async () => {
    const { servizio } = servizioFinto()
    const n = creaServizioNotifiche(
      servizio,
      ambienteFinto({ chiediPermesso: async () => 'denied' }),
      'chiave',
    )
    expect(await n.attiva()).toBe('negato')
    expect(servizio.registraPush).not.toHaveBeenCalled()
  })

  it('errore del browser o del server, o chiave mancante: "errore"', async () => {
    const { servizio } = servizioFinto()
    servizio.registraPush.mockRejectedValueOnce(new Error('rete'))
    expect(await creaServizioNotifiche(servizio, ambienteFinto(), 'chiave').attiva()).toBe('errore')
    expect(await creaServizioNotifiche(servizio, ambienteFinto(), undefined).attiva()).toBe(
      'errore',
    )
  })

  it('spegne: toglie il telefono dal browser e dal server', async () => {
    const { servizio } = servizioFinto()
    const ambiente = ambienteFinto()
    const n = creaServizioNotifiche(servizio, ambiente, 'chiave')
    await n.attiva()
    await n.disattiva()
    expect(ambiente.annulla).toHaveBeenCalled()
    expect(servizio.rimuoviPush).toHaveBeenCalledWith(TELEFONO.endpoint)
  })

  it('spegne anche senza rete (il server lo toglierà da solo) o senza registrazione', async () => {
    const { servizio } = servizioFinto()
    servizio.rimuoviPush.mockRejectedValueOnce(new Error('offline'))
    const n = creaServizioNotifiche(servizio, ambienteFinto(), 'chiave')
    await n.attiva()
    await expect(n.disattiva()).resolves.toBeUndefined()
    await n.disattiva()
    expect(servizio.rimuoviPush).toHaveBeenCalledTimes(1)
  })
})

describe('browser', () => {
  it('la chiave VAPID diventa byte', () => {
    // "AQID" = [1, 2, 3]; con "-" e "_" al posto di "+" e "/".
    expect([...chiaveInByte('AQID')]).toEqual([1, 2, 3])
    expect([...chiaveInByte('-_8')]).toEqual([251, 255])
  })

  it('dalla sottoscrizione del browser alle tre stringhe per il server', () => {
    const s = (json: object) => ({ toJSON: () => json }) as PushSubscription
    expect(
      daSottoscrizione(s({ endpoint: 'https://x', keys: { p256dh: 'k', auth: 'a' } })),
    ).toEqual({ endpoint: 'https://x', p256dh: 'k', auth: 'a' })
    expect(() => daSottoscrizione(s({ endpoint: 'https://x' }))).toThrow('incompleta')
  })
})

// --- Impostazioni -----------------------------------------------------------------------------

function notificheFinte(stato: StatoNotifiche, esitoAttiva: 'ok' | 'negato' | 'errore' = 'ok') {
  let corrente = stato
  let avvisi: Avvisi = { inviti: true, programma: true }
  const servizio: ServizioNotifiche = {
    stato: vi.fn(async () => corrente),
    attiva: vi.fn(async () => {
      if (esitoAttiva === 'ok') corrente = 'accese'
      return esitoAttiva
    }),
    disattiva: vi.fn(async () => void (corrente = 'spente')),
    avvisi: vi.fn(() => avvisi),
    imposta: vi.fn(async (a: Avvisi) => void (avvisi = a)),
  }
  return servizio
}

async function apriImpostazioni(notifiche: ServizioNotifiche) {
  render(
    <MemoryRouter initialEntries={['/impostazioni']}>
      <AccessoProvider servizio={servizioFinto().servizio}>
        <ContestoNotifiche.Provider value={notifiche}>
          <App />
        </ContestoNotifiche.Provider>
      </AccessoProvider>
    </MemoryRouter>,
  )
  await screen.findByRole('heading', { name: 'Impostazioni', level: 1 })
}

const interruttore = () => screen.findByRole('button', { name: /Nuovi inviti/ })

describe('Impostazioni → Notifiche', () => {
  it('spente: si accendono con un tocco', async () => {
    const notifiche = notificheFinte('spente')
    await apriImpostazioni(notifiche)
    await userEvent.click(await interruttore())
    await waitFor(() => expect(notifiche.attiva).toHaveBeenCalled())
    expect(await screen.findByText(/Tocca per spegnerle/)).toBeInTheDocument()
  })

  it('accese: si spengono con un tocco', async () => {
    const notifiche = notificheFinte('accese')
    await apriImpostazioni(notifiche)
    await userEvent.click(await interruttore())
    expect(notifiche.disattiva).toHaveBeenCalled()
    expect(await screen.findByText(/Tocca per accenderle/)).toBeInTheDocument()
  })

  it('permesso negato dal telefono: avviso per riprovare', async () => {
    await apriImpostazioni(notificheFinte('spente', 'negato'))
    await userEvent.click(await interruttore())
    expect(await screen.findByText(/Consenti/)).toBeInTheDocument()
  })

  it('errore: avviso', async () => {
    await apriImpostazioni(notificheFinte('spente', 'errore'))
    await userEvent.click(await interruttore())
    expect(await screen.findByRole('alert')).toHaveTextContent('Non è stato possibile')
  })

  it.each([
    ['serve-home', /schermata Home/],
    ['bloccate', /Hai negato il permesso/],
    ['non-supportate', /non può ricevere/],
  ] as const)('%s: spiega perché non si può, senza azione', async (stato, testo) => {
    const notifiche = notificheFinte(stato)
    await apriImpostazioni(notifiche)
    expect(await screen.findByText(testo)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Nuovi inviti/ })).not.toBeInTheDocument()
    expect(notifiche.attiva).not.toHaveBeenCalled()
  })

  it('se il controllo del browser fallisce, l’interruttore resta spento', async () => {
    const notifiche = notificheFinte('spente')
    notifiche.stato = vi.fn(async () => {
      throw new Error('boh')
    })
    await apriImpostazioni(notifiche)
    expect(await screen.findByText(/Tocca per accenderle/)).toBeInTheDocument()
  })
})

describe('servizio notifiche: quali avvisi riceve il telefono', () => {
  const memoriaFinta = () => {
    let salvati: Avvisi | null = null
    return {
      leggi: vi.fn(() => salvati),
      scrivi: vi.fn((a: Avvisi) => void (salvati = a)),
    }
  }

  it('di base tutti; la scelta va al server e il telefono se la ricorda', async () => {
    const { servizio } = servizioFinto()
    const memoria = memoriaFinta()
    const n = creaServizioNotifiche(servizio, ambienteFinto(), 'chiave', memoria)
    expect(n.avvisi()).toEqual({ inviti: true, programma: true })
    await n.attiva()
    await n.imposta({ inviti: false, programma: true })
    expect(servizio.impostaAvvisi).toHaveBeenCalledWith(TELEFONO.endpoint, false, true)
    expect(n.avvisi()).toEqual({ inviti: false, programma: true })
    // Spegnendo tutto si riparte da quelli di base.
    await n.disattiva()
    expect(n.avvisi()).toEqual({ inviti: true, programma: true })
  })

  it('la memoria del browser: legge, scrive, e senza memoria non si rompe', () => {
    localStorage.clear()
    expect(memoriaBrowser.leggi()).toBeNull()
    memoriaBrowser.scrivi({ inviti: true, programma: false })
    expect(memoriaBrowser.leggi()).toEqual({ inviti: true, programma: false })
    localStorage.setItem('arco.avvisi', 'non è json')
    expect(memoriaBrowser.leggi()).toBeNull()
    const scrivi = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('finestra privata')
    })
    expect(() => memoriaBrowser.scrivi({ inviti: true, programma: true })).not.toThrow()
    scrivi.mockRestore()
  })
})

describe('Impostazioni → avviso del programma dell’allenatore', () => {
  const aggiornato_il = '2026-11-01T10:00:00+00:00'
  /** Bruno (collegato) è seguito da Anna. */
  function remotoConAllenatore() {
    const remoto = new RemotoFinto()
    for (const a of [ATLETA, AMMINISTRATORE]) {
      remoto.scrivi('atleti', {
        id: a.id,
        matricola: a.matricola,
        nome: a.nome,
        cognome: a.cognome,
        ruolo: a.ruolo,
        attivo: true,
        ha_accesso: true,
        allenatore: a.id === AMMINISTRATORE.id,
        aggiornato_il,
      })
    }
    remoto.scrivi('allenatori_atleti', {
      allenatore_id: AMMINISTRATORE.id,
      atleta_id: ATLETA.id,
      aggiornato_il,
    })
    return remoto
  }
  const apri = async (notifiche: ServizioNotifiche, remoto = remotoConAllenatore()) => {
    render(
      <MemoryRouter initialEntries={['/impostazioni']}>
        <AccessoProvider servizio={servizioFinto({ remoto }).servizio}>
          <ContestoNotifiche.Provider value={notifiche}>
            <App />
          </ContestoNotifiche.Provider>
        </AccessoProvider>
      </MemoryRouter>,
    )
    await screen.findByRole('heading', { name: 'Impostazioni', level: 1 })
  }
  const programma = () => screen.findByRole('button', { name: /Programma dell’allenatore/ })

  it('senza allenatore l’interruttore non c’è', async () => {
    await apri(notificheFinte('spente'), new RemotoFinto())
    await screen.findByRole('button', { name: /Nuovi inviti/ })
    expect(
      screen.queryByRole('button', { name: /Programma dell’allenatore/ }),
    ).not.toBeInTheDocument()
  })

  it('accendendo solo il programma, il telefono riceve solo quello', async () => {
    const notifiche = notificheFinte('spente')
    await apri(notifiche)
    await userEvent.click(await programma())
    await waitFor(() =>
      expect(notifiche.imposta).toHaveBeenCalledWith({ inviti: false, programma: true }),
    )
    expect(notifiche.attiva).toHaveBeenCalled()
    expect(await screen.findByText(/cambia il programma. Tocca per spegnerle/)).toBeInTheDocument()
    expect(await screen.findByText(/invito di una gara. Tocca per accenderle/)).toBeInTheDocument()
  })

  it('con tutti e due accesi, spegnerne uno lascia l’altro; spegnere l’ultimo toglie il telefono', async () => {
    const notifiche = notificheFinte('accese')
    await apri(notifiche)
    // Prima che arrivi chi segue l'atleta, l'interruttore del programma non c'è.
    await programma()
    await userEvent.click(await screen.findByRole('button', { name: /Nuovi inviti/ }))
    await waitFor(() =>
      expect(notifiche.imposta).toHaveBeenCalledWith({ inviti: false, programma: true }),
    )
    expect(notifiche.disattiva).not.toHaveBeenCalled()
    await userEvent.click(await programma())
    await waitFor(() => expect(notifiche.disattiva).toHaveBeenCalled())
  })

  it('se il server non riesce a cambiare la scelta: avviso', async () => {
    const notifiche = notificheFinte('accese')
    notifiche.imposta = vi.fn(async () => {
      throw new Error('rete')
    })
    await apri(notifiche)
    await userEvent.click(await programma())
    expect(await screen.findByRole('alert')).toHaveTextContent('Non è stato possibile')
  })
})

// --- Motore offline: parte che mostra le notifiche -------------------------------------------------

describe('public/push.js', () => {
  function caricaServiceWorker() {
    const ascoltatori = new Map<string, (e: unknown) => void>()
    const mostra = vi.fn(async () => {})
    const apri = vi.fn(async () => null)
    const finestre: {
      url: string
      focus: () => Promise<void>
      navigate?: (u: string) => Promise<void>
    }[] = []
    const self = {
      addEventListener: (nome: string, f: (e: unknown) => void) => ascoltatori.set(nome, f),
      registration: { showNotification: mostra },
      location: { origin: 'https://app.prova.invalid' },
      clients: { matchAll: async () => finestre, openWindow: apri },
    }
    const file = resolve(import.meta.dirname, '../../public/push.js')
    new Function('self', readFileSync(file, 'utf8'))(self)
    const evento = (extra: object) => {
      let lavoro: Promise<unknown> = Promise.resolve()
      return {
        e: { ...extra, waitUntil: (p: Promise<unknown>) => (lavoro = p) },
        fine: () => lavoro,
      }
    }
    return { ascoltatori, mostra, apri, finestre, evento }
  }

  it('mostra la notifica con titolo, testo e indirizzo della gara', async () => {
    const sw = caricaServiceWorker()
    const { e, fine } = sw.evento({
      data: { json: () => ({ titolo: 'Nuovo invito', testo: 'Gara X', url: '/gare/R1' }) },
    })
    sw.ascoltatori.get('push')!(e)
    await fine()
    expect(sw.mostra).toHaveBeenCalledWith(
      'Nuovo invito',
      expect.objectContaining({ body: 'Gara X', tag: '/gare/R1', data: { url: '/gare/R1' } }),
    )
  })

  it('messaggio vuoto o storto, o indirizzo fuori dall’app: avviso generico verso le Gare', async () => {
    const sw = caricaServiceWorker()
    for (const data of [
      undefined,
      {
        json: () => {
          throw new Error('non è JSON')
        },
      },
      { json: () => ({ url: 'https://altro.invalid' }) },
    ]) {
      const { e, fine } = sw.evento({ data })
      sw.ascoltatori.get('push')!(e)
      await fine()
    }
    expect(sw.mostra).toHaveBeenCalledTimes(3)
    for (const chiamata of sw.mostra.mock.calls as unknown as [
      string,
      { data: { url: string } },
    ][]) {
      expect(chiamata[0]).toBe('Arcieri Eugubini')
      expect(chiamata[1].data.url).toBe('/gare')
    }
  })

  it('al tocco apre l’app se è chiusa', async () => {
    const sw = caricaServiceWorker()
    const chiudi = vi.fn()
    const { e, fine } = sw.evento({
      notification: { close: chiudi, data: { url: '/gare/R1' } },
    })
    sw.ascoltatori.get('notificationclick')!(e)
    await fine()
    expect(chiudi).toHaveBeenCalled()
    expect(sw.apri).toHaveBeenCalledWith('https://app.prova.invalid/gare/R1')
  })

  it('al tocco porta in primo piano l’app già aperta, sulla gara giusta', async () => {
    const sw = caricaServiceWorker()
    const focus = vi.fn(async () => {})
    const navigate = vi.fn(async () => {})
    sw.finestre.push({ url: 'https://app.prova.invalid/atleti', focus, navigate })
    const { e, fine } = sw.evento({ notification: { close: vi.fn(), data: undefined } })
    sw.ascoltatori.get('notificationclick')!(e)
    await fine()
    expect(focus).toHaveBeenCalled()
    expect(navigate).toHaveBeenCalledWith('https://app.prova.invalid/gare')
    expect(sw.apri).not.toHaveBeenCalled()
  })

  it('se la finestra non sa navigare, resta dov’è', async () => {
    const sw = caricaServiceWorker()
    const focus = vi.fn(async () => {})
    sw.finestre.push({ url: 'https://app.prova.invalid/', focus })
    const { e, fine } = sw.evento({ notification: { close: vi.fn(), data: { url: '/gare/R1' } } })
    sw.ascoltatori.get('notificationclick')!(e)
    await fine()
    expect(focus).toHaveBeenCalled()
    expect(sw.apri).not.toHaveBeenCalled()
  })
})
