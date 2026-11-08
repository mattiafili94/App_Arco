import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RemotoFinto } from '../test/remotoFinto'
import { renderApp } from '../test/render'
import { servizioFinto } from '../test/servizioFinto'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 10, 10, 0))
})
afterEach(() => vi.useRealTimers())

const aggiornato_il = '2026-11-01T10:00:00+00:00'

const gara = (codice: string, dati: Record<string, unknown> = {}) => ({
  codice,
  dal: '2026-10-24',
  al: '2026-10-25',
  calendario: 'Interregionale',
  regione: 'Umbria',
  localita: 'Gubbio (PG)',
  tipologia: '18 m',
  dettaglio: null,
  societa_codice: '11003',
  societa_nome: 'Arcieri Eugubini',
  stato: 'omologata',
  in_calendario_umbria: true,
  ha_invito: false,
  url_risultati: 'https://www.fitarco-italia.org/upload_2026/r2611039.pdf',
  aggiornato_il,
  ...dati,
})

const parziali = (a: number, b: number, prefisso = '18m') => [
  { colonna: `${prefisso}-1`, punti: a, posizione: 1 },
  { colonna: `${prefisso}-2`, punti: b, posizione: 1 },
]

const CATEGORIA = 'Arco Ricurvo - Senior Maschile'

const riga = (codice: string, dati: Record<string, unknown>) => ({
  gara_codice: codice,
  categoria: CATEGORIA,
  ordine: 1,
  divisione: 'OL',
  classe: 'Senior Maschile',
  posizione: 1,
  esito: '1',
  turno: '1-1A',
  nome_completo: 'ROSSI Mario',
  cognome: 'ROSSI',
  nome: 'Mario',
  societa_codice: '11004',
  societa_nome: 'Arcieri di Assisi',
  parziali: parziali(280, 272),
  prove: [],
  totale: 552,
  conteggi: [21, 26],
  colonne_conteggi: ['10', '9'],
  atleta_id: null,
  provvisoria: false,
  aggiornato_il,
  ...dati,
})

function remotoConRisultati(provvisoria = false) {
  const remoto = new RemotoFinto()
  remoto.scrivi('gare', gara('R2611039'))
  remoto.scrivi('classifiche', riga('R2611039', { provvisoria }))
  remoto.scrivi(
    'classifiche',
    riga('R2611039', {
      ordine: 2,
      posizione: 2,
      cognome: 'PROVA',
      nome: 'Bruno',
      societa_codice: '11003',
      societa_nome: 'Arcieri Eugubini',
      parziali: parziali(263, 271),
      totale: 534,
      conteggi: [17, 25],
      atleta_id: 'id-bruno',
      provvisoria,
    }),
  )
  remoto.scrivi(
    'classifiche',
    riga('R2611039', {
      ordine: 3,
      posizione: null,
      esito: 'DNF',
      cognome: "D'AMARIO",
      nome: 'Teresa',
      parziali: parziali(181, 18),
      totale: 199,
      conteggi: [1, 0],
      provvisoria,
    }),
  )
  remoto.scrivi(
    'classifiche',
    riga('R2611039', {
      categoria: 'Arco Nudo - Senior Maschile',
      cognome: 'BIANCHI',
      nome: 'Luca',
      societa_codice: '11003',
      societa_nome: 'Arcieri Eugubini',
      totale: 480,
      provvisoria,
    }),
  )
  return remoto
}

const apri = (remoto = remotoConRisultati(), percorso = '/gare/R2611039/risultati') =>
  renderApp(percorso, { servizio: servizioFinto({ remoto }).servizio })

describe('risultati di una gara', () => {
  it('dalla scheda gara si apre la classifica', async () => {
    await renderApp('/gare/R2611039', {
      servizio: servizioFinto({ remoto: remotoConRisultati() }).servizio,
    })
    const riga = await within(await screen.findByRole('main')).findByRole('link', {
      name: /Classifica/,
    })
    expect(riga).toHaveTextContent('4 atleti · 2 dei nostri')
    await userEvent.click(riga)
    expect(await screen.findByRole('heading', { level: 1, name: 'Risultati' })).toBeInTheDocument()
  })

  it('mostra prima i nostri atleti di tutte le categorie, poi l’elenco delle categorie', async () => {
    await apri()
    const nostri = await screen.findByRole('region', { name: 'I nostri atleti (2)' })
    const righe = within(nostri).getAllByText(/\d°/)
    expect(righe).toHaveLength(2)
    expect(within(nostri).getByText(/Bianchi Luca/)).toBeInTheDocument()
    expect(within(nostri).getByText(/Prova Bruno/)).toBeInTheDocument()
    expect(within(nostri).getByText(new RegExp(`${CATEGORIA} · 263 \\+ 271`))).toBeInTheDocument()

    const categorie = screen.getByRole('region', { name: 'Categorie (2)' })
    expect(within(categorie).getByRole('link', { name: /Arco Nudo/ })).toHaveTextContent(
      '1 atleti · 1 dei nostri',
    )
    expect(within(categorie).getByRole('link', { name: /Arco Ricurvo/ })).toHaveTextContent(
      '3 atleti · 1 dei nostri',
    )
  })

  it('apre una categoria: classifica con parziali, conteggi e società; i nostri evidenziati', async () => {
    await apri()
    await userEvent.click(await screen.findByRole('link', { name: /Arco Ricurvo/ }))
    expect(await screen.findByRole('heading', { level: 1, name: CATEGORIA })).toBeInTheDocument()

    const classifica = screen.getByRole('region', { name: 'Classifica' })
    const righe = within(classifica).getAllByText(/Mario|Bruno|Teresa/)
    expect(righe.map((r) => r.textContent)).toEqual([
      expect.stringContaining('1° Rossi Mario'),
      expect.stringContaining('2° Prova Bruno'),
      expect.stringContaining("DNF D'Amario Teresa"),
    ])
    expect(
      within(classifica).getByText(/Arcieri di Assisi · 280 \+ 272 · 10: 21 · 9: 26/),
    ).toBeInTheDocument()
    // Solo Bruno è della compagnia: ha il segnale anche per i lettori di schermo.
    expect(within(classifica).getAllByText('Della compagnia:')).toHaveLength(1)
    expect(screen.getByText('Della compagnia:').parentElement).toHaveTextContent('Prova Bruno')
  })

  it('dalla categoria si torna all’elenco', async () => {
    await apri(
      remotoConRisultati(),
      `/gare/R2611039/risultati?categoria=${encodeURIComponent(CATEGORIA)}`,
    )
    await screen.findByRole('heading', { level: 1, name: CATEGORIA })
    await userEvent.click(within(screen.getByRole('main')).getByRole('link', { name: /Risultati/ }))
    expect(await screen.findByRole('region', { name: 'Categorie (2)' })).toBeInTheDocument()
  })

  it('i risultati provvisori lo dicono', async () => {
    await apri(remotoConRisultati(true))
    expect(await screen.findByText(/Risultati provvisori/)).toBeInTheDocument()
  })

  it('i risultati definitivi non hanno l’avviso', async () => {
    await apri()
    await screen.findByRole('region', { name: 'I nostri atleti (2)' })
    expect(screen.queryByText(/Risultati provvisori/)).not.toBeInTheDocument()
  })

  it('gara composta: i punteggi di ogni prova con la distanza', async () => {
    const remoto = new RemotoFinto()
    remoto.scrivi('gare', gara('R2611038', { tipologia: '25+18 m', url_risultati: null }))
    remoto.scrivi(
      'classifiche',
      riga('R2611038', {
        parziali: [],
        prove: [
          { parziali: parziali(167, 105, '25m'), totale: 272 },
          { parziali: parziali(188, 190, '18m'), totale: 378 },
        ],
        totale: 650,
      }),
    )
    await apri(remoto, `/gare/R2611038/risultati?categoria=${encodeURIComponent(CATEGORIA)}`)
    expect(await screen.findByText(/272 \(25 m\) \+ 378 \(18 m\)/)).toBeInTheDocument()
    expect(screen.getByText('650')).toBeInTheDocument()
  })

  it('senza classifica salvata lo dice', async () => {
    const remoto = new RemotoFinto()
    remoto.scrivi('gare', gara('R2611039'))
    await apri(remoto)
    expect(await screen.findByText('Risultati non salvati')).toBeInTheDocument()
  })

  it('una categoria che non c’è lo dice', async () => {
    await apri(remotoConRisultati(), '/gare/R2611039/risultati?categoria=Inventata')
    expect(await screen.findByText('Categoria non trovata')).toBeInTheDocument()
  })

  it('la scheda gara senza classifica salvata mostra solo il PDF', async () => {
    const remoto = new RemotoFinto()
    remoto.scrivi('gare', gara('R2611039'))
    await apri(remoto, '/gare/R2611039')
    await screen.findByRole('link', { name: /PDF dei risultati/ })
    expect(
      within(screen.getByRole('main')).queryByRole('link', { name: /Classifica/ }),
    ).not.toBeInTheDocument()
  })
})
