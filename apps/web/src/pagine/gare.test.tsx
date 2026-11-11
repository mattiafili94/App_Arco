import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RemotoFinto } from '../test/remotoFinto'
import { renderApp } from '../test/render'
import { ATLETA, servizioFinto } from '../test/servizioFinto'

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
  al: '2026-12-13',
  calendario: 'Interregionale',
  regione: 'Umbria',
  localita: 'Perugia (PG)',
  tipologia: '18 m',
  dettaglio: 'competizione interregionale',
  societa_codice: '11018',
  societa_nome: 'ASD Arcieri Augusta Perusia',
  stato: 'in-calendario',
  in_calendario_umbria: true,
  ha_invito: false,
  url_risultati: null,
  aggiornato_il,
  ...dati,
})

/** Un calendario di prova: una gara futura con invito, una annullata, due passate (una fuori regione). */
function remotoConGare() {
  const remoto = new RemotoFinto()
  remoto.scrivi('gare', gara('R2611040', { stato: 'invito', ha_invito: true }))
  remoto.scrivi(
    'gare',
    gara('R2611050', {
      dal: '2026-11-20',
      al: '2026-11-20',
      localita: 'Terni (TR)',
      stato: 'annullata',
    }),
  )
  remoto.scrivi(
    'gare',
    gara('R2611039', {
      dal: '2026-10-24',
      al: '2026-10-25',
      localita: 'Gubbio (PG)',
      stato: 'omologata',
      url_risultati: 'https://www.fitarco-italia.org/upload_2026/r2611039.pdf',
    }),
  )
  remoto.scrivi(
    'gare',
    gara('N2511039', {
      dal: '2025-06-15',
      al: '2025-06-15',
      calendario: 'Nazionale',
      regione: null,
      localita: 'Roma (RM)',
      tipologia: 'Doppio 70/60mt Round - Doppio 50mt Round',
      stato: 'sconosciuto',
      in_calendario_umbria: false,
    }),
  )
  remoto.scrivi('inviti', {
    gara_codice: 'R2611040',
    testo: 'PROGRAMMA\n\nSABATO\n9,30 Accreditamento',
    luogo: 'CVA - Piazza della Torre, Perugia',
    riferimento: 'Mario Rossi 3330000000',
    email: 'societa@example.com',
    web: 'https://www.esempio.it',
    verificato: true,
    aggiornato_il,
  })
  remoto.scrivi('partecipazioni', {
    atleta_id: ATLETA.id,
    gara_codice: 'R2611039',
    divisione: 'OL',
    classe: 'SM',
    rank: 'SM',
    aggiornato_il,
  })
  return remoto
}

const conGare = () => servizioFinto({ remoto: remotoConGare() }).servizio

describe('tab Gare', () => {
  it('senza gare spiega cosa succede', async () => {
    await renderApp('/gare')
    expect(await screen.findByText('Nessuna gara salvata')).toBeInTheDocument()
    await screen.findByText(/Il calendario non ha ancora gare/)
  })

  it('divide le gare in prossime e passate, le più vicine per prime', async () => {
    await renderApp('/gare', { servizio: conGare() })
    const prossime = await screen.findByRole('region', { name: 'Prossime' })
    const passate = screen.getByRole('region', { name: 'Passate' })

    const nomiProssime = within(prossime)
      .getAllByRole('link')
      .map((l) => l.textContent)
    expect(nomiProssime).toHaveLength(2)
    expect(nomiProssime[0]).toContain('Terni (TR)') // 20 novembre, prima del 12 dicembre
    expect(nomiProssime[1]).toContain('Perugia (PG)')

    const nomiPassate = within(passate)
      .getAllByRole('link')
      .map((l) => l.textContent)
    expect(nomiPassate[0]).toContain('Gubbio (PG)') // la più recente per prima
    expect(nomiPassate[1]).toContain('Roma (RM)')
  })

  it('ogni riga dice data e stato: invito, annullata, risultati, fuori regione, partecipazione', async () => {
    await renderApp('/gare', { servizio: conGare() })
    const perugia = await screen.findByRole('link', { name: /Perugia/ })
    expect(perugia).toHaveTextContent('18 m · Perugia (PG)')
    expect(perugia).toHaveTextContent('12–13 dic')
    expect(perugia).toHaveTextContent('Invito disponibile')

    expect(screen.getByRole('link', { name: /Terni/ })).toHaveTextContent('Annullata')
    const gubbio = screen.getByRole('link', { name: /Gubbio/ })
    expect(gubbio).toHaveTextContent('Risultati definitivi')
    // Le partecipazioni arrivano con la sincronizzazione, un po' dopo le gare.
    await waitFor(() => expect(gubbio).toHaveTextContent('Hai partecipato'))
    const roma = screen.getByRole('link', { name: /Roma/ })
    expect(roma).toHaveTextContent('Doppio 70 m')
    expect(roma).toHaveTextContent('15 giu 2025')
    expect(roma).toHaveTextContent('Fuori regione')
  })
})

describe('scheda gara', () => {
  const apri = async (nome: RegExp) => {
    await renderApp('/gare', { servizio: conGare() })
    await userEvent.click(await screen.findByRole('link', { name: nome }))
    return screen.findByRole('heading', { level: 1 })
  }

  it('una gara con invito mostra dettagli, contatti e testo completo', async () => {
    await apri(/Perugia/)
    expect(await screen.findByRole('heading', { level: 1, name: '18 m' })).toBeInTheDocument()
    expect(screen.getByText('Perugia (PG) · 12–13 dic 2026')).toBeInTheDocument()
    expect(screen.getByText('ASD Arcieri Augusta Perusia')).toBeInTheDocument()
    // L'invito arriva con la sincronizzazione, a volte dopo la gara.
    expect(await screen.findByRole('link', { name: /societa@example.com/ })).toHaveAttribute(
      'href',
      'mailto:societa@example.com',
    )
    expect(screen.getByRole('link', { name: /esempio.it/ })).toHaveAttribute('target', '_blank')
    const testo = screen.getByText(/PROGRAMMA/)
    expect(testo).toHaveTextContent('SABATO')
    expect(testo.textContent).toContain('9,30 Accreditamento')
  })

  it('"Aggiungi al calendario": file per il telefono e link Google Calendar', async () => {
    const creaUrl = vi.fn(() => 'blob:prova')
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: creaUrl, revokeObjectURL: vi.fn() }))
    const clic = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    await apri(/Perugia/)

    const google = screen.getByRole('link', { name: /Google Calendar/ })
    expect(google.getAttribute('href')).toContain('calendar.google.com/calendar/render')
    expect(google.getAttribute('href')).toContain('dates=20261212%2F20261214')

    await userEvent.click(screen.getByRole('button', { name: /Calendario del telefono/ }))
    expect(clic).toHaveBeenCalledTimes(1)
    const [blob] = creaUrl.mock.calls[0] as unknown as [Blob]
    expect(await blob.text()).toContain('DTSTART;VALUE=DATE:20261212')
    expect(blob.type).toContain('text/calendar')
  })

  it('una gara passata ha il PDF dei risultati e niente "Aggiungi al calendario"', async () => {
    await apri(/Gubbio/)
    expect(screen.getByRole('link', { name: /PDF dei risultati/ })).toHaveAttribute(
      'href',
      'https://www.fitarco-italia.org/upload_2026/r2611039.pdf',
    )
    expect(screen.getByText('Risultati definitivi')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Aggiungi al calendario' })).not.toBeInTheDocument()
  })

  it('una gara annullata non si aggiunge al calendario', async () => {
    await apri(/Terni/)
    expect(screen.getByText('Annullata')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Aggiungi al calendario' })).not.toBeInTheDocument()
  })

  it('una gara fuori regione lo dice', async () => {
    await apri(/Roma/)
    expect(screen.getByText('Fuori regione')).toBeInTheDocument()
    expect(screen.getByText('Doppio 70/60mt Round - Doppio 50mt Round')).toBeInTheDocument()
  })

  it('un invito non ancora scaricato lo dice', async () => {
    const remoto = new RemotoFinto()
    remoto.scrivi('gare', gara('R2611040', { stato: 'invito', ha_invito: true }))
    await renderApp('/gare/R2611040', { servizio: servizioFinto({ remoto }).servizio })
    expect(await screen.findByText('Invito in arrivo')).toBeInTheDocument()
  })

  it('una gara che non c’è: lo dice e si torna all’elenco', async () => {
    await renderApp('/gare/R0000000', { servizio: conGare() })
    expect(await screen.findByText('Gara non trovata')).toBeInTheDocument()
    // Il collegamento "indietro" è dentro l'intestazione della pagina (il tab "Gare" è nella barra).
    const intestazione = screen.getByRole('banner')
    await userEvent.click(within(intestazione).getByRole('link', { name: /Gare/ }))
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1, name: 'Gare' })).toBeInTheDocument(),
    )
  })

  it('funziona anche solo con i dati già sul telefono (offline): le gare restano', async () => {
    const remoto = remotoConGare()
    const { servizio } = servizioFinto({ remoto })
    await renderApp('/gare', { servizio })
    await screen.findByRole('link', { name: /Perugia/ })
    // Da qui il "server" non risponde più: la schermata continua a mostrare quello che ha.
    remoto.errore = new Error('offline')
    await userEvent.click(screen.getByRole('link', { name: /Perugia/ }))
    expect(await screen.findByText('Invito')).toBeInTheDocument()
  })
})

describe('tab Gare: le 6 in evidenza, il calendario e lo storico', () => {
  /** 8 gare future (una nel 2027, calendario già definitivo) e 8 passate (2025 e 2026). */
  function remotoConTanteGare(conAnnoDopo = true) {
    const remoto = new RemotoFinto()
    const future = [
      '2026-11-14',
      '2026-11-21',
      '2026-11-28',
      '2026-12-05',
      '2026-12-12',
      '2026-12-19',
    ]
    future.forEach((dal, i) =>
      remoto.scrivi('gare', gara(`R26110${60 + i}`, { dal, al: dal, localita: `Futura ${i + 1}` })),
    )
    remoto.scrivi(
      'gare',
      gara('R2611070', { dal: '2026-12-27', al: '2026-12-27', localita: 'Futura 7' }),
    )
    if (conAnnoDopo) {
      remoto.scrivi(
        'gare',
        gara('R2711001', { dal: '2027-01-16', al: '2027-01-16', localita: 'Futura 8' }),
      )
    }
    const passate = [
      '2026-11-01',
      '2026-10-18',
      '2026-09-06',
      '2026-06-14',
      '2026-03-08',
      '2026-01-11',
    ]
    passate.forEach((dal, i) =>
      remoto.scrivi(
        'gare',
        gara(`R26110${10 + i}`, { dal, al: dal, localita: `Passata ${i + 1}` }),
      ),
    )
    remoto.scrivi(
      'gare',
      gara('R2511001', { dal: '2025-12-07', al: '2025-12-07', localita: 'Passata 7' }),
    )
    remoto.scrivi(
      'gare',
      gara('R2511002', { dal: '2025-02-02', al: '2025-02-02', localita: 'Passata 8' }),
    )
    return remoto
  }
  const nomi = (regione: HTMLElement) =>
    within(regione)
      .getAllByRole('link')
      .map((l) => /(Futura|Passata) \d/.exec(l.textContent ?? '')?.[0])

  it('prossime: solo le prime 6 in ordine di data, poi i pulsanti dei calendari', async () => {
    await renderApp('/gare', { servizio: servizioFinto({ remoto: remotoConTanteGare() }).servizio })
    const prossime = await screen.findByRole('region', { name: 'Prossime' })
    expect(nomi(prossime)).toEqual([
      'Futura 1',
      'Futura 2',
      'Futura 3',
      'Futura 4',
      'Futura 5',
      'Futura 6',
    ])
    expect(screen.getByRole('link', { name: 'Calendario 2026' })).toHaveAttribute(
      'href',
      '/gare/calendario/2026',
    )
    // Il calendario 2027 c'è solo perché le sue gare sono già scaricate (definitivo).
    expect(screen.getByRole('link', { name: 'Calendario 2027' })).toHaveAttribute(
      'href',
      '/gare/calendario/2027',
    )
  })

  it('senza gare dell’anno dopo c’è solo il calendario dell’anno in corso', async () => {
    await renderApp('/gare', {
      servizio: servizioFinto({ remoto: remotoConTanteGare(false) }).servizio,
    })
    expect(await screen.findByRole('link', { name: 'Calendario 2026' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Calendario 2027' })).not.toBeInTheDocument()
  })

  it('passate: solo le ultime 6, dalla più recente, poi "Storico completo"', async () => {
    await renderApp('/gare', { servizio: servizioFinto({ remoto: remotoConTanteGare() }).servizio })
    const passate = await screen.findByRole('region', { name: 'Passate' })
    expect(nomi(passate)).toEqual([
      'Passata 1',
      'Passata 2',
      'Passata 3',
      'Passata 4',
      'Passata 5',
      'Passata 6',
    ])
    await userEvent.click(screen.getByRole('link', { name: 'Storico completo' }))
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Storico gare' }),
    ).toBeInTheDocument()
  })

  it('il calendario dell’anno: tutte le gare, mese per mese, anche quelle già fatte', async () => {
    await renderApp('/gare', { servizio: servizioFinto({ remoto: remotoConTanteGare() }).servizio })
    await userEvent.click(await screen.findByRole('link', { name: 'Calendario 2026' }))
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Calendario 2026' }),
    ).toBeInTheDocument()
    expect(
      screen
        .getAllByRole('region')
        .map((r) => r.getAttribute('aria-label') ?? r.querySelector('h2')?.textContent),
    ).toEqual(['Gennaio', 'Marzo', 'Giugno', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'])
    expect(nomi(screen.getByRole('region', { name: 'Dicembre' }))).toEqual([
      'Futura 4',
      'Futura 5',
      'Futura 6',
      'Futura 7',
    ])
    // La gara del 2027 non è nel calendario 2026.
    expect(screen.queryByText(/Futura 8/)).not.toBeInTheDocument()
  })

  it('il calendario dell’anno dopo ha le sue gare', async () => {
    await renderApp('/gare/calendario/2027', {
      servizio: servizioFinto({ remoto: remotoConTanteGare() }).servizio,
    })
    const gennaio = await screen.findByRole('region', { name: 'Gennaio' })
    expect(nomi(gennaio)).toEqual(['Futura 8'])
  })

  it('un anno senza calendario (passato o non ancora definitivo) lo dice', async () => {
    await renderApp('/gare/calendario/2025', {
      servizio: servizioFinto({ remoto: remotoConTanteGare(false) }).servizio,
    })
    expect(await screen.findByText('Calendario non disponibile')).toBeInTheDocument()
  })

  it('lo storico completo: tutte le gare passate, anno per anno', async () => {
    await renderApp('/gare/storico', {
      servizio: servizioFinto({ remoto: remotoConTanteGare() }).servizio,
    })
    const anno2026 = await screen.findByRole('region', { name: '2026' })
    expect(nomi(anno2026)).toHaveLength(6)
    expect(nomi(screen.getByRole('region', { name: '2025' }))).toEqual(['Passata 7', 'Passata 8'])
    // Niente gare future nello storico.
    expect(screen.queryByText(/Futura/)).not.toBeInTheDocument()
  })

  it('storico vuoto: lo dice', async () => {
    const remoto = new RemotoFinto()
    remoto.scrivi('gare', gara('R2611060', { dal: '2026-12-12', al: '2026-12-12' }))
    await renderApp('/gare/storico', { servizio: servizioFinto({ remoto }).servizio })
    // Con il computer carico (tutti i test insieme) può servire più di un secondo.
    expect(
      await screen.findByText('Nessuna gara passata', {}, { timeout: 4000 }),
    ).toBeInTheDocument()
  })
})
