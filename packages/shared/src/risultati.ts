/**
 * Come si mostrano i risultati di una gara nell'app (Fase 3.3): nomi, punteggi per prova, conteggi 10/X,
 * categorie. Funzioni pure sulle righe di classifica salvate sul telefono (tabella `classifiche`).
 */

export interface ParzialeSalvato {
  /** "18m-1", "70m-3", "H&F", "Perc."… */
  colonna: string
  punti: number
  posizione: number | null
}

export interface ProvaSalvata {
  parziali: ParzialeSalvato[]
  totale: number
}

/** Una riga della classifica di una gara (tabella `classifiche`). */
export interface RigaClassifica {
  gara_codice: string
  /** "Arco Ricurvo - Senior Maschile". */
  categoria: string
  /** Posizione della riga nella categoria, come nel PDF. */
  ordine: number
  posizione: number | null
  /** "1", "2"… oppure "DNF" (ritirato). */
  esito: string
  cognome: string
  nome: string
  societa_codice: string
  societa_nome: string
  parziali: ParzialeSalvato[]
  /** Gare composte (25+18, doppio 70 m): una voce per prova. */
  prove: ProvaSalvata[]
  totale: number
  /** I due conteggi (es. 10 e 9) e come si chiamano le colonne (es. "10", "9"). */
  conteggi: [number, number]
  colonne_conteggi: [string, string]
  /** L'atleta della compagnia, se riconosciuto. */
  atleta_id: string | null
  provvisoria: boolean
}

/** "D'AMARIO" → "D'Amario", "DE LUCA" → "De Luca". */
const iniziali = (testo: string) =>
  testo
    .toLowerCase()
    .replace(
      /(^|[\s'’-])(\p{L})/gu,
      (_, prima: string, lettera: string) => prima + lettera.toUpperCase(),
    )

/** "ROSSI" + "Mario" → "Rossi Mario" (il PDF scrive il cognome tutto in maiuscolo). */
export const formattaNome = (r: Pick<RigaClassifica, 'cognome' | 'nome'>) =>
  `${iniziali(r.cognome)} ${r.nome}`.trim()

/** "25m-1" → "25 m"; "H&F" → null (non è una distanza). */
const distanza = (colonna: string) => /^(\d+)m-/.exec(colonna)?.[1]

/**
 * I punteggi per parziale o per prova, per chi vuole il dettaglio:
 * 18 m "280 + 272"; 25+18 "272 (25 m) + 378 (18 m)"; doppio 70 m "552 + 555"; una sola colonna: vuoto
 * (coincide con il totale).
 */
export function descriviPunteggi(r: Pick<RigaClassifica, 'parziali' | 'prove'>): string {
  if (r.prove.length > 0) {
    const distanze = r.prove.map((p) => distanza(p.parziali[0]?.colonna ?? ''))
    const diverse = new Set(distanze).size > 1
    return r.prove
      .map((p, i) => (diverse && distanze[i] ? `${p.totale} (${distanze[i]} m)` : `${p.totale}`))
      .join(' + ')
  }
  return r.parziali.length > 1 ? r.parziali.map((p) => p.punti).join(' + ') : ''
}

/** "10: 21 · 9: 26" (le colonne le sceglie ogni gara: 10 e 9, 10+X e X, 6 e 5…). */
export const descriviConteggi = (r: Pick<RigaClassifica, 'conteggi' | 'colonne_conteggi'>) =>
  `${r.colonne_conteggi[0]}: ${r.conteggi[0]} · ${r.colonne_conteggi[1]}: ${r.conteggi[1]}`

/** "4°" per chi è classificato, altrimenti l'esito del PDF ("DNF"). */
export const descriviPosizione = (r: Pick<RigaClassifica, 'posizione' | 'esito'>) =>
  r.posizione === null ? r.esito : `${r.posizione}°`

export interface CategoriaVista {
  nome: string
  righe: RigaClassifica[]
  /** Quante righe sono di atleti della compagnia (anche non ancora nell'app). */
  nostri: number
}

/** Le righe dei nostri: atleti riconosciuti o di una società della compagnia. */
export const eNostro = (
  r: Pick<RigaClassifica, 'atleta_id' | 'societa_codice'>,
  codiceSocieta: string,
) => r.atleta_id !== null || r.societa_codice === codiceSocieta

/** Raggruppa le righe per categoria (in ordine alfabetico) e ordina ogni categoria come nel PDF. */
export function raggruppaPerCategoria(
  righe: readonly RigaClassifica[],
  codiceSocieta: string,
): CategoriaVista[] {
  const perNome = new Map<string, RigaClassifica[]>()
  for (const r of righe) perNome.set(r.categoria, [...(perNome.get(r.categoria) ?? []), r])
  return [...perNome.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'it'))
    .map(([nome, elenco]) => {
      const ordinate = elenco.sort((a, b) => a.ordine - b.ordine)
      return {
        nome,
        righe: ordinate,
        nostri: ordinate.filter((r) => eNostro(r, codiceSocieta)).length,
      }
    })
}
