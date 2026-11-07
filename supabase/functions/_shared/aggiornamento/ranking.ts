/**
 * Quali classifiche (ranking) chiedere a Fitarco: solo le combinazioni tipo × divisione × classe × genere
 * dei nostri atleti, senza doppioni (CLAUDE.md, "Classifica").
 */
import type { TipoRanking } from '../fitarco/richieste.ts'
import { riconosciTipologia, type Famiglia } from '../tipologie.ts'

/** Tipo di ranking per famiglia di gara. */
export const TIPO_RANKING: Record<Famiglia, TipoRanking> = {
  indoor: 'I',
  outdoor: 'T',
  campagna: 'C',
  '3d': '3',
}

/** Come la scheda Fitarco chiama i tipi nella "Classe di ranking". */
const TIPO_DA_SCHEDA: Record<string, TipoRanking> = {
  Indoor: 'I',
  Outdoor: 'T',
  Campagna: 'C',
  '3D': '3',
}

/** Classi che hanno una ranking (le giovanili più piccole no). */
const CLASSI_RANKING = new Set(['M', 'S', 'J', 'A', 'R'])

export interface AtletaPerRanking {
  id: string
  /** Dalla scheda: { Indoor: "SM", Outdoor: "SM", … }. */
  classiRanking: Record<string, string>
  /** Le gare dello storico (tipologia come la scrive Fitarco e divisione). */
  gare: { tipologia: string; divisione: string }[]
}

export interface CombinazioneRanking {
  tipo: TipoRanking
  divisione: string
  classe: string
  genere: 'M' | 'F'
  /** Gli atleti che rientrano in questa combinazione. */
  atleti: string[]
}

export function combinazioniRanking(atleti: readonly AtletaPerRanking[]): CombinazioneRanking[] {
  const combinazioni = new Map<string, CombinazioneRanking>()
  for (const atleta of atleti) {
    // Divisioni usate dall'atleta, per tipo di ranking.
    const divisioni = new Map<TipoRanking, Set<string>>()
    for (const g of atleta.gare) {
      const tipologia = riconosciTipologia(g.tipologia)
      if (!tipologia) continue
      const tipo = TIPO_RANKING[tipologia.famiglia]
      divisioni.set(tipo, (divisioni.get(tipo) ?? new Set()).add(g.divisione))
    }
    for (const [nomeTipo, codice] of Object.entries(atleta.classiRanking)) {
      const tipo = TIPO_DA_SCHEDA[nomeTipo]
      const classe = codice.slice(0, -1)
      const genere = codice.at(-1)
      if (!tipo || !CLASSI_RANKING.has(classe) || (genere !== 'M' && genere !== 'F')) continue
      for (const divisione of divisioni.get(tipo) ?? []) {
        const chiave = `${tipo}|${divisione}|${classe}|${genere}`
        const c = combinazioni.get(chiave) ?? { tipo, divisione, classe, genere, atleti: [] }
        c.atleti.push(atleta.id)
        combinazioni.set(chiave, c)
      }
    }
  }
  return [...combinazioni.values()]
}
