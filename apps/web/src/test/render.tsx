import type { ReactElement } from 'react'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router'

/** Disegna un componente dentro un router, partendo da un indirizzo (e uno stato) a scelta. */
export function renderConRouter(
  ui: ReactElement,
  { percorso = '/', stato }: { percorso?: string; stato?: unknown } = {},
) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: percorso, state: stato }]}>{ui}</MemoryRouter>,
  )
}
