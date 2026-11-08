import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GiornoAllenamento } from '@arco/shared'
import { copiaSettimanaScorsa, leggiGiorno, salvaGiorno } from '../allenamento/scrittura'
import { dbPredefinito } from '../sync/db'
import { RemotoFinto } from '../test/remotoFinto'
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

const giorno = (g: string, dati: Partial<GiornoAllenamento> = {}) => ({
  atleta_id: ATLETA.id,
  giorno: g,
  programma: '',
  fatto: false,
  frecce_libere: 0,
  nota: '',
  modificato_il: '2026-11-01T10:00:00.000Z',
  aggiornato_il: '2026-11-01T10:00:00+00:00',
  ...dati,
})

/** Una settimana di prova: lunedì 9 (60 frecce, fatto), martedì 10 (riposo), mercoledì 11 vuoto. */
function remotoConAllenamento() {
  const remoto = new RemotoFinto()
  remoto.scrivi(
    'allenamento_giorni',
    giorno('2026-11-09', {
      programma: '60 frecce a 18 m\nlavoro sulla trazione',
      fatto: true,
      frecce_libere: 60,
    }),
  )
  remoto.scrivi('allenamento_giorni', giorno('2026-11-10', { programma: 'riposo' }))
  // La settimana scorsa: due programmi da copiare.
  remoto.scrivi('allenamento_giorni', giorno('2026-11-03', { programma: '40 frecce a 25 m' }))
  remoto.scrivi(
    'allenamento_giorni',
    giorno('2026-11-05', { programma: 'gara', frecce_libere: 20 }),
  )
  return remoto
}

const conAllenamento = () => servizioFinto({ remoto: remotoConAllenamento() })

describe('scrittura sul telefono', () => {
  it('salva un giorno e lo segna da inviare, senza toccare la data del server', async () => {
    const db = dbPredefinito()
    await db.allenamento_giorni.put({ ...giorno('2026-11-09', { programma: 'prima' }) })
    const nuovo = await salvaGiorno(
      db,
      ATLETA.id,
      '2026-11-09',
      { fatto: true },
      new Date('2026-11-09T12:00:00Z'),
    )
    expect(nuovo).toMatchObject({ programma: 'prima', fatto: true })
    const salvato = (await db.allenamento_giorni.get([ATLETA.id, '2026-11-09'])) as Record<
      string,
      unknown
    >
    expect(salvato.da_inviare).toBe(1)
    expect(salvato.aggiornato_il).toBe('2026-11-01T10:00:00+00:00')
    expect(salvato.modificato_il).toBe('2026-11-09T12:00:00.000Z')
  })

  it('un giorno nuovo parte vuoto; la data di modifica cresce sempre, anche con l’orologio fermo', async () => {
    const db = dbPredefinito()
    const adesso = new Date('2026-11-09T12:00:00Z')
    const a = await salvaGiorno(db, ATLETA.id, '2026-11-12', { programma: 'x' }, adesso)
    const b = await salvaGiorno(db, ATLETA.id, '2026-11-12', { nota: 'y' }, adesso)
    expect(a).toMatchObject({ programma: 'x', nota: '', fatto: false, frecce_libere: 0 })
    expect(b).toMatchObject({ programma: 'x', nota: 'y' })
    expect(Date.parse(b.modificato_il)).toBeGreaterThan(Date.parse(a.modificato_il))
    expect(await leggiGiorno(db, ATLETA.id, '2026-11-13')).toBeUndefined()
  })

  it('copia la settimana scorsa: solo i programmi, senza sovrascrivere', async () => {
    const db = dbPredefinito()
    await db.allenamento_giorni.bulkPut([
      giorno('2026-11-03', { programma: '40 frecce a 25 m', fatto: true, frecce_libere: 40 }),
      giorno('2026-11-05', { programma: 'gara', nota: 'bene' }),
      giorno('2026-11-12', { programma: 'già scritto' }),
    ])
    const copiati = await copiaSettimanaScorsa(db, ATLETA.id, '2026-11-09')
    expect(copiati).toBe(1) // il 12 novembre ha già un programma
    const martedi = (await leggiGiorno(db, ATLETA.id, '2026-11-10'))!
    expect(martedi).toMatchObject({
      programma: '40 frecce a 25 m',
      fatto: false,
      frecce_libere: 0,
      nota: '',
    })
    expect((await leggiGiorno(db, ATLETA.id, '2026-11-12'))?.programma).toBe('già scritto')
  })
})

describe('tab Allenamento: la settimana', () => {
  it('la settimana corrente, da lunedì a domenica, con i giorni e il riepilogo', async () => {
    await renderApp('/allenamento', { servizio: conAllenamento().servizio })
    expect(await screen.findByText('9–15 nov')).toBeInTheDocument()
    const giorni = await screen.findByRole('region', { name: 'Giorni' })
    await waitFor(() => expect(within(giorni).getAllByRole('link')).toHaveLength(7))
    const righe = within(giorni).getAllByRole('link')
    expect(righe[0]).toHaveTextContent('Lunedì 9 nov')
    await waitFor(() => expect(righe[0]).toHaveTextContent('Fatto · 60 frecce a 18 m'))
    expect(righe[0]).toHaveTextContent('60 frecce')
    expect(righe[1]).toHaveTextContent('Martedì 10 nov')
    await waitFor(() => expect(righe[1]).toHaveTextContent('riposo'))
    expect(righe[2]).toHaveTextContent('Mercoledì 11 nov · Oggi')
    expect(righe[2]).toHaveTextContent('Nessun programma')
    expect(righe[6]).toHaveTextContent('Domenica 15 nov')

    const riepilogo = screen.getByRole('region', { name: 'Riepilogo della settimana' })
    await waitFor(() => expect(riepilogo).toHaveTextContent('libere 60 · in gara 0'))
    expect(riepilogo).toHaveTextContent('1 su 7')
  })

  it('si scorre di settimana in settimana, e si torna a quella corrente', async () => {
    await renderApp('/allenamento', { servizio: conAllenamento().servizio })
    await userEvent.click(await screen.findByRole('link', { name: 'Settimana precedente' }))
    expect(await screen.findByText('2–8 nov')).toBeInTheDocument()
    const giorni = await screen.findByRole('region', { name: 'Giorni' })
    await waitFor(() => expect(giorni).toHaveTextContent('40 frecce a 25 m'))
    expect(screen.getByRole('region', { name: 'Riepilogo della settimana' })).toHaveTextContent(
      'libere 20',
    )

    await userEvent.click(screen.getByRole('link', { name: 'Settimana successiva' }))
    await userEvent.click(screen.getByRole('link', { name: 'Settimana successiva' }))
    expect(await screen.findByText('16–22 nov')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('link', { name: 'Torna a questa settimana' }))
    expect(await screen.findByText('9–15 nov')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Torna a questa settimana' })).not.toBeInTheDocument()
  })

  it('"Copia la settimana scorsa" copia i programmi e li manda al server', async () => {
    const { servizio, remoto } = conAllenamento()
    await renderApp('/allenamento', { servizio })
    // Lunedì 9 e martedì 10 hanno già un programma; la settimana scorsa ne ha due (3 e 5 nov).
    await userEvent.click(await screen.findByRole('button', { name: 'Copia la settimana scorsa' }))
    expect(await screen.findByText('Copiato 1 programma.')).toBeInTheDocument()
    // Il giovedì 5 → 12 novembre.
    await waitFor(() =>
      expect(
        within(screen.getByRole('region', { name: 'Giorni' })).getByText('gara'),
      ).toBeInTheDocument(),
    )
    // Subito dopo la sincronizzazione porta la modifica sul server.
    await waitFor(() =>
      expect(
        remoto.righe.allenamento_giorni.some(
          (r) => r.giorno === '2026-11-12' && r.programma === 'gara',
        ),
      ).toBe(true),
    )
  })

  it('niente da copiare: lo dice', async () => {
    const remoto = new RemotoFinto()
    await renderApp('/allenamento', { servizio: servizioFinto({ remoto }).servizio })
    await userEvent.click(await screen.findByRole('button', { name: 'Copia la settimana scorsa' }))
    expect(await screen.findByText(/Niente da copiare/)).toBeInTheDocument()
  })

  it('settimana vuota: i sette giorni ci sono lo stesso, con riepilogo a zero', async () => {
    await renderApp('/allenamento', { servizio: servizioFinto().servizio })
    const giorni = await screen.findByRole('region', { name: 'Giorni' })
    expect(within(giorni).getAllByRole('link')).toHaveLength(7)
    expect(screen.getByRole('region', { name: 'Riepilogo della settimana' })).toHaveTextContent(
      '0 su 7',
    )
  })

  it('un parametro sbagliato nell’indirizzo riporta alla settimana corrente', async () => {
    await renderApp('/allenamento?settimana=boh', { servizio: servizioFinto().servizio })
    expect(await screen.findByText('9–15 nov')).toBeInTheDocument()
  })
})

describe('un giorno di allenamento', () => {
  const apri = async (g = '2026-11-09', finto = conAllenamento()) => {
    await renderApp(`/allenamento/${g}`, { servizio: finto.servizio })
    await screen.findByLabelText('Cosa devo fare')
    return finto
  }

  it('mostra cosa fare, fatto, frecce e note; il totale del giorno è nel titolo', async () => {
    await apri()
    await waitFor(() =>
      expect(screen.getByLabelText('Cosa devo fare')).toHaveValue(
        '60 frecce a 18 m\nlavoro sulla trazione',
      ),
    )
    expect(screen.getByRole('heading', { level: 1, name: 'Lunedì 9 nov' })).toBeInTheDocument()
    expect(screen.getByLabelText('Fatto')).toBeChecked()
    expect(screen.getByLabelText('Frecce tirate')).toHaveValue('60')
    expect(screen.getByText('60 frecce in tutto')).toBeInTheDocument()
    expect(screen.getByLabelText('Note')).toHaveValue('')
  })

  it('scrivere salva subito sul telefono e poi manda al server', async () => {
    const finto = await apri('2026-11-11')
    await userEvent.type(screen.getByLabelText('Cosa devo fare'), '100 frecce a 70 m')
    await userEvent.click(screen.getByLabelText('Fatto'))
    await userEvent.type(screen.getByLabelText('Frecce tirate'), '100')
    await userEvent.type(screen.getByLabelText('Note'), 'bene la trazione')

    await waitFor(async () => {
      const salvato = await leggiGiorno(dbPredefinito(), ATLETA.id, '2026-11-11')
      expect(salvato).toMatchObject({
        programma: '100 frecce a 70 m',
        fatto: true,
        frecce_libere: 100,
        nota: 'bene la trazione',
      })
    })
    // Dopo un attimo l'invio parte da solo.
    await waitFor(() => expect(finto.remoto.salvataggi.length).toBeGreaterThan(0), {
      timeout: 4000,
    })
    await waitFor(
      () =>
        expect(
          finto.remoto.righe.allenamento_giorni.find((r) => r.giorno === '2026-11-11'),
        ).toMatchObject({
          programma: '100 frecce a 70 m',
          frecce_libere: 100,
        }),
      { timeout: 4000 },
    )
    await waitFor(() => expect(screen.getByText('Salvato.')).toBeInTheDocument(), { timeout: 4000 })
  })

  it('frecce non valide: errore accanto al campo e niente viene salvato', async () => {
    await apri('2026-11-12')
    await userEvent.type(screen.getByLabelText('Frecce tirate'), '12,5')
    expect(await screen.findByText('Scrivi un numero da 0 a 9999.')).toBeInTheDocument()
    // Si salva solo quello che è valido: l'ultimo numero buono è 12.
    await waitFor(async () =>
      expect((await leggiGiorno(dbPredefinito(), ATLETA.id, '2026-11-12'))?.frecce_libere).toBe(12),
    )
    await userEvent.clear(screen.getByLabelText('Frecce tirate'))
    await userEvent.type(screen.getByLabelText('Frecce tirate'), '90')
    await waitFor(async () =>
      expect((await leggiGiorno(dbPredefinito(), ATLETA.id, '2026-11-12'))?.frecce_libere).toBe(90),
    )
    expect(screen.queryByText('Scrivi un numero da 0 a 9999.')).not.toBeInTheDocument()
  })

  it('offline: si salva sul telefono e lo dice; si invia al ritorno della rete', async () => {
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    const finto = await apri('2026-11-13')
    await userEvent.type(screen.getByLabelText('Cosa devo fare'), 'tiro a casa')
    expect(
      await screen.findByText('Salvato sul telefono. Si invia al server appena c’è la rete.'),
    ).toBeInTheDocument()
    expect(finto.remoto.salvataggi).toEqual([])
    expect((await leggiGiorno(dbPredefinito(), ATLETA.id, '2026-11-13'))?.programma).toBe(
      'tiro a casa',
    )

    online.mockReturnValue(true)
    window.dispatchEvent(new Event('online'))
    await waitFor(() => expect(finto.remoto.salvataggi.length).toBeGreaterThan(0), {
      timeout: 4000,
    })
  })

  it('dal giorno si torna alla sua settimana', async () => {
    await apri('2026-11-03')
    const indietro = screen.getAllByRole('link', { name: 'Allenamento' })[0]!
    expect(indietro).toHaveAttribute('href', '/allenamento?settimana=2026-11-02')
  })

  it('un indirizzo con un giorno sbagliato riporta all’Allenamento', async () => {
    await renderApp('/allenamento/boh', { servizio: servizioFinto().servizio })
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Allenamento' }),
    ).toBeInTheDocument()
  })
})

describe('uscita con modifiche non inviate', () => {
  it('avvisa che si perdono', async () => {
    // Offline: la modifica resta da inviare (con la rete partirebbe da sola).
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    await renderApp('/impostazioni', { servizio: servizioFinto().servizio })
    await dbPredefinito().allenamento_giorni.put({
      ...giorno('2026-11-11', { programma: 'x' }),
      da_inviare: 1,
    })
    await userEvent.click(await screen.findByRole('button', { name: 'Esci' }))
    expect(
      await screen.findByText(/1 modifica dell’allenamento non ancora inviata/),
    ).toBeInTheDocument()
  })

  it('senza modifiche in sospeso non c’è l’avviso', async () => {
    await renderApp('/impostazioni', { servizio: servizioFinto().servizio })
    await userEvent.click(await screen.findByRole('button', { name: 'Esci' }))
    expect(screen.getByText(/ti servirà di nuovo il codice personale/)).toBeInTheDocument()
    expect(screen.queryByText(/non ancora inviat/)).not.toBeInTheDocument()
  })
})
