import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { destinazioneDi, titoloDocumento } from './navigazione'
import { CHIAVE_TEMA } from './tema/tema'
import { renderApp } from './test/render'
import { chiamateAggiorna, simulaNuovaVersione } from './test/pwa-register-finto'

afterEach(() => {
  simulaNuovaVersione(false)
  vi.restoreAllMocks()
})

const titolo = (nome: string) => screen.getByRole('heading', { level: 1, name: nome })

describe('navigazione', () => {
  it('l indirizzo iniziale porta alle Gare', async () => {
    await renderApp('/')
    expect(titolo('Gare')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Gare' })).toHaveAttribute('aria-current', 'page')
  })

  it('un indirizzo sconosciuto porta alle Gare', async () => {
    await renderApp('/non-esiste')
    expect(titolo('Gare')).toBeInTheDocument()
  })

  it('ogni tab apre la sua pagina e diventa quello attivo', async () => {
    await renderApp('/gare')
    for (const nome of ['Atleti', 'Classifica', 'Allenamento', 'Gare']) {
      await userEvent.click(screen.getByRole('link', { name: nome }))
      expect(titolo(nome)).toBeInTheDocument()
      expect(screen.getByRole('link', { name: nome })).toHaveAttribute('aria-current', 'page')
      await waitFor(() => expect(document.title).toBe(`${nome} · Arcieri Eugubini`))
    }
  })

  it('cambiando pagina il titolo riceve il focus, per i lettori di schermo', async () => {
    await renderApp('/gare')
    await userEvent.click(screen.getByRole('link', { name: 'Classifica' }))
    expect(titolo('Classifica')).toHaveFocus()
  })

  it('riconosce il tab di un indirizzo e il titolo della finestra', () => {
    expect(destinazioneDi('/classifica')?.id).toBe('classifica')
    expect(destinazioneDi('/classifica/OL')?.id).toBe('classifica')
    expect(destinazioneDi('/impostazioni')).toBeUndefined()
    expect(titoloDocumento('/impostazioni')).toBe('Impostazioni · Arcieri Eugubini')
    expect(titoloDocumento('/amministrazione/atleti/x')).toBe('Amministrazione · Arcieri Eugubini')
    expect(titoloDocumento('/altro')).toBe('Arcieri Eugubini')
  })
})

describe('Impostazioni', () => {
  it('si aprono dall icona in alto e riportano al tab di partenza', async () => {
    await renderApp('/atleti')
    await userEvent.click(screen.getByRole('link', { name: 'Impostazioni' }))
    expect(titolo('Impostazioni')).toBeInTheDocument()
    expect(screen.getByRole('navigation').querySelector('[aria-current]')).toBeNull()

    // Il primo link "Atleti" è quello per tornare indietro, nell'intestazione (il secondo è il tab).
    const indietro = screen.getAllByRole('link', { name: 'Atleti' })[0]!
    expect(indietro.closest('header')).not.toBeNull()
    await userEvent.click(indietro)
    expect(titolo('Atleti')).toBeInTheDocument()
  })

  it('aperte direttamente, il link indietro porta alle Gare', async () => {
    await renderApp('/impostazioni')
    expect(screen.getAllByRole('link', { name: 'Gare' })[0]).toHaveAttribute('href', '/gare')
  })

  it('cambiare tema lo applica alla pagina e lo ricorda', async () => {
    await renderApp('/impostazioni')
    expect(screen.getByRole('radio', { name: 'Come il telefono' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    await userEvent.click(screen.getByRole('radio', { name: 'Alto contrasto' }))
    expect(document.documentElement.dataset.theme).toBe('contrast')
    expect(localStorage.getItem(CHIAVE_TEMA)).toBe('alto-contrasto')
  })

  it('mostrano la versione dell app', async () => {
    await renderApp('/impostazioni')
    expect(screen.getByText('0.0.0-test')).toBeInTheDocument()
  })
})

describe('stati dell app', () => {
  it('offline mostra una riga di stato, e la toglie quando torna la rete', async () => {
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    await renderApp('/gare')
    expect(screen.getByRole('status')).toHaveTextContent('Offline')

    online.mockReturnValue(true)
    act(() => {
      window.dispatchEvent(new Event('online'))
    })
    expect(screen.queryByText(/Offline/)).not.toBeInTheDocument()
  })

  it('con la rete non mostra nessuna riga di stato', async () => {
    await renderApp('/gare')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('una nuova versione si installa solo quando l atleta preme Ricarica', async () => {
    simulaNuovaVersione()
    chiamateAggiorna.length = 0
    await renderApp('/gare')
    expect(screen.getByRole('status')).toHaveTextContent('Nuova versione pronta.')
    expect(chiamateAggiorna).toEqual([])

    await userEvent.click(screen.getByRole('button', { name: 'Ricarica' }))
    expect(chiamateAggiorna).toEqual([true])
  })
})
