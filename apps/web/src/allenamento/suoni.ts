/**
 * I suoni del timer della volée, generati dal telefono (Web Audio): funzionano anche offline e non servono
 * file audio. Il fischio è un tono acuto e breve; l'avviso dei 30 secondi è un doppio "bip" più basso e
 * diverso, così non si confonde con il fischio.
 */
export interface Suoni {
  /** Va chiamato da un tocco dell'atleta (il telefono permette l'audio solo dopo un tocco). */
  sblocca(): void
  /** Uno o più fischi, uno dopo l'altro. */
  fischi(quanti: number): void
  /** Breve avviso (30 secondi alla fine). */
  avviso(): void
  /** Libera l'audio. */
  chiudi(): void
}

const FISCHIO_HZ = 2400
const FISCHIO_S = 0.45
const PAUSA_FISCHI_S = 0.3
const AVVISO_HZ = 880
const AVVISO_S = 0.12

interface ContestoAudio {
  currentTime: number
  destination: unknown
  state: string
  createOscillator(): {
    type: string
    frequency: { value: number }
    connect(n: unknown): void
    start(t: number): void
    stop(t: number): void
  }
  createGain(): {
    gain: {
      value: number
      setValueAtTime(v: number, t: number): void
      linearRampToValueAtTime(v: number, t: number): void
    }
    connect(n: unknown): void
  }
  resume(): Promise<void>
  close(): Promise<void>
}

type CostruttoreAudio = new () => ContestoAudio

/** I suoni veri. Senza Web Audio (browser vecchi) resta solo la vibrazione, dove c'è. */
export function creaSuoni(): Suoni {
  let ctx: ContestoAudio | null = null

  const tono = (frequenza: number, inizio: number, durata: number, volume: number) => {
    if (!ctx) return
    const osc = ctx.createOscillator()
    const guadagno = ctx.createGain()
    osc.type = 'square'
    osc.frequency.value = frequenza
    // Una piccola rampa all'inizio e alla fine evita lo "scatto" del tono.
    guadagno.gain.setValueAtTime(0, inizio)
    guadagno.gain.linearRampToValueAtTime(volume, inizio + 0.01)
    guadagno.gain.setValueAtTime(volume, inizio + durata - 0.02)
    guadagno.gain.linearRampToValueAtTime(0, inizio + durata)
    osc.connect(guadagno)
    guadagno.connect(ctx.destination)
    osc.start(inizio)
    osc.stop(inizio + durata)
  }

  const vibra = (schema: number[]) => {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(schema)
    }
  }

  return {
    sblocca() {
      const Costruttore = (globalThis as unknown as { AudioContext?: CostruttoreAudio })
        .AudioContext
      if (!ctx && Costruttore) ctx = new Costruttore()
      if (ctx && ctx.state === 'suspended') void ctx.resume()
    },
    fischi(quanti) {
      if (ctx) {
        const da = ctx.currentTime
        for (let i = 0; i < quanti; i++) {
          tono(FISCHIO_HZ, da + i * (FISCHIO_S + PAUSA_FISCHI_S), FISCHIO_S, 0.4)
        }
      }
      vibra(
        Array.from({ length: quanti }, () => 400)
          .flatMap((v) => [v, 200])
          .slice(0, -1),
      )
    },
    avviso() {
      if (ctx) {
        const da = ctx.currentTime
        tono(AVVISO_HZ, da, AVVISO_S, 0.3)
        tono(AVVISO_HZ, da + AVVISO_S * 2, AVVISO_S, 0.3)
      }
      vibra([120, 80, 120])
    },
    chiudi() {
      if (ctx) void ctx.close().catch(() => {})
      ctx = null
    },
  }
}
