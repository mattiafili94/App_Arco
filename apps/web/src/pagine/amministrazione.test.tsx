import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderApp } from '../test/render'
import { AMMINISTRATORE, servizioFinto } from '../test/servizioFinto'

afterEach(() => vi.restoreAllMocks())

const titolo = (nome: string) => screen.getByRole('heading', { level: 1, name: nome })
const comeAmministratore = () => servizioFinto({ collegato: AMMINISTRATORE })

describe('Amministrazione', () => {
  it('un atleta che apre l indirizzo viene riportato alle Impostazioni', async () => {
    await renderApp('/amministrazione')
    expect(titolo('Impostazioni')).toBeInTheDocument()
  })

  it('elenca gli atleti con lo stato del loro accesso', async () => {
    await renderApp('/amministrazione', { servizio: comeAmministratore().servizio })
    expect(await screen.findByRole('region', { name: 'Atleti (3)' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Esempio Carla/ })).toHaveTextContent('Senza accesso')
    expect(screen.getByRole('link', { name: /Prova Bruno/ })).toHaveTextContent('Accesso attivo')
  })

  it('aggiunge un atleta e lo mostra nell elenco', async () => {
    const { servizio } = comeAmministratore()
    await renderApp('/amministrazione', { servizio })
    await screen.findByRole('region', { name: 'Atleti (3)' })

    await userEvent.type(screen.getByLabelText('Matricola'), '900004')
    await userEvent.type(screen.getByLabelText('Nome'), 'Dario')
    await userEvent.type(screen.getByLabelText('Cognome'), 'Esempio')
    await userEvent.click(screen.getByRole('button', { name: 'Aggiungi atleta' }))

    expect(await screen.findByText(/Atleta aggiunto: Dario Esempio/)).toBeInTheDocument()
    expect(await screen.findByRole('region', { name: 'Atleti (4)' })).toBeInTheDocument()
    expect(screen.getByLabelText('Matricola')).toHaveValue('')
    expect(servizio.aggiungiAtleta).toHaveBeenCalledWith({
      matricola: '900004',
      nome: 'Dario',
      cognome: 'Esempio',
    })
  })

  it('segnala campi mancanti e matricole già presenti', async () => {
    const { servizio } = comeAmministratore()
    await renderApp('/amministrazione', { servizio })
    await userEvent.click(screen.getByRole('button', { name: 'Aggiungi atleta' }))
    expect(screen.getByText('Scrivi il nome.')).toBeInTheDocument()
    expect(servizio.aggiungiAtleta).not.toHaveBeenCalled()

    await userEvent.type(screen.getByLabelText('Matricola'), '900002')
    await userEvent.type(screen.getByLabelText('Nome'), 'Bis')
    await userEvent.type(screen.getByLabelText('Cognome'), 'Prova')
    await userEvent.click(screen.getByRole('button', { name: 'Aggiungi atleta' }))
    expect(await screen.findByText("Questa matricola è già nell'elenco.")).toBeInTheDocument()
  })

  it('senza rete lo dice e permette di riprovare', async () => {
    const finto = comeAmministratore()
    finto.servizio.elencoAtleti.mockRejectedValueOnce(new Error('offline'))
    await renderApp('/amministrazione', { servizio: finto.servizio })
    expect(await screen.findByRole('alert')).toHaveTextContent('Impossibile caricare gli atleti')
    await userEvent.click(screen.getByRole('button', { name: 'Riprova' }))
    expect(await screen.findByRole('region', { name: 'Atleti (3)' })).toBeInTheDocument()
  })
})

describe('Dettaglio atleta', () => {
  it('genera il link personale e lo fa condividere', async () => {
    const share = vi.fn(async () => {})
    Object.defineProperty(navigator, 'share', { value: share, configurable: true })
    const { servizio } = comeAmministratore()
    await renderApp('/amministrazione/atleti/id-carla', { servizio })
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Carla Esempio' }),
    ).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Genera link' }))
    expect(await screen.findByText(/Link pronto/)).toBeInTheDocument()
    expect(screen.getByText('K7PM3-XQR9A')).toBeInTheDocument()
    expect(
      screen.getByText('https://arcieri-eugubini.pages.dev/accesso#m=900003&c=K7PM3XQR9A'),
    ).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Condividi' }))
    expect(share).toHaveBeenCalledWith(
      expect.objectContaining({ text: expect.stringContaining('#m=900003&c=K7PM3XQR9A') }),
    )
    Reflect.deleteProperty(navigator, 'share')
  })

  it('senza la condivisione del telefono, copia il messaggio', async () => {
    const writeText = vi.fn(async () => {})
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    await renderApp('/amministrazione/atleti/id-carla', { servizio: comeAmministratore().servizio })
    await userEvent.click(await screen.findByRole('button', { name: 'Genera link' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Copia messaggio' }))
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('Ciao Carla'))
    expect(await screen.findByText(/Messaggio con il link copiato/)).toBeInTheDocument()
  })

  it('avvisa che rigenerare il link scollega il telefono vecchio', async () => {
    await renderApp('/amministrazione/atleti/id-bruno', { servizio: comeAmministratore().servizio })
    expect(await screen.findByText(/verrà scollegato/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Genera nuovo link' })).toBeInTheDocument()
  })

  it('mostra l errore del server se il link non viene creato', async () => {
    const finto = comeAmministratore()
    finto.servizio.generaLink.mockRejectedValueOnce(
      new Error('Serve la rete. Riprova quando sei connesso.'),
    )
    await renderApp('/amministrazione/atleti/id-carla', { servizio: finto.servizio })
    await userEvent.click(await screen.findByRole('button', { name: 'Genera link' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Serve la rete')
  })

  it('revoca l accesso solo dopo la conferma', async () => {
    const { servizio } = comeAmministratore()
    await renderApp('/amministrazione/atleti/id-bruno', { servizio })
    await userEvent.click(await screen.findByRole('button', { name: 'Revoca accesso' }))
    expect(servizio.revocaAccesso).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: "Revoca l'accesso di Bruno" }))
    expect(await screen.findByText(/Accesso revocato: Bruno Prova/)).toBeInTheDocument()
    expect(servizio.revocaAccesso).toHaveBeenCalledWith('id-bruno')
  })

  it('il proprio accesso non si gestisce dall app', async () => {
    await renderApp('/amministrazione/atleti/id-anna', { servizio: comeAmministratore().servizio })
    expect(await screen.findByText(/Questo è il tuo accesso/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Genera/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Revoca/ })).not.toBeInTheDocument()
  })

  it('un atleta inesistente riporta all elenco', async () => {
    await renderApp('/amministrazione/atleti/non-esiste', {
      servizio: comeAmministratore().servizio,
    })
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Amministrazione' }),
    ).toBeInTheDocument()
  })
})
