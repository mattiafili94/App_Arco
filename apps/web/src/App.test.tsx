import { act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { App } from './App'
import { destinazioneDi, titoloDocumento } from './navigazione'
import { CHIAVE_TEMA } from './tema/tema'
import { renderConRouter } from './test/render'
import { chiamateAggiorna, simulaNuovaVersione } from './test/pwa-register-finto'

afterEach(() => {
  simulaNuovaVersione(false)
  vi.restoreAllMocks()
})

describe('navigazione', () => {
  it('l indirizzo iniziale porta alle Gare', () => {
    renderConRouter(<App />, { percorso: '/' })
    expect(screen.getByRole('heading', { level: 1, name: 'Gare' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Gare' })).toHaveAttribute('aria-current', 'page')
  })

  it('un indirizzo sconosciuto porta alle Gare', () => {
    renderConRouter(<App />, { percorso: '/non-esiste' })
    expect(screen.getByRole('heading', { level: 1, name: 'Gare' })).toBeInTheDocument()
  })

  it('ogni tab apre la sua pagina e diventa quello attivo', async () => {
    renderConRouter(<App />, { percorso: '/gare' })
    for (const nome of ['Atleti', 'Classifica', 'Allenamento', 'Gare']) {
      await userEvent.click(screen.getByRole('link', { name: nome }))
      expect(screen.getByRole('heading', { level: 1, name: nome })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: nome })).toHaveAttribute('aria-current', 'page')
      expect(document.title).toBe(`${nome} · Arcieri Eugubini`)
    }
  })

  it('cambiando pagina il titolo riceve il focus, per i lettori di schermo', async () => {
    renderConRouter(<App />, { percorso: '/gare' })
    await userEvent.click(screen.getByRole('link', { name: 'Classifica' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Classifica' })).toHaveFocus()
  })

  it('ogni tab spiega cosa conterrà, senza pulsanti senza effetto', () => {
    renderConRouter(<App />, { percorso: '/allenamento' })
    expect(
      screen.getByRole('heading', { name: 'Nessun allenamento registrato' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('riconosce il tab di un indirizzo e il titolo della finestra', () => {
    expect(destinazioneDi('/classifica')?.id).toBe('classifica')
    expect(destinazioneDi('/classifica/OL')?.id).toBe('classifica')
    expect(destinazioneDi('/impostazioni')).toBeUndefined()
    expect(titoloDocumento('/impostazioni')).toBe('Impostazioni · Arcieri Eugubini')
    expect(titoloDocumento('/altro')).toBe('Arcieri Eugubini')
  })
})

describe('Impostazioni', () => {
  it('si aprono dall icona in alto e riportano al tab di partenza', async () => {
    renderConRouter(<App />, { percorso: '/atleti' })
    await userEvent.click(screen.getByRole('link', { name: 'Impostazioni' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Impostazioni' })).toBeInTheDocument()
    expect(screen.getByRole('navigation').querySelector('[aria-current]')).toBeNull()

    // Il primo link "Atleti" è quello per tornare indietro, nell'intestazione (il secondo è il tab).
    const indietro = screen.getAllByRole('link', { name: 'Atleti' })[0]!
    expect(indietro.closest('header')).not.toBeNull()
    await userEvent.click(indietro)
    expect(screen.getByRole('heading', { level: 1, name: 'Atleti' })).toBeInTheDocument()
  })

  it('aperte direttamente, il link indietro porta alle Gare', () => {
    renderConRouter(<App />, { percorso: '/impostazioni' })
    const indietro = screen.getAllByRole('link', { name: 'Gare' })[0]!
    expect(indietro).toHaveAttribute('href', '/gare')
  })

  it('cambiare tema lo applica alla pagina e lo ricorda', async () => {
    renderConRouter(<App />, { percorso: '/impostazioni' })
    expect(screen.getByRole('radio', { name: 'Come il telefono' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    await userEvent.click(screen.getByRole('radio', { name: 'Alto contrasto' }))
    expect(document.documentElement.dataset.theme).toBe('contrast')
    expect(localStorage.getItem(CHIAVE_TEMA)).toBe('alto-contrasto')
  })

  it('mostrano la versione dell app', () => {
    renderConRouter(<App />, { percorso: '/impostazioni' })
    expect(screen.getByText('0.0.0-test')).toBeInTheDocument()
  })
})

describe('stati dell app', () => {
  it('offline mostra una riga di stato, e la toglie quando torna la rete', () => {
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    renderConRouter(<App />, { percorso: '/gare' })
    expect(screen.getByRole('status')).toHaveTextContent('Offline')

    online.mockReturnValue(true)
    act(() => {
      window.dispatchEvent(new Event('online'))
    })
    expect(screen.queryByText(/Offline/)).not.toBeInTheDocument()
  })

  it('con la rete non mostra nessuna riga di stato', () => {
    renderConRouter(<App />, { percorso: '/gare' })
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('una nuova versione si installa solo quando l atleta preme Ricarica', async () => {
    simulaNuovaVersione()
    chiamateAggiorna.length = 0
    renderConRouter(<App />, { percorso: '/gare' })
    expect(screen.getByRole('status')).toHaveTextContent('Nuova versione pronta.')
    expect(chiamateAggiorna).toEqual([])

    await userEvent.click(screen.getByRole('button', { name: 'Ricarica' }))
    expect(chiamateAggiorna).toEqual([true])
  })
})
