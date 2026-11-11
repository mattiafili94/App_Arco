import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GiornoAllenamento } from '@arco/shared'
import { leggiGiorno } from '../allenamento/scrittura'
import type { Atleta } from '../accesso/servizio'
import { dbPredefinito } from '../sync/db'
import { RemotoFinto } from '../test/remotoFinto'
import { renderApp } from '../test/render'
import { AMMINISTRATORE, ATLETA, servizioFinto } from '../test/servizioFinto'

// Oggi, per tutti i test: mercoledì 11 novembre 2026 (solo la data è finta, i timer restano veri).
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 11, 10, 0))
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

const aggiornato_il = '2026-11-01T10:00:00+00:00'
const CARLA: Atleta = {
  id: 'id-carla',
  matricola: '900003',
  nome: 'Carla',
  cognome: 'Zeta',
  ruolo: 'atleta',
  attivo: true,
  haAccesso: true,
}
const DARIO: Atleta = {
  ...CARLA,
  id: 'id-dario',
  matricola: '900004',
  nome: 'Dario',
  cognome: 'Alfa',
}

const riga = (a: Atleta, allenatore = false) => ({
  id: a.id,
  matricola: a.matricola,
  nome: a.nome,
  cognome: a.cognome,
  ruolo: a.ruolo,
  attivo: true,
  ha_accesso: true,
  allenatore,
  aggiornato_il,
})

const giorno = (atleta: string, g: string, dati: Partial<GiornoAllenamento> = {}) => ({
  atleta_id: atleta,
  giorno: g,
  programma: '',
  fatto: false,
  frecce_libere: 0,
  nota: '',
  modificato_il: '2026-11-10T08:00:00.000Z',
  programma_modificato_il: '2026-11-10T08:00:00.000Z',
  programma_modificato_da: atleta,
  aggiornato_il,
  ...dati,
})

/** Bruno (collegato) è allenatore e segue Carla; Dario c'è ma Bruno non lo segue ancora. */
function remotoAllenatore({ bruno = true, segueCarla = true } = {}) {
  const remoto = new RemotoFinto()
  remoto.scrivi('atleti', riga(ATLETA, bruno))
  remoto.scrivi('atleti', riga(CARLA))
  remoto.scrivi('atleti', riga(DARIO))
  remoto.scrivi('atleti', riga(AMMINISTRATORE))
  if (segueCarla) {
    remoto.scrivi('allenatori_atleti', {
      allenatore_id: ATLETA.id,
      atleta_id: CARLA.id,
      aggiornato_il,
    })
  }
  remoto.scrivi(
    'allenamento_giorni',
    giorno(CARLA.id, '2026-11-10', {
      programma: '60 frecce a 18 m',
      fatto: true,
      frecce_libere: 60,
      nota: 'braccio stanco',
    }),
  )
  remoto.scrivi('simulazioni', {
    id: 'sim-carla',
    atleta_id: CARLA.id,
    giorno: '2026-11-10',
    formato: '18m',
    distanza: null,
    bersaglio: 'trispot',
    frecce: ['10', '9', '8'],
    conclusa: false,
    eliminata: false,
    creata_il: '2026-11-10T09:00:00.000Z',
    modificato_il: '2026-11-10T09:00:00.000Z',
    aggiornato_il,
  })
  return remoto
}

const apri = async (indirizzo: string, opzioni: Parameters<typeof remotoAllenatore>[0] = {}) => {
  const finto = servizioFinto({
    remoto: remotoAllenatore(opzioni),
    atleti: [AMMINISTRATORE, { ...ATLETA, allenatore: true }, CARLA, DARIO],
  })
  await renderApp(indirizzo, { servizio: finto.servizio })
  return finto
}

describe('il quinto tab, solo per gli allenatori', () => {
  it('un allenatore ha "I miei atleti" nella barra dei tab', async () => {
    await apri('/gare')
    const barra = screen.getByRole('navigation', { name: 'Navigazione principale' })
    expect(await within(barra).findByRole('link', { name: /I miei atleti/ })).toHaveAttribute(
      'href',
      '/allenatore',
    )
  })

  it('chi non è allenatore no; e la pagina, se ci arriva, glielo dice', async () => {
    await apri('/allenatore', { bruno: false })
    expect(await screen.findByText('Sezione per gli allenatori')).toBeInTheDocument()
    const barra = screen.getByRole('navigation', { name: 'Navigazione principale' })
    expect(within(barra).queryByRole('link', { name: /I miei atleti/ })).not.toBeInTheDocument()
  })

  it('l’elenco degli atleti seguiti; toccandone uno si apre la sua settimana', async () => {
    await apri('/allenatore')
    const elenco = await screen.findByRole('region', { name: 'Atleti che segui' })
    await waitFor(() => expect(within(elenco).getAllByRole('link')).toHaveLength(1))
    await userEvent.click(within(elenco).getByRole('link', { name: /Carla Zeta/ }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Carla Zeta' })).toBeInTheDocument()
    const giorni = await screen.findByRole('region', { name: 'Giorni' })
    await waitFor(() =>
      expect(within(giorni).getByRole('link', { name: /Martedì/ })).toHaveTextContent(
        '60 frecce a 18 m',
      ),
    )
    // Il programma l'ha scritto l'atleta: l'allenatore lo vede.
    expect(within(giorni).getByRole('link', { name: /Martedì/ })).toHaveTextContent(
      'scritto dall’atleta',
    )
  })

  it('senza atleti seguiti lo dice, con il pulsante per sceglierli', async () => {
    await apri('/allenatore', { segueCarla: false })
    expect(await screen.findByText('Non segui ancora nessun atleta')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Scegli gli atleti' })).toBeInTheDocument()
  })

  it('un atleta non seguito non si apre', async () => {
    await apri(`/allenatore/${DARIO.id}`)
    expect(await screen.findByText('Atleta non seguito')).toBeInTheDocument()
  })
})

describe('il giorno di un atleta seguito', () => {
  it('l’allenatore scrive il programma; "fatto", frecce e nota li vede soltanto', async () => {
    const finto = await apri(`/allenatore/${CARLA.id}/2026-11-10`)
    const programma = await screen.findByLabelText('Programma')
    await waitFor(() => expect(programma).toHaveValue('60 frecce a 18 m'))
    expect(screen.getByText('Programma scritto dall’atleta.')).toBeInTheDocument()

    const segnato = screen.getByRole('region', { name: 'Segnato dall’atleta' })
    expect(segnato).toHaveTextContent('Fatto')
    expect(segnato).toHaveTextContent('Sì')
    expect(segnato).toHaveTextContent('60')
    expect(segnato).toHaveTextContent('braccio stanco')
    expect(screen.queryByRole('checkbox', { name: 'Fatto' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Nuova simulazione' })).not.toBeInTheDocument()

    await userEvent.clear(programma)
    await userEvent.type(programma, '90 frecce')
    await waitFor(async () => {
      const g = await leggiGiorno(dbPredefinito(), CARLA.id, '2026-11-10')
      expect(g).toMatchObject({
        programma: '90 frecce',
        programma_modificato_da: ATLETA.id,
        fatto: true,
        frecce_libere: 60,
        nota: 'braccio stanco',
      })
    })
    expect(await screen.findByText('Programma scritto da te.')).toBeInTheDocument()
    // Arriva al server.
    await waitFor(
      () =>
        expect(finto.remoto.salvataggi.at(-1)).toMatchObject({
          atleta_id: CARLA.id,
          programma: '90 frecce',
        }),
      { timeout: 4000 },
    )
  })

  it('le simulazioni dell’atleta si aprono solo da guardare', async () => {
    await apri(`/allenatore/${CARLA.id}/2026-11-10`)
    const simulazioni = await screen.findByRole('region', { name: 'Simulazioni di gara' })
    await userEvent.click(await within(simulazioni).findByRole('link', { name: /18 m/ }))
    expect(await screen.findByRole('heading', { level: 1, name: '18 m' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Riepilogo' })).toHaveTextContent('27')
    expect(screen.queryByRole('group', { name: 'Valore della freccia' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Tocca per correggere/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Elimina la simulazione' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Avvia timer' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Nota della volée/ })).not.toBeInTheDocument()
  })
})

describe('copiare il programma su altri atleti', () => {
  it('il programma della settimana si copia sugli atleti scelti', async () => {
    const finto = servizioFinto({
      remoto: remotoAllenatore(),
      atleti: [AMMINISTRATORE, { ...ATLETA, allenatore: true }, CARLA, DARIO],
    })
    // Bruno segue anche Dario.
    finto.remoto.scrivi('allenatori_atleti', {
      allenatore_id: ATLETA.id,
      atleta_id: DARIO.id,
      aggiornato_il,
    })
    await renderApp(`/allenatore/${CARLA.id}`, { servizio: finto.servizio })
    await userEvent.click(await screen.findByRole('button', { name: 'Copia il programma su…' }))
    const scelta = screen.getByRole('group', { name: /Copia il programma di questa settimana/ })
    expect(within(scelta).queryByRole('checkbox', { name: 'Carla Zeta' })).not.toBeInTheDocument()
    await userEvent.click(within(scelta).getByRole('checkbox', { name: 'Dario Alfa' }))
    await userEvent.click(within(scelta).getByRole('button', { name: 'Copia' }))
    expect(await screen.findByText('Copiato 1 programma.')).toBeInTheDocument()
    expect(await leggiGiorno(dbPredefinito(), DARIO.id, '2026-11-10')).toMatchObject({
      programma: '60 frecce a 18 m',
      programma_modificato_da: ATLETA.id,
    })
  })
})

describe('impostazioni', () => {
  it('l’allenatore sceglie gli atleti da seguire; la scelta arriva al telefono', async () => {
    // Un'atleta che compare solo in questo test (così nessun altro test la tocca).
    const ELENA: Atleta = {
      ...CARLA,
      id: 'id-elena',
      matricola: '900005',
      nome: 'Elena',
      cognome: 'Beta',
    }
    const remoto = remotoAllenatore()
    remoto.scrivi('atleti', riga(ELENA))
    const finto = servizioFinto({
      remoto,
      atleti: [AMMINISTRATORE, { ...ATLETA, allenatore: true }, CARLA, DARIO, ELENA],
    })
    await renderApp('/impostazioni', { servizio: finto.servizio })
    const sezione = await screen.findByRole('region', { name: 'Atleti che segui' })
    await waitFor(() =>
      expect(within(sezione).getByRole('checkbox', { name: 'Carla Zeta' })).toBeChecked(),
    )
    expect(within(sezione).queryByRole('checkbox', { name: /Bruno/ })).not.toBeInTheDocument()
    const elena = within(sezione).getByRole('checkbox', { name: 'Elena Beta' })
    expect(elena).not.toBeChecked()
    await userEvent.click(elena)
    await waitFor(() => expect(finto.servizio.seguiAtleta).toHaveBeenCalledWith(ELENA.id, true))
    // La scelta arriva al telefono con la sincronizzazione.
    await waitFor(
      () => expect(within(sezione).getByRole('checkbox', { name: 'Elena Beta' })).toBeChecked(),
      { timeout: 4000 },
    )
  })

  it('l’atleta vede chi lo segue', async () => {
    const finto = servizioFinto({
      collegato: CARLA,
      remoto: remotoAllenatore(),
      atleti: [AMMINISTRATORE, { ...ATLETA, allenatore: true }, CARLA, DARIO],
    })
    await renderApp('/impostazioni', { servizio: finto.servizio })
    expect(await screen.findByText(/Bruno Prova: vedono il tuo allenamento/)).toBeInTheDocument()
    // Non è allenatore: niente scelta degli atleti.
    expect(screen.queryByRole('region', { name: 'Atleti che segui' })).not.toBeInTheDocument()
  })

  it('l’atleta vede nella sua settimana chi ha scritto il programma', async () => {
    const remoto = remotoAllenatore()
    remoto.scrivi(
      'allenamento_giorni',
      giorno(CARLA.id, '2026-11-12', {
        programma: 'Tecnica',
        programma_modificato_da: ATLETA.id,
      }),
    )
    await renderApp('/allenamento', {
      servizio: servizioFinto({ collegato: CARLA, remoto, atleti: [ATLETA, CARLA] }).servizio,
    })
    const giorni = await screen.findByRole('region', { name: 'Giorni' })
    await waitFor(() =>
      expect(within(giorni).getByRole('link', { name: /Giovedì/ })).toHaveTextContent(
        'scritto da Bruno Prova',
      ),
    )
  })
})

describe('amministrazione', () => {
  it('l’amministratore dà e toglie il ruolo di allenatore', async () => {
    const finto = servizioFinto({
      collegato: AMMINISTRATORE,
      atleti: [AMMINISTRATORE, ATLETA, CARLA],
    })
    await renderApp(`/amministrazione/atleti/${CARLA.id}`, { servizio: finto.servizio })
    const ruolo = await screen.findByRole('checkbox', { name: /Allenatore/ })
    expect(ruolo).not.toBeChecked()
    await userEvent.click(ruolo)
    await waitFor(() =>
      expect(finto.servizio.impostaAllenatore).toHaveBeenCalledWith(CARLA.id, true),
    )
    expect(await screen.findByText('Carla ora è anche allenatore.')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('checkbox', { name: /Allenatore/ })).toBeChecked())
  })
})
