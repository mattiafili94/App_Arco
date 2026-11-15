import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RemotoFinto } from '../test/remotoFinto'
import { renderApp } from '../test/render'
import { AMMINISTRATORE, ATLETA, servizioFinto } from '../test/servizioFinto'

// Oggi, per tutti i test: 10 novembre 2026 (solo la data è finta, i timer restano veri).
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 10, 10, 0))
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

const aggiornato_il = '2026-11-01T10:00:00+00:00'

const gara = (codice: string, dati: Record<string, unknown> = {}) => ({
  codice,
  dal: '2026-12-12',
  al: '2026-12-12',
  calendario: 'Interregionale',
  regione: 'Umbria',
  localita: 'Perugia (PG)',
  tipologia: '18 m',
  dettaglio: null,
  societa_codice: '11018',
  societa_nome: 'ASD Arcieri Augusta Perusia',
  stato: 'invito',
  in_calendario_umbria: true,
  ha_invito: true,
  url_risultati: null,
  aggiornato_il,
  ...dati,
})

const atleta = (a: typeof ATLETA) => ({
  id: a.id,
  matricola: a.matricola,
  nome: a.nome,
  cognome: a.cognome,
  ruolo: a.ruolo,
  attivo: true,
  ha_accesso: true,
  allenatore: false,
  aggiornato_il,
})

const CARLA = { ...ATLETA, id: 'id-carla', matricola: '900003', nome: 'Carla', cognome: 'Esempio' }

/** Perugia (futura, con invito), Terni (futura, annullata), Gubbio (passata). */
function remotoConGare({ sondaggio }: { sondaggio?: 'aperto' | 'chiuso' } = {}) {
  const remoto = new RemotoFinto()
  remoto.scrivi('gare', gara('R2611040'))
  remoto.scrivi('gare', gara('R2611050', { localita: 'Terni (TR)', stato: 'annullata' }))
  remoto.scrivi(
    'gare',
    gara('R2611039', {
      dal: '2026-10-24',
      al: '2026-10-24',
      localita: 'Gubbio (PG)',
      stato: 'omologata',
    }),
  )
  for (const a of [AMMINISTRATORE, ATLETA, CARLA]) remoto.scrivi('atleti', atleta(a))
  if (sondaggio) {
    remoto.scrivi('sondaggi', {
      gara_codice: 'R2611040',
      aperto: sondaggio === 'aperto',
      aperto_da: AMMINISTRATORE.id,
      aperto_il: aggiornato_il,
      chiuso_il: sondaggio === 'chiuso' ? aggiornato_il : null,
      aggiornato_il,
    })
  }
  return remoto
}

const apriGara = async (
  servizio: ReturnType<typeof servizioFinto>['servizio'],
  nome = /Perugia/,
) => {
  await renderApp('/gare', { servizio })
  await userEvent.click(await screen.findByRole('link', { name: nome }))
  await screen.findByRole('heading', { level: 1, name: '18 m' })
}

describe('sondaggio: l’amministratore', () => {
  it('apre il sondaggio di una gara con l’invito, vede chi non ha risposto e lo chiude', async () => {
    const finto = servizioFinto({ remoto: remotoConGare(), collegato: AMMINISTRATORE })
    await apriGara(finto.servizio)
    await userEvent.click(await screen.findByRole('button', { name: /Apri sondaggio/ }))
    expect(finto.servizio.apriSondaggio).toHaveBeenCalledWith('R2611040')

    expect(
      await screen.findByRole('radiogroup', { name: 'Partecipi a questa gara?' }),
    ).toBeInTheDocument()
    const sondaggio = screen.getByRole('region', { name: 'Sondaggio' })
    expect(within(sondaggio).getByText('Aperto')).toBeInTheDocument()
    expect(within(sondaggio).getByText('Ancora nessuno')).toBeInTheDocument()
    // Tutti e tre devono ancora rispondere, in ordine di cognome.
    expect(
      within(sondaggio).getByText('Carla Esempio, Anna Prova, Bruno Prova'),
    ).toBeInTheDocument()

    await userEvent.click(
      await within(sondaggio).findByRole('button', { name: 'Chiudi sondaggio' }),
    )
    expect(finto.servizio.chiudiSondaggio).toHaveBeenCalledWith('R2611040')
    expect(await within(sondaggio).findByText('Chiuso')).toBeInTheDocument()
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument()
    await userEvent.click(
      await within(sondaggio).findByRole('button', { name: 'Riapri sondaggio' }),
    )
    expect(await screen.findByRole('radiogroup')).toBeInTheDocument()
  })

  it('niente sondaggio per una gara annullata o passata', async () => {
    const finto = servizioFinto({ remoto: remotoConGare(), collegato: AMMINISTRATORE })
    await apriGara(finto.servizio, /Terni/)
    expect(screen.queryByRole('button', { name: /Apri sondaggio/ })).not.toBeInTheDocument()
    await userEvent.click(screen.getAllByRole('link', { name: /Gare/ })[0]!)
    await userEvent.click(await screen.findByRole('link', { name: /Gubbio/ }))
    await screen.findByText('Gubbio (PG)', { selector: 'span' })
    expect(screen.queryByRole('button', { name: /Apri sondaggio/ })).not.toBeInTheDocument()
  })

  it('senza rete non si apre: lo dice', async () => {
    const finto = servizioFinto({ remoto: remotoConGare(), collegato: AMMINISTRATORE })
    finto.servizio.apriSondaggio.mockRejectedValueOnce(
      new Error('Serve la rete. Riprova quando sei connesso.'),
    )
    await apriGara(finto.servizio)
    await userEvent.click(await screen.findByRole('button', { name: /Apri sondaggio/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Serve la rete')
  })
})

describe('sondaggio: l’atleta', () => {
  it('senza sondaggio non vede niente (non può aprirlo)', async () => {
    await apriGara(servizioFinto({ remoto: remotoConGare() }).servizio)
    await screen.findByText('Invito disponibile')
    expect(screen.queryByRole('button', { name: /Apri sondaggio/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Sondaggio' })).not.toBeInTheDocument()
  })

  it('sondaggio aperto: gara gialla; "Partecipo" la fa verde, "Non partecipo" rossa', async () => {
    const remoto = remotoConGare({ sondaggio: 'aperto' })
    await renderApp('/gare', { servizio: servizioFinto({ remoto }).servizio })
    const gialla = await screen.findByRole('link', { name: /Perugia/ })
    await waitFor(() => expect(gialla).toHaveTextContent('Sondaggio aperto: rispondi'))
    expect(gialla.className).toMatch(/avviso/)
    await userEvent.click(gialla)
    await userEvent.click(await screen.findByRole('radio', { name: 'Partecipo' }))
    expect(await screen.findByText('Partecipi a questa gara.')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Partecipo' })).toHaveAttribute('aria-checked', 'true')
    await waitFor(() =>
      expect(remoto.righe.risposte_sondaggio).toMatchObject([
        { gara_codice: 'R2611040', atleta_id: ATLETA.id, partecipa: true },
      ]),
    )
    const sondaggio = screen.getByRole('region', { name: 'Sondaggio' })
    expect(within(sondaggio).getByText('Bruno Prova')).toBeInTheDocument()
    // L'atleta non vede chi non ha risposto (lo vede l'amministratore).
    expect(within(sondaggio).queryByText('Non hanno risposto')).not.toBeInTheDocument()

    await userEvent.click(screen.getAllByRole('link', { name: /Gare/ })[0]!)
    const riga = await screen.findByRole('link', { name: /Perugia/ })
    await waitFor(() => expect(riga).toHaveTextContent('Partecipi'))
    expect(riga.className).toMatch(/positivo/)
    expect(riga).not.toHaveTextContent('Sondaggio aperto')
    expect(screen.getByRole('link', { name: /Terni/ }).className).not.toMatch(
      /positivo|avviso|negativo/,
    )

    await userEvent.click(riga)
    await userEvent.click(await screen.findByRole('radio', { name: 'Non partecipo' }))
    await waitFor(() => expect(screen.queryByText(/a questa gara\./)).not.toBeInTheDocument())
    await waitFor(() =>
      expect(remoto.righe.risposte_sondaggio).toMatchObject([{ partecipa: false }]),
    )
    await userEvent.click(screen.getAllByRole('link', { name: /Gare/ })[0]!)
    const rossa = await screen.findByRole('link', { name: /Perugia/ })
    await waitFor(() => expect(rossa).toHaveTextContent('Non partecipi'))
    expect(rossa.className).toMatch(/negativo/)
  })

  it('a sondaggio chiuso senza risposta la gara non è colorata', async () => {
    await renderApp('/gare', {
      servizio: servizioFinto({ remoto: remotoConGare({ sondaggio: 'chiuso' }) }).servizio,
    })
    const riga = await screen.findByRole('link', { name: /Perugia/ })
    expect(riga.className).not.toMatch(/positivo|avviso|negativo/)
    expect(riga).not.toHaveTextContent('Sondaggio')
  })

  it('offline: la risposta resta sul telefono e si invia appena c’è la rete', async () => {
    const remoto = remotoConGare({ sondaggio: 'aperto' })
    await apriGara(servizioFinto({ remoto }).servizio)
    await screen.findByRole('radio', { name: 'Partecipo' })
    remoto.errore = new Error('offline')
    await userEvent.click(screen.getByRole('radio', { name: 'Partecipo' }))
    expect(await screen.findByText(/si invia appena c’è la rete/)).toBeInTheDocument()
    expect(screen.getByText('Partecipi a questa gara.')).toBeInTheDocument()
  })

  it('a sondaggio chiuso vede la sua risposta, ma non la cambia più', async () => {
    const remoto = remotoConGare({ sondaggio: 'chiuso' })
    remoto.scrivi('risposte_sondaggio', {
      gara_codice: 'R2611040',
      atleta_id: ATLETA.id,
      partecipa: true,
      modificato_il: aggiornato_il,
      aggiornato_il,
    })
    await apriGara(servizioFinto({ remoto }).servizio)
    const sondaggio = await screen.findByRole('region', { name: 'Sondaggio' })
    expect(within(sondaggio).getByText('Chiuso')).toBeInTheDocument()
    expect(within(sondaggio).getByText('Partecipo')).toBeInTheDocument()
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument()
    expect(within(sondaggio).queryByRole('button', { name: /sondaggio/ })).not.toBeInTheDocument()
  })
})
