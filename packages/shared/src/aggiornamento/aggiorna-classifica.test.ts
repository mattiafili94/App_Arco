import { beforeEach, describe, expect, it } from 'vitest'
import {
  gestisciAggiornaClassifica,
  PREFISSO_BLOCCO,
  type Contesto,
  type Fonte,
} from '../aggiornamento'
import type { FileScaricato, RispostaFitarco } from '../fitarco'
import { esempio } from '../fitarco/esempi'
import { ArchivioFinto } from './archivio-finto'

const ADESSO = new Date('2026-11-10T10:00:00Z')
const FILTRO = { tipo: 'I', divisione: 'OL', classe: 'S', genere: 'M' }

/** Fitarco finto: risponde con la classifica di esempio (che dichiara 13 atleti ma ne ha 6). */
class FonteFinta implements Fonte {
  richiesteFatte = 0
  risposta: RispostaFitarco = {
    ok: true,
    html: esempio('ranking').replace('Numero totale: 13', 'Numero totale: 6'),
  }
  async leggi(): Promise<RispostaFitarco> {
    this.richiesteFatte++
    return this.risposta
  }
  async scarica(): Promise<FileScaricato> {
    throw new Error('non serve')
  }
}

let archivio: ArchivioFinto
let fonte: FonteFinta
let membro: boolean

const chiama = (corpo: unknown) =>
  gestisciAggiornaClassifica(corpo, {
    ctx: { archivio, fonte, oggi: '2026-11-10' } satisfies Contesto,
    chiamanteMembro: async () => membro,
    adesso: () => ADESSO,
  })

beforeEach(() => {
  archivio = new ArchivioFinto()
  archivio.adesso = ADESSO.getTime()
  fonte = new FonteFinta()
  membro = true
})

describe('pulsante "Aggiorna" delle classifiche', () => {
  it('un membro rilegge la classifica: una richiesta a Fitarco, salvata e scritta nel diario', async () => {
    const r = await chiama(FILTRO)
    expect(r).toEqual({
      stato: 200,
      corpo: { esito: 'ok', atleti: 6, lettaIl: ADESSO.toISOString() },
    })
    expect(fonte.richiesteFatte).toBe(1)
    expect(archivio.classificheComplete.get('I|OL|S|M')).toMatchObject({ totale: 6 })
    expect(archivio.diario.at(-1)).toMatchObject({
      tipo: 'ranking',
      chiave: 'I|OL|S|M',
      esito: 'ok',
      richieste: 1,
    })
  })

  it('chi non è un atleta attivo non può', async () => {
    membro = false
    expect(await chiama(FILTRO)).toEqual({
      stato: 403,
      corpo: { errore: 'Accesso non consentito.' },
    })
    expect(fonte.richiesteFatte).toBe(0)
  })

  it('richieste storte non arrivano a Fitarco', async () => {
    for (const corpo of [
      null,
      {},
      { ...FILTRO, tipo: 'X' },
      { ...FILTRO, divisione: "OL'; --" },
      'ciao',
    ]) {
      expect(await chiama(corpo)).toMatchObject({ stato: 400 })
    }
    expect(fonte.richiesteFatte).toBe(0)
  })

  it('la stessa classifica non si rilegge prima di 6 ore, e dice quando riprovare', async () => {
    await chiama(FILTRO)
    const r = await chiama(FILTRO)
    expect(r.stato).toBe(429)
    expect(r.corpo).toMatchObject({ esito: 'troppo-presto' })
    expect(r.corpo.riprovaDopo).toBe(new Date(ADESSO.getTime() + 6 * 3_600_000).toISOString())
    expect(fonte.richiesteFatte).toBe(1)
  })

  it('un’altra classifica si può leggere subito', async () => {
    await chiama(FILTRO)
    expect((await chiama({ ...FILTRO, tipo: 'T' })).stato).toBe(200)
    expect(fonte.richiesteFatte).toBe(2)
  })

  it('dopo 6 ore si rilegge', async () => {
    await chiama(FILTRO)
    archivio.classificheComplete.get('I|OL|S|M')!.letta_il = new Date(
      ADESSO.getTime() - 6 * 3_600_000,
    ).toISOString()
    expect((await chiama(FILTRO)).stato).toBe(200)
  })

  it('tetto di letture all’ora per tutta la compagnia', async () => {
    for (let i = 0; i < 10; i++) {
      archivio.diario.push({
        tipo: 'ranking',
        chiave: `x${i}`,
        esito: 'ok',
        messaggio: '',
        richieste: 1,
        giorno: '2026-11-10',
        istante: ADESSO.getTime() - 60_000,
      })
    }
    const r = await chiama(FILTRO)
    expect(r.stato).toBe(429)
    expect(r.corpo).toMatchObject({ esito: 'troppe-richieste' })
    expect(fonte.richiesteFatte).toBe(0)
  })

  it('Fitarco non risponde: errore nel diario con il segno del blocco, nessuna riprova a raffica', async () => {
    fonte.risposta = { ok: false, motivo: 'http', dettaglio: '503' }
    const r = await chiama(FILTRO)
    expect(r.stato).toBe(503)
    expect(r.corpo).toMatchObject({ esito: 'fitarco-non-risponde' })
    expect(archivio.diario.at(-1)!.messaggio.startsWith(PREFISSO_BLOCCO)).toBe(true)
    // Subito dopo, un'altra classifica non parte nemmeno.
    const ancora = await chiama({ ...FILTRO, tipo: 'T' })
    expect(ancora.stato).toBe(503)
    expect(fonte.richiesteFatte).toBe(1)
  })

  it('una risposta di formato inatteso è un errore del sito, non nostro: 502 e niente salvato', async () => {
    fonte.risposta = { ok: true, html: '<div>pagina cambiata</div>' }
    const r = await chiama(FILTRO)
    expect(r.stato).toBe(502)
    expect(r.corpo).toMatchObject({ esito: 'errore' })
    expect(archivio.classificheComplete.size).toBe(0)
    expect(archivio.diario.at(-1)).toMatchObject({ esito: 'errore' })
  })

  it('conti che non tornano: la classifica vecchia resta e l’atleta lo sa', async () => {
    fonte.risposta = { ok: true, html: esempio('ranking') } // dichiara 13, ne ha 6
    const r = await chiama(FILTRO)
    expect(r).toMatchObject({ stato: 200, corpo: { esito: 'anomalia' } })
    expect(archivio.classificheComplete.size).toBe(0)
  })

  it('un errore non previsto del database passa in alto (lo gestisce la funzione)', async () => {
    archivio.classificheRanking = async () => {
      throw new Error('database giù')
    }
    await expect(chiama(FILTRO)).rejects.toThrow('database giù')
  })
})
