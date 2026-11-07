import { describe, expect, it, vi } from 'vitest'
import {
  CACHE_PREDEFINITA_MS,
  creaClientFitarco,
  PAUSA_PREDEFINITA_MS,
  richiestaCalendario,
  richiestaSchedaGara,
} from '../fitarco'

const OK = '{"status":"OK","content":"<div>ok</div>"}'

/** Orologio finto: `attendi` fa avanzare il tempo invece di aspettare davvero. */
function orologio() {
  let ora = 1_000_000
  const attese: number[] = []
  return {
    adesso: () => ora,
    attendi: async (ms: number) => {
      attese.push(ms)
      ora += ms
    },
    avanza: (ms: number) => (ora += ms),
    attese,
  }
}

const fetchFinto = (...risposte: (string | Response | Error)[]) =>
  vi.fn<typeof fetch>(async () => {
    const r = risposte.length > 1 ? risposte.shift()! : risposte[0]!
    if (r instanceof Error) throw r
    return typeof r === 'string' ? new Response(r) : r
  })

describe('client educato per Fitarco', () => {
  it('manda un POST semplice: nessun User-Agent o intestazione aggiunta', async () => {
    const f = fetchFinto(OK)
    const client = creaClientFitarco({ fetch: f as typeof fetch, ...orologio() })
    const r = richiestaCalendario(2026)
    expect(await client.leggi(r)).toEqual({ ok: true, html: '<div>ok</div>' })
    const [url, init] = f.mock.calls[0]!
    expect(url).toBe(r.url)
    expect(init).toMatchObject({ method: 'POST', body: r.corpo })
    expect(init?.headers).toBeUndefined()
  })

  it('fa una richiesta alla volta, con la pausa tra una e l’altra', async () => {
    const o = orologio()
    let inCorso = 0
    let massimo = 0
    const f = vi.fn(async () => {
      massimo = Math.max(massimo, ++inCorso)
      await Promise.resolve()
      inCorso--
      return new Response(OK)
    })
    const client = creaClientFitarco({ fetch: f as typeof fetch, ...o })
    await Promise.all(['A', 'B', 'C'].map((c) => client.leggi(richiestaSchedaGara(c))))
    expect(massimo).toBe(1)
    expect(client.richiesteFatte).toBe(3)
    expect(o.attese).toEqual([PAUSA_PREDEFINITA_MS, PAUSA_PREDEFINITA_MS])
  })

  it('non aspetta se la pausa è già passata', async () => {
    const o = orologio()
    const client = creaClientFitarco({ fetch: fetchFinto(OK) as typeof fetch, pausaMs: 500, ...o })
    await client.leggi(richiestaSchedaGara('A'))
    o.avanza(800)
    await client.leggi(richiestaSchedaGara('B'))
    expect(o.attese).toEqual([])
  })

  it('non rilegge una risposta buona appena letta, ma la rilegge dopo la scadenza', async () => {
    const o = orologio()
    const f = fetchFinto(OK)
    const client = creaClientFitarco({ fetch: f as typeof fetch, ...o })
    await client.leggi(richiestaSchedaGara('A'))
    await client.leggi(richiestaSchedaGara('A'))
    expect(f).toHaveBeenCalledTimes(1)
    o.avanza(CACHE_PREDEFINITA_MS + 1)
    await client.leggi(richiestaSchedaGara('A'))
    expect(f).toHaveBeenCalledTimes(2)
  })

  it('segnala blocchi ed errori senza riprovare da solo', async () => {
    const f = fetchFinto(
      new Response('Service unavailable', { status: 503 }),
      'Service unavailable',
      new TypeError('rete assente'),
      OK,
    )
    const client = creaClientFitarco({ fetch: f as typeof fetch, ...orologio() })
    expect(await client.leggi(richiestaSchedaGara('A'))).toEqual({
      ok: false,
      motivo: 'http',
      dettaglio: '503',
    })
    expect(await client.leggi(richiestaSchedaGara('A'))).toMatchObject({
      ok: false,
      motivo: 'non-json',
    })
    expect(await client.leggi(richiestaSchedaGara('A'))).toMatchObject({
      ok: false,
      motivo: 'rete',
    })
    // Gli errori non restano in memoria: la volta dopo si rilegge.
    expect(await client.leggi(richiestaSchedaGara('A'))).toMatchObject({ ok: true })
    expect(f).toHaveBeenCalledTimes(4)
  })

  it('interrompe una richiesta che non risponde', async () => {
    vi.useFakeTimers()
    try {
      const f = vi.fn(
        (_url: string | URL | Request, init?: RequestInit) =>
          new Promise<Response>((_, rifiuta) =>
            init?.signal?.addEventListener('abort', () => rifiuta(new Error('interrotta'))),
          ),
      )
      const client = creaClientFitarco({ fetch: f as typeof fetch, timeoutMs: 1000 })
      const attesa = client.leggi(richiestaSchedaGara('A'))
      await vi.advanceTimersByTimeAsync(1000)
      expect(await attesa).toMatchObject({
        ok: false,
        motivo: 'rete',
        dettaglio: 'Error: interrotta',
      })
    } finally {
      vi.useRealTimers()
    }
  })

  it('usa davvero l’attesa e il fetch del sistema se non se ne passano altri', async () => {
    const originale = globalThis.fetch
    globalThis.fetch = fetchFinto(OK) as typeof fetch
    try {
      const client = creaClientFitarco({ pausaMs: 5 })
      await client.leggi(richiestaSchedaGara('A'))
      expect(await client.leggi(richiestaSchedaGara('B'))).toMatchObject({ ok: true })
    } finally {
      globalThis.fetch = originale
    }
  })
})
