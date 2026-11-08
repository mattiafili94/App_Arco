import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { creaSuoni, type Suoni } from '../allenamento/suoni'
import { TimerVolee } from './TimerVolee'

/** Suoni finti: annotano cosa suonerebbe, e in quale istante (secondi dall'avvio). */
function suoniFinti(orologio: () => number) {
  const eventi: string[] = []
  let inizio = 0
  const suoni: Suoni = {
    sblocca: vi.fn(() => {
      inizio = orologio()
    }),
    fischi: vi.fn((n: number) => {
      eventi.push(
        `${n} ${n === 1 ? 'fischio' : 'fischi'} a ${Math.round((orologio() - inizio) / 1000)} s`,
      )
    }),
    avviso: vi.fn(() => {
      eventi.push(`avviso a ${Math.round((orologio() - inizio) / 1000)} s`)
    }),
    chiudi: vi.fn(),
  }
  return { suoni, eventi }
}

let t = 0
const ora = () => t
/** Il tempo passa a piccoli passi (come in vero: il timer controlla ogni 200 ms). */
const passano = (ms: number) =>
  act(() => {
    for (let passato = 0; passato < ms; passato += 200) {
      t += 200
      vi.advanceTimersByTime(200)
    }
  })

beforeEach(() => {
  vi.useFakeTimers()
  t = 1_000_000
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

const avvia = (durata = 120_000) => {
  const finti = suoniFinti(ora)
  const vista = render(<TimerVolee durataTiro={durata} suoni={finti.suoni} ora={ora} />)
  return { ...finti, ...vista }
}

describe('timer della volée', () => {
  it('è facoltativo: all’inizio c’è solo il pulsante, e niente suona', () => {
    const { suoni } = avvia()
    expect(screen.getByRole('button', { name: 'Avvia timer' })).toBeInTheDocument()
    expect(screen.getByText(/Facoltativo/)).toBeInTheDocument()
    expect(screen.queryByRole('timer')).not.toBeInTheDocument()
    expect(suoni.fischi).not.toHaveBeenCalled()
  })

  it('1 fischio all’avvio e 10 secondi per andare in linea (preparazione)', () => {
    const { eventi } = avvia()
    fireEvent.click(screen.getByRole('button', { name: 'Avvia timer' }))
    expect(eventi).toEqual(['1 fischio a 0 s'])
    expect(screen.getByRole('timer')).toHaveTextContent('0:10')
    expect(
      screen.getByText('Preparazione', { selector: 'p:not(.visually-hidden)' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Timer della volée' })).toHaveAttribute(
      'data-fase',
      'preparazione',
    )
    passano(4_000)
    expect(screen.getByRole('timer')).toHaveTextContent('0:06')
  })

  it('al secondo fischio parte il tempo di tiro: 2 minuti all’indoor', () => {
    const { eventi } = avvia(120_000)
    fireEvent.click(screen.getByRole('button', { name: 'Avvia timer' }))
    passano(10_000)
    expect(eventi).toEqual(['1 fischio a 0 s', '1 fischio a 10 s'])
    expect(screen.getByRole('timer')).toHaveTextContent('2:00')
    expect(screen.getByRole('region', { name: 'Timer della volée' })).toHaveAttribute(
      'data-fase',
      'tiro',
    )
    passano(60_000)
    expect(screen.getByRole('timer')).toHaveTextContent('1:00')
  })

  it('all’outdoor il tempo di tiro è di 4 minuti', () => {
    avvia(240_000)
    fireEvent.click(screen.getByRole('button', { name: 'Avvia timer' }))
    passano(10_000)
    expect(screen.getByRole('timer')).toHaveTextContent('4:00')
  })

  it('a 30 secondi dalla fine: fase gialla e avviso sonoro (non un fischio)', () => {
    const { eventi } = avvia()
    fireEvent.click(screen.getByRole('button', { name: 'Avvia timer' }))
    passano(100_000)
    expect(eventi.at(-1)).toBe('avviso a 100 s')
    expect(screen.getByRole('region', { name: 'Timer della volée' })).toHaveAttribute(
      'data-fase',
      'ultimi30',
    )
    expect(screen.getByRole('timer')).toHaveTextContent('0:30')
    expect(screen.getAllByText('Ultimi 30 secondi').length).toBeGreaterThan(0)
  })

  it('tempo scaduto: 2 fischi; il pulsante diventa "Chiudi" e poi il timer si ferma da solo', () => {
    const { eventi } = avvia()
    fireEvent.click(screen.getByRole('button', { name: 'Avvia timer' }))
    passano(130_000)
    expect(eventi).toEqual([
      '1 fischio a 0 s',
      '1 fischio a 10 s',
      'avviso a 100 s',
      '2 fischi a 130 s',
    ])
    expect(screen.getAllByText('Tempo scaduto').length).toBeGreaterThan(0)
    expect(screen.getByRole('timer')).toHaveTextContent('0:00')
    // Dopo qualche secondo di "tempo scaduto" il timer si ferma e torna il pulsante.
    passano(6_000)
    expect(screen.getByRole('button', { name: 'Avvia timer' })).toBeInTheDocument()
    expect(eventi).toHaveLength(4)
  })

  it('"Chiudi" dopo il tempo scaduto lo ferma subito', () => {
    avvia()
    fireEvent.click(screen.getByRole('button', { name: 'Avvia timer' }))
    passano(131_000)
    fireEvent.click(screen.getByRole('button', { name: 'Chiudi' }))
    expect(screen.getByRole('button', { name: 'Avvia timer' })).toBeInTheDocument()
  })

  it('si può fermare quando si vuole; non suona più e si può rifare da capo', () => {
    const { eventi } = avvia()
    fireEvent.click(screen.getByRole('button', { name: 'Avvia timer' }))
    passano(30_000)
    fireEvent.click(screen.getByRole('button', { name: 'Ferma il timer' }))
    expect(screen.getByRole('button', { name: 'Avvia timer' })).toBeInTheDocument()
    passano(200_000)
    expect(eventi).toEqual(['1 fischio a 0 s', '1 fischio a 10 s'])
    fireEvent.click(screen.getByRole('button', { name: 'Avvia timer' }))
    expect(screen.getByRole('timer')).toHaveTextContent('0:10')
    expect(eventi).toHaveLength(3)
  })

  it('se il telefono è rimasto fermo, i suoni saltati arrivano tutti, in ordine', () => {
    const { eventi } = avvia()
    fireEvent.click(screen.getByRole('button', { name: 'Avvia timer' }))
    // Un solo "scatto" lungo (schermo spento, scheda in secondo piano): il tempo salta di colpo.
    act(() => {
      t += 135_000
      vi.advanceTimersByTime(200)
    })
    expect(eventi).toEqual([
      '1 fischio a 0 s',
      '1 fischio a 135 s',
      'avviso a 135 s',
      '2 fischi a 135 s',
    ])
  })

  it('uscendo dalla pagina libera l’audio', () => {
    const { suoni, unmount } = avvia()
    fireEvent.click(screen.getByRole('button', { name: 'Avvia timer' }))
    unmount()
    expect(suoni.chiudi).toHaveBeenCalled()
  })

  it('con il blocco dello schermo disponibile lo chiede all’avvio e lo rilascia alla fine', async () => {
    const release = vi.fn(async () => {})
    const request = vi.fn(async () => ({ release }))
    Object.defineProperty(navigator, 'wakeLock', { value: { request }, configurable: true })
    avvia()
    fireEvent.click(screen.getByRole('button', { name: 'Avvia timer' }))
    await act(async () => {})
    expect(request).toHaveBeenCalledWith('screen')
    fireEvent.click(screen.getByRole('button', { name: 'Ferma il timer' }))
    expect(release).toHaveBeenCalled()
    // Un telefono che rifiuta il blocco non rompe niente.
    request.mockRejectedValueOnce(new Error('no'))
    fireEvent.click(screen.getByRole('button', { name: 'Avvia timer' }))
    await act(async () => {})
    expect(screen.getByRole('timer')).toBeInTheDocument()
    Reflect.deleteProperty(navigator, 'wakeLock')
  })
})

describe('i suoni veri (Web Audio)', () => {
  function audioFinto(stato = 'running') {
    const oscillatori: { frequenza: number; inizio: number; fine: number }[] = []
    const resume = vi.fn(async () => {})
    const close = vi.fn(async () => {})
    class AudioContextFinto {
      currentTime = 5
      destination = {}
      state = stato
      createOscillator() {
        const reg = { frequenza: 0, inizio: 0, fine: 0 }
        oscillatori.push(reg)
        const frequency = {}
        Object.defineProperty(frequency, 'value', {
          set: (v: number) => {
            reg.frequenza = v
          },
        })
        return {
          type: '',
          frequency,
          connect() {},
          start: (x: number) => {
            reg.inizio = x
          },
          stop: (x: number) => {
            reg.fine = x
          },
        }
      }
      createGain() {
        return {
          gain: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {} },
          connect() {},
        }
      }
      resume = resume
      close = close
    }
    vi.stubGlobal('AudioContext', AudioContextFinto)
    return { oscillatori, resume, close }
  }

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('un fischio è un tono acuto; due fischi sono due toni uno dopo l’altro', () => {
    const { oscillatori } = audioFinto()
    const suoni = creaSuoni()
    suoni.sblocca()
    suoni.fischi(2)
    expect(oscillatori).toHaveLength(2)
    expect(oscillatori.every((o) => o.frequenza === 2400)).toBe(true)
    expect(oscillatori[1]!.inizio).toBeGreaterThan(oscillatori[0]!.fine)
  })

  it('l’avviso è diverso dal fischio: due bip più bassi', () => {
    const { oscillatori } = audioFinto()
    const suoni = creaSuoni()
    suoni.sblocca()
    suoni.avviso()
    expect(oscillatori).toHaveLength(2)
    expect(oscillatori.every((o) => o.frequenza === 880)).toBe(true)
  })

  it('l’audio sospeso del telefono si riattiva con il tocco; chiudendo si libera', () => {
    const { resume, close } = audioFinto('suspended')
    const suoni = creaSuoni()
    suoni.sblocca()
    expect(resume).toHaveBeenCalled()
    suoni.chiudi()
    expect(close).toHaveBeenCalled()
  })

  it('senza Web Audio non si rompe niente (resta la vibrazione, se c’è)', () => {
    vi.stubGlobal('AudioContext', undefined)
    const vibra = vi.fn()
    Object.defineProperty(navigator, 'vibrate', { value: vibra, configurable: true })
    const suoni = creaSuoni()
    suoni.sblocca()
    suoni.fischi(2)
    suoni.avviso()
    suoni.chiudi()
    expect(vibra).toHaveBeenCalledTimes(2)
    expect(vibra).toHaveBeenNthCalledWith(1, [400, 200, 400])
    Reflect.deleteProperty(navigator, 'vibrate')
    // Senza nemmeno la vibrazione.
    expect(() => {
      suoni.fischi(1)
      suoni.avviso()
    }).not.toThrow()
  })
})
