import { beforeEach, describe, expect, it } from 'vitest'
import {
  gestisciAggiornaAtleta,
  TEMPO_MASSIMO_ATLETA_MS,
  type Contesto,
  type Fonte,
} from '../aggiornamento'
import type { FileScaricato, RichiestaFitarco, RispostaFitarco } from '../fitarco'
import { esempio } from '../fitarco/esempi'
import { ArchivioFinto } from './archivio-finto'

const OGGI = '2026-11-10'
const ADESSO = Date.parse(`${OGGI}T17:20:00Z`)

/** Fitarco finto: risponde con la scheda atleta di esempio e conta le richieste. */
class FonteFinta implements Fonte {
  richiesteFatte = 0
  chiamate: string[] = []
  risposta: RispostaFitarco = { ok: true, html: esempio('scheda-atleta') }
  async leggi(r: RichiestaFitarco): Promise<RispostaFitarco> {
    this.richiesteFatte++
    this.chiamate.push(r.corpo.get('render')!)
    return this.risposta
  }
  async scarica(): Promise<FileScaricato> {
    throw new Error('non serve')
  }
}

let archivio: ArchivioFinto
let fonte: FonteFinta
let amministratore: boolean

const chiama = () =>
  gestisciAggiornaAtleta({
    ctx: { archivio, fonte, oggi: OGGI } satisfies Contesto,
    chiamanteAmministratore: async () => amministratore,
    adesso: () => archivio.adesso,
  })

beforeEach(() => {
  archivio = new ArchivioFinto()
  archivio.oggi = OGGI
  archivio.adesso = ADESSO
  archivio.atletiSalvati = [
    {
      id: 'a1',
      matricola: '900001',
      nome: 'Mario',
      cognome: 'Rossi',
      classi_ranking: {},
      attivo: true,
    },
  ]
  fonte = new FonteFinta()
  amministratore = true
})

describe('lettura immediata della scheda di un atleta nuovo', () => {
  it('l’amministratore la fa partire: una sola richiesta a Fitarco, la scheda del nuovo atleta', async () => {
    const r = await chiama()
    expect(r).toEqual({
      stato: 200,
      corpo: { letture: [{ tipo: 'scheda-atleta', esito: 'ok' }], fermato: null },
    })
    expect(fonte.richiesteFatte).toBe(1)
    expect(fonte.chiamate).toEqual(['scheda_tesserato_result'])
    expect(archivio.storici.get('a1')?.length).toBeGreaterThan(0)
    expect(archivio.diario.at(-1)).toMatchObject({
      tipo: 'scheda-atleta',
      chiave: 'a1',
      esito: 'ok',
    })
  })

  it('fa una lettura sola anche se ci sono altri atleti nuovi: gli altri toccano al prossimo giro', async () => {
    archivio.atletiSalvati.push({
      id: 'a2',
      matricola: '900001',
      nome: 'Luca',
      cognome: 'Verdi',
      classi_ranking: {},
      attivo: true,
    })
    const r = await chiama()
    expect((r.corpo.letture as unknown[]).length).toBe(1)
    expect(fonte.richiesteFatte).toBe(1)
  })

  it('chi non è l’amministratore non può, e Fitarco non viene toccato', async () => {
    amministratore = false
    expect(await chiama()).toEqual({ stato: 403, corpo: { errore: 'Accesso non consentito.' } })
    expect(fonte.richiesteFatte).toBe(0)
    expect(archivio.diario).toEqual([])
  })

  it('se non ci sono schede da leggere, non fa richieste (le altre letture restano al controllo automatico)', async () => {
    await chiama()
    fonte.richiesteFatte = 0
    const r = await chiama()
    expect(r.corpo.letture).toEqual([])
    expect(fonte.richiesteFatte).toBe(0)
  })

  it('non fa letture pesanti (calendario, PDF, classifiche) nemmeno se sono in lista', async () => {
    // Con la scheda già letta, restano da fare calendario e altro: qui non devono partire.
    await chiama()
    fonte.richiesteFatte = 0
    fonte.chiamate = []
    await chiama()
    expect(fonte.chiamate.filter((c) => c === 'lista_calendario_results')).toEqual([])
  })

  it('se Fitarco non risponde si ferma e lo dice; il controllo automatico riproverà', async () => {
    fonte.risposta = { ok: false, motivo: 'http', dettaglio: '503' }
    const r = await chiama()
    expect(r.stato).toBe(200)
    expect(r.corpo.fermato).toBe('Fitarco non risponde: risposta http 503')
    expect(r.corpo.letture).toEqual([{ tipo: 'scheda-atleta', esito: 'errore' }])
    expect(fonte.richiesteFatte).toBe(1)
  })

  it('ha un tempo massimo', () => {
    expect(TEMPO_MASSIMO_ATLETA_MS).toBe(30_000)
  })
})
