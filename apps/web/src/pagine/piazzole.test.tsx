import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Simulazione, ValoreFreccia } from '@arco/shared'
import { leggiSimulazione, nuovoId } from '../allenamento/simulazioni'
import { dbPredefinito } from '../sync/db'
import { renderApp } from '../test/render'
import { ATLETA, servizioFinto } from '../test/servizioFinto'

// Oggi, per tutti i test: domenica 15 novembre 2026 (solo la data è finta, i timer restano veri).
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 15, 10, 0))
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

const GIORNO = '2026-11-15'
const ripeti = (v: ValoreFreccia, n: number): ValoreFreccia[] => Array(n).fill(v)

const CAMPAGNA = { formato: '12+12', bersaglio: 'campagna' } as const
const TRE_D = { formato: '3d', bersaglio: '3d' } as const

async function preparaSimulazione(dati: Partial<Simulazione> = {}): Promise<Simulazione> {
  const s: Simulazione = {
    id: nuovoId(),
    atleta_id: ATLETA.id,
    giorno: GIORNO,
    formato: '3d',
    distanza: null,
    bersaglio: '3d',
    frecce: [],
    conclusa: false,
    eliminata: false,
    creata_il: '2026-11-15T08:00:00.000Z',
    modificato_il: '2026-11-15T08:00:00.000Z',
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

describe('nuova simulazione: campagna e 3D', () => {
  it('campagna 12+12: 24 piazzole, niente distanza, bersaglio, compound né timer da scegliere', async () => {
    await renderApp(`/allenamento/${GIORNO}/nuova`, { servizio: servizioFinto().servizio })
    await userEvent.selectOptions(await screen.findByLabelText('Gara'), '12+12')
    expect(
      screen.getByText('72 frecce: 24 piazzole da 3 frecce, in due parziali da 36.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('radiogroup', { name: 'Distanza' })).not.toBeInTheDocument()
    expect(screen.queryByRole('radiogroup', { name: 'Bersaglio' })).not.toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })

  it('campagna 24+24: 48 piazzole, 144 frecce in una prova sola', async () => {
    await renderApp(`/allenamento/${GIORNO}/nuova`, { servizio: servizioFinto().servizio })
    await userEvent.selectOptions(await screen.findByLabelText('Gara'), '24+24')
    expect(
      screen.getByText('144 frecce: 48 piazzole da 3 frecce, in due parziali da 72.'),
    ).toBeInTheDocument()
  })

  it('3D: 24 piazzole da 3 frecce', async () => {
    await renderApp(`/allenamento/${GIORNO}/nuova`, { servizio: servizioFinto().servizio })
    await userEvent.selectOptions(await screen.findByLabelText('Gara'), '3d')
    expect(
      screen.getByText('72 frecce: 24 piazzole da 3 frecce, in due parziali da 36.'),
    ).toBeInTheDocument()
  })

  it('"Inizia" per la campagna la salva senza distanza e senza compound', async () => {
    await renderApp(`/allenamento/${GIORNO}/nuova`, { servizio: servizioFinto().servizio })
    await userEvent.selectOptions(await screen.findByLabelText('Gara'), '24+24')
    await userEvent.click(screen.getByRole('button', { name: 'Inizia' }))
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Campagna 24+24' }),
    ).toBeInTheDocument()
    const salvate = await dbPredefinito().simulazioni.toArray()
    expect(salvate).toHaveLength(1)
    expect(salvate[0]).toMatchObject({
      formato: '24+24',
      distanza: null,
      bersaglio: 'campagna',
      compound: false,
      frecce: [],
    })
  })

  it('"Inizia" per il 3D usa il suo bersaglio, anche dopo aver scelto un outdoor con distanza', async () => {
    await renderApp(`/allenamento/${GIORNO}/nuova`, { servizio: servizioFinto().servizio })
    const gara = await screen.findByLabelText('Gara')
    await userEvent.selectOptions(gara, '70m')
    await userEvent.click(screen.getByRole('radio', { name: '60 m' }))
    await userEvent.selectOptions(gara, '3d')
    await userEvent.click(screen.getByRole('button', { name: 'Inizia' }))
    expect(await screen.findByRole('heading', { level: 1, name: '3D' })).toBeInTheDocument()
    const salvate = await dbPredefinito().simulazioni.toArray()
    expect(salvate.filter((r) => r.formato === '3d')).toEqual([
      expect.objectContaining({ formato: '3d', distanza: null, bersaglio: '3d' }),
    ])
  })
})

describe('il tastierino di campagna e 3D', () => {
  it('campagna: da 6 a 1 e M', async () => {
    await apri(await preparaSimulazione(CAMPAGNA))
    expect(tasti()).toEqual(['6', '5', '4', '3', '2', '1', 'M'])
  })

  it('3D: 11, 10, 8, 5 e M', async () => {
    await apri(await preparaSimulazione(TRE_D))
    expect(tasti()).toEqual(['11', '10', '8', '5', 'M'])
  })

  it('niente scelta del bersaglio da toccare, niente timer', async () => {
    await apri(await preparaSimulazione(TRE_D))
    expect(
      screen.queryByRole('radiogroup', { name: 'Come segni le frecce' }),
    ).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Avvia timer' })).not.toBeInTheDocument()
  })

  it('e l’indoor li ha ancora', async () => {
    await apri(await preparaSimulazione({ formato: '18m', bersaglio: 'trispot' }))
    expect(screen.getByRole('radiogroup', { name: 'Come segni le frecce' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Avvia timer' })).toBeInTheDocument()
  })
})

describe('segnare per piazzola', () => {
  it('3D: la piazzola in corso, il totale e il passaggio alla successiva', async () => {
    const s = await preparaSimulazione(TRE_D)
    await apri(s)
    expect(screen.getByRole('heading', { level: 1, name: '3D' })).toBeInTheDocument()
    expect(screen.getByText('Piazzola 1 di 24')).toBeInTheDocument()
    await premi('11')
    await premi('10')
    expect(
      await screen.findByText('Piazzola: 21 · Totale: 21 · 2 frecce su 72'),
    ).toBeInTheDocument()
    await premi('M')
    expect((await leggiSimulazione(dbPredefinito(), s.id))?.frecce).toEqual(['11', '10', 'M'])
    await waitFor(() => expect(screen.getByText('Piazzola 2 di 24')).toBeInTheDocument())
    expect(
      screen.getByText('Piazzola: 0 · Piazzola precedente: 21 · Totale: 21 · 3 frecce su 72'),
    ).toBeInTheDocument()
  })

  it('campagna 24+24: 48 piazzole', async () => {
    await apri(
      await preparaSimulazione({
        formato: '24+24',
        bersaglio: 'campagna',
        frecce: ripeti('6', 90),
      }),
    )
    expect(screen.getByText('Piazzola 31 di 48')).toBeInTheDocument()
    expect(screen.getByText(/90 frecce su 144/)).toBeInTheDocument()
  })

  it('riepilogo: totale, parziali, conteggi 6 e 5 alla campagna, e la media', async () => {
    await apri(await preparaSimulazione({ ...CAMPAGNA, frecce: ['6', '6', '5', '4', 'M', '5'] }))
    const riepilogo = screen.getByRole('region', { name: 'Riepilogo' })
    expect(riepilogo).toHaveTextContent('26')
    expect(riepilogo).toHaveTextContent('Parziali 26 + 0')
    expect(riepilogo).toHaveTextContent('6 e 5')
    expect(riepilogo).toHaveTextContent('2 · 2')
    expect(riepilogo).toHaveTextContent('4,3')
  })

  it('riepilogo del 3D: conteggi 11 e 10', async () => {
    await apri(await preparaSimulazione({ ...TRE_D, frecce: ['11', '11', '10', '8', 'M', '5'] }))
    const riepilogo = screen.getByRole('region', { name: 'Riepilogo' })
    expect(riepilogo).toHaveTextContent('45')
    expect(riepilogo).toHaveTextContent('11 e 10')
    expect(riepilogo).toHaveTextContent('2 · 1')
  })

  it('l’elenco si chiama "Piazzola", con il totale della piazzola e il progressivo', async () => {
    await apri(await preparaSimulazione({ ...TRE_D, frecce: ['11', '11', '10', '8', 'M', '5'] }))
    expect(screen.getByRole('region', { name: 'Tutte le piazzole' })).toBeInTheDocument()
    const righe = within(screen.getByRole('list', { name: 'Piazzola' })).getAllByRole('listitem')
    expect(righe).toHaveLength(2)
    expect(righe[0]).toHaveTextContent('Piazzola 1')
    expect(righe[0]).toHaveTextContent('Piazzola 32 · Totale 32')
    expect(righe[1]).toHaveTextContent('Piazzola 13 · Totale 45')
  })

  it('la nota è "della piazzola"', async () => {
    const s = await preparaSimulazione({ ...TRE_D, frecce: ['11', '10', '8'] })
    await apri(s)
    // La nota si scrive dall'elenco delle piazzole.
    const lista = screen.getByRole('list', { name: 'Piazzola' })
    await userEvent.click(within(lista).getByRole('button', { name: /Nota della piazzola 1:/ }))
    await userEvent.type(within(lista).getByLabelText('Nota della piazzola 1'), 'salita')
    await waitFor(async () =>
      expect((await leggiSimulazione(dbPredefinito(), s.id))?.note).toEqual({ '0': 'salita' }),
    )
  })

  it('correggere una freccia: "della piazzola"', async () => {
    const s = await preparaSimulazione({ ...TRE_D, frecce: ['11', '10', '8'] })
    await apri(s)
    await userEvent.click(
      screen.getAllByRole('button', {
        name: 'Freccia 2 della piazzola 1: 10. Tocca per correggere.',
      })[0]!,
    )
    await premi('5')
    await waitFor(async () =>
      expect((await leggiSimulazione(dbPredefinito(), s.id))?.frecce).toEqual(['11', '5', '8']),
    )
  })

  it('3D finito: il tastierino è bloccato e restano solo le correzioni', async () => {
    await apri(await preparaSimulazione({ ...TRE_D, frecce: ripeti('11', 72) }))
    expect(screen.getByText('Tutte le frecce sono state segnate')).toBeInTheDocument()
    for (const b of within(
      screen.getByRole('group', { name: 'Valore della freccia' }),
    ).getAllByRole('button')) {
      expect(b).toBeDisabled()
    }
  })
})

describe('confronto con le gare', () => {
  const aggiornato_il = '2026-11-01T10:00:00+00:00'
  const gara3d = (codice: string, dal: string) => ({
    codice,
    dal,
    al: dal,
    calendario: 'Interregionale',
    regione: 'Umbria',
    localita: 'Gubbio (PG)',
    tipologia: '3D',
    dettaglio: null,
    societa_codice: '11003',
    societa_nome: 'Arcieri Eugubini',
    stato: 'omologata',
    in_calendario_umbria: true,
    ha_invito: false,
    url_risultati: null,
    aggiornato_il,
  })
  const part3d = (gara_codice: string, totale: number) => ({
    atleta_id: ATLETA.id,
    gara_codice,
    divisione: 'AN',
    classe: 'SM',
    rank: 'SM',
    posizione: 3,
    totale,
    aggiornato_il,
  })

  it('senza altre simulazioni né gare non compare', async () => {
    await apri(await preparaSimulazione({ ...TRE_D, frecce: ['11', '10', '8'] }))
    expect(screen.queryByRole('region', { name: 'Confronto con le gare' })).not.toBeInTheDocument()
  })

  it('con un’altra simulazione conclusa e due gare: tre medie per freccia', async () => {
    const db = dbPredefinito()
    await db.gare.bulkPut([gara3d('G1', '2026-05-01'), gara3d('G2', '2026-06-01')])
    await db.partecipazioni.bulkPut([part3d('G1', 576), part3d('G2', 648)]) // 8 e 9 per freccia
    await preparaSimulazione({
      ...TRE_D,
      id: nuovoId(),
      frecce: ripeti('10', 72),
      giorno: '2026-11-10',
    })
    await apri(await preparaSimulazione({ ...TRE_D, frecce: ['11', '10', '8'] }))

    const confronto = await screen.findByRole('region', { name: 'Confronto con le gare' })
    expect(within(confronto).getByText('Questa simulazione')).toBeInTheDocument()
    expect(confronto).toHaveTextContent('9,67')
    expect(confronto).toHaveTextContent('Altre simulazioni')
    expect(confronto).toHaveTextContent('10,00')
    expect(confronto).toHaveTextContent('1 simulazione conclusa')
    expect(confronto).toHaveTextContent('Gare · Nudo')
    expect(confronto).toHaveTextContent('8,50')
    expect(confronto).toHaveTextContent('ultime 2 gare')
  })

  it('una sola gara: "ultima gara"', async () => {
    const db = dbPredefinito()
    await db.gare.put(gara3d('G1', '2026-05-01'))
    await db.partecipazioni.put(part3d('G1', 576))
    await apri(await preparaSimulazione({ ...TRE_D, frecce: ['11', '10', '8'] }))
    const confronto = await screen.findByRole('region', { name: 'Confronto con le gare' })
    expect(confronto).toHaveTextContent('ultima gara')
    expect(confronto).not.toHaveTextContent('Altre simulazioni')
  })
})
