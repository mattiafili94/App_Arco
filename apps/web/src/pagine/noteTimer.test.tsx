import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Simulazione, ValoreFreccia } from '@arco/shared'
import { leggiSimulazione, nuovoId } from '../allenamento/simulazioni'
import { dbPredefinito } from '../sync/db'
import { renderApp } from '../test/render'
import { ATLETA, servizioFinto } from '../test/servizioFinto'

// Oggi, per tutti i test: mercoledì 11 novembre 2026, ore 10 (solo la data è finta, i timer restano veri).
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 11, 10, 0))
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

const ripeti = (v: ValoreFreccia, n: number): ValoreFreccia[] => Array(n).fill(v)

async function preparaSimulazione(dati: Partial<Simulazione> = {}): Promise<Simulazione> {
  const s: Simulazione = {
    id: nuovoId(),
    atleta_id: ATLETA.id,
    giorno: '2026-11-11',
    formato: '18m',
    distanza: null,
    bersaglio: 'trispot',
    frecce: [],
    conclusa: false,
    eliminata: false,
    creata_il: '2026-11-11T08:00:00.000Z',
    modificato_il: '2026-11-11T08:00:00.000Z',
    ...dati,
  }
  await dbPredefinito().simulazioni.put(s as unknown as Record<string, unknown>)
  return s
}

const apri = async (s: Simulazione) => {
  const finto = servizioFinto()
  await renderApp(`/allenamento/${s.giorno}/simulazione/${s.id}`, { servizio: finto.servizio })
  await screen.findByRole('group', { name: 'Valore della freccia' })
  return finto
}

describe('timer nella simulazione', () => {
  it('c’è il pulsante facoltativo, con la durata giusta all’indoor', async () => {
    await apri(await preparaSimulazione())
    expect(screen.getByRole('button', { name: 'Avvia timer' })).toBeInTheDocument()
    expect(screen.queryByRole('timer')).not.toBeInTheDocument()
  })

  it('avviandolo: preparazione di 10 secondi; fermandolo si torna a segnare come prima', async () => {
    await apri(await preparaSimulazione())
    await userEvent.click(screen.getByRole('button', { name: 'Avvia timer' }))
    expect(screen.getByRole('timer')).toHaveTextContent('0:10')
    // I tasti restano utilizzabili mentre il timer corre.
    await userEvent.click(
      within(screen.getByRole('group', { name: 'Valore della freccia' })).getByRole('button', {
        name: '10',
      }),
    )
    expect(await screen.findByText(/Totale: 10 · 1 frecce su 60/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Ferma il timer' }))
    expect(screen.getByRole('button', { name: 'Avvia timer' })).toBeInTheDocument()
  })

  it('a gara finita il timer non c’è più', async () => {
    await apri(await preparaSimulazione({ frecce: ripeti('9', 60), conclusa: true }))
    expect(screen.queryByRole('button', { name: 'Avvia timer' })).not.toBeInTheDocument()
  })
})

describe('note per volée', () => {
  it('la nota della volée in corso si scrive e si salva sul telefono', async () => {
    const s = await preparaSimulazione({ frecce: ['10', '9', '8', '7'] })
    await apri(s)
    expect(screen.getByText('Nota della volée 2 (facoltativa)')).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Nota della volée 2'), 'vento da destra')
    await waitFor(async () =>
      expect((await leggiSimulazione(dbPredefinito(), s.id))?.note).toEqual({
        '1': 'vento da destra',
      }),
    )
    expect(screen.getByText('Nota della volée 2: vento da destra')).toBeInTheDocument()
  })

  it('cancellando il testo la nota sparisce', async () => {
    const s = await preparaSimulazione({ frecce: ['10'], note: { '0': 'prova' } })
    await apri(s)
    await userEvent.clear(screen.getByLabelText('Nota della volée 1'))
    await waitFor(async () =>
      expect((await leggiSimulazione(dbPredefinito(), s.id))?.note).toEqual({}),
    )
  })

  it('nell’elenco delle volée: "Aggiungi" apre la nota, "Modifica" quella già scritta', async () => {
    const s = await preparaSimulazione({ frecce: ['10', '9', '8', '7', '6', 'M'] })
    await apri(s)
    const tabella = screen.getByRole('table')
    // Volée 1: nessuna nota.
    await userEvent.click(
      within(tabella).getByRole('button', { name: /Nota della volée 1:\s*Aggiungi/ }),
    )
    await userEvent.type(within(tabella).getByLabelText('Nota della volée 1'), 'primo bersaglio')
    await waitFor(async () =>
      expect((await leggiSimulazione(dbPredefinito(), s.id))?.note).toEqual({
        '0': 'primo bersaglio',
      }),
    )
    // Si chiude: la nota resta scritta sotto la volée.
    await userEvent.click(
      within(tabella).getByRole('button', { name: /Nota della volée 1:\s*Modifica/ }),
    )
    expect(within(tabella).queryByLabelText('Nota della volée 1')).not.toBeInTheDocument()
    expect(within(tabella).getByText('primo bersaglio')).toBeInTheDocument()
    // Volée 2 senza nota.
    expect(
      within(tabella).getByRole('button', { name: /Nota della volée 2:\s*Aggiungi/ }),
    ).toBeInTheDocument()
  })

  it('25+18: le note dei 18 m hanno il numero giusto su tutta la simulazione (la prima volée dei 18 m è la 20)', async () => {
    const s = await preparaSimulazione({
      formato: '25+18m',
      bersaglio: 'singolo',
      frecce: [...ripeti('9', 60), '10'],
    })
    await apri(s)
    // La volée in corso è la prima della seconda prova.
    expect(screen.getByText('Nota della volée 1 (facoltativa)')).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Nota della volée 1'), 'cambio luce')
    await waitFor(async () =>
      expect((await leggiSimulazione(dbPredefinito(), s.id))?.note).toEqual({
        '20': 'cambio luce',
      }),
    )
  })

  it('le note si inviano al server insieme alla simulazione', async () => {
    const s = await preparaSimulazione({ frecce: ['10'] })
    const finto = await apri(s)
    await userEvent.type(screen.getByLabelText('Nota della volée 1'), 'ok')
    await waitFor(
      () =>
        expect(finto.remoto.righe.simulazioni[0]).toMatchObject({ id: s.id, note: { '0': 'ok' } }),
      {
        timeout: 4000,
      },
    )
  })

  it('una simulazione vecchia senza note si apre lo stesso', async () => {
    await apri(await preparaSimulazione({ frecce: ['10'] }))
    expect(screen.getByLabelText('Nota della volée 1')).toHaveValue('')
  })
})
