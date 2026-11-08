/**
 * Il motore dell'aggiornamento dei dati Fitarco: esegue la lista di lavoro un pezzo alla volta.
 *
 * Database (`Archivio`) e sito Fitarco (`Fonte`) arrivano dall'esterno: la funzione del server passa
 * quelli veri, i test quelli finti. Ogni lettura: legge, controlla (lettori + sentinella), salva solo
 * le novità e scrive nel diario `letture` com'è andata.
 */
import {
  ErroreFormatoFitarco,
  estraiRighe,
  leggiCalendario,
  leggiInvito,
  leggiRanking,
  leggiRisultati,
  leggiSchedaAtleta,
  leggiSchedaGara,
  richiestaCalendario,
  richiestaInvito,
  richiestaRanking,
  richiestaSchedaAtleta,
  richiestaSchedaGara,
  type FileScaricato,
  type RichiestaFitarco,
  type RispostaFitarco,
  type StatoGara,
  type TipoRanking,
} from '../fitarco/index.ts'
import type { AtletaNoto } from './atleti.ts'
import {
  pianificaLetture,
  inizioClassificheComplete,
  risultatiProvvisori,
  type Lettura,
  type StatoPianificazione,
  type TipoLettura,
} from './pianifica.ts'
import { combinazioniRanking } from './ranking.ts'
import {
  datiAtletaDaScheda,
  impronta,
  rigaGaraDaCalendario,
  rigaGaraDaStorico,
  rigaInvito,
  righeClassifica,
  righeRanking,
  righeStorico,
  type RigaGara,
  type RigaInvito,
  type RigaPartecipazione,
} from './righe.ts'
import { controllaCalendario, controllaClassifica, controllaStorico } from './sentinella.ts'

// --- Cosa serve dall'esterno ---------------------------------------------------------------------

export interface GaraSalvata extends RigaGara {
  ha_invito: boolean
  url_risultati: string | null
  impronta_risultati: string | null
}

export interface AtletaArchivio extends AtletaNoto {
  classi_ranking: Record<string, string>
}

export type Esito = 'ok' | 'invariato' | 'errore' | 'anomalia'

/** Lo stato "grezzo" dal database, da cui si calcola cosa leggere. */
export interface StatoArchivio {
  /** Ultime letture riuscite: data italiana "AAAA-MM-GG". */
  ultimeLetture: { tipo: string; chiave: string; letto_il: string }[]
  gare: {
    codice: string
    dal: string
    al: string
    stato: StatoGara
    in_calendario_umbria: boolean
    ha_invito: boolean
    url_risultati: string | null
    con_partecipanti: boolean
    /** null: classifica non ancora salvata. */
    classifica_provvisoria: boolean | null
  }[]
  atleti: { id: string }[]
}

export interface Archivio {
  stato(): Promise<StatoArchivio>
  accoda(letture: Lettura[]): Promise<void>
  prossime(quante: number): Promise<{ tipo: TipoLettura; chiave: string; tentativi: number }[]>
  completa(tipo: TipoLettura, chiave: string): Promise<void>
  rimanda(
    tipo: TipoLettura,
    chiave: string,
    tentativi: number,
    errore: string,
    quando: Date,
  ): Promise<void>
  registra(r: {
    tipo: TipoLettura
    chiave: string
    esito: Esito
    messaggio: string
    richieste: number
  }): Promise<void>

  gare(codici: string[]): Promise<GaraSalvata[]>
  gareDiAnno(anno: number): Promise<GaraSalvata[]>
  /** Gare complete: le inserisce o le aggiorna. */
  salvaGare(righe: (RigaGara & { ha_invito?: boolean })[]): Promise<void>
  /** Cambia solo alcuni campi di una gara già salvata. */
  aggiornaGara(codice: string, campi: Partial<GaraSalvata>): Promise<void>
  invito(codice: string): Promise<RigaInvito | null>
  salvaInvito(riga: RigaInvito): Promise<void>
  /** Solo gli atleti attivi. */
  atleti(): Promise<AtletaArchivio[]>
  aggiornaAtleta(id: string, campi: Record<string, unknown>): Promise<void>
  storico(atletaId: string): Promise<RigaPartecipazione[]>
  /** Storico di tutti con la tipologia della gara (per le combinazioni di ranking). */
  storicoConTipologia(): Promise<
    { atleta_id: string; tipologia: string; divisione: string; dal: string }[]
  >
  salvaStorico(atletaId: string, righe: RigaPartecipazione[]): Promise<void>
  /** I nostri atleti nello storico di una gara: uno per arco (divisione). */
  partecipanti(
    codiceGara: string,
  ): Promise<{ atletaId: string; divisione: string; totale: number | null }[]>
  /**
   * Toglie dalle classifiche delle gare iniziate prima di `primaDel` le righe degli altri atleti
   * (restano i nostri). Restituisce quante righe ha tolto.
   */
  potaClassifiche(primaDel: string): Promise<number>
  /** Toglie le gare iniziate prima di `primaDel` che nessun nostro atleta ha fatto. Quante ne ha tolte. */
  potaGare(primaDel: string): Promise<number>
  /** Istante (ms) dell'ultima lettura fallita perché Fitarco non rispondeva, o null. */
  ultimoBlocco(): Promise<number | null>
  /** La classifica salvata è provvisoria? null se non c'è. */
  classificaProvvisoria(codiceGara: string): Promise<boolean | null>
  salvaClassifica(
    codice: string,
    righe: unknown[],
    impronta: string,
    provvisoria: boolean,
  ): Promise<void>
  salvaRanking(
    tipo: TipoRanking,
    divisione: string,
    atleti: string[],
    righe: unknown[],
  ): Promise<void>
}

export interface Fonte {
  leggi(richiesta: RichiestaFitarco): Promise<RispostaFitarco>
  scarica(url: string): Promise<FileScaricato>
  readonly richiesteFatte: number
}

export interface Contesto {
  archivio: Archivio
  fonte: Fonte
  /** Data italiana di oggi, "AAAA-MM-GG". */
  oggi: string
}

/** Nel diario, l'inizio del messaggio di una lettura fallita perché Fitarco non rispondeva. */
export const PREFISSO_BLOCCO = 'Fitarco non risponde: '

/** Dopo un "Fitarco non risponde", tutte le letture si fermano per questo tempo. */
export const PAUSA_DOPO_BLOCCO_MS = 6 * 3_600_000

/** Il sito Fitarco non risponde o ci blocca: ci si ferma subito e si riprova un'altra volta. */
export class FitarcoNonRisponde extends Error {
  constructor(messaggio: string) {
    super(messaggio)
    this.name = 'FitarcoNonRisponde'
  }
}

/** "AAAA-MM-GG" del giorno italiano corrispondente a un istante. */
export function giornoItaliano(istante: Date): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Rome' }).format(istante)
}

/** Dallo stato del database a quello che serve a `pianificaLetture`. */
export function statoPianificazione(a: StatoArchivio, oggi: string): StatoPianificazione {
  const inizioAnno = `${oggi.slice(0, 4)}-01-01`
  return {
    oggi,
    ultimeLetture: new Map(a.ultimeLetture.map((l) => [`${l.tipo}|${l.chiave}`, l.letto_il])),
    gare: a.gare.map((g) => ({
      codice: g.codice,
      dal: g.dal,
      al: g.al,
      stato: g.stato,
      // Tutte le gare dell'Umbria dall'anno in corso, e tutte quelle dei nostri atleti.
      rilevante: (g.in_calendario_umbria && g.dal >= inizioAnno) || g.con_partecipanti,
      inCalendarioUmbria: g.in_calendario_umbria,
      haInvito: g.ha_invito,
      urlRisultati: g.url_risultati,
      risultati:
        g.classifica_provvisoria === null ? null : { provvisoria: g.classifica_provvisoria },
    })),
    atleti: a.atleti,
  }
}

// --- Le singole letture ----------------------------------------------------------------------------

interface Esecuzione {
  esito: Exclude<Esito, 'errore'>
  messaggio: string
}

async function leggiHtml(fonte: Fonte, richiesta: RichiestaFitarco): Promise<string> {
  const r = await fonte.leggi(richiesta)
  if (r.ok) return r.html
  if (r.motivo === 'stato' || r.motivo === 'vuota') {
    throw new ErroreFormatoFitarco(`Risposta Fitarco senza dati (${r.motivo})`)
  }
  throw new FitarcoNonRisponde(`risposta ${r.motivo} ${r.dettaglio}`)
}

/**
 * Una lettura rimasta in lista per una gara che nel frattempo è stata tolta (es. gara passata senza
 * nostri atleti): esce dalla lista senza chiedere niente a Fitarco.
 */
const GARA_TOLTA: Esecuzione = {
  esito: 'invariato',
  messaggio: 'Gara non più nel database: lettura tolta dalla lista',
}

/**
 * Una lettura rimasta in lista per una gara uscita dalla finestra delle classifiche complete (es. a
 * gennaio, o dopo un cambio della finestra): per quelle basta lo storico degli atleti, niente richieste.
 */
const GARA_FUORI_FINESTRA: Esecuzione = {
  esito: 'invariato',
  messaggio: 'Gara prima dell’anno scorso: basta lo storico degli atleti',
}

/** Codice gara definitivo Fitarco: una lettera e 7 cifre (R2611039). */
const CODICE_DEFINITIVO = /^[A-Z]\d{7}$/

const CAMPI_GARA: (keyof RigaGara)[] = [
  'dal',
  'al',
  'calendario',
  'regione',
  'localita',
  'tipologia',
  'dettaglio',
  'societa_codice',
  'societa_nome',
  'stato',
  'in_calendario_umbria',
]

async function calendario(ctx: Contesto, chiave: string): Promise<Esecuzione> {
  const anno = Number(chiave)
  const tutte = leggiCalendario(await leggiHtml(ctx.fonte, richiestaCalendario(anno)))
  // Nel calendario provvisorio (es. il prossimo anno) molte gare hanno un codice temporaneo
  // ("tmp11564"): diventerebbero doppioni quando arriva quello vero. Si salvano solo i codici definitivi.
  const lette = tutte.filter((g) => CODICE_DEFINITIVO.test(g.codice)).map(rigaGaraDaCalendario)
  const temporanee = tutte.length - lette.length
  const salvate = new Map((await ctx.archivio.gareDiAnno(anno)).map((g) => [g.codice, g]))

  const umbria = (righe: Iterable<{ in_calendario_umbria: boolean }>) =>
    [...righe].filter((g) => g.in_calendario_umbria).length
  const anomalia = controllaCalendario(umbria(salvate.values()), umbria(lette))
  if (anomalia && lette.length === 0) return { esito: 'anomalia', messaggio: anomalia }

  const cambiate = lette
    .filter((r) => {
      const s = salvate.get(r.codice)
      return !s || CAMPI_GARA.some((c) => s[c] !== r[c]) || (r.stato === 'invito' && !s.ha_invito)
    })
    .map((r) => (r.stato === 'invito' ? { ...r, ha_invito: true } : r))
  if (cambiate.length > 0) await ctx.archivio.salvaGare(cambiate)

  const riepilogo =
    `${cambiate.length} gare nuove o cambiate su ${lette.length}` +
    (temporanee > 0 ? ` (${temporanee} con codice provvisorio, non salvate)` : '')
  if (anomalia) return { esito: 'anomalia', messaggio: `${anomalia} (${riepilogo})` }
  return { esito: cambiate.length > 0 ? 'ok' : 'invariato', messaggio: riepilogo }
}

/** Il PDF della classifica individuale (non quello a squadre né quelli degli scontri diretti). */
const PDF_INDIVIDUALE = /\/[a-z]\d{7}\.pdf$/i

async function schedaGara(ctx: Contesto, codice: string): Promise<Esecuzione> {
  const [salvata] = await ctx.archivio.gare([codice])
  if (!salvata) return GARA_TOLTA
  if (salvata.dal < inizioClassificheComplete(ctx.oggi)) return GARA_FUORI_FINESTRA
  const scheda = leggiSchedaGara(await leggiHtml(ctx.fonte, richiestaSchedaGara(codice)))
  const pdf = scheda.risultati.find((d) => PDF_INDIVIDUALE.test(d.url))?.url ?? null

  const campi = {
    ha_invito: scheda.haInvito || salvata.ha_invito,
    url_risultati: pdf ?? salvata.url_risultati,
  }
  if (campi.ha_invito === salvata.ha_invito && campi.url_risultati === salvata.url_risultati) {
    return {
      esito: 'invariato',
      messaggio: pdf ? 'PDF già noto' : 'Risultati non ancora pubblicati',
    }
  }
  const pdfNuovo = pdf !== null && !salvata.url_risultati
  await ctx.archivio.aggiornaGara(codice, campi)
  return {
    esito: 'ok',
    messaggio: pdfNuovo ? 'Pubblicato il PDF dei risultati' : 'Scheda aggiornata',
  }
}

async function invito(ctx: Contesto, codice: string): Promise<Esecuzione> {
  if ((await ctx.archivio.gare([codice])).length === 0) return GARA_TOLTA
  const riga = rigaInvito(codice, leggiInvito(await leggiHtml(ctx.fonte, richiestaInvito(codice))))
  const salvato = await ctx.archivio.invito(codice)
  if (salvato && (Object.keys(riga) as (keyof RigaInvito)[]).every((k) => salvato[k] === riga[k])) {
    return { esito: 'invariato', messaggio: 'Invito invariato' }
  }
  await ctx.archivio.salvaInvito(riga)
  const [gara] = await ctx.archivio.gare([codice])
  if (gara && !gara.ha_invito) await ctx.archivio.aggiornaGara(codice, { ha_invito: true })
  return { esito: 'ok', messaggio: salvato ? 'Invito cambiato' : 'Invito nuovo' }
}

const stessoStorico = (a: RigaPartecipazione[], b: RigaPartecipazione[]) => {
  const chiavi = (righe: RigaPartecipazione[]) =>
    righe
      .map((r) => [r.gara_codice, r.divisione, r.classe, r.rank, r.posizione, r.totale].join('|'))
      .sort()
      .join('\n')
  return chiavi(a) === chiavi(b)
}

async function schedaAtleta(ctx: Contesto, id: string): Promise<Esecuzione> {
  const atleta = (await ctx.archivio.atleti()).find((a) => a.id === id)
  if (!atleta) return { esito: 'invariato', messaggio: 'Atleta non più attivo' }
  const scheda = leggiSchedaAtleta(
    await leggiHtml(ctx.fonte, richiestaSchedaAtleta(atleta.matricola)),
  )
  if (scheda.matricola !== atleta.matricola) {
    throw new ErroreFormatoFitarco(`La scheda letta è della matricola ${scheda.matricola}`)
  }
  await ctx.archivio.aggiornaAtleta(id, {
    ...datiAtletaDaScheda(scheda),
    scheda_letta_il: new Date().toISOString(),
  })

  // Le gare dello storico che non conosciamo ancora (es. fuori regione).
  const codici = [...new Set(scheda.storico.map((g) => g.codice))]
  const note = new Set((await ctx.archivio.gare(codici)).map((g) => g.codice))
  const nuoveGare = codici
    .filter((c) => !note.has(c))
    .map((c) => rigaGaraDaStorico(scheda.storico.find((g) => g.codice === c)!))
  if (nuoveGare.length > 0) await ctx.archivio.salvaGare(nuoveGare)

  const righe = righeStorico(scheda)
  const vecchie = await ctx.archivio.storico(id)
  const anomalia = controllaStorico(vecchie.length, righe.length)
  if (anomalia) return { esito: 'anomalia', messaggio: anomalia }
  if (stessoStorico(vecchie, righe)) {
    return {
      esito: nuoveGare.length > 0 ? 'ok' : 'invariato',
      messaggio: `Storico invariato (${righe.length} gare)`,
    }
  }
  await ctx.archivio.salvaStorico(id, righe)
  return {
    esito: 'ok',
    messaggio: `Storico salvato: ${righe.length} gare (${nuoveGare.length} gare nuove)`,
  }
}

async function risultati(ctx: Contesto, codice: string): Promise<Esecuzione> {
  const [gara] = await ctx.archivio.gare([codice])
  if (!gara) return GARA_TOLTA
  if (gara.dal < inizioClassificheComplete(ctx.oggi)) return GARA_FUORI_FINESTRA
  if (!gara.url_risultati) throw new Error(`Manca il link al PDF della gara ${codice}`)
  const file = await ctx.fonte.scarica(gara.url_risultati)
  if (!file.ok) {
    if (file.motivo === 'http' && file.dettaglio === '404')
      throw new Error('PDF dei risultati non trovato (404)')
    throw new FitarcoNonRisponde(`Il PDF non si scarica (${file.motivo}: ${file.dettaglio})`)
  }

  const provvisoria = risultatiProvvisori(gara, ctx.oggi)
  const impr = await impronta(file.dati)
  const salvata = await ctx.archivio.classificaProvvisoria(codice)
  if (impr === gara.impronta_risultati && salvata === provvisoria) {
    return { esito: 'invariato', messaggio: 'PDF invariato' }
  }

  const letti = leggiRisultati(await estraiRighe(file.dati))
  if (letti.codiceGara && letti.codiceGara !== codice) {
    throw new ErroreFormatoFitarco(`Il PDF è della gara ${letti.codiceGara}`)
  }
  const atleti = await ctx.archivio.atleti()
  const righe = righeClassifica(letti, atleti)
  // Un PDF senza atleti ha un formato che non conosciamo (es. gare "sperimentali"): meglio non salvarlo.
  if (righe.length === 0) {
    return { esito: 'anomalia', messaggio: 'Nessun atleta trovato nel PDF: non salvo niente' }
  }
  await ctx.archivio.salvaClassifica(codice, righe, impr, provvisoria)

  const nostre = righe.filter((r) => r.atleta_id !== null).length
  const riepilogo = `${righe.length} atleti, ${nostre} dei nostri${provvisoria ? ', provvisoria' : ''}`
  const anomalie = controllaClassifica(righe, await ctx.archivio.partecipanti(codice))
  if (anomalie.length === 0) return { esito: 'ok', messaggio: riepilogo }
  const nomi = new Map(atleti.map((a) => [a.id, `${a.nome} ${a.cognome}`]))
  const dettagli = anomalie.map(
    (a) =>
      `${nomi.get(a.atletaId) ?? a.atletaId} (${a.divisione}): ${a.motivo === 'non-trovato' ? 'non trovato nel PDF' : 'totale diverso dallo storico'}`,
  )
  return { esito: 'anomalia', messaggio: `${riepilogo}. Controllare: ${dettagli.join('; ')}` }
}

async function combinazioni(ctx: Contesto) {
  const atleti = await ctx.archivio.atleti()
  // Solo gli archi usati nelle ultime stagioni: un arco lasciato anni fa non ha più una ranking.
  const dal = inizioClassificheComplete(ctx.oggi)
  const storico = (await ctx.archivio.storicoConTipologia()).filter((s) => s.dal >= dal)
  return combinazioniRanking(
    atleti.map((a) => ({
      id: a.id,
      classiRanking: a.classi_ranking,
      gare: storico.filter((s) => s.atleta_id === a.id),
    })),
  )
}

const chiaveRanking = (c: { tipo: string; divisione: string; classe: string; genere: string }) =>
  `${c.tipo}|${c.divisione}|${c.classe}|${c.genere}`

async function ranking(ctx: Contesto, chiave: string): Promise<Esecuzione> {
  const combinazione = (await combinazioni(ctx)).find((c) => chiaveRanking(c) === chiave)
  if (!combinazione) return { esito: 'invariato', messaggio: 'Nessun atleta in questa classifica' }
  const { tipo, divisione, classe, genere } = combinazione
  const letta = leggiRanking(
    await leggiHtml(ctx.fonte, richiestaRanking({ tipo, divisione, classe, genere })),
  )
  const righe = righeRanking(letta, { classe, genere }, await ctx.archivio.atleti())
  await ctx.archivio.salvaRanking(tipo, divisione, combinazione.atleti, righe)
  return {
    esito: 'ok',
    messaggio: `${righe.length} dei nostri su ${combinazione.atleti.length} in classifica`,
  }
}

const ESECUTORI: Record<TipoLettura, (ctx: Contesto, chiave: string) => Promise<Esecuzione>> = {
  calendario,
  'scheda-gara': schedaGara,
  invito,
  'scheda-atleta': schedaAtleta,
  risultati,
  ranking,
}

/** Letture che richiedono molto calcolo (PDF, calendari): poche per chiamata. */
const PESANTI = new Set<TipoLettura>(['risultati', 'calendario'])

export const PRIORITA_RANKING = 25

/** Quante letture in lista si guardano a ogni giro. */
export const LAVORI_DA_GUARDARE = 200

/** Mette in lista le classifiche (ranking) di tutti i nostri atleti: pulsante "Aggiorna". */
export async function accodaRanking(ctx: Contesto): Promise<number> {
  const lista = (await combinazioni(ctx)).map((c) => ({
    tipo: 'ranking' as const,
    chiave: chiaveRanking(c),
    priorita: PRIORITA_RANKING,
  }))
  await ctx.archivio.accoda(lista)
  return lista.length
}

// --- Un giro di lavoro --------------------------------------------------------------------------

export interface OpzioniGiro {
  /** Quante letture al massimo in questa chiamata. */
  massimo: number
  /** Quante letture "pesanti" al massimo (il piano gratuito dà poco tempo di calcolo). */
  massimoPesanti: number
  /** Non iniziare letture nuove dopo questo istante (ms). */
  scadenza: number
  adesso?: () => number
}

export interface Riepilogo {
  pianificate: number
  eseguite: { tipo: TipoLettura; chiave: string; esito: Esito; messaggio: string }[]
  /** Perché il giro si è fermato prima, se è successo. */
  fermato: string | null
}

/** Ritardo prima di riprovare una lettura fallita: 1 ora, 2, 4… fino a un giorno. */
export function ritardoNuovoTentativo(tentativi: number): number {
  return Math.min(24, 2 ** tentativi) * 3_600_000
}

export async function giro(ctx: Contesto, opzioni: OpzioniGiro): Promise<Riepilogo> {
  const adesso = opzioni.adesso ?? Date.now

  // Se di recente Fitarco non ha risposto, non si legge niente: lo si lascia riposare.
  const blocco = await ctx.archivio.ultimoBlocco()
  if (blocco !== null && adesso() - blocco < PAUSA_DOPO_BLOCCO_MS) {
    const ripresa = new Date(blocco + PAUSA_DOPO_BLOCCO_MS)
    return {
      pianificate: 0,
      eseguite: [],
      fermato: `In pausa: Fitarco non ha risposto, si riprova dopo ${ripresa.toISOString()}`,
    }
  }

  // A inizio anno la stagione più vecchia esce dalle "classifiche complete": restano i nostri atleti.
  const potate = await ctx.archivio.potaClassifiche(inizioClassificheComplete(ctx.oggi))
  if (potate > 0) {
    await ctx.archivio.registra({
      tipo: 'risultati',
      chiave: `potatura ${inizioClassificheComplete(ctx.oggi)}`,
      esito: 'ok',
      messaggio: `Tolte ${potate} righe di altri atleti dalle classifiche delle gare vecchie`,
      richieste: 0,
    })
  }

  // Calendari solo dell'anno in corso: delle gare passate restano quelle fatte dai nostri atleti.
  const inizioAnno = `${ctx.oggi.slice(0, 4)}-01-01`
  const gareTolte = await ctx.archivio.potaGare(inizioAnno)
  if (gareTolte > 0) {
    await ctx.archivio.registra({
      tipo: 'calendario',
      chiave: `gare passate ${inizioAnno}`,
      esito: 'ok',
      messaggio: `Tolte ${gareTolte} gare degli anni passati senza nostri atleti`,
      richieste: 0,
    })
  }

  const piano = pianificaLetture(statoPianificazione(await ctx.archivio.stato(), ctx.oggi))
  await ctx.archivio.accoda(piano)

  const riepilogo: Riepilogo = { pianificate: piano.length, eseguite: [], fermato: null }
  let pesanti = 0
  // Si guarda avanti nella lista: se in cima ci sono tante letture pesanti (ne basta una per
  // chiamata), si trovano comunque quelle leggere più in basso.
  for (const lavoro of await ctx.archivio.prossime(LAVORI_DA_GUARDARE)) {
    if (riepilogo.eseguite.length >= opzioni.massimo) break
    if (adesso() >= opzioni.scadenza) {
      riepilogo.fermato = 'Tempo finito: si continua alla prossima chiamata'
      break
    }
    const pesante = PESANTI.has(lavoro.tipo)
    if (pesante && pesanti >= opzioni.massimoPesanti) continue
    if (pesante) pesanti++

    const prima = ctx.fonte.richiesteFatte
    const fatte = () => ctx.fonte.richiesteFatte - prima
    try {
      const r = await ESECUTORI[lavoro.tipo](ctx, lavoro.chiave)
      await ctx.archivio.completa(lavoro.tipo, lavoro.chiave)
      // Solo le colonne del diario (non `tentativi` della lista di lavoro).
      await ctx.archivio.registra({
        tipo: lavoro.tipo,
        chiave: lavoro.chiave,
        esito: r.esito,
        messaggio: r.messaggio,
        richieste: fatte(),
      })
      riepilogo.eseguite.push({ tipo: lavoro.tipo, chiave: lavoro.chiave, ...r })
    } catch (errore) {
      const testo = errore instanceof Error ? errore.message : String(errore)
      // Il prefisso segna nel diario i "blocchi": servono per la pausa generale.
      const messaggio = errore instanceof FitarcoNonRisponde ? `${PREFISSO_BLOCCO}${testo}` : testo
      const tentativi = lavoro.tentativi + 1
      const quando = new Date(adesso() + ritardoNuovoTentativo(tentativi))
      await ctx.archivio.rimanda(lavoro.tipo, lavoro.chiave, tentativi, messaggio, quando)
      await ctx.archivio.registra({
        tipo: lavoro.tipo,
        chiave: lavoro.chiave,
        esito: 'errore',
        messaggio,
        richieste: fatte(),
      })
      riepilogo.eseguite.push({
        tipo: lavoro.tipo,
        chiave: lavoro.chiave,
        esito: 'errore',
        messaggio,
      })
      if (errore instanceof FitarcoNonRisponde) {
        riepilogo.fermato = messaggio
        break
      }
    }
  }
  return riepilogo
}
