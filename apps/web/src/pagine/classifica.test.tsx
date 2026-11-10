import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ClassificaRanking, RigaClassificaRanking } from '@arco/shared'
import { Scelte } from '../componenti/Scelte'
import { Select } from '../componenti/Select'
import { dbPredefinito } from '../sync/db'
import { renderApp } from '../test/render'
import { ATLETA, servizioFinto } from '../test/servizioFinto'

// Oggi, per tutti i test: 10 novembre 2026, ore 15 (solo la data è finta, i timer restano veri).
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 10, 15, 0))
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

const LETTA = new Date(2026, 10, 10, 10, 12).toISOString()

const riga = (
  posizione: number,
  dati: Partial<RigaClassificaRanking> = {},
): RigaClassificaRanking => ({
  posizione,
  matricola: `m${posizione}`,
  nome: `Atleta${posizione} Cognome`,
  // Ogni terzo atleta è dell'Umbria, e ogni quinto è della nostra società.
  societa_codice: posizione % 5 === 0 ? '11003' : posizione % 3 === 0 ? '11018' : '05001',
  societa_nome:
    posizione % 5 === 0
      ? 'Compagnia Arcieri Eugubini'
      : posizione % 3 === 0
        ? 'Augusta Perusia'
        : 'Del Nord',
  punti: 1200 - posizione,
  gare: [
    {
      codice: 'G1',
      punti: 600 - posizione,
      localita: 'Terni (TR)',
      dal: '2026-03-14',
      al: '2026-03-15',
    },
    { codice: 'G2', punti: 600, localita: 'Roma (RM)', dal: '2026-02-26', al: '2026-03-01' },
  ],
  ...dati,
})

/** 120 atleti: Mario Rossi al 7° posto, e Bruno (tu, matricola 900002) al 60°. */
function classificaIndoor(): ClassificaRanking {
  const righe = Array.from({ length: 120 }, (_, i) => riga(i + 1))
  righe[6] = riga(7, { matricola: '900099', nome: 'Rossi Mario' })
  righe[59] = riga(60, {
    matricola: ATLETA.matricola,
    nome: 'Prova Bruno',
    societa_codice: '11003',
  })
  return {
    tipo: 'I',
    divisione: 'OL',
    classe: 'S',
    genere: 'M',
    categoria: 'Arco Ricurvo - Seniores Maschile',
    totale: 120,
    righe,
    letta_il: LETTA,
    aggiornato_il: LETTA,
  }
}

function classificaOutdoor(): ClassificaRanking {
  return {
    tipo: 'T',
    divisione: 'OL',
    classe: 'S',
    genere: 'M',
    categoria: 'Arco Ricurvo - Seniores Maschile',
    totale: 2,
    righe: [riga(1), riga(2, { matricola: ATLETA.matricola, nome: 'Prova Bruno' })],
    letta_il: LETTA,
    aggiornato_il: LETTA,
  }
}

function servizioConClassifiche(...classifiche: ClassificaRanking[]) {
  const finto = servizioFinto()
  classifiche.forEach((c) => finto.classifica.aggiungi(c))
  return finto
}

describe('tab Classifica', () => {
  it('senza classifiche scaricate dice cosa succede e offre comunque la ricerca', async () => {
    await renderApp('/classifica')
    expect(await screen.findByText('Non compari ancora in nessuna classifica')).toBeInTheDocument()
    expect(screen.getByLabelText('Tipo di gara')).toHaveValue('I')
    expect(screen.getByLabelText('Arco')).toHaveValue('OL')
    expect(screen.getByLabelText('Classe')).toHaveValue('S')
    expect(screen.getByLabelText('Genere')).toHaveValue('M')
  })

  it('in primo piano solo la tua posizione: titolo, posto, punti e le due gare', async () => {
    const { servizio } = servizioConClassifiche(classificaOutdoor(), classificaIndoor())
    await renderApp('/classifica', { servizio })
    const mia = await screen.findByRole('region', { name: 'La tua posizione' })
    const righe = await waitFor(() => {
      const l = within(mia).getAllByRole('link')
      expect(l).toHaveLength(2)
      return l
    })
    // Indoor prima di Outdoor.
    expect(righe[0]).toHaveTextContent('Indoor · Ricurvo · Senior M')
    expect(righe[0]).toHaveTextContent('60°')
    expect(righe[0]).toHaveTextContent('1.140 punti')
    expect(righe[0]).toHaveTextContent('Terni (TR) 540 · Roma (RM) 600')
    expect(righe[1]).toHaveTextContent('Outdoor · Ricurvo · Senior M')
    expect(righe[1]).toHaveTextContent('2°')
    expect(righe[0]).toHaveAttribute('href', '/classifica/I/OL/S/M?mia=1')
    // Mai le righe degli altri atleti in questa pagina.
    expect(screen.queryByText(/Rossi Mario/)).not.toBeInTheDocument()
    expect(await screen.findByText(/Dati letti da Fitarco oggi alle 10:12/)).toBeInTheDocument()
  })

  it('i filtri partono dalla tua classifica; "Mostra" apre quella scelta, con la regione', async () => {
    const finto = servizioConClassifiche(classificaOutdoor())
    finto.classifica.aggiungi({ ...classificaOutdoor(), divisione: 'CO', classe: 'J', genere: 'F' })
    await renderApp('/classifica', { servizio: finto.servizio })
    await waitFor(() => expect(screen.getByLabelText('Tipo di gara')).toHaveValue('T'))

    await userEvent.selectOptions(screen.getByLabelText('Arco'), 'CO')
    await userEvent.selectOptions(screen.getByLabelText('Classe'), 'J')
    await userEvent.selectOptions(screen.getByLabelText('Genere'), 'F')
    await userEvent.click(screen.getByRole('radio', { name: 'Umbria' }))
    await userEvent.click(screen.getByRole('button', { name: 'Mostra' }))

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Outdoor · Compound · Junior F' }),
    ).toBeInTheDocument()
    // La regione scelta passa alla pagina della classifica.
    expect(await screen.findByRole('radio', { name: 'Umbria' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
  })
})

describe('classifica completa', () => {
  const apri = async (
    percorso = '/classifica/I/OL/S/M',
    finto = servizioConClassifiche(classificaIndoor()),
  ) => {
    await renderApp(percorso, { servizio: finto.servizio })
    await screen.findByRole('heading', { level: 1, name: 'Indoor · Ricurvo · Senior M' })
    await screen.findByRole('region', { name: 'Classifica' })
    return finto
  }
  const nomiVisibili = () =>
    within(screen.getByRole('region', { name: 'Classifica' }))
      .getAllByText(/^\d+\. /)
      .map((e) =>
        // Solo il testo della riga (non la descrizione che sta dentro lo stesso elemento).
        [...e.childNodes]
          .filter((n) => n.nodeType === Node.TEXT_NODE)
          .map((n) => n.textContent)
          .join(''),
      )

  it('i primi 50 atleti, con punti, società e le due gare; poi "Mostra altri"', async () => {
    await apri()
    expect(screen.getByText(/120 atleti · letta da Fitarco oggi alle 10:12/)).toBeInTheDocument()
    expect(nomiVisibili()).toHaveLength(50)
    expect(nomiVisibili()[0]).toBe('1. Atleta1 Cognome')
    expect(screen.getByText('1.199')).toBeInTheDocument()
    expect(screen.getByText(/Del Nord · Terni \(TR\) 599 · Roma \(RM\) 600/)).toBeInTheDocument()
    expect(screen.getByText('Atleti da 1 a 50 su 120.')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Mostra altri 50' }))
    expect(nomiVisibili()).toHaveLength(100)
    await userEvent.click(screen.getByRole('button', { name: 'Mostra altri 20' }))
    expect(nomiVisibili()).toHaveLength(120)
    expect(screen.queryByRole('button', { name: /Mostra altri/ })).not.toBeInTheDocument()
  })

  it('la ricerca cerca nel nome e nella società e riparte dall’inizio', async () => {
    await apri()
    await userEvent.type(screen.getByLabelText('Cerca per nome o società'), 'rossi')
    expect(nomiVisibili()).toEqual(['7. Rossi Mario'])
    expect(screen.getByText('Atleti da 1 a 1 su 1.')).toBeInTheDocument()

    await userEvent.clear(screen.getByLabelText('Cerca per nome o società'))
    await userEvent.type(screen.getByLabelText('Cerca per nome o società'), 'zzzz')
    expect(await screen.findByText('Nessun atleta trovato')).toBeInTheDocument()
  })

  it('"Umbria" tiene le società umbre, con le posizioni nazionali', async () => {
    await apri()
    await userEvent.click(screen.getByRole('radio', { name: 'Umbria' }))
    const posizioni = nomiVisibili().map((n) => Number.parseInt(n, 10))
    expect(posizioni.slice(0, 4)).toEqual([3, 5, 6, 9]) // società 11018 (multipli di 3) e 11003 (di 5)
    expect(posizioni.every((p) => p % 3 === 0 || p % 5 === 0)).toBe(true)
    await userEvent.click(screen.getByRole('radio', { name: 'Tutta Italia' }))
    expect(nomiVisibili()[0]).toBe('1. Atleta1 Cognome')
  })

  it('dalla tua posizione la lista parte dal 1° e arriva fino a te e a 3 posti sotto di te', async () => {
    await apri('/classifica/I/OL/S/M?mia=1')
    // Tu sei il 60°: si vede dal 1° al 63°.
    expect(nomiVisibili()[0]).toBe('1. Atleta1 Cognome')
    expect(nomiVisibili().at(-1)).toBe('63. Atleta63 Cognome')
    const mia = screen.getByText('60. Prova Bruno · Tu')
    expect(mia.closest('div[class*="row"]')).toHaveTextContent('Della compagnia:')
    expect(screen.getByText('Atleti da 1 a 63 su 120.')).toBeInTheDocument()
    // Niente più "Torna all'inizio" né "Vai alla mia posizione": resta "Mostra altri".
    expect(screen.queryByRole('button', { name: /Torna all/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Vai alla mia posizione' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Mostra altri 50' }))
    expect(screen.getByText('Atleti da 1 a 113 su 120.')).toBeInTheDocument()
  })

  it('"Vai alla mia posizione" compare quando non sei in vista e allunga l’elenco fino a te', async () => {
    await apri()
    // Tra i primi 50 non ci sei (60°).
    await userEvent.click(screen.getByRole('button', { name: 'Vai alla mia posizione' }))
    expect(nomiVisibili()[0]).toBe('1. Atleta1 Cognome')
    expect(screen.getByText('60. Prova Bruno · Tu')).toBeInTheDocument()
    expect(screen.getByText('Atleti da 1 a 63 su 120.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Vai alla mia posizione' })).not.toBeInTheDocument()
  })

  it('classifica non ancora scaricata: si scarica con il pulsante', async () => {
    const finto = servizioFinto()
    finto.classifica.dopoAggiorna = () => classificaIndoor()
    await renderApp('/classifica/I/OL/S/M', { servizio: finto.servizio })
    expect(await screen.findByText('Questa classifica non è ancora scaricata')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Scarica da Fitarco' }))
    expect(await screen.findByRole('region', { name: 'Classifica' })).toBeInTheDocument()
    expect(screen.getByText('Classifica aggiornata: 120 atleti.')).toBeInTheDocument()
    expect(finto.classifica.aggiorna).toHaveBeenCalledTimes(1)
  })

  it('rifiuto del pulsante: spiega e dice quando riprovare', async () => {
    const finto = servizioConClassifiche(classificaIndoor())
    finto.classifica.rispostaAggiorna = {
      esito: 'troppo-presto',
      errore: 'Questa classifica è stata aggiornata da poco: si può rileggere ogni 6 ore.',
      riprovaDopo: new Date(2026, 10, 10, 16, 12).toISOString(),
    }
    await apri('/classifica/I/OL/S/M', finto)
    await userEvent.click(screen.getByRole('button', { name: 'Aggiorna' }))
    expect(await screen.findByText(/ogni 6 ore\. Riprova oggi alle 16:12\./)).toBeInTheDocument()
    expect(finto.classifica.aggiorna).toHaveBeenCalledWith({
      tipo: 'I',
      divisione: 'OL',
      classe: 'S',
      genere: 'M',
    })
  })

  it('aggiornamento riuscito: la lista mostra i dati nuovi', async () => {
    const finto = servizioConClassifiche(classificaIndoor())
    finto.classifica.dopoAggiorna = () => ({
      ...classificaIndoor(),
      totale: 121,
      righe: [...classificaIndoor().righe, riga(121)],
      aggiornato_il: new Date(2026, 10, 10, 14, 59).toISOString(),
    })
    await apri('/classifica/I/OL/S/M', finto)
    await userEvent.click(screen.getByRole('button', { name: 'Aggiorna' }))
    expect(await screen.findByText('Classifica aggiornata: 121 atleti.')).toBeInTheDocument()
    expect(await screen.findByText(/121 atleti · letta da Fitarco/)).toBeInTheDocument()
  })

  it('indirizzo con valori sbagliati: si torna al tab Classifica', async () => {
    await renderApp('/classifica/X/OL/S/M')
    expect(await screen.findByRole('heading', { level: 1, name: 'Classifica' })).toBeInTheDocument()
  })

  it('offline: si vede la copia salvata sul telefono, con l’avviso', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    await dbPredefinito().classifiche_ranking.put(
      classificaIndoor() as unknown as Record<string, unknown>,
    )
    const finto = servizioFinto()
    finto.classifica.rete = false
    await apri('/classifica/I/OL/S/M', finto)
    expect(screen.getByText(/Sei offline: vedi l’ultima copia/)).toBeInTheDocument()
    expect(nomiVisibili()).toHaveLength(50)
  })

  it('offline e mai aperta: non c’è niente da mostrare e lo dice', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    const finto = servizioFinto()
    finto.classifica.rete = false
    await renderApp('/classifica/T/CO/J/F', { servizio: finto.servizio })
    expect(await screen.findByText('Classifica non salvata sul telefono')).toBeInTheDocument()
  })

  it('server che non risponde, senza copia: errore', async () => {
    const finto = servizioFinto()
    finto.classifica.rete = false // online per il telefono, ma il server non risponde
    await renderApp('/classifica/T/CO/J/F', { servizio: finto.servizio })
    expect(
      await screen.findByText('Non riesco a leggere i dati. Riprova tra poco.'),
    ).toBeInTheDocument()
  })
})

describe('Select e Scelte', () => {
  it('Select: etichetta, valore attuale e cambio', async () => {
    const cambia = vi.fn()
    render(
      <Select
        label="Arco"
        valore="OL"
        opzioni={[
          { valore: 'OL', etichetta: 'Ricurvo' },
          { valore: 'CO', etichetta: 'Compound' },
        ]}
        onChange={cambia}
      />,
    )
    expect(screen.getByLabelText('Arco')).toHaveValue('OL')
    await userEvent.selectOptions(screen.getByLabelText('Arco'), 'CO')
    expect(cambia).toHaveBeenCalledWith('CO')
  })

  it('Scelte: gruppo con nome, una sola scelta attiva', async () => {
    const cambia = vi.fn()
    render(
      <Scelte
        label="Regione"
        valore="italia"
        opzioni={[
          { valore: 'italia', etichetta: 'Tutta Italia' },
          { valore: 'umbria', etichetta: 'Umbria' },
        ]}
        onChange={cambia}
      />,
    )
    const gruppo = screen.getByRole('radiogroup', { name: 'Regione' })
    expect(within(gruppo).getByRole('radio', { name: 'Tutta Italia' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    expect(within(gruppo).getByRole('radio', { name: 'Umbria' })).toHaveAttribute(
      'aria-checked',
      'false',
    )
    await userEvent.click(within(gruppo).getByRole('radio', { name: 'Umbria' }))
    expect(cambia).toHaveBeenCalledWith('umbria')
  })
})
