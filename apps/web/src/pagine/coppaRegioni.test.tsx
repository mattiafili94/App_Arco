import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { ClassificaRanking } from '@arco/shared'
import { RemotoFinto } from '../test/remotoFinto'
import { renderApp } from '../test/render'
import { AMMINISTRATORE, ATLETA, servizioFinto } from '../test/servizioFinto'

const aggiornato_il = '2026-11-01T10:00:00+00:00'

/** Bruno (collegato), con o senza il ruolo di tecnico regionale. */
function servizio(tecnico: boolean) {
  const remoto = new RemotoFinto()
  remoto.scrivi('atleti', {
    id: ATLETA.id,
    matricola: ATLETA.matricola,
    nome: ATLETA.nome,
    cognome: ATLETA.cognome,
    ruolo: 'atleta',
    attivo: true,
    ha_accesso: true,
    allenatore: false,
    tecnico_regionale: tecnico,
    aggiornato_il,
  })
  const finto = servizioFinto({ remoto })
  const classifica: ClassificaRanking = {
    tipo: 'T',
    divisione: 'OL',
    classe: 'J',
    genere: 'F',
    categoria: 'Arco Olimpico - Junior Femminile',
    totale: 2,
    righe: [
      {
        posizione: 1,
        matricola: 'm1',
        nome: 'Lontana Lea',
        societa_codice: '05001',
        societa_nome: 'Del Nord',
        punti: 1300,
        gare: [],
      },
      {
        posizione: 2,
        matricola: 'm2',
        nome: 'Umbra Ida',
        societa_codice: '11018',
        societa_nome: 'Augusta Perusia',
        punti: 1250,
        gare: [],
      },
    ],
    letta_il: aggiornato_il,
    aggiornato_il,
  }
  finto.classifica.aggiungi(classifica)
  return finto
}

describe('Coppa delle Regioni (tecnico regionale)', () => {
  it('senza il ruolo la sezione non c’è e l’indirizzo riporta al tab', async () => {
    await renderApp('/classifica', { servizio: servizio(false).servizio })
    await screen.findByText('Non compari ancora in nessuna classifica')
    expect(screen.queryByRole('link', { name: /Coppa delle Regioni/ })).not.toBeInTheDocument()

    await renderApp('/classifica/coppa-regioni', { servizio: servizio(false).servizio })
    expect(
      (await screen.findAllByRole('heading', { level: 1, name: 'Classifica' }))[0],
    ).toBeInTheDocument()
  })

  it('con il ruolo: elenco per tipo, arco, classe con distanza e genere; apre la classifica umbra', async () => {
    await renderApp('/classifica', { servizio: servizio(true).servizio })
    await userEvent.click(await screen.findByRole('link', { name: /Coppa delle Regioni/ }))
    await screen.findByRole('heading', { level: 1, name: 'Coppa delle Regioni' })

    const targa = screen.getByRole('region', { name: 'Targa' })
    const campagna = screen.getByRole('region', { name: 'Campagna' })
    expect(within(targa).getAllByRole('link')).toHaveLength(16)
    expect(within(campagna).getAllByRole('link')).toHaveLength(18)
    expect(within(targa).queryByText(/Master/)).not.toBeInTheDocument()
    expect(
      within(targa).getByRole('link', { name: 'Ricurvo · Allievi 60 m · Maschile' }),
    ).toBeInTheDocument()
    expect(
      within(campagna).getByRole('link', { name: 'Nudo · Master · Femminile' }),
    ).toBeInTheDocument()

    await userEvent.click(
      within(targa).getByRole('link', { name: 'Ricurvo · Junior 70 m · Femminile' }),
    )
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Outdoor · Ricurvo · Junior F' }),
    ).toBeInTheDocument()
    // Solo gli umbri.
    expect(await screen.findByText(/Umbra Ida/)).toBeInTheDocument()
    expect(screen.queryByText(/Lontana Lea/)).not.toBeInTheDocument()
    // La freccia torna all'elenco della Coppa.
    await userEvent.click(screen.getByRole('link', { name: /Coppa delle Regioni/ }))
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Coppa delle Regioni' }),
    ).toBeInTheDocument()
  })
})

describe('Amministrazione: il ruolo di tecnico regionale', () => {
  it('l’amministratore lo dà e lo toglie dalla scheda dell’atleta', async () => {
    const finto = servizioFinto({ collegato: AMMINISTRATORE })
    await renderApp(`/amministrazione/atleti/${ATLETA.id}`, { servizio: finto.servizio })
    const casella = await screen.findByRole('checkbox', { name: /Tecnico regionale/ })
    expect(casella).not.toBeChecked()
    await userEvent.click(casella)
    await waitFor(() =>
      expect(finto.servizio.impostaTecnicoRegionale).toHaveBeenCalledWith(ATLETA.id, true),
    )
    expect(await screen.findByText(/ora è anche tecnico regionale/)).toBeInTheDocument()
    expect(casella).toBeChecked()
  })
})
