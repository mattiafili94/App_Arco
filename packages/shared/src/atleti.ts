/**
 * Storico, record e "ultima gara" di un atleta (Fase 4): funzioni pure sulle righe salvate sul telefono
 * (tabelle `partecipazioni`, `gare`, `classifiche`).
 *
 * Regole (CLAUDE.md, "Regole di record e statistiche"):
 * - le gare composte si dividono in **prove** (25+18 → 25 m + 18 m; doppio 70 m → due prove);
 * - i record sono per prova e per **divisione** (arco); per l'outdoor anche per **distanza vera**
 *   (70, 60, 50… m), che non è nel nome della gara ma nelle colonne del PDF ("70m-1") o, per le gare
 *   vecchie senza PDF, si ricava da classe e divisione (`distanzaOutdoor`);
 * - le gare vecchie, conosciute solo dallo storico, hanno il totale ma non le prove: contano solo se
 *   sono gare a prova unica;
 * - i risultati provvisori contano, ma si segnalano.
 */
import { garaPassata, type Gara } from './gare'
import type { RigaClassifica } from './risultati'
import { riconosciTipologia, type Famiglia } from './tipologie'

/** Una gara dello storico di un atleta (tabella `partecipazioni`). */
export interface Partecipazione {
  atleta_id: string
  gara_codice: string
  /** "OL", "CO", "AN"… (l'arco usato in quella gara). */
  divisione: string
  /** Classe dell'atleta in quella gara: "SM", "MF", "JM"… */
  classe: string
  posizione: number | null
  totale: number | null
  /** La gara non è ancora nella scheda Fitarco dell'atleta: viene dal PDF dei risultati (vedi `partecipazioniConPdf`). */
  dalPdf?: boolean
}

/** Una prova di una gara, con il punteggio dell'atleta. */
export interface ProvaGara {
  /** "indoor:18m", "outdoor:70m", "campagna:12+12", "3d:3d": con la divisione identifica un record. */
  chiave: string
  famiglia: Famiglia
  /** "18m", "25m", "70m", "60m", "50m", "12+12", "24+24", "3d". */
  prova: string
  divisione: string
  gara_codice: string
  /** Data della gara ("AAAA-MM-GG"). */
  data: string
  totale: number
  /** Il risultato non è ancora definitivo (gara non omologata). */
  provvisoria: boolean
}

export const DIVISIONI: Record<string, string> = {
  OL: 'Ricurvo',
  CO: 'Compound',
  AN: 'Nudo',
  AI: 'Istintivo',
  LB: 'Longbow',
}

/** "OL" → "Ricurvo"; le divisioni paralimpiche e sconosciute restano come sono ("W1"). */
export const nomeDivisione = (codice: string) => DIVISIONI[codice] ?? codice

/**
 * Distanza dell'outdoor per divisione e classe, quando il PDF non c'è. Ricavata dai PDF veri del 2026
 * (colonne "70m-1", "60m-1"…): le combinazioni mai viste restano `null` (non contano per i record,
 * piuttosto che sbagliare).
 */
export function distanzaOutdoor(divisione: string, classe: string): number | null {
  const lettera = classe.charAt(0).toUpperCase() // S, J, M, A, R, G
  if (divisione === 'OL') {
    return { S: 70, J: 70, M: 60, A: 60, R: 40, G: 25 }[lettera] ?? null
  }
  if (divisione === 'CO') return { S: 50, J: 50, M: 50, R: 40, G: 25 }[lettera] ?? null
  if (divisione === 'AN' || divisione === 'AI' || divisione === 'LB') {
    return { S: 50, J: 50, M: 50, A: 40, R: 25 }[lettera] ?? null
  }
  return null
}

const distanzaDaColonna = (colonna: string | undefined) => {
  const d = colonna ? /^(\d+)m-/.exec(colonna)?.[1] : undefined
  return d ? `${d}m` : null
}

const prova = (
  famiglia: Famiglia,
  nome: string,
  base: Pick<ProvaGara, 'divisione' | 'gara_codice' | 'data' | 'provvisoria'>,
  totale: number,
): ProvaGara => ({ ...base, chiave: `${famiglia}:${nome}`, famiglia, prova: nome, totale })

/**
 * Tutte le prove dell'atleta, una per ogni prova di ogni gara (le gare composte ne danno due).
 * `classifiche` può contenere anche le righe di altri atleti: si usano solo quelle dell'atleta.
 */
export function proveDiAtleta(
  atletaId: string,
  partecipazioni: readonly Partecipazione[],
  gare: readonly Gara[],
  classifiche: readonly RigaClassifica[],
): ProvaGara[] {
  const perGara = new Map(gare.map((g) => [g.codice, g]))
  const mie = classifiche.filter((r) => r.atleta_id === atletaId)
  const risultato: ProvaGara[] = []

  for (const p of partecipazioni) {
    if (p.atleta_id !== atletaId) continue
    const gara = perGara.get(p.gara_codice)
    const tipologia = gara && riconosciTipologia(gara.tipologia)
    if (!gara || !tipologia) continue
    const { famiglia } = tipologia
    const base = { divisione: p.divisione, gara_codice: p.gara_codice, data: gara.dal }
    const riga = mie.find((r) => r.gara_codice === p.gara_codice && r.divisione === p.divisione)

    if (riga) {
      // Un ritirato (DNF) non ha un punteggio completo: non conta.
      if (riga.esito === 'DNF') continue
      const comune = { ...base, provvisoria: riga.provvisoria }
      if (riga.prove.length > 0) {
        riga.prove.forEach((pr, i) => {
          const nome = distanzaDaColonna(pr.parziali[0]?.colonna) ?? tipologia.prove[i]
          if (nome) risultato.push(prova(famiglia, nome, comune, pr.totale))
        })
      } else {
        const nome =
          famiglia === 'indoor' || famiglia === 'outdoor'
            ? (distanzaDaColonna(riga.parziali[0]?.colonna) ?? tipologia.prove[0])
            : tipologia.prove[0]
        if (nome) risultato.push(prova(famiglia, nome, comune, riga.totale))
      }
      continue
    }

    // Gara vecchia, senza PDF: solo il totale, quindi solo le gare a prova unica.
    if (p.totale === null || tipologia.prove.length !== 1) continue
    const nome =
      famiglia === 'outdoor'
        ? (() => {
            const d = distanzaOutdoor(p.divisione, p.classe)
            return d === null ? null : `${d}m`
          })()
        : tipologia.prove[0]
    if (nome) {
      risultato.push(
        prova(famiglia, nome, { ...base, provvisoria: gara.stato !== 'omologata' }, p.totale),
      )
    }
  }
  return risultato
}

const ORDINE_FAMIGLIE: Famiglia[] = ['indoor', 'outdoor', 'campagna', '3d']

/** I record personali: per ogni prova e divisione, il punteggio migliore (a parità, il primo ottenuto). */
export function recordPersonali(prove: readonly ProvaGara[]): ProvaGara[] {
  const migliori = new Map<string, ProvaGara>()
  for (const p of prove) {
    const k = `${p.chiave}|${p.divisione}`
    const attuale = migliori.get(k)
    if (
      !attuale ||
      p.totale > attuale.totale ||
      (p.totale === attuale.totale && p.data < attuale.data)
    ) {
      migliori.set(k, p)
    }
  }
  // Outdoor: dalla distanza maggiore; il resto in ordine (18 m, 25 m; 12+12, 24+24).
  const numero = (p: ProvaGara) => Number.parseInt(p.prova, 10) || 0
  const perProva = (a: ProvaGara, b: ProvaGara) =>
    a.famiglia === 'outdoor' ? numero(b) - numero(a) : numero(a) - numero(b)
  return [...migliori.values()].sort(
    (a, b) =>
      ORDINE_FAMIGLIE.indexOf(a.famiglia) - ORDINE_FAMIGLIE.indexOf(b.famiglia) ||
      perProva(a, b) ||
      a.prova.localeCompare(b.prova) ||
      a.divisione.localeCompare(b.divisione),
  )
}

/** "18 m", "70 m", "25 m outdoor", "12+12", "24+24", "3D". */
export function nomeProva(p: Pick<ProvaGara, 'famiglia' | 'prova'>): string {
  if (p.famiglia === '3d') return '3D'
  if (p.famiglia === 'campagna') return p.prova
  const m = p.prova.replace('m', ' m')
  return p.famiglia === 'outdoor' && p.prova === '25m' ? `${m} outdoor` : m
}

/** Una riga dello storico: la gara con il risultato dell'atleta. */
export interface RigaStorico {
  gara: Gara
  divisione: string
  posizione: number | null
  totale: number | null
}

/** Lo storico dell'atleta: le sue gare dalla più recente. Gare non più nei dati si saltano. */
export function storicoAtleta(
  atletaId: string,
  partecipazioni: readonly Partecipazione[],
  gare: readonly Gara[],
): RigaStorico[] {
  const perGara = new Map(gare.map((g) => [g.codice, g]))
  return partecipazioni
    .filter((p) => p.atleta_id === atletaId)
    .flatMap((p) => {
      const gara = perGara.get(p.gara_codice)
      return gara
        ? [{ gara, divisione: p.divisione, posizione: p.posizione, totale: p.totale }]
        : []
    })
    .sort(
      (a, b) =>
        b.gara.dal.localeCompare(a.gara.dal) ||
        a.gara.codice.localeCompare(b.gara.codice) ||
        a.divisione.localeCompare(b.divisione),
    )
}

/** L'ultima gara già disputata (la prima dello storico che non è nel futuro). */
export const ultimaGara = (storico: readonly RigaStorico[], oggi: string): Gara | null =>
  storico.find((r) => garaPassata(r.gara, oggi) || r.gara.dal <= oggi)?.gara ?? null

/**
 * Lo storico di un atleta con anche le gare che si conoscono **solo dal PDF dei risultati** (Mattia, 10/11/2026: se
 * i dati sono nel database si mostrano). La scheda Fitarco dell'atleta si rilegge una volta a settimana e una gara
 * appena finita può comparirci anche dopo l'omologazione; il PDF invece arriva pochi giorni dopo la gara e la riga
 * dell'atleta è già collegata a lui (\`atleta_id\`). Per ogni riga collegata senza la gara nello storico si aggiunge
 * una partecipazione presa dal PDF (arco, posizione, totale); quando arriva quella della scheda vale quella e non ci
 * sono doppioni (stessa gara e stesso arco). `partecipazioni` e `classifiche` possono essere di più atleti.
 */
export function partecipazioniConPdf(
  partecipazioni: readonly Partecipazione[],
  classifiche: readonly Pick<
    RigaClassifica,
    'atleta_id' | 'gara_codice' | 'divisione' | 'posizione' | 'totale' | 'esito'
  >[],
): Partecipazione[] {
  const chiave = (atleta: string, gara: string, divisione: string) =>
    `${atleta}|${gara}|${divisione}`
  const note = new Set(partecipazioni.map((p) => chiave(p.atleta_id, p.gara_codice, p.divisione)))
  const risultato = [...partecipazioni]
  for (const r of classifiche) {
    if (!r.atleta_id) continue
    const k = chiave(r.atleta_id, r.gara_codice, r.divisione)
    if (note.has(k)) continue
    note.add(k)
    risultato.push({
      atleta_id: r.atleta_id,
      gara_codice: r.gara_codice,
      divisione: r.divisione,
      // La classe non serve: con la riga del PDF la distanza si legge dalle colonne.
      classe: '',
      posizione: r.esito === 'DNF' ? null : r.posizione,
      totale: r.esito === 'DNF' ? null : r.totale,
      dalPdf: true,
    })
  }
  return risultato
}
