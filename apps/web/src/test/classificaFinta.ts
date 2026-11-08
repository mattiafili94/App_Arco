import { vi } from 'vitest'
import type {
  ClassificaRanking,
  FiltroClassifica,
  MiaPosizione,
  RispostaAggiorna,
} from '@arco/shared'
import type { ServizioClassifica } from '../classifica/servizio'

const chiave = (f: FiltroClassifica) => `${f.tipo}|${f.divisione}|${f.classe}|${f.genere}`

/**
 * Classifiche finte per i test: tiene in memoria le classifiche "sul server" e risponde come farebbe
 * Supabase. `rete = false` simula l'assenza di rete (letture che falliscono).
 */
export class ClassificaFinta implements ServizioClassifica {
  classifiche = new Map<string, ClassificaRanking>()
  rete = true
  /** Cosa risponde il pulsante "Aggiorna" (di base: classifica già presente, riletta). */
  rispostaAggiorna: RispostaAggiorna | null = null
  /** Cosa succede alla classifica dopo un "Aggiorna" riuscito (di base niente). */
  dopoAggiorna: ((f: FiltroClassifica) => ClassificaRanking | null) | null = null

  aggiungi(c: ClassificaRanking) {
    this.classifiche.set(chiave(c), c)
  }

  private controllaRete() {
    if (!this.rete) throw new Error('offline')
  }

  miePosizioni = vi.fn(async (matricola: string): Promise<MiaPosizione[]> => {
    this.controllaRete()
    return [...this.classifiche.values()].flatMap((c) => {
      const riga = c.righe.find((r) => r.matricola === matricola)
      return riga
        ? [
            {
              tipo: c.tipo,
              divisione: c.divisione,
              classe: c.classe,
              genere: c.genere,
              categoria: c.categoria,
              totale: c.totale,
              letta_il: c.letta_il,
              aggiornato_il: c.aggiornato_il,
              riga,
            },
          ]
        : []
    })
  })

  leggi = vi.fn(
    async (
      filtro: FiltroClassifica,
      conosciuta: string | null,
    ): Promise<ClassificaRanking | 'invariata' | null> => {
      this.controllaRete()
      const c = this.classifiche.get(chiave(filtro))
      if (!c) return null
      return conosciuta !== null && Date.parse(conosciuta) === Date.parse(c.aggiornato_il)
        ? 'invariata'
        : c
    },
  )

  aggiorna = vi.fn(async (filtro: FiltroClassifica): Promise<RispostaAggiorna> => {
    if (!this.rete) return { esito: 'rete' }
    if (this.rispostaAggiorna) return this.rispostaAggiorna
    const nuova = this.dopoAggiorna?.(filtro)
    if (nuova) this.aggiungi(nuova)
    const c = this.classifiche.get(chiave(filtro))
    return c
      ? { esito: 'ok', atleti: c.righe.length, lettaIl: c.letta_il }
      : { esito: 'errore', errore: 'Classifica non disponibile.' }
  })
}
