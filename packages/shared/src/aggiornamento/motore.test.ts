import { beforeEach, describe, expect, it } from 'vitest'
import {
  accodaRanking,
  giornoItaliano,
  giro,
  ritardoNuovoTentativo,
  statoPianificazione,
  type Contesto,
  type Fonte,
  type GaraSalvata,
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

  it('gare rilevanti: Umbria dal 7/11/2026 (primo accesso) e tutte quelle dei nostri atleti', () => {
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
        gare: [
          gara('R1', '2026-03-01', true, false),
          gara('R2', '2025-03-01', true, false),
          gara('R3', '2024-03-01', false, true),
          gara('R4', '2026-11-07', true, false),
          gara('R5', '2026-12-12', true, false),
          gara('R6', '2026-12-12', false, false),
        ],
        atleti: [{ id: 'a1' }],
      },
      OGGI,
    )
    // Prima del primo accesso: solo le gare dei nostri atleti; dopo: tutte quelle dell'Umbria.
    expect(s.gare.map((g) => g.rilevante)).toEqual([false, false, true, true, true, false])
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
    // Le letture fatte escono dalla lista; il secondo giro non ripete scheda e calendario 2026, e non
    // legge i calendari degli anni passati dello storico (2024, 2025): solo quello dell'anno in corso.
    const secondo = (await giro(ctx, OPZIONI)).eseguite.map((e) => `${e.tipo} ${e.chiave}`)
    expect(secondo).not.toContain('calendario 2026')
    expect(secondo).not.toContain('scheda-atleta a1')
    expect(secondo.filter((l) => l.startsWith('calendario'))).toEqual([])
  })

  it('con tante letture pesanti in lista, fa comunque quelle leggere', async () => {
    archivio.diario = [
      {
        tipo: 'scheda-atleta',
        chiave: 'a1',
        esito: 'ok',
        messaggio: '',
        richieste: 1,
        giorno: OGGI,
      },
      {
        tipo: 'calendario',
        chiave: '2026',
        esito: 'ok',
        messaggio: '',
        richieste: 1,
        giorno: OGGI,
      },
      {
        tipo: 'calendario',
        chiave: '2027',
        esito: 'ok',
        messaggio: '',
        richieste: 1,
        giorno: OGGI,
      },
    ]
    const lavoro = (tipo: 'risultati' | 'invito', chiave: string, priorita: number) => ({
      tipo,
      chiave,
      priorita,
      tentativi: 0,
      daFareDal: 0,
      ultimoErrore: null,
    })
    archivio.coda = [
      ...Array.from({ length: 30 }, (_, i) =>
        lavoro('risultati', `R26110${String(i).padStart(2, '0')}`, 15),
      ),
      lavoro('invito', 'R2611040', 5),
    ]
    const r = await giro(ctx, { ...OPZIONI, massimo: 6, massimoPesanti: 1 })
    expect(r.eseguite.map((e) => e.tipo)).toEqual(['risultati', 'invito'])
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
    // Le classifiche sono letture pesanti come i calendari: tra le due ne passa una sola.
    expect(
      leggeri.eseguite.filter((e) => e.tipo === 'calendario' || e.tipo === 'ranking'),
    ).toHaveLength(1)

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
    expect(r.fermato).toBe('Fitarco non risponde: risposta http 503')
    expect(fonte.richiesteFatte).toBe(1)
  })

  it('dopo un "Fitarco non risponde" tutte le letture si fermano per 6 ore', async () => {
    fonte.risposte.scheda_tesserato_result = { ok: false, motivo: 'http', dettaglio: '503' }
    await giro(ctx, OPZIONI)
    delete fonte.risposte.scheda_tesserato_result

    archivio.adesso += 5 * 3_600_000
    const inPausa = await giro(ctx, OPZIONI)
    expect(inPausa).toEqual({
      pianificate: 0,
      eseguite: [],
      fermato: expect.stringContaining('In pausa'),
    })
    expect(fonte.richiesteFatte).toBe(1)

    archivio.adesso += 2 * 3_600_000
    const ripartito = await giro(ctx, OPZIONI)
    expect(ripartito.eseguite.length).toBeGreaterThan(0)
    expect(ripartito.fermato).toBeNull()
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

  it('calendario provvisorio: le gare con codice temporaneo non si salvano', async () => {
    fonte.risposte.lista_calendario_results = {
      ok: true,
      html: esempio('calendario').replace(/data-id="R2611044"/, 'data-id="tmp11564"'),
    }
    const r = await esegui('calendario', '2026')
    expect(r.messaggio).toBe(
      '0 gare nuove o cambiate su 20 (1 con codice provvisorio, non salvate)',
    )
    expect(archivio.gareSalvate.has('tmp11564')).toBe(false)
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
    expect(await esegui('scheda-gara', 'R9999999')).toMatchObject({
      esito: 'invariato',
      messaggio: 'Gara non più nel database: lettura tolta dalla lista',
    })
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

  describe('notifica del nuovo invito', () => {
    const imposta = (campi: Partial<GaraSalvata>) =>
      Object.assign(archivio.gareSalvate.get('R2611040')!, { ha_invito: false }, campi)

    it('invito nuovo di una gara futura: una notifica, che dice quale gara', async () => {
      imposta({ dal: '2026-12-12', al: '2026-12-13', tipologia: '18 m', localita: 'Perugia (PG)' })
      await esegui('invito', 'R2611040')
      expect(archivio.notifiche).toEqual([
        {
          gara_codice: 'R2611040',
          titolo: 'Nuovo invito',
          testo: "È arrivato l'invito di 18 m · Perugia (PG) (12–13 dic 2026). Tocca per leggerlo.",
        },
      ])
    })

    it('la gara di oggi è ancora futura: notifica', async () => {
      imposta({ dal: OGGI, al: OGGI })
      await esegui('invito', 'R2611040')
      expect(archivio.notifiche).toHaveLength(1)
    })

    it('gara già passata (es. atleta nuovo con tante gare vecchie): nessuna notifica', async () => {
      imposta({ dal: '2026-11-01', al: '2026-11-02' })
      expect(await esegui('invito', 'R2611040')).toMatchObject({ messaggio: 'Invito nuovo' })
      expect(archivio.notifiche).toEqual([])
    })

    it('gara annullata: nessuna notifica', async () => {
      imposta({ dal: '2026-12-12', al: '2026-12-12', stato: 'annullata' })
      await esegui('invito', 'R2611040')
      expect(archivio.notifiche).toEqual([])
    })

    it('invito già salvato o solo modificato: nessuna notifica', async () => {
      imposta({ dal: '2026-12-12', al: '2026-12-12' })
      await esegui('invito', 'R2611040')
      archivio.notifiche = []
      await esegui('invito', 'R2611040')
      fonte.risposte.scheda_invito_result = {
        ok: true,
        html: esempio('invito').replace('28 posti', '30 posti'),
      }
      expect(await esegui('invito', 'R2611040')).toMatchObject({ messaggio: 'Invito cambiato' })
      expect(archivio.notifiche).toEqual([])
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
      expect(r.messaggio).toContain('Mario Rossi (OL): totale diverso dallo storico')
      // I dati del PDF si salvano comunque (il PDF è la fonte ufficiale).
      expect(archivio.classifiche.has('R2611039')).toBe(true)
    })

    it('sentinella: un PDF senza atleti (formato diverso) non si salva', async () => {
      fonte.pdf = { ok: true, dati: pdfConRighe(righePdf().slice(0, 3)) }
      const r = await esegui('risultati', 'R2611039')
      expect(r).toMatchObject({
        esito: 'anomalia',
        messaggio: 'Nessun atleta trovato nel PDF: non salvo niente',
      })
      expect(archivio.classifiche.has('R2611039')).toBe(false)
    })

    it('sentinella: un nostro atleta che manca dal PDF', async () => {
      fonte.pdf = { ok: true, dati: pdfConRighe(righePdf().slice(0, -1)) }
      expect((await esegui('risultati', 'R2611039')).messaggio).toContain(
        'Mario Rossi (OL): non trovato nel PDF',
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

  describe('classifiche ranking complete', () => {
    /** La classifica di esempio dichiara 13 atleti ma ne contiene 6: si adatta il totale al vero. */
    const rankingCoerente = () => ({
      ok: true as const,
      html: esempio('ranking').replace('Numero totale: 13', 'Numero totale: 6'),
    })

    it('mette in lista le classifiche dei nostri atleti', async () => {
      archivio.atletiSalvati[0]!.classi_ranking = { Indoor: 'SM' }
      expect(await accodaRanking(ctx)).toBe(1)
      expect(archivio.coda.map((c) => `${c.tipo} ${c.chiave}`)).toContain('ranking I|OL|S|M')
    })

    it('la legge intera (tutta Italia) e la salva con i suoi numeri', async () => {
      fonte.risposte.lista_ranking_gare_results = rankingCoerente()
      expect(await esegui('ranking', 'I|OL|S|M')).toMatchObject({
        esito: 'ok',
        messaggio: '6 atleti, 2 dei nostri',
      })
      const richiesta = fonte.chiamate.at(-1)!
      expect(richiesta).toContain('"idRankingTipo":"I"')
      expect(richiesta).toContain('"idComitato":""')
      const salvata = archivio.classificheComplete.get('I|OL|S|M')!
      expect(salvata).toMatchObject({
        categoria: 'Arco Ricurvo - Seniores Maschile',
        totale: 6,
        letta_il: new Date(archivio.adesso).toISOString(),
      })
      expect(salvata.righe).toHaveLength(6)
    })

    it('se Fitarco dichiara più atleti di quelli letti, non salva e lo dice', async () => {
      const r = await esegui('ranking', 'I|OL|S|M')
      expect(r).toMatchObject({ esito: 'anomalia' })
      expect(r.messaggio).toContain('dichiara 13 atleti ma ne ho letti 6')
      expect(archivio.classificheComplete.size).toBe(0)
    })

    it('una combinazione senza atleti non è un errore: si salva vuota', async () => {
      fonte.risposte.lista_ranking_gare_results = {
        ok: true,
        html: '<div class="no-results">Nessun risultato per questa ricerca</div>',
      }
      expect(await esegui('ranking', 'T|LB|A|F')).toMatchObject({
        esito: 'ok',
        messaggio: '0 atleti, 0 dei nostri',
      })
      expect(archivio.classificheComplete.get('T|LB|A|F')).toMatchObject({ totale: 0, righe: [] })
    })

    it('una lettura vuota non cancella una classifica buona', async () => {
      fonte.risposte.lista_ranking_gare_results = rankingCoerente()
      await esegui('ranking', 'I|OL|S|M')
      fonte.risposte.lista_ranking_gare_results = {
        ok: true,
        html: '<div class="no-results">Nessun risultato per questa ricerca</div>',
      }
      expect(await esegui('ranking', 'I|OL|S|M')).toMatchObject({ esito: 'anomalia' })
      expect(archivio.classificheComplete.get('I|OL|S|M')!.righe).toHaveLength(6)
    })

    it('una chiave non valida si toglie dalla lista senza chiamare Fitarco', async () => {
      const prima = fonte.richiesteFatte
      expect(await esegui('ranking', 'X|OL|S|M')).toMatchObject({ esito: 'invariato' })
      expect(fonte.richiesteFatte).toBe(prima)
    })

    it('il lunedì dalle 10 si rileggono le classifiche scaricate, una per giro', async () => {
      fonte.risposte.lista_ranking_gare_results = rankingCoerente()
      archivio.atletiSalvati[0]!.classi_ranking = { Indoor: 'SM' }
      const vecchia = '2026-11-02T09:30:00.000Z'
      for (const k of ['I|OL|S|M', 'T|CO|S|M', 'C|AN|S|M']) {
        const [tipo, divisione, classe, genere] = k.split('|') as ['I', string, string, 'M']
        archivio.classificheComplete.set(k, {
          tipo,
          divisione,
          classe,
          genere,
          categoria: 'x',
          totale: 6,
          righe: [],
          letta_il: vecchia,
        })
      }
      // Lunedì 9 novembre 2026, 10:05 in Italia.
      archivio.adesso = Date.parse('2026-11-09T09:05:00Z')
      const giriRanking: string[] = []
      for (let i = 0; i < 4; i++) {
        archivio.adesso += 15 * 60_000
        const r = await giro(ctx, { ...OPZIONI, massimo: 6, massimoPesanti: 1 })
        giriRanking.push(...r.eseguite.filter((e) => e.tipo === 'ranking').map((e) => e.chiave))
        expect(r.eseguite.filter((e) => e.tipo === 'ranking').length).toBeLessThanOrEqual(1)
      }
      expect(giriRanking.sort()).toEqual(['C|AN|S|M', 'I|OL|S|M', 'T|CO|S|M'])
      // Finito: non si ripete lo stesso giorno.
      archivio.adesso += 15 * 60_000
      const ancora = await giro(ctx, { ...OPZIONI, massimo: 6, massimoPesanti: 1 })
      expect(ancora.eseguite.filter((e) => e.tipo === 'ranking')).toEqual([])
    })
  })

  it('ranking: solo gli archi usati nelle ultime stagioni', async () => {
    archivio.atletiSalvati[0]!.classi_ranking = { Indoor: 'SM' }
    // Un nudo tirato nel 2022 (arco lasciato) e il ricurvo di adesso.
    archivio.gareSalvate.set('R2211001', {
      ...archivio.gareSalvate.get('R2611039')!,
      codice: 'R2211001',
      dal: '2022-02-01',
      al: '2022-02-01',
    })
    archivio.storici.set('a1', [
      ...archivio.storici.get('a1')!,
      {
        gara_codice: 'R2211001',
        divisione: 'AN',
        classe: 'SM',
        rank: 'SM',
        posizione: 1,
        totale: 450,
      },
    ])
    expect(await accodaRanking(ctx)).toBe(1)
    expect(archivio.coda.filter((c) => c.tipo === 'ranking').map((c) => c.chiave)).toEqual([
      'I|OL|S|M',
    ])
  })
})

describe('gare passate, gare non previste e atleti nuovi', () => {
  beforeEach(async () => {
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
  })

  /** Copia di una gara salvata, con un altro codice e altre date. */
  const copia = (codice: string, dal: string) => {
    archivio.gareSalvate.set(codice, {
      ...archivio.gareSalvate.get('R2611001')!,
      codice,
      dal,
      al: dal,
      url_risultati: PDF_URL,
    })
  }

  it('le gare senza nostri atleti restano finché sono nella finestra (anno in corso + scorso)', async () => {
    copia('R2411999', '2024-03-01')
    copia('R2511999', '2025-03-01')
    await giro(ctx, { ...OPZIONI, massimo: 0 })
    expect(archivio.gareSalvate.has('R2411999')).toBe(false)
    expect(archivio.gareSalvate.has('R2511999')).toBe(true)
    // Le gare del 2024 dello storico restano.
    expect(archivio.gareSalvate.has('R2411016')).toBe(true)
    expect(archivio.diario.at(-1)).toMatchObject({
      chiave: 'gare passate 2025-01-01',
      messaggio: 'Tolte 1 gare degli anni passati senza nostri atleti',
    })
  })

  it('letture già in lista per gare finite prima del 7/11/2026 senza nostri atleti: escono senza richieste', async () => {
    copia('R2611998', '2026-10-04')
    const prima = fonte.richiesteFatte
    for (const tipo of ['scheda-gara', 'risultati'] as const) {
      expect(await esegui(tipo, 'R2611998')).toMatchObject({
        esito: 'invariato',
        messaggio: 'Gara finita prima dell’avvio dell’app senza nostri atleti: non serve',
      })
    }
    expect(fonte.richiesteFatte).toBe(prima)
    // Dopo l'avvio si leggono tutte.
    copia('R2611997', '2026-11-08')
    fonte.pdf = { ok: true, dati: pdfConRighe(righePdf(534, 'R2611997')) }
    expect(await esegui('risultati', 'R2611997')).toMatchObject({ esito: 'ok' })
  })

  it('un atleta che entra dopo: le sue righe nelle classifiche già salvate vengono collegate', async () => {
    // Classifica letta quando c'era solo Mario Rossi: Luca Verdi (11004 nel PDF) non è dei nostri.
    await esegui('scheda-gara', 'R2611039')
    fonte.pdf = {
      ok: true,
      dati: pdfConRighe([
        ...righePdf(),
        '3 2- 1A BIANCHI Anna MF 02 11003 Arcieri Eugubini 200/ 3 200/ 3 400 1 2',
      ]),
    }
    await esegui('risultati', 'R2611039')
    const anna = () =>
      archivio.classifiche
        .get('R2611039')!
        .righe.find((r) => (r as unknown as { cognome: string }).cognome === 'BIANCHI')!
    expect(anna().atleta_id).toBeNull()

    // Entra Anna Bianchi: la sua scheda (stessa gara nello storico) collega la sua riga.
    archivio.atletiSalvati.push({
      id: 'a2',
      matricola: '900001',
      nome: 'Anna',
      cognome: 'Bianchi',
      classi_ranking: {},
      attivo: true,
    })
    const r = await esegui('scheda-atleta', 'a2')
    expect(r.messaggio).toContain('1 righe di classifica collegate')
    expect(anna().atleta_id).toBe('a2')
  })
})
