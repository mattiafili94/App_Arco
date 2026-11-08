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
export function serieAndamento(prove: readonly ProvaGara[]): SerieAndamento[] {
  const perSerie = new Map<string, ProvaGara[]>()
  for (const p of prove) {
    const id = `${p.chiave}|${p.divisione}`
    perSerie.set(id, [...(perSerie.get(id) ?? []), p])
  }
  return recordPersonali(prove).flatMap((r) => {
    const id = `${r.chiave}|${r.divisione}`
    const punti = perSerie.get(id)!
    if (punti.length < 2) return []
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
