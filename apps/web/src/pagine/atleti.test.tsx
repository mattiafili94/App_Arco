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
})

const aggiornato_il = '2026-11-01T10:00:00+00:00'

const atleta = (id: string, nome: string, cognome: string, dati: Record<string, unknown> = {}) => ({
  id,
  matricola: `9${id.length}`,
  nome,
  cognome,
  ruolo: 'atleta',
  attivo: true,
  ha_accesso: true,
  aggiornato_il,
  ...dati,
})

const gara = (
  codice: string,
  dal: string,
  tipologia: string,
  dati: Record<string, unknown> = {},
) => ({
  codice,
  dal,
  al: dal,
  calendario: 'Interregionale',
  regione: 'Umbria',
  localita: 'Gubbio (PG)',
  tipologia,
  dettaglio: null,
  societa_codice: '11003',
  societa_nome: 'Arcieri Eugubini',
  stato: 'omologata',
  in_calendario_umbria: true,
  ha_invito: false,
  url_risultati: null,
  aggiornato_il,
  ...dati,
})

const part = (atleta_id: string, gara_codice: string, dati: Record<string, unknown> = {}) => ({
  atleta_id,
  gara_codice,
  divisione: 'OL',
  classe: 'SM',
  rank: 'SM',
  posizione: 3,
  totale: 500,
  aggiornato_il,
  ...dati,
})

const colonne = (nome: string) => [
  { colonna: `${nome}-1`, punti: 0, posizione: 1 },
  { colonna: `${nome}-2`, punti: 0, posizione: 1 },
]

/** Atleti: Bruno (tu), Carla Zeta, Anna Alfa, uno senza accesso e uno non attivo (non compaiono). */
function remotoConAtleti() {
  const remoto = new RemotoFinto()
  remoto.scrivi('atleti', atleta(ATLETA.id, 'Bruno', 'Prova'))
  remoto.scrivi('atleti', atleta('id-carla', 'Carla', 'Zeta'))
  remoto.scrivi('atleti', atleta('id-anna', 'Anna', 'Alfa', { ruolo: 'amministratore' }))
  remoto.scrivi('atleti', atleta('id-senza', 'Dario', 'Senzalink', { ha_accesso: false }))
  remoto.scrivi('atleti', atleta('id-ex', 'Ettore', 'Exsocio', { attivo: false }))

  remoto.scrivi('gare', gara('G1', '2026-01-10', '18 m'))
  remoto.scrivi('gare', gara('G2', '2026-03-14', '25+18 m'))
  remoto.scrivi(
    'gare',
    gara('G3', '2026-10-31', '70/60mt Round - 50mt Round', { stato: 'da-omologare' }),
  )
  remoto.scrivi('gare', gara('G4', '2019-02-02', '18 m', { localita: 'Perugia (PG)' }))
  remoto.scrivi('gare', gara('G5', '2026-12-12', '18 m', { stato: 'invito' }))

  // Bruno: 18 m (con PDF), 25+18 (con PDF), 70 m provvisorio (con PDF), 18 m del 2019 (solo storico).
  const p = (g: string, dati: Record<string, unknown> = {}) =>
    remoto.scrivi('partecipazioni', part(ATLETA.id, g, dati))
  p('G1', { totale: 540 })
  p('G2', { totale: 1100, posizione: 2 })
  p('G3', { totale: 640, posizione: 1 })
  p('G4', { totale: 560 })
  remoto.scrivi('partecipazioni', part('id-carla', 'G1', { divisione: 'CO', totale: 580 }))

  const riga = (g: string, ordine: number, dati: Record<string, unknown>) =>
    remoto.scrivi('classifiche', {
      gara_codice: g,
      categoria: 'Arco Ricurvo - Senior Maschile',
      ordine,
      divisione: 'OL',
      classe: 'Senior Maschile',
      posizione: 3,
      esito: '3',
      turno: null,
      nome_completo: 'ROSSI Mario',
      cognome: 'ROSSI',
      nome: 'Mario',
      societa_codice: '11003',
      societa_nome: 'Arcieri Eugubini',
      parziali: colonne('18m'),
      prove: [],
      totale: 0,
      conteggi: [10, 20],
      colonne_conteggi: ['10', '9'],
      atleta_id: ATLETA.id,
      provvisoria: false,
      aggiornato_il,
      ...dati,
    })
  riga('G1', 1, { totale: 540 })
  riga('G2', 1, {
    totale: 1100,
    prove: [
      { parziali: colonne('25m'), totale: 530 },
      { parziali: colonne('18m'), totale: 570 },
    ],
  })
  riga('G3', 1, { totale: 640, parziali: colonne('70m'), provvisoria: true })
  return remoto
}

const conAtleti = () => servizioFinto({ remoto: remotoConAtleti() }).servizio

describe('tab Atleti', () => {
  it('senza dati spiega cosa succede', async () => {
    await renderApp('/atleti')
    expect(await screen.findByText('Nessun atleta per ora')).toBeInTheDocument()
    expect(screen.getByText(/link di accesso/)).toBeInTheDocument()
  })

  it('elenca chi ha l’accesso, tu in cima e gli altri in ordine alfabetico', async () => {
    await renderApp('/atleti', { servizio: conAtleti() })
    const elenco = await screen.findByRole('region', { name: 'Compagnia' })
    const nomi = within(elenco)
      .getAllByRole('link')
      .map((l) => l.textContent)
    expect(nomi).toHaveLength(3)
    expect(nomi[0]).toContain('Bruno Prova')
    expect(nomi[0]).toContain('Tu')
    expect(nomi[1]).toContain('Anna Alfa')
    expect(nomi[2]).toContain('Carla Zeta')
    expect(screen.queryByText(/Senzalink/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Exsocio/)).not.toBeInTheDocument()
  })

  it('sotto il nome: arco e data dell’ultima gara già disputata', async () => {
    await renderApp('/atleti', { servizio: conAtleti() })
    const bruno = await screen.findByRole('link', { name: /Bruno Prova/ })
    // La gara del 12 dicembre è futura (e non è nel suo storico): l'ultima è quella del 31 ottobre.
    await waitFor(() => expect(bruno).toHaveTextContent('Ricurvo · ultima gara 31 ott'))
    expect(screen.getByRole('link', { name: /Carla Zeta/ })).toHaveTextContent(
      'Compound · ultima gara 10 gen',
    )
    // Anna non ha gare: nessuna seconda riga.
    expect(screen.getByRole('link', { name: /Anna Alfa/ })).not.toHaveTextContent('ultima gara')
  })

  it('toccando un atleta si apre la sua scheda', async () => {
    await renderApp('/atleti', { servizio: conAtleti() })
    await userEvent.click(await screen.findByRole('link', { name: /Carla Zeta/ }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Carla Zeta' })).toBeInTheDocument()
  })
})

describe('scheda atleta', () => {
  it('record personali per prova e arco, con luogo, data e provvisorio', async () => {
    await renderApp('/atleti/id-bruno', { servizio: conAtleti() })
    const record = await screen.findByRole('region', { name: 'Record personali' })
    await waitFor(() => expect(within(record).getAllByRole('link')).toHaveLength(3))
    const righe = within(record)
      .getAllByRole('link')
      .map((l) => l.textContent ?? '')
    // 18 m: il migliore è quello del 2019 (560, solo storico); 25 m e 70 m dalle prove dei PDF.
    expect(righe).toHaveLength(3)
    expect(righe[0]).toContain('18 m · Ricurvo')
    expect(righe[0]).toContain('570') // la prova da 18 m del 25+18
    expect(righe[1]).toContain('25 m · Ricurvo')
    expect(righe[1]).toContain('530')
    expect(righe[2]).toContain('70 m · Ricurvo')
    expect(righe[2]).toContain('640')
    expect(righe[2]).toContain('provvisorio')
    expect(righe[0]).not.toContain('provvisorio')
  })

  it('storico: le gare dalla più recente, con totale e posizione', async () => {
    await renderApp('/atleti/id-bruno', { servizio: conAtleti() })
    const storico = await screen.findByRole('region', { name: 'Storico gare' })
    await waitFor(() => expect(within(storico).getAllByRole('link')).toHaveLength(4))
    const righe = within(storico)
      .getAllByRole('link')
      .map((l) => l.textContent ?? '')
    expect(righe).toHaveLength(4)
    expect(righe[0]).toContain('70 m · Gubbio (PG)')
    expect(righe[0]).toContain('640')
    expect(righe[0]).toContain('1° posto')
    expect(righe[1]).toContain('25+18 m · Gubbio (PG)')
    expect(righe[3]).toContain('18 m · Perugia (PG)')
    expect(righe[3]).toContain('2 feb 2019')
  })

  it('da una gara si apre la scheda della gara', async () => {
    await renderApp('/atleti/id-bruno', { servizio: conAtleti() })
    const storico = await screen.findByRole('region', { name: 'Storico gare' })
    await userEvent.click((await within(storico).findAllByRole('link'))[0]!)
    expect(await screen.findByText('Tipologia')).toBeInTheDocument()
  })

  it('un atleta senza gare mostra due righe che spiegano', async () => {
    await renderApp('/atleti/id-anna', { servizio: conAtleti() })
    expect(await screen.findByText('Nessun record per ora')).toBeInTheDocument()
    expect(screen.getByText('Nessuna gara per ora')).toBeInTheDocument()
  })

  it('atleta sconosciuto, senza accesso o non attivo: non trovato', async () => {
    for (const id of ['id-boh', 'id-senza', 'id-ex']) {
      const { unmount } = await renderApp(`/atleti/${id}`, { servizio: conAtleti() })
      expect(await screen.findByText('Atleta non trovato')).toBeInTheDocument()
      unmount()
    }
  })

  it('si torna all’elenco', async () => {
    await renderApp('/atleti/id-bruno', { servizio: conAtleti() })
    await screen.findByRole('region', { name: 'Record personali' })
    const indietro = screen.getAllByRole('link', { name: 'Atleti' })[0]!
    expect(indietro).toHaveAttribute('href', '/atleti')
  })
})
