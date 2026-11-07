import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { App } from './App'
import { CHIAVE_TEMA } from './tema/tema'

describe('App (vetrina del design system)', () => {
  it('mostra il nome dell app e i quattro tab', () => {
    render(<App />)
    expect(screen.getByRole('heading', { level: 1, name: 'Arcieri Eugubini' })).toBeInTheDocument()
    for (const nome of ['Gare', 'Atleti', 'Classifica', 'Allenamento']) {
      expect(screen.getByRole('link', { name: nome })).toBeInTheDocument()
    }
    expect(screen.getByRole('link', { name: 'Gare' })).toHaveAttribute('aria-current', 'page')
  })

  it('cambiare tema lo applica alla pagina e lo ricorda', async () => {
    render(<App />)
    expect(screen.getByRole('radio', { name: 'Come il telefono' })).toHaveAttribute(
      'aria-checked',
      'true',
    )

    await userEvent.click(screen.getByRole('radio', { name: 'Alto contrasto' }))

    expect(document.documentElement.dataset.theme).toBe('contrast')
    expect(localStorage.getItem(CHIAVE_TEMA)).toBe('alto-contrasto')
    expect(screen.getByRole('radio', { name: 'Alto contrasto' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
  })

  it('il tab attivo segue l indirizzo', async () => {
    window.location.hash = '#classifica'
    render(<App />)
    expect(screen.getByRole('link', { name: 'Classifica' })).toHaveAttribute('aria-current', 'page')
    window.location.hash = ''
  })
})
