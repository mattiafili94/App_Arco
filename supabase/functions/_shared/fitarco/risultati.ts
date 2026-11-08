/**
 * Lettore della classifica individuale nei PDF dei risultati (dalle righe di `estraiRighe`).
 *
 * Com'è fatto il PDF (CLAUDE.md, "PDF risultati"):
 * - in cima a ogni pagina: nome della gara, società con codice gara, luogo e data, giudici…;
 * - per ogni categoria ("Arco Ricurvo - Senior Maschile", "… Continua" se prosegue) una riga che dichiara
 *   le colonne: `Pos. Atleta Cat. Società 18m-1 18m-2 Totale 10 9`;
 * - riga atleta: posizione, turno-piazzola, COGNOME Nome (a volte con una parola in più),
 *   categoria (2 cifre), codice società (5 cifre; per i club esteri il paese), società, parziali `punti/ posizione`, totale, due conteggi;
 * - gare composte (25+18, doppio 70 m): la riga atleta ha solo totale e conteggi; i parziali delle due
 *   prove stanno in una riga SOPRA (prima prova) e una SOTTO (seconda prova), con le colonne dichiarate
 *   allo stesso modo sopra e sotto l'intestazione (`25m-1 25m-2 Tot.` / `18m-1 18m-2 Tot.`).
 * Controllo di coerenza (sentinella): la somma dei parziali deve fare il totale.
 */
import { ErroreFormatoFitarco, numero, type Societa } from './html.ts'
import type { RigaTesto } from './pdf-testo.ts'

/**
 * Codice società degli atleti di club esteri: nel PDF hanno il paese al posto del codice a 5 cifre
 * (visto nella gara R2611001, novembre 2026). "00000" non è un codice Fitarco vero e rispetta il
 * vincolo del database (`^[0-9]{5}$`); il paese resta nel nome della società.
 */
export const CODICE_SOCIETA_ESTERA = '00000'

/** Divisioni come le scrive il PDF → codice Fitarco. Nei PDF vecchi il ricurvo è "Arco Olimpico". */
export const DIVISIONI_PDF: Record<string, string> = {
  'Arco Ricurvo': 'OL',
  'Arco Olimpico': 'OL',
  'Arco Compound': 'CO',
  'Arco Nudo': 'AN',
  'Arco Istintivo': 'AI',
  'Long Bow': 'LB',
  Longbow: 'LB',
  // Tiro paralimpico (visti nei PDF veri, novembre 2026). Altre categorie nuove fermano la lettura.
  'Compound W1': 'W1',
  'Visually Impaired 1': 'V1',
}

export interface Parziale {
  /** Nome della colonna: "18m-1", "70m-3", "H&F", "Hunter", "Perc."… */
  colonna: string
  punti: number
  /** Posizione nel parziale (manca, per esempio, se l'atleta si è ritirato). */
  posizione: number | null
}

export interface ProvaRisultato {
  parziali: Parziale[]
  totale: number
}

export interface AtletaRisultato {
  /** Posizione in classifica, null se non classificato (vedi `esito`). */
  posizione: number | null
  /** La prima colonna così com'è: "1", "2"… oppure "DNF" (ritirato) ecc. */
  esito: string
  turno: string
  /** Come nel PDF: "COGNOME Nome", a volte con una parola in più ("Rita MF"). */
  nomeCompleto: string
  /** Le parole iniziali in maiuscolo ("DI GREGORIO", "D'AMARIO"). */
  cognome: string
  /** Il resto ("Sabrina", "Pietro Luigi"), senza la classe dell'atleta. */
  nome: string
  /** Classe dell'atleta se diversa da quella in cui gareggia ("MF", "GM"…), altrimenti null. */
  classeAtleta: string | null
  /** Colonna "Cat." (2 cifre); in alcune righe il PDF la lascia vuota. */
  categoria: string | null
  societa: Societa
  /** Parziali sulla riga dell'atleta (gare semplici). */
  parziali: Parziale[]
  /** Prove delle gare composte (25+18, doppio 70 m): prima e seconda. Vuoto nelle gare semplici. */
  prove: ProvaRisultato[]
  totale: number
  /** I due conteggi finali (es. 10 e 9, oppure 10+X e X): solo sul totale della gara. */
  conteggi: [number, number]
}

export interface CategoriaRisultati {
  /** "Arco Ricurvo - Senior Maschile". */
  nome: string
  /** Codice della divisione (OL, CO, AN, AI, LB; paralimpiche W1, V1). */
  divisione: string
  /** "Senior Maschile", "Over 20 Femminile", "Femminile"… */
  classe: string
  colonneParziali: string[]
  /** Colonne delle due prove nelle gare composte, es. [["25m-1","25m-2"], ["18m-1","18m-2"]]. */
  colonneProve: string[][]
  /** Nomi dei due conteggi: ["10","9"], ["10+X","X"], ["6","5"], ["11","10"]. */
  colonneConteggi: [string, string]
  atleti: AtletaRisultato[]
}

export interface RisultatiGara {
  titolo: string
  /** Codice gara dalla riga dell'organizzatore: "(R2611039)". */
  codiceGara: string | null
  organizzatore: string
  luogoData: string
  categorie: CategoriaRisultati[]
}

// --- Riconoscere le righe -----------------------------------------------------------------------

const RE_CATEGORIA = new RegExp(`^(${Object.keys(DIVISIONI_PDF).join('|')})\\b`)
const RE_INTESTAZIONE = /^Pos\. Atleta Cat\. Società (.*)$/
const RE_COLONNE_PROVA = /^((?:\S+-\d+ )+)Tot\.$/
const RE_ATLETA = /^(\d+|[A-Z]{2,4}) \d+- ?\w+ /
const RE_PUNTEGGI_PROVA = /^(?:\d+(?:\/ ?\d+)? )+\d{1,3}(?:\.\d{3})?$/
const RE_PIE_PAGINA =
  /^(\d+\/\d+ Classifica|Powered by|Giudici di Gara|Direttore dei Tiri|Comitato Organizzatore)/

/** Distanza massima (in punti) tra una riga di parziali e la sua riga atleta. */
const DISTANZA_PROVA = 9

const fermati = (messaggio: string, riga: RigaTesto) =>
  new ErroreFormatoFitarco(`${messaggio} (pagina ${riga.pagina}: "${riga.testo}")`)

/** "280/ 1" → { punti: 280, posizione: 1 }; "18" → { punti: 18, posizione: null }. */
function leggiParziale(colonna: string, valore: string, riga: RigaTesto): Parziale {
  const m = /^(\d+)(?:\/(\d+))?$/.exec(valore)
  if (!m) throw fermati(`Parziale non riconosciuto "${valore}"`, riga)
  return { colonna, punti: Number(m[1]), posizione: m[2] ? Number(m[2]) : null }
}

/** Unisce "280/ 1" in un solo pezzo e divide la riga in parole. */
const parole = (testo: string) => testo.replace(/(\d+)\/ (\d+)/g, '$1/$2').split(' ')

/**
 * "DI GREGORIO Sabrina" → cognome "DI GREGORIO", nome "Sabrina".
 * "PONZIANI Rita MF" → classe dell'atleta "MF" (quando gareggia in un'altra classe, es. una Master
 * nella classe Senior). Altre parole in più (es. "Junior") restano nel nome.
 */
function dividiNome(parti: string[]): {
  cognome: string
  nome: string
  classeAtleta: string | null
} {
  const maiuscola = (p: string) => /[A-Z]/.test(p) && p === p.toUpperCase()
  let i = 0
  while (i < parti.length && maiuscola(parti[i]!)) i++
  const resto = parti.slice(i)
  const classe = resto.length > 1 && /^[A-Z]{2}$/.test(resto.at(-1)!) ? resto.pop()! : null
  return { cognome: parti.slice(0, i).join(' '), nome: resto.join(' '), classeAtleta: classe }
}

function leggiAtleta(riga: RigaTesto, categoria: CategoriaRisultati): AtletaRisultato {
  const t = parole(riga.testo.replace(/^(\S+ \d+-) /, '$1'))
  // Il codice società (5 cifre) separa il nome dalla società. Prima c'è la categoria (2 cifre),
  // che in alcune righe manca.
  let s = t.findIndex((p, k) => k >= 3 && /^\d{5}$/.test(p))
  let categoriaEta = s > 0 && /^\d{2}$/.test(t[s - 1]!) ? t[s - 1]! : null
  let finoNome = categoriaEta ? s - 1 : s
  let codice = t[s]!
  // Club estero: niente codice, dopo la categoria c'è il paese in maiuscolo ("ESTONIA",
  // "SAN MARINO") e poi il nome del club. Il paese resta nel nome della società.
  if (s < 0) {
    finoNome = t.findIndex(
      (p, k) => k >= 3 && /^\d{2}$/.test(p) && /^\p{Lu}[\p{Lu}'-]*$/u.test(t[k + 1] ?? ''),
    )
    s = finoNome
    categoriaEta = t[s] ?? null
    codice = CODICE_SOCIETA_ESTERA
  }
  const n = categoria.colonneParziali.length
  const fine = t.length - 3 - n
  if (s < 0 || finoNome < 3 || fine <= s + 1) throw fermati('Riga atleta non riconosciuta', riga)

  const parziali = t
    .slice(fine, fine + n)
    .map((v, k) => leggiParziale(categoria.colonneParziali[k]!, v, riga))
  const [tot, c1, c2] = t.slice(-3).map((v) => numero(v))
  if (tot == null || c1 == null || c2 == null) throw fermati('Totale o conteggi mancanti', riga)
  if (n > 0 && parziali.reduce((s, p) => s + p.punti, 0) !== tot) {
    throw fermati('La somma dei parziali non fa il totale', riga)
  }
  const esito = t[0]!
  const nomeParti = t.slice(2, finoNome)
  return {
    posizione: /^\d+$/.test(esito) ? Number(esito) : null,
    esito,
    turno: t[1]!,
    nomeCompleto: nomeParti.join(' '),
    ...dividiNome(nomeParti),
    categoria: categoriaEta,
    societa: { codice, nome: t.slice(s + 1, fine).join(' ') },
    parziali,
    prove: [],
    totale: tot,
    conteggi: [c1, c2],
  }
}

function leggiProva(riga: RigaTesto, colonne: string[]): ProvaRisultato {
  const t = parole(riga.testo)
  if (t.length !== colonne.length + 1) throw fermati('Parziali della prova non riconosciuti', riga)
  const parziali = t.slice(0, -1).map((v, k) => leggiParziale(colonne[k]!, v, riga))
  const totale = numero(t.at(-1)!)!
  if (parziali.reduce((s, p) => s + p.punti, 0) !== totale) {
    throw fermati('La somma dei parziali della prova non fa il suo totale', riga)
  }
  return { parziali, totale }
}

/** La riga "ancora" (atleta o intestazione) più vicina sulla stessa pagina. */
function piuVicina<T extends { riga: RigaTesto }>(riga: RigaTesto, ancore: T[]): T | undefined {
  let migliore: T | undefined
  for (const a of ancore) {
    const d = Math.abs(a.riga.y - riga.y)
    if (a.riga.pagina === riga.pagina && d <= DISTANZA_PROVA) {
      if (!migliore || d < Math.abs(migliore.riga.y - riga.y)) migliore = a
    }
  }
  return migliore
}

export function leggiRisultati(righe: RigaTesto[]): RisultatiGara {
  const prima = righe.filter((r) => r.pagina === 1)
  if (prima.length < 3) throw new ErroreFormatoFitarco('PDF dei risultati senza intestazione')
  const [titolo, organizzatore, luogoData] = prima.slice(0, 3).map((r) => r.testo)
  const intestazionePagina = new Set([titolo, organizzatore, luogoData])

  const categorie: CategoriaRisultati[] = []
  let corrente: CategoriaRisultati | undefined
  const intestazioni: { riga: RigaTesto; categoria: CategoriaRisultati }[] = []
  const colonneProva: RigaTesto[] = []
  const atleti: { riga: RigaTesto; atleta: AtletaRisultato; categoria: CategoriaRisultati }[] = []
  const punteggiProva: RigaTesto[] = []
  let ultima: 'categoria' | 'altro' = 'altro'

  for (const riga of righe) {
    const testo = riga.testo
    if (intestazionePagina.has(testo) || RE_PIE_PAGINA.test(testo)) continue

    const precedente: 'categoria' | 'altro' = ultima
    ultima = 'altro'

    if (RE_CATEGORIA.test(testo)) {
      ultima = 'categoria'
      const nome = testo.replace(/\s+Continua$/, '')
      corrente = categorie.find((c) => c.nome === nome)
      if (!corrente) {
        const [div = '', ...resto] = nome.split(' - ')
        corrente = {
          nome,
          divisione: DIVISIONI_PDF[div]!,
          classe: resto.join(' - '),
          colonneParziali: [],
          colonneProve: [],
          colonneConteggi: ['', ''],
          atleti: [],
        }
        categorie.push(corrente)
      }
      continue
    }

    const intestazione = RE_INTESTAZIONE.exec(testo)
    if (intestazione) {
      // Subito prima ci deve essere il nome della categoria (o le colonne della prima prova):
      // una divisione nuova, che non riconosciamo, non deve finire nella categoria precedente.
      if (!corrente || precedente === 'altro') {
        throw fermati('Intestazione di colonne senza categoria', riga)
      }
      const colonne = intestazione[1]!.split(' ')
      const totale = colonne.indexOf('Totale')
      if (totale < 0 || colonne.length !== totale + 3)
        throw fermati('Colonne non riconosciute', riga)
      corrente.colonneParziali = colonne.slice(0, totale)
      corrente.colonneConteggi = [colonne[totale + 1]!, colonne[totale + 2]!]
      intestazioni.push({ riga, categoria: corrente })
      continue
    }

    if (RE_COLONNE_PROVA.test(testo)) {
      ultima = precedente === 'categoria' ? 'categoria' : 'altro'
      colonneProva.push(riga)
      continue
    }

    if (RE_ATLETA.test(testo)) {
      if (!corrente || intestazioni.at(-1)?.categoria !== corrente) {
        throw fermati('Riga atleta prima delle colonne', riga)
      }
      const atleta = leggiAtleta(riga, corrente)
      corrente.atleti.push(atleta)
      atleti.push({ riga, atleta, categoria: corrente })
      continue
    }

    if (RE_PUNTEGGI_PROVA.test(testo)) punteggiProva.push(riga)
    // Altre righe (es. "Dopo 72 Frecce"): non servono.
  }

  // Gare composte: colonne delle prove sopra/sotto l'intestazione, punteggi sopra/sotto l'atleta.
  for (const riga of colonneProva) {
    const vicina = piuVicina(riga, intestazioni)
    if (!vicina) throw fermati('Colonne di una prova senza intestazione vicina', riga)
    const colonne = RE_COLONNE_PROVA.exec(riga.testo)![1]!.trim().split(' ')
    vicina.categoria.colonneProve[riga.y > vicina.riga.y ? 0 : 1] = colonne
  }
  for (const riga of punteggiProva) {
    const vicino = piuVicina(riga, atleti)
    if (!vicino) throw fermati('Punteggi di una prova senza atleta vicino', riga)
    const indice = riga.y > vicino.riga.y ? 0 : 1
    const colonne = vicino.categoria.colonneProve[indice]
    if (!colonne) throw fermati('Punteggi di una prova senza colonne', riga)
    vicino.atleta.prove[indice] = leggiProva(riga, colonne)
  }
  for (const { riga, atleta, categoria } of atleti) {
    if (categoria.colonneProve.length === 0) continue
    const prove = atleta.prove.filter(Boolean)
    if (atleta.posizione !== null && prove.length !== 2)
      throw fermati('Mancano i punteggi delle prove', riga)
    if (prove.length === 2 && prove[0]!.totale + prove[1]!.totale !== atleta.totale) {
      throw fermati('La somma delle prove non fa il totale', riga)
    }
  }

  const codice = /\(([A-Z]\d{7})\)\s*$/.exec(organizzatore!)
  return {
    titolo: titolo!,
    codiceGara: codice ? codice[1]! : null,
    organizzatore: organizzatore!.replace(/\s*\([A-Z]\d{7}\)\s*$/, ''),
    luogoData: luogoData!,
    categorie,
  }
}
