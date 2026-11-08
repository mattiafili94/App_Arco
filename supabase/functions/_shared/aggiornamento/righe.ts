/**
 * Da quello che leggono i lettori Fitarco alle righe delle tabelle del database
 * (migrazione 20261108120000_dati_fitarco.sql). Nessun accesso al database qui: solo trasformazioni.
 */
import type { GaraCalendario, StatoGara } from '../fitarco/calendario.ts'
import type { Invito } from '../fitarco/invito.ts'
import type { Ranking } from '../fitarco/ranking.ts'
import type { RisultatiGara } from '../fitarco/risultati.ts'
import type { SchedaAtleta } from '../fitarco/scheda-atleta.ts'
import { genereDaClasse, trovaAtleta, type AtletaNoto } from './atleti.ts'

export interface RigaGara {
  codice: string
  dal: string
  al: string
  calendario: string
  regione: string | null
  localita: string
  tipologia: string
  dettaglio: string | null
  societa_codice: string | null
  societa_nome: string | null
  stato: StatoGara
  in_calendario_umbria: boolean
}

/** Una gara del calendario Fitarco. */
export function rigaGaraDaCalendario(g: GaraCalendario): RigaGara {
  return {
    codice: g.codice,
    dal: g.dal,
    al: g.al,
    calendario: g.calendario,
    regione: g.regione,
    localita: g.localita,
    tipologia: g.tipologia,
    dettaglio: g.dettaglio,
    societa_codice: g.societa.codice,
    societa_nome: g.societa.nome,
    stato: g.stato,
    in_calendario_umbria: g.regione === 'Umbria',
  }
}

/**
 * Una gara conosciuta solo dallo storico di un atleta (es. fuori regione): si sa poco, il resto
 * arriverà dal calendario di quell'anno. Lo stato resta "sconosciuto" finché non lo si legge.
 */
export function rigaGaraDaStorico(g: SchedaAtleta['storico'][number]): RigaGara {
  return {
    codice: g.codice,
    dal: g.data,
    al: g.data,
    calendario: g.calendario,
    regione: null,
    localita: g.localita,
    tipologia: g.tipologia,
    dettaglio: null,
    societa_codice: null,
    societa_nome: null,
    stato: 'sconosciuto',
    in_calendario_umbria: false,
  }
}

export interface RigaInvito {
  gara_codice: string
  testo: string
  luogo: string | null
  riferimento: string | null
  email: string | null
  web: string | null
  verificato: boolean
}

export function rigaInvito(codiceGara: string, i: Invito): RigaInvito {
  return {
    gara_codice: codiceGara,
    testo: i.note,
    luogo: i.luogo,
    riferimento: i.riferimento,
    email: i.email,
    web: i.web,
    verificato: i.verificato,
  }
}

/** Dati dell'atleta presi dalla scheda (colonne che scrive solo il server). */
export function datiAtletaDaScheda(s: SchedaAtleta) {
  return { classe: s.classe, genere: genereDaClasse(s.classe), classi_ranking: s.classiRanking }
}

export interface RigaPartecipazione {
  gara_codice: string
  divisione: string
  classe: string
  rank: string
  posizione: number | null
  totale: number | null
}

/**
 * Lo storico per `salva_storico`. Fitarco usa la posizione 999 in alcuni Campionati Regionali
 * (non classificato per il titolo): da noi diventa "nessuna posizione".
 */
export function righeStorico(s: SchedaAtleta): RigaPartecipazione[] {
  const viste = new Set<string>()
  return s.storico.flatMap((g) => {
    const chiave = `${g.codice}|${g.divisione}`
    if (viste.has(chiave)) return []
    viste.add(chiave)
    return [
      {
        gara_codice: g.codice,
        divisione: g.divisione,
        classe: g.classe,
        rank: g.rank,
        posizione: g.posizione === 999 ? null : g.posizione,
        totale: g.totale,
      },
    ]
  })
}

/** La classifica completa di un PDF per `salva_classifica`, con gli Eugubini collegati. */
export function righeClassifica(r: RisultatiGara, atleti: readonly AtletaNoto[]) {
  return r.categorie.flatMap((c) =>
    c.atleti.map((a, i) => ({
      categoria: c.nome,
      ordine: i + 1,
      divisione: c.divisione,
      classe: c.classe,
      posizione: a.posizione,
      esito: a.esito,
      turno: a.turno,
      nome_completo: a.nomeCompleto,
      cognome: a.cognome,
      nome: a.nome,
      classe_atleta: a.classeAtleta,
      categoria_eta: a.categoria,
      societa_codice: a.societa.codice,
      societa_nome: a.societa.nome,
      parziali: a.parziali,
      prove: a.prove,
      totale: a.totale,
      conteggi: a.conteggi,
      colonne_conteggi: c.colonneConteggi,
      atleta_id: trovaAtleta(a, atleti),
    })),
  )
}

/** Una riga della classifica completa, com'è salvata in `classifiche_ranking.righe`. */
export interface RigaClassificaRanking {
  posizione: number
  matricola: string
  /** Come la scrive Fitarco ("ROSSI Mario"). */
  nome: string
  societa_codice: string
  societa_nome: string
  punti: number
  /** Le gare che contano (di solito due), con i loro punti. */
  gare: { codice: string; punti: number; localita: string; dal: string; al: string }[]
}

/** La classifica letta da Fitarco, pronta per `salva_classifica_ranking` (una categoria per richiesta). */
export function righeClassificaRanking(r: Ranking): {
  categoria: string
  totale: number
  righe: RigaClassificaRanking[]
} {
  return {
    categoria: r.categorie.map((c) => c.nome).join(' + '),
    totale: r.totale,
    righe: r.categorie.flatMap((c) =>
      c.righe.map((riga) => ({
        posizione: riga.posizione,
        matricola: riga.matricola,
        nome: riga.nomeCompleto,
        societa_codice: riga.societa.codice,
        societa_nome: riga.societa.nome,
        punti: riga.punti,
        gare: riga.gare,
      })),
    ),
  }
}

/** Impronta (SHA-256 in esadecimale) di un file: se non cambia, non si riscrive niente. */
export async function impronta(dati: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', dati as Uint8Array<ArrayBuffer>)
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
