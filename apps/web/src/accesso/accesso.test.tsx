import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderApp } from '../test/render'
import { AMMINISTRATORE, ATLETA, CODICE_GIUSTO, servizioFinto } from '../test/servizioFinto'
import { CHIAVE_PROFILO } from './contesto'

afterEach(() => vi.restoreAllMocks())

const titolo = (nome: string) => screen.getByRole('heading', { level: 1, name: nome })

async function compila(matricola: string, codice: string) {
  await userEvent.type(screen.getByLabelText('Matricola'), matricola)
  await userEvent.type(screen.getByLabelText(/Codice personale/), codice)
  await userEvent.click(screen.getByRole('button', { name: 'Entra' }))
}

describe('senza accesso', () => {
  it('si vede solo la pagina Accedi, qualunque sia l indirizzo, senza i tab', async () => {
    await renderApp('/classifica', { servizio: servizioFinto({ collegato: null }).servizio })
    expect(titolo('Accedi')).toBeInTheDocument()
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
    // Il titolo della finestra lo imposta un effetto: su un computer lento arriva un attimo dopo.
    await waitFor(() => expect(document.title).toBe('Accedi · Arcieri Eugubini'))
  })

  it('con matricola e codice giusti si entra nelle Gare', async () => {
    await renderApp('/gare', { servizio: servizioFinto({ collegato: null }).servizio })
    await compila('900002', 'k7pm3-xqr9a')
    expect(await screen.findByRole('heading', { level: 1, name: 'Gare' })).toBeInTheDocument()
  })

  it('con un codice sbagliato lo dice, senza cancellare quello che hai scritto', async () => {
    await renderApp('/gare', { servizio: servizioFinto({ collegato: null }).servizio })
    await compila('900002', 'AAAAABBBBB')
    expect(await screen.findByRole('alert')).toHaveTextContent('Matricola o codice non corretti')
    expect(screen.getByLabelText('Matricola')).toHaveValue('900002')
  })

  it('controlla i campi prima di inviare', async () => {
    const { servizio } = servizioFinto({ collegato: null })
    await renderApp('/gare', { servizio })
    await compila('abc', 'corto')
    expect(screen.getByText('Scrivi la matricola Fitarco: solo cifre.')).toBeInTheDocument()
    expect(screen.getByText('Il codice ha 10 caratteri, tra lettere e cifre.')).toBeInTheDocument()
    expect(screen.getByLabelText('Matricola')).toHaveAttribute('aria-invalid', 'true')
    expect(servizio.accedi).not.toHaveBeenCalled()
  })

  it('offline avvisa che per il primo accesso serve la rete', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    await renderApp('/gare', { servizio: servizioFinto({ collegato: null, rete: false }).servizio })
    expect(screen.getByText('Sei offline. Per il primo accesso serve la rete.')).toBeInTheDocument()
    await compila('900002', CODICE_GIUSTO)
    expect(await screen.findByRole('alert')).toHaveTextContent('Serve la rete per il primo accesso')
  })

  it('una matricola senza scheda attiva non entra', async () => {
    const { servizio } = servizioFinto({ collegato: null })
    servizio.profilo.mockResolvedValueOnce(null)
    await renderApp('/gare', { servizio })
    await compila('900002', CODICE_GIUSTO)
    expect(await screen.findByRole('alert')).toHaveTextContent("non è attiva nell'app")
    expect(servizio.esci).toHaveBeenCalled()
  })
})

describe('link personale', () => {
  it('entra da solo, toglie il codice dall indirizzo e spiega come installare l app', async () => {
    const replace = vi.spyOn(window.history, 'replaceState')
    await renderApp('/accesso', {
      servizio: servizioFinto({ collegato: null }).servizio,
      hash: `#m=900002&c=${CODICE_GIUSTO}`,
    })
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Benvenuto, Bruno' }),
    ).toBeInTheDocument()
    expect(replace).toHaveBeenCalled()
    // Per l'iPhone: matricola e codice da scrivere nell'app installata.
    expect(screen.getByText('900002')).toBeInTheDocument()
    expect(screen.getByText('K7PM3-XQR9A')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Continua nel browser' }))
    expect(titolo('Gare')).toBeInTheDocument()
  })

  it('un link incompleto lo dice e lascia scrivere i dati a mano', async () => {
    await renderApp('/accesso', {
      servizio: servizioFinto({ collegato: null }).servizio,
      hash: '#m=900002',
    })
    expect(screen.getByRole('alert')).toHaveTextContent('Il link non è completo')
  })

  it('aprendo /accesso da membro, senza arrivare dal link, si va alle Gare', async () => {
    await renderApp('/accesso')
    expect(titolo('Gare')).toBeInTheDocument()
  })
})

describe('accesso già fatto', () => {
  it('apre l app e salva la scheda per aprirla anche offline', async () => {
    await renderApp('/gare')
    expect(titolo('Gare')).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem(CHIAVE_PROFILO)!)).toMatchObject({ nome: 'Bruno' })
  })

  it('offline si apre con la scheda salvata sul telefono', async () => {
    localStorage.setItem(CHIAVE_PROFILO, JSON.stringify({ ...ATLETA, utenteId: ATLETA.id }))
    await renderApp('/impostazioni', { servizio: servizioFinto({ rete: false }).servizio })
    expect(titolo('Impostazioni')).toBeInTheDocument()
    expect(screen.getByText('Bruno Prova')).toBeInTheDocument()
  })

  it('offline e senza scheda salvata chiede di accedere con la rete', async () => {
    await renderApp('/gare', { servizio: servizioFinto({ rete: false }).servizio })
    expect(titolo('Accedi')).toBeInTheDocument()
  })

  it('un atleta disattivato viene scollegato e avvisato', async () => {
    const finto = servizioFinto()
    finto.servizio.profilo.mockResolvedValue(null)
    await renderApp('/gare', { servizio: finto.servizio })
    expect(titolo('Accedi')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('non è più valido')
    expect(localStorage.getItem(CHIAVE_PROFILO)).toBeNull()
  })

  it('se l accesso viene revocato mentre l app è aperta, si torna ad Accedi', async () => {
    const finto = servizioFinto()
    await renderApp('/gare', { servizio: finto.servizio })
    act(() => finto.simulaUscita())
    expect(await screen.findByRole('heading', { level: 1, name: 'Accedi' })).toBeInTheDocument()
  })
})

describe('Esci', () => {
  it('chiede conferma e poi torna alla pagina Accedi', async () => {
    const { servizio } = servizioFinto()
    await renderApp('/impostazioni', { servizio })
    expect(screen.getByText('Bruno Prova')).toBeInTheDocument()
    expect(screen.getByText('900002')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Esci' }))
    expect(servizio.esci).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Annulla' }))
    await userEvent.click(screen.getByRole('button', { name: 'Esci' }))
    await userEvent.click(screen.getByRole('button', { name: 'Esci da questo telefono' }))

    await waitFor(() => expect(titolo('Accedi')).toBeInTheDocument())
    expect(servizio.esci).toHaveBeenCalled()
    expect(localStorage.getItem(CHIAVE_PROFILO)).toBeNull()
  })

  it('un atleta non vede l Amministrazione', async () => {
    await renderApp('/impostazioni')
    expect(screen.queryByRole('link', { name: 'Amministrazione' })).not.toBeInTheDocument()
  })

  it('l amministratore vede l Amministrazione', async () => {
    await renderApp('/impostazioni', {
      servizio: servizioFinto({ collegato: AMMINISTRATORE }).servizio,
    })
    expect(screen.getByRole('link', { name: 'Amministrazione' })).toHaveAttribute(
      'href',
      '/amministrazione',
    )
  })
})
