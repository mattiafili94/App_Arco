import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GraficoAndamento } from '../componenti/GraficoAndamento'
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

describe('scheda atleta: i pulsanti delle prove', () => {
  it('un pulsante per ogni prova con il suo arco, nell’ordine dei record, e "Tutte le gare"', async () => {
    await renderApp('/atleti/id-bruno', { servizio: conAtleti() })
    const prove = await screen.findByRole('navigation', { name: 'Prove' })
    await waitFor(() => expect(within(prove).getAllByRole('link')).toHaveLength(3))
    const link = within(prove).getAllByRole('link')
    expect(link.map((l) => l.textContent)).toEqual([
      '18 m · Ricurvo',
      '25 m · Ricurvo',
      '70 m · Ricurvo',
    ])
    expect(link[0]).toHaveAttribute(
      'href',
      `/atleti/id-bruno/prova/${encodeURIComponent('indoor:18m|OL')}`,
    )
    expect(screen.getByRole('link', { name: 'Tutte le gare' })).toHaveAttribute(
      'href',
      '/atleti/id-bruno/gare',
    )
    // Niente più record e storico in questa schermata.
    expect(screen.queryByRole('region', { name: 'Record personali' })).not.toBeInTheDocument()
  })

  it('un atleta senza punteggi: lo dice, e resta "Tutte le gare"', async () => {
    await renderApp('/atleti/id-anna', { servizio: conAtleti() })
    expect(await screen.findByText('Nessun punteggio per ora')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Tutte le gare' })).toBeInTheDocument()
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
    await screen.findByRole('navigation', { name: 'Prove' })
    expect(screen.getAllByRole('link', { name: 'Atleti' })[0]).toHaveAttribute('href', '/atleti')
  })
})

describe('pagina di una prova', () => {
  const PROVA_18 = `/atleti/id-bruno/prova/${encodeURIComponent('indoor:18m|OL')}`

  /** Apre la prova dei 18 m e aspetta che ci siano tutti i dati (storico e classifiche dei PDF). */
  const apriProva18 = async () => {
    await renderApp(PROVA_18, { servizio: conAtleti() })
    const record = await screen.findByRole('region', { name: 'Record personale' })
    await waitFor(() => expect(record).toHaveTextContent('570'))
    await waitFor(() =>
      expect(screen.getByRole('region', { name: 'Media per anno' })).toHaveTextContent('2 gare'),
    )
  }

  /** Come `remotoConAtleti`, più una seconda gara da 70 m: la serie dei 70 m ha due punteggi. */
  function conDueSettanta() {
    const remoto = remotoConAtleti()
    remoto.scrivi('gare', gara('G6', '2026-09-01', '70/60mt Round - 50mt Round'))
    remoto.scrivi('partecipazioni', part(ATLETA.id, 'G6', { totale: 650, posizione: 1 }))
    remoto.scrivi('classifiche', {
      ...(remoto.righe.classifiche[2] as Record<string, unknown>),
      gara_codice: 'G6',
      totale: 650,
      provvisoria: false,
    })
    return servizioFinto({ remoto }).servizio
  }

  it('dalla scheda si apre la prova: titolo, atleta e record personale', async () => {
    await renderApp('/atleti/id-bruno', { servizio: conAtleti() })
    const prove = await screen.findByRole('navigation', { name: 'Prove' })
    await userEvent.click(await within(prove).findByRole('link', { name: '18 m · Ricurvo' }))
    expect(
      await screen.findByRole('heading', { level: 1, name: '18 m · Ricurvo' }),
    ).toBeInTheDocument()
    const record = screen.getByRole('region', { name: 'Record personale' })
    // 18 m: 560 nel 2019 (solo storico), 540 a gennaio, 570 a marzo (la prova da 18 m del 25+18).
    await waitFor(() => expect(record).toHaveTextContent('570'))
    expect(record).toHaveTextContent('Gubbio (PG)')
    expect(record).toHaveTextContent('gara 25+18 m')
    expect(screen.getAllByRole('link', { name: 'Bruno Prova' })[0]).toHaveAttribute(
      'href',
      '/atleti/id-bruno',
    )
  })

  it('andamento: di base l’anno in corso; con la tendina si sceglie anche tutta la carriera', async () => {
    await apriProva18()
    const sezione = await screen.findByRole('region', { name: 'Andamento' })
    await waitFor(() =>
      expect(within(sezione).getAllByRole('button', { name: /punti, / })).toHaveLength(2),
    )
    expect(within(sezione).getByText('2026', { selector: 'summary span' })).toBeInTheDocument()
    expect(sezione).toHaveTextContent('570 · Gubbio (PG) · 14 mar 2026')

    await userEvent.click(within(sezione).getByText('2026', { selector: 'summary span' }))
    await userEvent.click(within(sezione).getByRole('checkbox', { name: 'Tutta la carriera' }))
    expect(within(sezione).getAllByRole('button', { name: /punti, / })).toHaveLength(3)
    expect(within(sezione).getByRole('checkbox', { name: '2026' })).not.toBeChecked()

    // Due anni insieme: si spunta il 2019, poi il 2026.
    await userEvent.click(within(sezione).getByRole('checkbox', { name: '2019' }))
    expect(within(sezione).getAllByRole('button', { name: /punti, / })).toHaveLength(1)
    await userEvent.click(within(sezione).getByRole('checkbox', { name: '2026' }))
    expect(within(sezione).getAllByRole('button', { name: /punti, / })).toHaveLength(3)
    expect(within(sezione).getByText('2019, 2026', { selector: 'summary span' })).toBeVisible()
  })

  it('togliendo tutti gli anni si torna a tutta la carriera', async () => {
    await apriProva18()
    const sezione = await screen.findByRole('region', { name: 'Andamento' })
    await userEvent.click(await within(sezione).findByText('2026', { selector: 'summary span' }))
    await userEvent.click(within(sezione).getByRole('checkbox', { name: '2026' }))
    expect(within(sezione).getByRole('checkbox', { name: 'Tutta la carriera' })).toBeChecked()
    expect(within(sezione).getAllByRole('button', { name: /punti, / })).toHaveLength(3)
  })

  it('la tabella ha gli stessi punteggi del grafico', async () => {
    await apriProva18()
    const sezione = await screen.findByRole('region', { name: 'Andamento' })
    await userEvent.click(await within(sezione).findByText('Mostra come tabella'))
    const tabella = within(sezione).getByRole('table', { name: 'Punteggi 18 m · Ricurvo' })
    expect(
      within(tabella)
        .getAllByRole('row')
        .slice(1)
        .map((r) => r.textContent),
    ).toEqual(['10 gen 2026Gubbio (PG)540', '14 mar 2026Gubbio (PG)570'])
  })

  it('media per anno e storico della prova anno per anno', async () => {
    await apriProva18()
    const medie = await screen.findByRole('region', { name: 'Media per anno' })
    // Si aspetta che arrivino tutti i dati (le classifiche dei PDF possono arrivare dopo lo storico).
    await waitFor(() =>
      expect(
        within(medie)
          .getAllByText(/gar[ae]$/)
          .map((r) => r.textContent),
      ).toEqual(['2 gare', '1 gara']),
    )
    expect(medie).toHaveTextContent('555')
    const anno2026 = screen.getByRole('region', { name: 'Gare del 2026' })
    const righe = within(anno2026)
      .getAllByRole('link')
      .map((l) => l.textContent ?? '')
    expect(righe).toHaveLength(2)
    expect(righe[0]).toContain('570')
    expect(righe[0]).toContain('gara 25+18 m')
    expect(righe[1]).toContain('540')
    expect(screen.getByRole('region', { name: 'Gare del 2019' })).toHaveTextContent('Perugia (PG)')
  })

  it('un solo punteggio: record e storico sì, andamento no', async () => {
    await renderApp(`/atleti/id-bruno/prova/${encodeURIComponent('indoor:25m|OL')}`, {
      servizio: conAtleti(),
    })
    expect(await screen.findByRole('region', { name: 'Record personale' })).toHaveTextContent('530')
    expect(screen.queryByRole('region', { name: 'Andamento' })).not.toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Gare del 2026' })).toBeInTheDocument()
  })

  it('il punto provvisorio è segnalato', async () => {
    await renderApp(`/atleti/id-bruno/prova/${encodeURIComponent('outdoor:70m|OL')}`, {
      servizio: conDueSettanta(),
    })
    const sezione = await screen.findByRole('region', { name: 'Andamento' })
    await userEvent.click(
      await within(sezione).findByRole('button', { name: /^640 punti.*provvisorio/ }),
    )
    expect(sezione).toHaveTextContent('640 · Gubbio (PG) · 31 ott 2026 · provvisorio')
    expect(screen.getByRole('region', { name: 'Media per anno' })).toHaveTextContent('645')
  })

  it('una prova che non c’è lo dice', async () => {
    await renderApp('/atleti/id-bruno/prova/boh', { servizio: conAtleti() })
    expect(await screen.findByText('Prova non trovata')).toBeInTheDocument()
  })

  it('dalla gara del record la freccia torna alla prova, non al tab Gare', async () => {
    await apriProva18()
    const record = await screen.findByRole('region', { name: 'Record personale' })
    await userEvent.click(within(record).getByRole('link'))
    expect(await screen.findByText('Tipologia')).toBeInTheDocument()
    const indietro = screen.getByRole('link', { name: '18 m · Ricurvo' })
    expect(indietro).toHaveAttribute('href', PROVA_18)
    await userEvent.click(indietro)
    expect(
      await screen.findByRole('heading', { level: 1, name: '18 m · Ricurvo' }),
    ).toBeInTheDocument()
  })
})

describe('tutte le gare dell’atleta', () => {
  it('anno per anno, dalla più recente, con totale e posizione', async () => {
    await renderApp('/atleti/id-bruno/gare', { servizio: conAtleti() })
    const anno2026 = await screen.findByRole('region', { name: '2026' })
    await waitFor(() => expect(within(anno2026).getAllByRole('link')).toHaveLength(3))
    const righe = within(anno2026)
      .getAllByRole('link')
      .map((l) => l.textContent ?? '')
    expect(righe[0]).toContain('70 m · Gubbio (PG)')
    expect(righe[0]).toContain('1° posto')
    expect(righe[1]).toContain('25+18 m · Gubbio (PG)')
    expect(screen.getByRole('region', { name: '2019' })).toHaveTextContent('2 feb 2019')
  })

  it('dalla gara si torna a "Tutte le gare"', async () => {
    await renderApp('/atleti/id-bruno/gare', { servizio: conAtleti() })
    const anno2026 = await screen.findByRole('region', { name: '2026' })
    await userEvent.click((await within(anno2026).findAllByRole('link'))[0]!)
    expect(await screen.findByText('Tipologia')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Tutte le gare' })).toHaveAttribute(
      'href',
      '/atleti/id-bruno/gare',
    )
  })

  it('senza gare lo dice', async () => {
    await renderApp('/atleti/id-anna/gare', { servizio: conAtleti() })
    expect(await screen.findByText('Nessuna gara per ora')).toBeInTheDocument()
  })
})

describe('scheda gara aperta da sola', () => {
  it('senza una pagina da cui si arriva, la freccia torna al tab Gare', async () => {
    await renderApp('/gare/G1', { servizio: conAtleti() })
    expect(await screen.findByText('Tipologia')).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Gare' })[0]).toHaveAttribute('href', '/gare')
  })
})

describe('GraficoAndamento', () => {
  it('due punteggi nello stesso giorno: il grafico si disegna lo stesso', () => {
    render(
      <GraficoAndamento
        titolo="Prova"
        punti={[
          { id: 'a', data: '2026-01-10', valore: 540, descrizione: 'Gubbio', provvisorio: false },
          {
            id: 'b',
            data: '2026-01-10',
            valore: 540,
            descrizione: 'Gubbio bis',
            provvisorio: true,
          },
        ]}
      />,
    )
    expect(screen.getAllByRole('button')).toHaveLength(2)
    expect(screen.getByRole('group', { name: 'Prova' })).toBeInTheDocument()
  })
})
