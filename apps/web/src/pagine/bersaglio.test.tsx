import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Simulazione, ValoreFreccia } from '@arco/shared'
import { BersaglioTocco } from '../componenti/BersaglioTocco'
import { leggiSimulazione, nuovoId } from '../allenamento/simulazioni'
import { dbPredefinito } from '../sync/db'
import { renderApp } from '../test/render'
import { ATLETA, servizioFinto } from '../test/servizioFinto'

// Oggi, per tutti i test: mercoledì 11 novembre 2026, ore 10 (solo la data è finta, i timer restano veri).
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 11, 10, 0))
  // Il bersaglio si disegna 250 px per 250 px (il suo viewBox dice quale zona del bersaglio occupa).
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    top: 0,
    width: 250,
    height: 250,
    right: 250,
    bottom: 250,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  })
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  localStorage.clear()
})

const bersaglio = () => screen.getByRole('img', { name: /Bersaglio/ })

/** Le coordinate dello schermo di un punto del bersaglio (dal viewBox del disegno, largo 250 px). */
const px = (x: number, y: number, el: Element = bersaglio()) => {
  const [mx, my, w, h] = el.getAttribute('viewBox')!.split(' ').map(Number) as [
    number,
    number,
    number,
    number,
  ]
  return { clientX: ((x - mx) / w) * 250, clientY: ((y - my) / h) * 250, pointerId: 1 }
}

describe('il bersaglio da toccare', () => {
  const costruisci = (bersaglioTipo: 'singolo' | 'trispot' | '122' | '80', compound = false) => {
    const onSegna = vi.fn()
    render(
      <BersaglioTocco
        bersaglio={bersaglioTipo}
        compound={compound}
        punti={[]}
        onSegna={onSegna}
        etichetta="Bersaglio di prova"
      />,
    )
    return onSegna
  }

  it('un tocco veloce segna il punto toccato, con il suo valore', () => {
    const onSegna = costruisci('122')
    fireEvent.pointerDown(bersaglio(), px(0, 0))
    fireEvent.pointerUp(bersaglio(), px(0, 0))
    expect(onSegna).toHaveBeenCalledWith([0, 0], 'X')
  })

  it('il valore dipende dal punto: anelli, X, mancata', () => {
    const onSegna = costruisci('122')
    for (const [x, y] of [
      [0.07, 0],
      [0.45, 0],
      [0, -0.95],
      [1.05, 0], // l'anello della mancata
    ] as const) {
      fireEvent.pointerDown(bersaglio(), px(x, y))
      fireEvent.pointerUp(bersaglio(), px(x, y))
    }
    expect(onSegna.mock.calls.map((c) => c[1])).toEqual(['10', '6', '1', 'M'])
  })

  it('tenendo premuto la lente mostra il valore; spostando il dito cambia; alzando lo segna', () => {
    const onSegna = costruisci('singolo')
    // Niente istruzioni scritte (Mattia, 11/11/2026).
    expect(screen.queryByText(/Tieni premuto/)).not.toBeInTheDocument()
    fireEvent.pointerDown(bersaglio(), px(0.05, 0))
    expect(screen.getByRole('img', { name: "Lente d'ingrandimento" })).toBeInTheDocument()
    expect(screen.getByText('10', { selector: 'p' })).toBeInTheDocument()
    expect(onSegna).not.toHaveBeenCalled()
    fireEvent.pointerMove(bersaglio(), px(0.45, 0))
    expect(screen.getByText('6', { selector: 'p' })).toBeInTheDocument()
    fireEvent.pointerUp(bersaglio(), px(0.45, 0))
    expect(onSegna).toHaveBeenCalledTimes(1)
    expect(onSegna).toHaveBeenCalledWith([0.45, 0], '6')
    // Alzato il dito la lente sparisce.
    expect(screen.queryByRole('img', { name: "Lente d'ingrandimento" })).not.toBeInTheDocument()
  })

  it('se il tocco viene interrotto (cancellato) non si segna niente', () => {
    const onSegna = costruisci('singolo')
    fireEvent.pointerDown(bersaglio(), px(0, 0))
    fireEvent.pointerCancel(bersaglio(), px(0, 0))
    fireEvent.pointerUp(bersaglio(), px(0, 0))
    expect(onSegna).not.toHaveBeenCalled()
  })

  it('un movimento senza il dito appoggiato non fa niente', () => {
    const onSegna = costruisci('singolo')
    fireEvent.pointerMove(bersaglio(), px(0.3, 0))
    fireEvent.pointerUp(bersaglio(), px(0.3, 0))
    expect(onSegna).not.toHaveBeenCalled()
  })

  it('un tocco fuori dall’anello della mancata non segna niente (si sta scorrendo la pagina)', () => {
    const onSegna = costruisci('singolo')
    // Angolo del disegno: fuori dal cerchio.
    fireEvent.pointerDown(bersaglio(), px(1.1, 1.1))
    fireEvent.pointerUp(bersaglio(), px(1.1, 1.1))
    expect(onSegna).not.toHaveBeenCalled()
    expect(screen.queryByRole('img', { name: "Lente d'ingrandimento" })).not.toBeInTheDocument()
  })

  it('trascinando il dito molto fuori, la freccia resta una mancata sul bordo, non un valore assurdo', () => {
    const onSegna = costruisci('singolo')
    fireEvent.pointerDown(bersaglio(), px(0.9, 0))
    fireEvent.pointerUp(bersaglio(), { clientX: 5000, clientY: -3000, pointerId: 1 })
    const [posizione, valore] = onSegna.mock.calls[0]!
    expect(valore).toBe('M')
    expect(Math.hypot(posizione[0], posizione[1])).toBeLessThanOrEqual(1.101)
  })

  it('attorno agli anelli c’è l’anello della mancata, largo come un anello', () => {
    costruisci('trispot')
    const cerchi = [...bersaglio().querySelectorAll('circle')].map((c) =>
      Number(c.getAttribute('r')),
    )
    // Trispot: 5 anelli larghi 0,2; la mancata arriva a 1,2.
    expect(Math.max(...cerchi)).toBeCloseTo(1.2)
  })

  it('compound indoor: il 10 è solo il centro; fuori dal centro vale 9', () => {
    const normale = costruisci('trispot', false)
    fireEvent.pointerDown(bersaglio(), px(0.15, 0))
    fireEvent.pointerUp(bersaglio(), px(0.15, 0))
    expect(normale).toHaveBeenCalledWith([0.15, 0], '10')
  })

  it('disabilitato (gara finita) o di sola lettura: non reagisce', () => {
    const onSegna = vi.fn()
    const { unmount } = render(
      <BersaglioTocco
        bersaglio="singolo"
        compound={false}
        punti={[]}
        onSegna={onSegna}
        disabilitato
        etichetta="Bersaglio A"
      />,
    )
    fireEvent.pointerDown(screen.getByRole('img', { name: 'Bersaglio A' }), px(0, 0))
    fireEvent.pointerUp(screen.getByRole('img', { name: 'Bersaglio A' }), px(0, 0))
    expect(onSegna).not.toHaveBeenCalled()
    unmount()
    render(
      <BersaglioTocco bersaglio="singolo" compound={false} punti={[]} etichetta="Bersaglio B" />,
    )
    // Di sola lettura: nessuna lente e nessuna scritta.
    expect(screen.queryByText(/frecce segnate/)).not.toBeInTheDocument()
    fireEvent.pointerDown(screen.getByRole('img', { name: 'Bersaglio B' }), px(0, 0))
    expect(screen.queryByRole('img', { name: "Lente d'ingrandimento" })).not.toBeInTheDocument()
  })

  it('le frecce già segnate si vedono sul bersaglio, ognuna con il suo nome', () => {
    render(
      <BersaglioTocco
        bersaglio="singolo"
        compound={false}
        punti={[
          { posizione: [0.1, 0.1], etichetta: 'Freccia 1: 9', stato: 'volee' },
          { posizione: [-0.3, 0.2], etichetta: 'Freccia 2: 7', stato: 'prima' },
          { posizione: [0, 0], etichetta: 'Freccia 3 da correggere', stato: 'scelta' },
        ]}
        etichetta="Con frecce"
      />,
    )
    expect(screen.getByText('Freccia 1: 9')).toBeInTheDocument()
    expect(screen.getByText('Freccia 2: 7')).toBeInTheDocument()
    expect(screen.getByText('Freccia 3 da correggere')).toBeInTheDocument()
  })
})

// --- Nella pagina del segnapunti ------------------------------------------------------------------------------

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
  await screen.findByRole('radiogroup', { name: 'Come segni le frecce' })
  return finto
}
const passaAlBersaglio = async () => {
  await userEvent.click(screen.getByRole('radio', { name: 'Bersaglio' }))
  await screen.findByRole('img', { name: /Bersaglio: tocca/ })
}
const tocca = (x: number, y: number) => {
  const b = screen.getByRole('img', { name: /Bersaglio: tocca/ })
  fireEvent.pointerDown(b, px(x, y, b))
  fireEvent.pointerUp(b, px(x, y, b))
}

describe('segnare toccando il bersaglio, nella pagina', () => {
  it('di base c’è il tastierino; si passa al bersaglio e il telefono si ricorda la scelta', async () => {
    const s = await preparaSimulazione()
    const { unmount } = render(<></>)
    unmount()
    await apri(s)
    expect(screen.getByRole('group', { name: 'Valore della freccia' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Tastierino' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    await passaAlBersaglio()
    expect(screen.queryByRole('group', { name: 'Valore della freccia' })).not.toBeInTheDocument()
    expect(localStorage.getItem('arco.segnapunti.modo')).toBe('bersaglio')
  })

  it('con la scelta già fatta in precedenza la pagina si apre sul bersaglio', async () => {
    localStorage.setItem('arco.segnapunti.modo', 'bersaglio')
    await apri(await preparaSimulazione())
    expect(await screen.findByRole('img', { name: /Bersaglio: tocca/ })).toBeInTheDocument()
  })

  it('se il telefono non ricorda le scelte (finestra privata) funziona lo stesso', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('negato')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('negato')
    })
    await apri(await preparaSimulazione())
    await passaAlBersaglio()
    expect(screen.getByRole('radio', { name: 'Bersaglio' })).toHaveAttribute('aria-checked', 'true')
  })

  it('il tocco segna valore e posizione, si salvano sul telefono e il totale si aggiorna', async () => {
    const s = await preparaSimulazione()
    await apri(s)
    await passaAlBersaglio()
    tocca(0.05, 0) // trispot: 10
    tocca(0.3, 0) // 9
    await waitFor(async () => {
      const salvata = await leggiSimulazione(dbPredefinito(), s.id)
      expect(salvata?.frecce).toEqual(['10', '9'])
      expect(salvata?.posizioni).toEqual([
        [0.05, 0],
        [0.3, 0],
      ])
    })
    expect(await screen.findByText(/Totale: 19 · 2 frecce su 60/)).toBeInTheDocument()
    // Le frecce segnate compaiono sul bersaglio.
    // (compaiono sul bersaglio da toccare e anche in quello del riepilogo)
    expect(screen.getAllByText('Freccia 1: 10').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Freccia 2: 9').length).toBeGreaterThan(0)
  })

  it('compound: lo stesso tocco vicino al centro vale 9 invece di 10', async () => {
    const s = await preparaSimulazione({ compound: true })
    await apri(s)
    await passaAlBersaglio()
    tocca(0.15, 0) // per un ricurvo sarebbe un 10
    await waitFor(async () =>
      expect((await leggiSimulazione(dbPredefinito(), s.id))?.frecce).toEqual(['9']),
    )
  })

  it('outdoor: toccando il centro si segna la X', async () => {
    const s = await preparaSimulazione({ formato: '70m', distanza: 70, bersaglio: '122' })
    await apri(s)
    await passaAlBersaglio()
    tocca(0, 0)
    await waitFor(async () =>
      expect((await leggiSimulazione(dbPredefinito(), s.id))?.frecce).toEqual(['X']),
    )
  })

  it('si può correggere una freccia toccando di nuovo il bersaglio; la posizione cambia', async () => {
    const s = await preparaSimulazione({
      frecce: ['10', '9'],
      posizioni: [
        [0.05, 0],
        [0.3, 0],
      ],
    })
    await apri(s)
    await passaAlBersaglio()
    await userEvent.click(
      screen.getAllByRole('button', {
        name: 'Freccia 2 della volée 1: 9. Tocca per correggere.',
      })[0]!,
    )
    expect(await screen.findByText(/Correggi la freccia 2/)).toBeInTheDocument()
    expect(screen.getByText('Freccia 2 da correggere')).toBeInTheDocument()
    tocca(0.55, 0) // sul trispot gli anelli sono larghi 0,2: a 0,55 c'è l'8
    await waitFor(async () => {
      const salvata = await leggiSimulazione(dbPredefinito(), s.id)
      expect(salvata?.frecce).toEqual(['10', '8'])
      expect(salvata?.posizioni).toEqual([
        [0.05, 0],
        [0.55, 0],
      ])
    })
  })

  it('una freccia segnata col tastierino non ha posizione; mischiare i due modi va bene', async () => {
    const s = await preparaSimulazione({ frecce: ['10'], posizioni: [[0.05, 0]] })
    await apri(s)
    await userEvent.click(
      within(screen.getByRole('group', { name: 'Valore della freccia' })).getByRole('button', {
        name: '9',
      }),
    )
    await waitFor(async () => {
      const salvata = await leggiSimulazione(dbPredefinito(), s.id)
      expect(salvata?.frecce).toEqual(['10', '9'])
      expect(salvata?.posizioni).toEqual([[0.05, 0], null])
    })
  })

  it('"Annulla ultima freccia" toglie anche la posizione', async () => {
    const s = await preparaSimulazione({
      frecce: ['10', '9'],
      posizioni: [
        [0.05, 0],
        [0.3, 0],
      ],
    })
    await apri(s)
    await userEvent.click(screen.getByRole('button', { name: 'Annulla ultima freccia' }))
    await waitFor(async () => {
      const salvata = await leggiSimulazione(dbPredefinito(), s.id)
      expect(salvata?.frecce).toEqual(['10'])
      expect(salvata?.posizioni).toEqual([[0.05, 0]])
    })
  })

  it('a gara finita il bersaglio non segna più (restano le correzioni)', async () => {
    const s = await preparaSimulazione({ frecce: ripeti('10', 60) })
    await apri(s)
    await passaAlBersaglio()
    tocca(0.3, 0)
    expect((await leggiSimulazione(dbPredefinito(), s.id))?.frecce).toHaveLength(60)
    expect((await leggiSimulazione(dbPredefinito(), s.id))?.frecce.every((v) => v === '10')).toBe(
      true,
    )
  })

  it('il riepilogo mostra dove sono arrivate le frecce, solo se c’è la posizione', async () => {
    await apri(await preparaSimulazione({ frecce: ['10', '9'], posizioni: [null, null] }))
    expect(screen.queryByRole('region', { name: /Dove sono arrivate/ })).not.toBeInTheDocument()
  })

  it('con le posizioni, il riepilogo ha il suo bersaglio di sola lettura', async () => {
    await apri(
      await preparaSimulazione({
        frecce: ['10', '9'],
        posizioni: [
          [0.05, 0],
          [0.3, 0.1],
        ],
      }),
    )
    const mappa = screen.getByRole('region', { name: 'Dove sono arrivate le frecce' })
    expect(within(mappa).getByRole('img', { name: 'Bersaglio con 2 frecce' })).toBeInTheDocument()
  })

  it('25+18: una mappa per ogni prova, solo con le sue frecce', async () => {
    await apri(
      await preparaSimulazione({
        formato: '25+18m',
        bersaglio: 'singolo',
        frecce: [...ripeti('9', 60), '10', '8'],
        posizioni: [...Array<null>(60).fill(null), [0.05, 0], [0.25, 0]],
      }),
    )
    // La prima prova non ha posizioni: c'è solo la mappa della seconda.
    expect(screen.queryByRole('region', { name: /prova 1/ })).not.toBeInTheDocument()
    const mappa = screen.getByRole('region', { name: /prova 2/ })
    expect(within(mappa).getByRole('img', { name: 'Bersaglio con 2 frecce' })).toBeInTheDocument()
  })
})

describe('scelta dell’arco compound nella nuova simulazione', () => {
  const nuova = async () => {
    await renderApp('/allenamento/2026-11-11/nuova', { servizio: servizioFinto().servizio })
    await screen.findByLabelText('Gara')
  }

  it('solo all’indoor c’è la casella del compound; la simulazione se la ricorda', async () => {
    await nuova()
    const casella = screen.getByRole('checkbox', { name: /Arco compound/ })
    expect(casella).not.toBeChecked()
    await userEvent.click(casella)
    await userEvent.click(screen.getByRole('button', { name: 'Inizia' }))
    await screen.findByRole('radiogroup', { name: 'Come segni le frecce' })
    const salvate = await dbPredefinito().simulazioni.toArray()
    expect(salvate.find((x) => x.formato === '18m')).toMatchObject({
      compound: true,
      posizioni: [],
    })
  })

  it('all’outdoor la casella non c’è e compound resta falso', async () => {
    await nuova()
    await userEvent.selectOptions(screen.getByLabelText('Gara'), '70m')
    expect(screen.queryByRole('checkbox', { name: /Arco compound/ })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Inizia' }))
    await screen.findByRole('radiogroup', { name: 'Come segni le frecce' })
    const salvate = await dbPredefinito().simulazioni.toArray()
    expect(salvate.find((x) => x.formato === '70m')).toMatchObject({ compound: false })
  })
})

describe('com’è fatta la pagina della simulazione', () => {
  it('titolo con la sola gara e "Avvia timer" accanto; poi elenco delle volée, riepilogo e in fondo il bersaglio', async () => {
    await apri(
      await preparaSimulazione({
        frecce: ['10', '9', '8'],
        posizioni: [
          [0, 0],
          [0.15, 0],
          [0.3, 0],
        ],
      }),
    )
    expect(screen.getByRole('heading', { level: 1, name: '18 m' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Avvia timer' }).closest('header')).not.toBeNull()
    expect(screen.queryByText(/facoltativ/i)).not.toBeInTheDocument()

    const elenco = screen.getByRole('region', { name: 'Tutte le volée' })
    const riepilogo = screen.getByRole('region', { name: 'Riepilogo' })
    const mappa = screen.getByRole('region', { name: 'Dove sono arrivate le frecce' })
    const dopo = (a: Element, b: Element) =>
      Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)
    expect(dopo(elenco, riepilogo)).toBe(true)
    expect(dopo(riepilogo, mappa)).toBe(true)
  })
})
