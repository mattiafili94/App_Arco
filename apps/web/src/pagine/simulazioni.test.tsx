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

const GIORNO = '2026-11-11'
const ripeti = (v: ValoreFreccia, n: number): ValoreFreccia[] => Array(n).fill(v)

/** Mette una simulazione sul telefono (come se fosse già stata iniziata). */
async function preparaSimulazione(dati: Partial<Simulazione> = {}): Promise<Simulazione> {
  const s: Simulazione = {
    id: nuovoId(),
    atleta_id: ATLETA.id,
    giorno: GIORNO,
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
const tasti = () =>
  within(screen.getByRole('group', { name: 'Valore della freccia' }))
    .getAllByRole('button')
    .map((b) => b.textContent)
const premi = (v: string) =>
  userEvent.click(
    within(screen.getByRole('group', { name: 'Valore della freccia' })).getByRole('button', {
      name: v,
    }),
  )

describe('nuova simulazione', () => {
  it('dal giorno: nessuna simulazione e il pulsante per iniziarne una', async () => {
    await renderApp(`/allenamento/${GIORNO}`, { servizio: servizioFinto().servizio })
    expect(await screen.findByText('Nessuna simulazione')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Nuova simulazione' }))
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Nuova simulazione' }),
    ).toBeInTheDocument()
  })

  it('indoor: bersaglio singolo o trispot, e come è fatta la gara', async () => {
    await renderApp(`/allenamento/${GIORNO}/nuova`, { servizio: servizioFinto().servizio })
    await screen.findByLabelText('Gara')
    const bersaglio = screen.getByRole('radiogroup', { name: 'Bersaglio' })
    expect(
      within(bersaglio)
        .getAllByRole('radio')
        .map((r) => r.textContent),
    ).toEqual(['Bersaglio singolo', 'Trispot'])
    expect(screen.queryByRole('radiogroup', { name: 'Distanza' })).not.toBeInTheDocument()
    expect(
      screen.getByText('60 frecce: 20 volée da 3 frecce, in due parziali da 30.'),
    ).toBeInTheDocument()
  })

  it('25+18: due prove', async () => {
    await renderApp(`/allenamento/${GIORNO}/nuova`, { servizio: servizioFinto().servizio })
    await userEvent.selectOptions(await screen.findByLabelText('Gara'), '25+18m')
    expect(
      screen.getByText(/120 frecce in 2 prove \(25 m e 18 m\), ognuna da 20 volée da 3 frecce/),
    ).toBeInTheDocument()
  })

  it('outdoor: distanza e bersaglio da 122 o 80 cm, volée da 6', async () => {
    await renderApp(`/allenamento/${GIORNO}/nuova`, { servizio: servizioFinto().servizio })
    await userEvent.selectOptions(await screen.findByLabelText('Gara'), '70m')
    const distanza = screen.getByRole('radiogroup', { name: 'Distanza' })
    expect(
      within(distanza)
        .getAllByRole('radio')
        .map((r) => r.textContent),
    ).toEqual(['70 m', '60 m', '50 m'])
    const bersaglio = screen.getByRole('radiogroup', { name: 'Bersaglio' })
    expect(
      within(bersaglio)
        .getAllByRole('radio')
        .map((r) => r.textContent),
    ).toEqual(['122 cm', '80 cm ridotto'])
    expect(
      screen.getByText('72 frecce: 12 volée da 6 frecce, in due parziali da 36.'),
    ).toBeInTheDocument()
  })

  it('"Inizia" crea la simulazione sul telefono e apre il segnapunti', async () => {
    await renderApp(`/allenamento/${GIORNO}/nuova`, { servizio: servizioFinto().servizio })
    await userEvent.selectOptions(await screen.findByLabelText('Gara'), '70m')
    await userEvent.click(screen.getByRole('radio', { name: '60 m' }))
    await userEvent.click(screen.getByRole('radio', { name: '80 cm ridotto' }))
    await userEvent.click(screen.getByRole('button', { name: 'Inizia' }))

    expect(
      await screen.findByRole('heading', { level: 1, name: '60 m · 80 cm ridotto' }),
    ).toBeInTheDocument()
    const salvate = await dbPredefinito().simulazioni.toArray()
    expect(salvate).toHaveLength(1)
    expect(salvate[0]).toMatchObject({
      atleta_id: ATLETA.id,
      giorno: GIORNO,
      formato: '70m',
      distanza: 60,
      bersaglio: '80',
      frecce: [],
      conclusa: false,
      eliminata: false,
    })
  })

  it('cambiando gara il bersaglio che non esiste torna al primo', async () => {
    await renderApp(`/allenamento/${GIORNO}/nuova`, { servizio: servizioFinto().servizio })
    await userEvent.click(await screen.findByRole('radio', { name: 'Trispot' }))
    await userEvent.selectOptions(screen.getByLabelText('Gara'), '70m')
    expect(screen.getByRole('radio', { name: '122 cm' })).toHaveAttribute('aria-checked', 'true')
  })

  it('un giorno sbagliato nell’indirizzo riporta all’Allenamento', async () => {
    await renderApp('/allenamento/boh/nuova', { servizio: servizioFinto().servizio })
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Allenamento' }),
    ).toBeInTheDocument()
  })
})

describe('il tastierino', () => {
  it('trispot indoor: 10, 9, 8, 7, 6 e M, niente X', async () => {
    await apri(await preparaSimulazione({ bersaglio: 'trispot' }))
    expect(tasti()).toEqual(['10', '9', '8', '7', '6', 'M'])
  })

  it('bersaglio singolo indoor: da 10 a 1 e M, niente X', async () => {
    await apri(await preparaSimulazione({ bersaglio: 'singolo' }))
    expect(tasti()).toEqual(['10', '9', '8', '7', '6', '5', '4', '3', '2', '1', 'M'])
  })

  it('outdoor 122 cm: X, da 10 a 1 e M', async () => {
    await apri(await preparaSimulazione({ formato: '70m', distanza: 70, bersaglio: '122' }))
    expect(tasti()).toEqual(['X', '10', '9', '8', '7', '6', '5', '4', '3', '2', '1', 'M'])
  })

  it('outdoor 80 cm ridotto: X, da 10 a 5 e M', async () => {
    await apri(await preparaSimulazione({ formato: '70m', distanza: 50, bersaglio: '80' }))
    expect(tasti()).toEqual(['X', '10', '9', '8', '7', '6', '5', 'M'])
  })

  it('ogni tocco segna una freccia e si salva sul telefono; la volée e il totale si aggiornano', async () => {
    const s = await preparaSimulazione()
    await apri(s)
    expect(screen.getByText('18 m · Volée 1 di 20')).toBeInTheDocument()
    await premi('10')
    await premi('9')
    expect(screen.getByText('Volée: 19 · Totale: 19 · 2 frecce su 60')).toBeInTheDocument()
    await premi('M')
    expect((await leggiSimulazione(dbPredefinito(), s.id))?.frecce).toEqual(['10', '9', 'M'])
    // Finita la volée si passa alla successiva, ricordando il totale di quella appena tirata.
    await waitFor(() => expect(screen.getByText('18 m · Volée 2 di 20')).toBeInTheDocument())
    expect(
      screen.getByText('Volée: 0 · Volée precedente: 19 · Totale: 19 · 3 frecce su 60'),
    ).toBeInTheDocument()
  })

  it('"Annulla ultima freccia" toglie l’ultima', async () => {
    const s = await preparaSimulazione({ frecce: ['10', '9'] })
    await apri(s)
    const annulla = screen.getByRole('button', { name: 'Annulla ultima freccia' })
    await userEvent.click(annulla)
    await waitFor(async () =>
      expect((await leggiSimulazione(dbPredefinito(), s.id))?.frecce).toEqual(['10']),
    )
    await userEvent.click(annulla)
    await waitFor(() => expect(annulla).toBeDisabled())
    expect((await leggiSimulazione(dbPredefinito(), s.id))?.frecce).toEqual([])
  })

  it('correggere una freccia: si tocca, si sceglie il valore giusto, si torna a segnare in fondo', async () => {
    const s = await preparaSimulazione({ frecce: ['10', '9', '8', '7'] })
    await apri(s)
    // La freccia 2 della volée 1 (un 9).
    await userEvent.click(
      screen.getAllByRole('button', {
        name: 'Freccia 2 della volée 1: 9. Tocca per correggere.',
      })[0]!,
    )
    expect(
      await screen.findByText(/Correggi la freccia 2: tocca il valore giusto\./),
    ).toBeInTheDocument()
    await premi('M')
    await waitFor(async () =>
      expect((await leggiSimulazione(dbPredefinito(), s.id))?.frecce).toEqual([
        '10',
        'M',
        '8',
        '7',
      ]),
    )
    expect(screen.queryByText(/Correggi la freccia/)).not.toBeInTheDocument()
    // Il tocco dopo la correzione aggiunge una freccia nuova.
    await premi('10')
    await waitFor(async () =>
      expect((await leggiSimulazione(dbPredefinito(), s.id))?.frecce).toHaveLength(5),
    )
  })

  it('si può rinunciare alla correzione', async () => {
    await apri(await preparaSimulazione({ frecce: ['10', '9'] }))
    await userEvent.click(
      screen.getAllByRole('button', { name: /Freccia 1 della volée 1: 10/ })[0]!,
    )
    await userEvent.click(await screen.findByRole('button', { name: 'Annulla la correzione' }))
    expect(screen.queryByText(/Correggi la freccia/)).not.toBeInTheDocument()
  })
})

describe('volée, prove e riepilogo', () => {
  it('il riepilogo: punteggio, parziali, conteggi 10 e 9 all’indoor, media', async () => {
    await apri(await preparaSimulazione({ frecce: ['10', '10', '9', '8', 'M', '10'] }))
    const riepilogo = screen.getByRole('region', { name: 'Riepilogo' })
    expect(within(riepilogo).getByText('Punteggio')).toBeInTheDocument()
    expect(riepilogo).toHaveTextContent('47')
    expect(riepilogo).toHaveTextContent('Parziali 47 + 0')
    expect(riepilogo).toHaveTextContent('10 e 9')
    expect(riepilogo).toHaveTextContent('3 · 1')
    expect(riepilogo).toHaveTextContent('Media per freccia')
    expect(riepilogo).toHaveTextContent('7,8')
  })

  it('l’elenco delle volée con totale e progressivo', async () => {
    await apri(await preparaSimulazione({ frecce: ['10', '10', '9', '8', 'M', '10'] }))
    const tabella = screen.getByRole('table')
    const righe = within(tabella).getAllByRole('row').slice(1)
    expect(righe).toHaveLength(2)
    expect(righe[0]).toHaveTextContent('1')
    expect(righe[0]).toHaveTextContent('29') // 10+10+9
    expect(righe[1]).toHaveTextContent('18') // 8+0+10, progressivo 47
    expect(righe[1]).toHaveTextContent('47')
  })

  it('outdoor: X e 10 si contano insieme (10+X) e gli X da soli; volée da 6', async () => {
    await apri(
      await preparaSimulazione({
        formato: '70m',
        distanza: 70,
        bersaglio: '122',
        frecce: ['X', 'X', '10', '9', '9', 'M', 'X'],
      }),
    )
    expect(screen.getByText('70 m · Volée 2 di 12')).toBeInTheDocument()
    const riepilogo = screen.getByRole('region', { name: 'Riepilogo' })
    expect(riepilogo).toHaveTextContent('10+X e X')
    expect(riepilogo).toHaveTextContent('4 · 3')
    expect(riepilogo).toHaveTextContent('58')
  })

  it('25+18: finita la prima prova si passa ai 18 m, e il riepilogo ha le due prove', async () => {
    await apri(
      await preparaSimulazione({
        formato: '25+18m',
        bersaglio: 'singolo',
        frecce: [...ripeti('10', 60), '9'],
      }),
    )
    expect(screen.getByText('Prova 2 di 2 · 18 m · Volée 1 di 20')).toBeInTheDocument()
    const riepilogo = screen.getByRole('region', { name: 'Riepilogo' })
    expect(riepilogo).toHaveTextContent('Prova 1 · 25 m')
    expect(riepilogo).toHaveTextContent('600')
    expect(riepilogo).toHaveTextContent('Prova 2 · 18 m')
    expect(riepilogo).toHaveTextContent('Totale')
    expect(riepilogo).toHaveTextContent('609')
  })

  it('finita la gara: tastierino bloccato, solo correzioni; la simulazione risulta conclusa', async () => {
    const s = await preparaSimulazione({ frecce: ripeti('10', 59) })
    await apri(s)
    await premi('10')
    expect(await screen.findByText('Tutte le frecce sono state segnate')).toBeInTheDocument()
    await waitFor(async () =>
      expect((await leggiSimulazione(dbPredefinito(), s.id))?.conclusa).toBe(true),
    )
    for (const tasto of within(
      screen.getByRole('group', { name: 'Valore della freccia' }),
    ).getAllByRole('button')) {
      expect(tasto).toBeDisabled()
    }
    expect(screen.getByRole('region', { name: 'Riepilogo' })).toHaveTextContent('600')
    // Le correzioni restano possibili.
    await userEvent.click(screen.getAllByRole('button', { name: /Freccia 3 della volée 20/ })[0]!)
    await premi('9')
    await waitFor(async () =>
      expect((await leggiSimulazione(dbPredefinito(), s.id))?.frecce[59]).toBe('9'),
    )
  })
})

describe('simulazioni nel giorno e nella settimana', () => {
  it('il giorno elenca le simulazioni, con punteggio e avanzamento, e somma le frecce', async () => {
    await preparaSimulazione({ frecce: ripeti('9', 12) })
    await preparaSimulazione({
      formato: '70m',
      distanza: 70,
      bersaglio: '122',
      frecce: ripeti('10', 6),
      creata_il: '2026-11-11T09:00:00.000Z',
    })
    await dbPredefinito().allenamento_giorni.put({
      atleta_id: ATLETA.id,
      giorno: GIORNO,
      programma: '',
      fatto: false,
      frecce_libere: 100,
      nota: '',
      modificato_il: '2026-11-11T08:00:00.000Z',
    })
    await renderApp(`/allenamento/${GIORNO}`, { servizio: servizioFinto().servizio })
    const elenco = await screen.findByRole('region', { name: 'Simulazioni di gara' })
    const righe = await waitFor(() => {
      const r = within(elenco).getAllByRole('link')
      expect(r).toHaveLength(2)
      return r
    })
    // La più recente per prima.
    expect(righe[0]).toHaveTextContent('70 m · 122 cm')
    expect(righe[0]).toHaveTextContent('60')
    expect(righe[0]).toHaveTextContent('6 frecce di 72 · In corso')
    expect(righe[1]).toHaveTextContent('18 m · Trispot')
    expect(righe[1]).toHaveTextContent('108')
    // 100 libere + 12 + 6 in gara.
    expect(screen.getByText('118 frecce in tutto')).toBeInTheDocument()
  })

  it('la settimana: le frecce delle simulazioni sono "in gara", senza contare due volte', async () => {
    await preparaSimulazione({ frecce: ripeti('9', 60) })
    await dbPredefinito().allenamento_giorni.put({
      atleta_id: ATLETA.id,
      giorno: GIORNO,
      programma: '',
      fatto: false,
      frecce_libere: 100,
      nota: '',
      modificato_il: '2026-11-11T08:00:00.000Z',
    })
    await renderApp('/allenamento', { servizio: servizioFinto().servizio })
    const riepilogo = await screen.findByRole('region', { name: 'Riepilogo della settimana' })
    await waitFor(() => expect(riepilogo).toHaveTextContent('libere 100 · in gara 60'))
    expect(riepilogo).toHaveTextContent('160')
    expect(riepilogo).toHaveTextContent('1 su 7')
    const oggi = within(screen.getByRole('region', { name: 'Giorni' }))
      .getAllByRole('link')
      .find((l) => l.textContent?.includes('Oggi'))!
    expect(oggi).toHaveTextContent('160 frecce')
  })

  it('le simulazioni cancellate non compaiono né contano', async () => {
    await preparaSimulazione({ frecce: ripeti('9', 30), eliminata: true })
    await renderApp(`/allenamento/${GIORNO}`, { servizio: servizioFinto().servizio })
    expect(await screen.findByText('Nessuna simulazione')).toBeInTheDocument()
  })
})

describe('cancellare, inviare, indirizzi sbagliati', () => {
  it('"Elimina" chiede conferma, segna la simulazione cancellata e torna al giorno', async () => {
    const s = await preparaSimulazione({ frecce: ['10'] })
    await apri(s)
    await userEvent.click(screen.getByRole('button', { name: 'Elimina la simulazione' }))
    expect(screen.getByText(/verranno cancellate/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Elimina la simulazione' }))
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Mercoledì 11 nov' }),
    ).toBeInTheDocument()
    const salvata = (await leggiSimulazione(dbPredefinito(), s.id))!
    expect(salvata.eliminata).toBe(true)
    expect(await screen.findByText('Nessuna simulazione')).toBeInTheDocument()
  })

  it('si può rinunciare a eliminare', async () => {
    await apri(await preparaSimulazione())
    await userEvent.click(screen.getByRole('button', { name: 'Elimina la simulazione' }))
    await userEvent.click(screen.getByRole('button', { name: 'Annulla' }))
    expect(screen.queryByText(/verranno cancellate/)).not.toBeInTheDocument()
  })

  it('dopo un attimo le frecce arrivano al server, tutte insieme', async () => {
    const s = await preparaSimulazione()
    const finto = await apri(s)
    await premi('10')
    await premi('9')
    await waitFor(() => expect(finto.remoto.salvataggiSimulazioni.length).toBeGreaterThan(0), {
      timeout: 4000,
    })
    await waitFor(
      () =>
        expect(finto.remoto.righe.simulazioni[0]).toMatchObject({ id: s.id, frecce: ['10', '9'] }),
      { timeout: 4000 },
    )
  })

  it('una simulazione che non esiste, o è di un altro giorno', async () => {
    await renderApp(`/allenamento/${GIORNO}/simulazione/${nuovoId()}`, {
      servizio: servizioFinto().servizio,
    })
    expect(await screen.findByText('Simulazione non trovata')).toBeInTheDocument()
  })

  it('con il giorno sbagliato nell’indirizzo si apre comunque quella giusta', async () => {
    const s = await preparaSimulazione()
    await renderApp(`/allenamento/2026-11-01/simulazione/${s.id}`, {
      servizio: servizioFinto().servizio,
    })
    expect(
      await screen.findByRole('heading', { level: 1, name: '18 m · Trispot' }),
    ).toBeInTheDocument()
  })
})
