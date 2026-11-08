import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AccessoProvider } from '../accesso/AccessoContext'
import { RemotoFinto } from '../test/remotoFinto'
import { renderApp, renderConRouter } from '../test/render'
import { servizioFinto } from '../test/servizioFinto'
import { useSincronizzazione } from './contesto'
import { ArcoDb } from './db'
import { Sincronizzazione } from './Sincronizzazione'

const gara = (codice: string) => ({
  codice,
  dal: '2026-10-24',
  localita: 'Gubbio (PG)',
  aggiornato_il: '2026-11-01T10:00:00Z',
})

let contatore = 0
const nuovoDb = () => new ArcoDb(`provider-${contatore++}`)

function impostaRete(online: boolean) {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(online)
}

/** Mostra lo stato della sincronizzazione. */
function Sonda() {
  const { stato, aggiorna } = useSincronizzazione()
  return (
    <div>
      <p>fase: {stato.fase}</p>
      <p>ultima: {stato.ultima === null ? 'mai' : 'sì'}</p>
      <button onClick={() => void aggiorna()}>aggiorna</button>
    </div>
  )
}

function disegna(remoto: RemotoFinto, db = nuovoDb()) {
  const { servizio } = servizioFinto({ remoto })
  render(
    <AccessoProvider servizio={servizio}>
      <Sincronizzazione db={db} intervalloMs={60_000}>
        <Sonda />
      </Sincronizzazione>
    </AccessoProvider>,
  )
  return db
}

beforeEach(() => {
  impostaRete(true)
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('sincronizzazione nell’app', () => {
  it('all’apertura scarica i dati e segna quando', async () => {
    const remoto = new RemotoFinto()
    remoto.scrivi('gare', gara('R1'))
    const db = disegna(remoto)
    await screen.findByText('ultima: sì')
    expect(screen.getByText('fase: ferma')).toBeInTheDocument()
    expect(await db.gare.count()).toBe(1)
  })

  it('senza rete non chiede niente e resta com’è', async () => {
    impostaRete(false)
    const remoto = new RemotoFinto()
    const db = disegna(remoto)
    await waitFor(() => expect(screen.getByText('fase: ferma')).toBeInTheDocument())
    expect(remoto.richieste).toEqual([])
    expect(await db.gare.count()).toBe(0)
  })

  it('quando torna la rete si aggiorna da solo', async () => {
    impostaRete(false)
    const remoto = new RemotoFinto()
    remoto.scrivi('gare', gara('R1'))
    const db = disegna(remoto)
    await waitFor(() => expect(screen.getByText('fase: ferma')).toBeInTheDocument())

    impostaRete(true)
    act(() => {
      window.dispatchEvent(new Event('online'))
    })
    await screen.findByText('ultima: sì')
    expect(await db.gare.count()).toBe(1)
  })

  it('un errore del server si vede e si riprova con il pulsante', async () => {
    const remoto = new RemotoFinto()
    remoto.errore = new Error('503')
    disegna(remoto)
    await screen.findByText('fase: errore')

    remoto.errore = null
    await userEvent.click(screen.getByRole('button', { name: 'aggiorna' }))
    await screen.findByText('ultima: sì')
    expect(screen.getByText('fase: ferma')).toBeInTheDocument()
  })

  it('non parte una seconda sincronizzazione mentre ce n’è una in corso', async () => {
    const remoto = new RemotoFinto()
    let sblocca: () => void = () => {}
    const attesa = new Promise<void>((fine) => (sblocca = fine))
    const originale = remoto.cambiamenti.bind(remoto)
    remoto.cambiamenti = async (...args) => {
      await attesa
      return originale(...args)
    }
    disegna(remoto)
    await screen.findByText('fase: in-corso')
    await userEvent.click(screen.getByRole('button', { name: 'aggiorna' }))
    sblocca()
    await screen.findByText('ultima: sì')
    expect(remoto.richieste.filter((r) => r.startsWith('gare'))).toHaveLength(1)
  })

  it('ogni pochi minuti, con l’app in primo piano', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const remoto = new RemotoFinto()
    disegna(remoto)
    await screen.findByText('ultima: sì')
    const prima = remoto.richieste.length

    await act(async () => {
      await vi.advanceTimersByTimeAsync(61_000)
    })
    await waitFor(() => expect(remoto.richieste.length).toBeGreaterThan(prima))
  })

  it('quando l’app torna in primo piano si aggiorna', async () => {
    const remoto = new RemotoFinto()
    disegna(remoto)
    await screen.findByText('ultima: sì')
    const prima = remoto.richieste.length
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await waitFor(() => expect(remoto.richieste.length).toBeGreaterThan(prima))
  })

  it('mostra anche senza rete l’ultimo aggiornamento già fatto', async () => {
    const db = nuovoDb()
    const remoto = new RemotoFinto()
    disegna(remoto, db)
    await screen.findByText('ultima: sì')
    document.body.innerHTML = ''

    impostaRete(false)
    disegna(remoto, db)
    await screen.findByText('ultima: sì')
  })
})

describe('Impostazioni: stato dei dati', () => {
  it('mostra quando è stato l’ultimo aggiornamento e permette di aggiornare', async () => {
    const remoto = new RemotoFinto()
    remoto.scrivi('gare', gara('R1'))
    const { servizio } = servizioFinto({ remoto })
    await renderApp('/impostazioni', { servizio })
    await screen.findByText(/Oggi alle \d\d:\d\d/)
    const prima = remoto.richieste.length
    await userEvent.click(screen.getByRole('button', { name: /Aggiorna ora/ }))
    await waitFor(() => expect(remoto.richieste.length).toBeGreaterThan(prima))
  })

  it('senza rete dice che è offline', async () => {
    impostaRete(false)
    const { servizio } = servizioFinto()
    await renderApp('/impostazioni', { servizio })
    expect(screen.getByRole('button', { name: /Aggiorna ora\s*Offline/ })).toBeInTheDocument()
    expect(screen.getByText('Mai')).toBeInTheDocument()
  })

  it('segnala un aggiornamento non riuscito', async () => {
    const remoto = new RemotoFinto()
    remoto.errore = new Error('503')
    const { servizio } = servizioFinto({ remoto })
    await renderApp('/impostazioni', { servizio })
    await screen.findByRole('button', { name: /Non riuscito, riprova/ })
  })

  it('usa il contesto solo dentro la sincronizzazione', () => {
    const errore = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => renderConRouter(<Sonda />)).toThrow('useSincronizzazione va usato dentro')
    errore.mockRestore()
  })
})
