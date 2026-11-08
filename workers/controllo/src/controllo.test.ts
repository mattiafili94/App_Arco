import { describe, expect, it, vi } from 'vitest'
import { controlla, inOrario, oraItaliana, type Ambiente } from './controllo'
import worker from './index'

const ENV: Ambiente = {
  URL_FUNZIONE: 'https://esempio.invalid/functions/v1/aggiorna-fitarco',
  AGGIORNA_CHIAVE: 'chiave-di-prova',
}
// 10:00 in Italia (inverno, UTC+1).
const MATTINA = new Date('2026-11-10T09:00:00Z')

const funzione = (stato: number, corpo: unknown) =>
  vi.fn<typeof fetch>(
    async () =>
      new Response(typeof corpo === 'string' ? corpo : JSON.stringify(corpo), { status: stato }),
  )

describe('orario del controllo automatico', () => {
  it("usa l'ora italiana, con l'ora legale", () => {
    expect(oraItaliana(new Date('2026-11-10T06:00:00Z'))).toBe(7)
    expect(oraItaliana(new Date('2026-07-10T05:00:00Z'))).toBe(7)
    expect(oraItaliana(new Date('2026-07-10T22:30:00Z'))).toBe(0)
  })

  it('dalle 7:00 alle 22:30', () => {
    expect(inOrario(new Date('2026-11-10T05:30:00Z'))).toBe(false) // 6:30
    expect(inOrario(new Date('2026-11-10T06:00:00Z'))).toBe(true) // 7:00
    expect(inOrario(new Date('2026-11-10T21:30:00Z'))).toBe(true) // 22:30
    expect(inOrario(new Date('2026-11-10T22:00:00Z'))).toBe(false) // 23:00
    expect(inOrario(new Date('2026-07-10T05:00:00Z'))).toBe(true) // 7:00 d'estate
    expect(inOrario(new Date('2026-07-10T21:00:00Z'))).toBe(false) // 23:00 d'estate
  })
})

describe('chiamata alla funzione aggiorna-fitarco', () => {
  it('manda un POST con la chiave e riassume la risposta', async () => {
    const f = funzione(200, {
      eseguite: [{ esito: 'ok' }, { esito: 'errore' }, { esito: 'invariato' }],
      richiesteFitarco: 3,
      fermato: null,
    })
    expect(await controlla(ENV, MATTINA, f)).toEqual({
      chiamata: true,
      esito: '3 letture (1 con errore), 3 richieste a Fitarco',
    })
    const [url, init] = f.mock.calls[0]!
    expect(url).toBe(ENV.URL_FUNZIONE)
    expect(init).toMatchObject({
      method: 'POST',
      headers: { 'x-aggiorna-chiave': 'chiave-di-prova' },
    })
  })

  it('dice se il giro si è fermato e accetta un riepilogo vuoto', async () => {
    expect(
      (await controlla(ENV, MATTINA, funzione(200, { eseguite: [], fermato: 'In pausa' }))).esito,
    ).toBe('0 letture (0 con errore), 0 richieste a Fitarco. Fermato: In pausa')
    expect((await controlla(ENV, MATTINA, funzione(200, {}))).esito).toBe(
      '0 letture (0 con errore), 0 richieste a Fitarco',
    )
  })

  it('fuori orario o senza chiave non chiama niente', async () => {
    const f = funzione(200, {})
    expect(await controlla(ENV, new Date('2026-11-10T03:00:00Z'), f)).toMatchObject({
      chiamata: false,
    })
    expect(await controlla({ URL_FUNZIONE: ENV.URL_FUNZIONE }, MATTINA, f)).toEqual({
      chiamata: false,
      esito: 'Manca il segreto AGGIORNA_CHIAVE del Worker',
    })
    expect(f).not.toHaveBeenCalled()
  })

  it('segnala errori della funzione e della rete', async () => {
    expect((await controlla(ENV, MATTINA, funzione(401, 'Non autorizzato'))).esito).toBe(
      'La funzione ha risposto 401: Non autorizzato',
    )
    const rotta = vi.fn<typeof fetch>(async () => {
      throw new TypeError('rete assente')
    })
    expect((await controlla(ENV, MATTINA, rotta)).esito).toBe(
      'Funzione non raggiungibile: TypeError: rete assente',
    )
  })
})

describe('il Worker', () => {
  it('al cron esegue il controllo e scrive il risultato nei log', async () => {
    const originale = globalThis.fetch
    globalThis.fetch = funzione(200, { eseguite: [], richiesteFitarco: 0 })
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    try {
      let lavoro: Promise<unknown> = Promise.resolve()
      worker.scheduled({ scheduledTime: MATTINA.getTime() }, ENV, {
        waitUntil: (p) => (lavoro = p),
      })
      await lavoro
      expect(log).toHaveBeenCalledWith('0 letture (0 con errore), 0 richieste a Fitarco')
    } finally {
      globalThis.fetch = originale
      log.mockRestore()
    }
  })

  it('non ha pagine', async () => {
    expect(worker.fetch().status).toBe(404)
  })
})
