import type { ReactElement } from 'react'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { AccessoProvider } from '../accesso/AccessoContext'
import type { ServizioAccesso } from '../accesso/servizio'
import { App } from '../App'
import { servizioFinto } from './servizioFinto'

/** Disegna un componente dentro un router, partendo da un indirizzo (e uno stato) a scelta. */
export function renderConRouter(
  ui: ReactElement,
  { percorso = '/', stato, hash = '' }: { percorso?: string; stato?: unknown; hash?: string } = {},
) {
  // "/gare/R1/risultati?categoria=X": l'indirizzo e i suoi parametri si separano.
  const [pathname = '/', ricerca = ''] = percorso.split('?')
  return render(
    <MemoryRouter
      initialEntries={[{ pathname, search: ricerca ? `?${ricerca}` : '', state: stato, hash }]}
    >
      {ui}
    </MemoryRouter>,
  )
}

/**
 * Disegna l'intera app con un servizio di accesso (finto, di base con un atleta collegato)
 * e aspetta che compaia la prima pagina.
 */
export async function renderApp(
  percorso = '/gare',
  {
    servizio = servizioFinto().servizio,
    stato,
    hash,
  }: { servizio?: ServizioAccesso; stato?: unknown; hash?: string } = {},
) {
  const risultato = renderConRouter(
    <AccessoProvider servizio={servizio}>
      <App />
    </AccessoProvider>,
    { percorso, stato, hash },
  )
  await screen.findByRole('heading', { level: 1 })
  return risultato
}
