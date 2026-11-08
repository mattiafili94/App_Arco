import { beforeEach, describe, expect, it } from 'vitest'
import {
  accodaRanking,
  giornoItaliano,
  giro,
  ritardoNuovoTentativo,
  statoPianificazione,
  type Contesto,
  type Fonte,
} from '../aggiornamento'
import type { FileScaricato, RichiestaFitarco, RispostaFitarco } from '../fitarco'
import { esempio, type Esempio } from '../fitarco/esempi'
import { pdfConRighe } from '../fitarco/pdf-di-prova'
import { ArchivioFinto } from './archivio-finto'

const OGGI = '2026-11-08'
const PDF_URL = 'https://www.fitarco-italia.org/upload_2026/r2611039.pdf'

/** Il PDF dei risultati della gara R2611039 (finto): Mario Rossi è il nostro atleta. */
const righePdf = (totaleRossi = 534, codice = 'R2611039') => [
  'Torneo di prova',
  `Arcieri Eugubini (${codice})`,
  'Gubbio, 24-10-2026',
  'Arco Ricurvo - Senior Maschile',
  'Pos. Atleta Cat. Società 18m-1 18m-2 Totale 10 9',
  '1 2- 7A VERDI Luca 02 11004 Arcieri di Assisi 280/ 1 272/ 1 552 21 26',
  `2 3- 2D ROSSI Mario 02 11003 Arcieri Eugubini 263/ 2 ${totaleRossi - 263}/ 2 ${totaleRossi} 17 25`,
]

/** Fitarco finto: risponde con gli esempi anonimizzati e conta le richieste. */
class FonteFinta implements Fonte {
  richiesteFatte = 0
  chiamate: string[] = []
  risposte: Partial<Record<string, RispostaFitarco | Esempio>> = {}
  pdf: FileScaricato = { ok: true, dati: pdfConRighe(righePdf()) }

  async leggi(r: RichiestaFitarco): Promise<RispostaFitarco> {
    this.richiesteFatte++
    const render = r.corpo.get('render')!
    this.chiamate.push(`${render} ${r.corpo.get('params')}`)
    const predefinite: Record<string, Esempio> = {
      lista_calendario_results: 'calendario',
      scheda_gara_result: 'scheda-gara',
      scheda_invito_result: 'invito',
      scheda_tesserato_result: 'scheda-atleta',
      lista_ranking_gare_results: 'ranking',
    }
    const risposta = this.risposte[render] ?? predefinite[render]!
    return typeof risposta === 'string' ? { ok: true, html: esempio(risposta) } : risposta
  }

  async scarica(url: string): Promise<FileScaricato> {
    this.richiesteFatte++
    this.chiamate.push(`scarica ${url}`)
    return this.pdf
  }
}

let archivio: ArchivioFinto
let fonte: FonteFinta
let ctx: Contesto
const OPZIONI = {
  massimo: 20,
  massimoPesanti: 20,
  scadenza: Infinity,
  adesso: () => archivio.adesso,
}

beforeEach(() => {
  archivio = new ArchivioFinto()
  archivio.oggi = OGGI
  archivio.adesso = Date.parse(`${OGGI}T10:00:00Z`)
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
  ctx = { archivio, fonte, oggi: OGGI }
})

/** Esegue un giro con una sola lettura già in lista. */
const esegui = async (
  tipo: Parameters<ArchivioFinto['accoda']>[0][number]['tipo'],
  chiave: string,
) => {
  archivio.coda = [{ tipo, chiave, priorita: 100, tentativi: 0, daFareDal: 0, ultimoErrore: null }]
  // Niente altro in lista: la pianificazione aggiunge cose con priorità più bassa.
  const r = await giro(ctx, { ...OPZIONI, massimo: 1 })
  return r.eseguite[0]!
}

describe('strumenti del motore', () => {
  it('data italiana di oggi', () => {
    expect(giornoItaliano(new Date('2026-11-07T23:30:00Z'))).toBe('2026-11-08')
    expect(giornoItaliano(new Date('2026-07-01T21:59:00Z'))).toBe('2026-07-01')
  })

  it('riprova dopo 2, 4, 8… ore, al massimo dopo un giorno', () => {
    expect(ritardoNuovoTentativo(1)).toBe(2 * 3_600_000)
    expect(ritardoNuovoTentativo(3)).toBe(8 * 3_600_000)
    expect(ritardoNuovoTentativo(10)).toBe(24 * 3_600_000)
  })

  it('gare rilevanti: Umbria dall’anno in corso e tutte quelle dei nostri atleti', () => {
    const gara = (codice: string, dal: string, umbria: boolean, conPartecipanti: boolean) => ({
      codice,
      dal,
      al: dal,
      stato: 'omologata' as const,
      in_calendario_umbria: umbria,
      ha_invito: false,
      url_risultati: null,
      con_partecipanti: conPartecipanti,
      classifica_provvisoria: true,
    })
    const s = statoPianificazione(
      {
        ultimeLetture: [{ tipo: 'calendario', chiave: '2026', letto_il: '2026-11-01' }],
        anniStorico: [2025],
        gare: [
          gara('R1', '2026-03-01', true, false),
          gara('R2', '2025-03-01', true, false),
          gara('R3', '2024-03-01', false, true),
        ],
        atleti: [{ id: 'a1' }],
      },
      OGGI,
    )
    expect(s.gare.map((g) => g.rilevante)).toEqual([true, false, true])
    expect(s.gare[0]!.risultati).toEqual({ provvisoria: true })
    expect(s.ultimeLetture.get('calendario|2026')).toBe('2026-11-01')
  })
})

describe('un giro di lavoro', () => {
  it('pianifica, legge e scrive nel diario: primo giro da database vuoto', async () => {
    const r = await giro(ctx, OPZIONI)
    // Scheda del nuovo atleta prima di tutto, poi il calendario dell'anno.
    expect(r.eseguite.slice(0, 2).map((e) => `${e.tipo} ${e.chiave} ${e.esito}`)).toEqual([
      'scheda-atleta a1 ok',
      'calendario 2026 ok',
    ])
    expect(archivio.storici.get('a1')).toHaveLength(43)
    expect(archivio.gareSalvate.get('R2611040')).toMatchObject({ stato: 'invito', ha_invito: true })
    expect(archivio.diario.every((d) => d.richieste >= 1)).toBe(true)
    // Le letture fatte escono dalla lista; il secondo giro non ripete scheda e calendario 2026, ma
    // legge i calendari degli anni dello storico (2024, 2025). Il 2027 (è novembre) era già nel primo.
    const secondo = (await giro(ctx, OPZIONI)).eseguite.map((e) => `${e.tipo} ${e.chiave}`)
    expect(secondo).not.toContain('calendario 2026')
    expect(secondo).not.toContain('scheda-atleta a1')
    expect(secondo).toEqual(expect.arrayContaining(['calendario 2024', 'calendario 2025']))
  })

  it('rispetta i limiti: numero di letture, letture pesanti e tempo', async () => {
    const pochi = await giro(ctx, { massimo: 1, massimoPesanti: 1, scadenza: Infinity })
    expect(pochi.eseguite).toHaveLength(1)

    archivio.coda = [
      {
        tipo: 'calendario',
        chiave: '2026',
        priorita: 9,
        tentativi: 0,
        daFareDal: 0,
        ultimoErrore: null,
      },
      {
        tipo: 'calendario',
        chiave: '2025',
        priorita: 8,
        tentativi: 0,
        daFareDal: 0,
        ultimoErrore: null,
      },
    ]
    archivio.diario = [
      {
        tipo: 'scheda-atleta',
        chiave: 'a1',
        esito: 'ok',
        messaggio: '',
        richieste: 1,
        giorno: OGGI,
      },
    ]
    const leggeri = await giro(ctx, { massimo: 10, massimoPesanti: 1, scadenza: Infinity })
    expect(leggeri.eseguite.filter((e) => e.tipo === 'calendario')).toHaveLength(1)

    let t = 0
    const finito = await giro(ctx, {
      massimo: 10,
      massimoPesanti: 10,
      scadenza: 1,
      adesso: () => t++,
    })
    expect(finito.fermato).toContain('Tempo finito')
  })

  it('un errore di formato rimanda la lettura e scrive nel diario, il giro continua', async () => {
    fonte.risposte.scheda_tesserato_result = { ok: true, html: '<div>pagina cambiata</div>' }
    const r = await giro(ctx, OPZIONI)
    expect(r.eseguite[0]).toMatchObject({ tipo: 'scheda-atleta', esito: 'errore' })
    expect(r.eseguite[1]).toMatchObject({ tipo: 'calendario', esito: 'ok' })
    const rimandata = archivio.coda.find((c) => c.tipo === 'scheda-atleta')!
    expect(rimandata).toMatchObject({ tentativi: 1, daFareDal: archivio.adesso + 2 * 3_600_000 })
    expect(rimandata.ultimoErrore).toContain('contenitore')
  })

  it('se Fitarco non risponde si ferma subito', async () => {
    fonte.risposte.scheda_tesserato_result = { ok: false, motivo: 'http', dettaglio: '503' }
    const r = await giro(ctx, OPZIONI)
    expect(r.eseguite).toHaveLength(1)
    expect(r.fermato).toContain('Fitarco non risponde (http: 503)')
    expect(fonte.richiesteFatte).toBe(1)
  })
})

describe('le singole letture', () => {
  beforeEach(async () => {
    // Database come dopo il primo giro: calendario e storico già letti.
    archivio.diario = [
      {
        tipo: 'scheda-atleta',
        chiave: 'a1',
        esito: 'ok',
        messaggio: '',
        richieste: 1,
        giorno: OGGI,
      },
    ]
    await esegui('calendario', '2026')
    await esegui('scheda-atleta', 'a1')
    fonte.chiamate = []
  })

  it('calendario: la seconda volta non cambia niente', async () => {
    expect(await esegui('calendario', '2026')).toMatchObject({
      esito: 'invariato',
      messaggio: '0 gare nuove o cambiate su 21',
    })
  })

  it('calendario: se torna vuoto non si salva niente (sentinella)', async () => {
    fonte.risposte.lista_calendario_results = { ok: true, html: '<div class="risultati"></div>' }
    const r = await esegui('calendario', '2026')
    expect(r).toMatchObject({ esito: 'anomalia' })
    expect(r.messaggio).toContain('vuoto')
    expect(archivio.gareSalvate.size).toBeGreaterThan(21)
  })

  it('calendario: una gara cambiata viene aggiornata, la sentinella avvisa se se ne perdono tante', async () => {
    archivio.gareSalvate.get('R2611001')!.localita = 'Altrove'
    fonte.risposte.lista_calendario_results = {
      ok: true,
      html: esempio('calendario').replace(
        /<div class="tab_row">[\s\S]*?(?=<div class="tab_row">)/g,
        (m, i: number) => (i % 3 ? '' : m),
      ),
    }
    const r = await esegui('calendario', '2026')
    expect(r.esito).toBe('anomalia')
    expect(r.messaggio).toContain('controllare')
  })

  it('scheda gara: prende il PDF individuale (non quello a squadre)', async () => {
    expect(await esegui('scheda-gara', 'R2611039')).toMatchObject({
      esito: 'ok',
      messaggio: 'Pubblicato il PDF dei risultati',
    })
    expect(archivio.gareSalvate.get('R2611039')).toMatchObject({
      url_risultati: PDF_URL,
      ha_invito: true,
    })
    expect(await esegui('scheda-gara', 'R2611039')).toMatchObject({
      esito: 'invariato',
      messaggio: 'PDF già noto',
    })
  })

  it('scheda gara: risultati non ancora pubblicati, o gara sconosciuta', async () => {
    fonte.risposte.scheda_gara_result = 'scheda-gara-futura'
    archivio.gareSalvate.get('R2611040')!.ha_invito = true
    expect(await esegui('scheda-gara', 'R2611040')).toMatchObject({
      esito: 'invariato',
      messaggio: 'Risultati non ancora pubblicati',
    })
    archivio.gareSalvate.get('R2611040')!.ha_invito = false
    expect(await esegui('scheda-gara', 'R2611040')).toMatchObject({
      esito: 'ok',
      messaggio: 'Scheda aggiornata',
    })
    expect(await esegui('scheda-gara', 'R9999999')).toMatchObject({ esito: 'errore' })
  })

  it('invito: nuovo, invariato, cambiato', async () => {
    archivio.gareSalvate.get('R2611040')!.ha_invito = false
    expect(await esegui('invito', 'R2611040')).toMatchObject({
      esito: 'ok',
      messaggio: 'Invito nuovo',
    })
    expect(archivio.gareSalvate.get('R2611040')!.ha_invito).toBe(true)
    expect(archivio.inviti.get('R2611040')!.testo).toContain('ISCRIZIONI')
    expect(await esegui('invito', 'R2611040')).toMatchObject({ esito: 'invariato' })
    fonte.risposte.scheda_invito_result = {
      ok: true,
      html: esempio('invito').replace('28 posti', '30 posti'),
    }
    expect(await esegui('invito', 'R2611040')).toMatchObject({
      esito: 'ok',
      messaggio: 'Invito cambiato',
    })
  })

  it('scheda atleta: dati, gare nuove dallo storico, poi invariata', async () => {
    const a = archivio.atletiSalvati[0]!
    expect(a.campi).toMatchObject({ classe: 'SM', genere: 'M' })
    expect(archivio.gareSalvate.get('N2511039')).toMatchObject({
      stato: 'sconosciuto',
      in_calendario_umbria: false,
    })
    expect(await esegui('scheda-atleta', 'a1')).toMatchObject({
      esito: 'invariato',
      messaggio: 'Storico invariato (43 gare)',
    })
  })

  it('scheda atleta: storico più corto (sentinella), matricola sbagliata, atleta non attivo', async () => {
    fonte.risposte.scheda_tesserato_result = {
      ok: true,
      html: esempio('scheda-atleta').replace(/<h5 class="anno">2024<\/h5>[\s\S]*$/, '</div></div>'),
    }
    expect(await esegui('scheda-atleta', 'a1')).toMatchObject({ esito: 'anomalia' })
    expect(archivio.storici.get('a1')).toHaveLength(43)

    archivio.atletiSalvati[0]!.matricola = '900002'
    expect(await esegui('scheda-atleta', 'a1')).toMatchObject({
      esito: 'errore',
      messaggio: expect.stringContaining('900001'),
    })

    archivio.atletiSalvati[0]!.attivo = false
    expect(await esegui('scheda-atleta', 'a1')).toMatchObject({
      esito: 'invariato',
      messaggio: 'Atleta non più attivo',
    })
  })

  it('scheda atleta: lo storico cambiato si risalva', async () => {
    archivio.storici.set(
      'a1',
      archivio.storici.get('a1')!.map((r, i) => (i === 0 ? { ...r, totale: 1 } : r)),
    )
    expect(await esegui('scheda-atleta', 'a1')).toMatchObject({
      esito: 'ok',
      messaggio: expect.stringContaining('43 gare'),
    })
  })

  describe('risultati', () => {
    beforeEach(async () => {
      await esegui('scheda-gara', 'R2611039')
    })

    it('salva la classifica con i nostri atleti collegati, provvisoria finché non è omologata', async () => {
      archivio.gareSalvate.get('R2611039')!.stato = 'da-omologare'
      expect(await esegui('risultati', 'R2611039')).toMatchObject({
        esito: 'ok',
        messaggio: '2 atleti, 1 dei nostri, provvisoria',
      })
      const salvata = archivio.classifiche.get('R2611039')!
      expect(salvata.righe.map((r) => r.atleta_id)).toEqual([null, 'a1'])
      expect(salvata.impronta).toMatch(/^[0-9a-f]{64}$/)
      // Stesso PDF, sempre provvisoria: niente da fare.
      const seconda = await esegui('risultati', 'R2611039')
      expect(seconda).toMatchObject({ esito: 'invariato' })
      // Omologata: stesso PDF, ma si risalva come definitiva.
      archivio.gareSalvate.get('R2611039')!.stato = 'omologata'
      expect(await esegui('risultati', 'R2611039')).toMatchObject({
        esito: 'ok',
        messaggio: '2 atleti, 1 dei nostri',
      })
      expect(archivio.classifiche.get('R2611039')!.provvisoria).toBe(false)
    })

    it('sentinella: un nostro atleta con un totale diverso dallo storico', async () => {
      fonte.pdf = { ok: true, dati: pdfConRighe(righePdf(530)) }
      const r = await esegui('risultati', 'R2611039')
      expect(r.esito).toBe('anomalia')
      expect(r.messaggio).toContain('Mario Rossi: totale diverso dallo storico')
      // I dati del PDF si salvano comunque (il PDF è la fonte ufficiale).
      expect(archivio.classifiche.has('R2611039')).toBe(true)
    })

    it('sentinella: un nostro atleta che manca dal PDF', async () => {
      fonte.pdf = { ok: true, dati: pdfConRighe(righePdf().slice(0, -1)) }
      expect((await esegui('risultati', 'R2611039')).messaggio).toContain(
        'Mario Rossi: non trovato nel PDF',
      )
    })

    it('PDF di un’altra gara, PDF mancante, link mancante, sito che non risponde', async () => {
      fonte.pdf = { ok: true, dati: pdfConRighe(righePdf(534, 'R2611001')) }
      expect(await esegui('risultati', 'R2611039')).toMatchObject({
        esito: 'errore',
        messaggio: 'Il PDF è della gara R2611001',
      })
      fonte.pdf = { ok: false, motivo: 'http', dettaglio: '404' }
      expect(await esegui('risultati', 'R2611039')).toMatchObject({
        esito: 'errore',
        messaggio: expect.stringContaining('404'),
      })
      expect(await esegui('risultati', 'R2611001')).toMatchObject({
        esito: 'errore',
        messaggio: expect.stringContaining('Manca il link'),
      })
      fonte.pdf = { ok: false, motivo: 'rete', dettaglio: 'timeout' }
      archivio.coda = [
        {
          tipo: 'risultati',
          chiave: 'R2611039',
          priorita: 100,
          tentativi: 0,
          daFareDal: 0,
          ultimoErrore: null,
        },
      ]
      const r = await giro(ctx, OPZIONI)
      expect(r.fermato).toContain('Il PDF non si scarica')
    })
  })

  it('una risposta senza dati è un errore di formato', async () => {
    fonte.risposte.scheda_invito_result = { ok: false, motivo: 'vuota', dettaglio: '' }
    expect(await esegui('invito', 'R2611040')).toMatchObject({
      esito: 'errore',
      messaggio: 'Risposta Fitarco senza dati (vuota)',
    })
  })

  it('ranking: mette in lista le combinazioni dei nostri atleti e salva solo i nostri', async () => {
    archivio.atletiSalvati[0]!.classi_ranking = { Indoor: 'SM' }
    archivio.atletiSalvati[0]!.matricola = '900011'
    expect(await accodaRanking(ctx)).toBe(1)
    expect(archivio.coda.map((c) => `${c.tipo} ${c.chiave}`)).toContain('ranking I|OL|S|M')
    expect(await esegui('ranking', 'I|OL|S|M')).toMatchObject({
      esito: 'ok',
      messaggio: '1 dei nostri su 1 in classifica',
    })
    expect(fonte.chiamate.at(-1)).toContain('"idRankingTipo":"I"')
    expect(archivio.ranking.get('I|OL|a1')).toHaveLength(1)
    expect(await esegui('ranking', 'T|OL|S|M')).toMatchObject({ esito: 'invariato' })
  })
})
