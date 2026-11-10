/**
 * Andamento di un atleta (Fase 4.2): i punteggi di una prova nel tempo e le medie per anno.
 * Funzioni pure sulle prove calcolate da `proveDiAtleta` (vedi atleti.ts).
 *
 * Un andamento è una sola serie: una prova (es. "18 m") con un arco (es. Ricurvo). Cambiare arco o
 * misurare un'altra distanza vuol dire punteggi non confrontabili, quindi mai nello stesso grafico.
 */
import { nomeDivisione, nomeProva, recordPersonali, type ProvaGara } from './atleti'

/** Una prova e un arco di cui si può vedere l'andamento. */
export interface SerieAndamento {
  /** "indoor:18m|OL": identifica la serie. */
  id: string
  /** "18 m · Ricurvo". */
  etichetta: string
  chiave: string
  divisione: string
  /** I punteggi, dal più vecchio al più recente. */
  punti: ProvaGara[]
}

/**
 * Le serie con almeno due punteggi (con uno solo non c'è un andamento), nello stesso ordine dei record:
 * indoor, outdoor, campagna, 3D.
 */
export function serieAndamento(prove: readonly ProvaGara[], minimo = 2): SerieAndamento[] {
  const perSerie = new Map<string, ProvaGara[]>()
  for (const p of prove) {
    const id = `${p.chiave}|${p.divisione}`
    perSerie.set(id, [...(perSerie.get(id) ?? []), p])
  }
  return recordPersonali(prove).flatMap((r) => {
    const id = `${r.chiave}|${r.divisione}`
    const punti = perSerie.get(id)!
    if (punti.length < minimo) return []
    return [
      {
        id,
        etichetta: `${nomeProva(r)} · ${nomeDivisione(r.divisione)}`,
        chiave: r.chiave,
        divisione: r.divisione,
        punti: [...punti].sort(
          (a, b) => a.data.localeCompare(b.data) || a.gara_codice.localeCompare(b.gara_codice),
        ),
      },
    ]
  })
}

export interface MediaAnnuale {
  anno: number
  /** Media dei punteggi dell'anno, con un decimale. */
  media: number
  gare: number
}

/** Le medie per anno solare, dall'anno più recente. */
export function medieAnnuali(punti: readonly ProvaGara[]): MediaAnnuale[] {
  const perAnno = new Map<number, number[]>()
  for (const p of punti) {
    const anno = Number(p.data.slice(0, 4))
    perAnno.set(anno, [...(perAnno.get(anno) ?? []), p.totale])
  }
  return [...perAnno.entries()]
    .map(([anno, valori]) => ({
      anno,
      media: Math.round((valori.reduce((a, b) => a + b, 0) / valori.length) * 10) / 10,
      gare: valori.length,
    }))
    .sort((a, b) => b.anno - a.anno)
}

/** Estremi dell'asse dei punteggi e i valori da scrivere: arrotondati a numeri "tondi". */
export function assePunteggi(valori: readonly number[]): {
  min: number
  max: number
  tacche: number[]
} {
  const minimo = Math.min(...valori)
  const massimo = Math.max(...valori)
  // Passo tondo (1, 2, 5 × 10^n) che dia 3-5 tacche.
  const intervallo = Math.max(massimo - minimo, 1)
  const grezzo = intervallo / 3
  const potenza = 10 ** Math.floor(Math.log10(grezzo))
  const passo = [1, 2, 5, 10].map((m) => m * potenza).find((p) => p >= grezzo)!
  const min = Math.floor(minimo / passo) * passo
  const max = Math.max(Math.ceil(massimo / passo) * passo, min + passo)
  const tacche: number[] = []
  for (let v = min; v <= max + 1e-9; v += passo) tacche.push(v)
  return { min, max, tacche }
}

// --- Scheda atleta per prova (Mattia, 10/11/2026) ------------------------------------------------

/**
 * Tutte le prove (con il loro arco) in cui l'atleta ha almeno un punteggio: i pulsanti della scheda atleta,
 * nello stesso ordine dei record (indoor, outdoor, campagna, 3D; dentro ognuna per distanza).
 */
export const serieAtleta = (prove: readonly ProvaGara[]) => serieAndamento(prove, 1)

/** "indoor:18m|OL": identifica una prova con un arco (e va nell'indirizzo della pagina, codificato). */
export const idSerie = (p: Pick<ProvaGara, 'chiave' | 'divisione'>) => `${p.chiave}|${p.divisione}`

/** Gli anni in cui ci sono punteggi, dal più recente. */
export function anniDellaSerie(punti: readonly Pick<ProvaGara, 'data'>[]): number[] {
  return [...new Set(punti.map((p) => Number(p.data.slice(0, 4))))].sort((a, b) => b - a)
}

/** Gli anni scelti nel grafico: alcuni anni, o tutta la carriera. */
export type AnniScelti = readonly number[] | 'tutti'

/**
 * La scelta di partenza: l'anno in corso; se quest'anno non ci sono ancora punteggi, l'anno più recente che ne
 * ha (altrimenti il grafico partirebbe vuoto).
 */
export function anniPredefiniti(anni: readonly number[], oggi: string): AnniScelti {
  const corrente = Number(oggi.slice(0, 4))
  if (anni.includes(corrente)) return [corrente]
  return anni.length > 0 ? [anni[0]!] : 'tutti'
}

/** I punteggi degli anni scelti. */
export const filtraPerAnni = <T extends Pick<ProvaGara, 'data'>>(
  punti: readonly T[],
  anni: AnniScelti,
): T[] =>
  anni === 'tutti' ? [...punti] : punti.filter((p) => anni.includes(Number(p.data.slice(0, 4))))

/** "2026", "2025, 2026", "Tutta la carriera": cosa è scelto, in breve. */
export const descriviAnni = (anni: AnniScelti): string =>
  anni === 'tutti' ? 'Tutta la carriera' : [...anni].sort((a, b) => a - b).join(', ')

/** Lo storico di una prova: i punteggi anno per anno, dal più recente. */
export function storicoPerAnnoDellaSerie(
  punti: readonly ProvaGara[],
): { anno: number; punti: ProvaGara[] }[] {
  const recenti = [...punti].sort(
    (a, b) => b.data.localeCompare(a.data) || b.gara_codice.localeCompare(a.gara_codice),
  )
  return anniDellaSerie(recenti).map((anno) => ({
    anno,
    punti: recenti.filter((p) => p.data.startsWith(`${anno}-`)),
  }))
}
