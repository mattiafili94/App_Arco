import type { Remoto } from '../sync/remoto'
import { chiaveDi, TABELLE, type Eliminazione, type NomeTabella, type Riga } from '../sync/tabelle'

/**
 * Server finto per i test della sincronizzazione: tiene le righe in memoria, con `aggiornato_il` e il
 * registro delle eliminazioni, e risponde come farebbe Supabase (filtro per data, ordine stabile, pagine).
 */
export class RemotoFinto implements Remoto {
  righe: Record<NomeTabella, Riga[]> = {
    atleti: [],
    gare: [],
    inviti: [],
    partecipazioni: [],
    classifiche: [],
    ranking: [],
  }
  registro: Eliminazione[] = []
  /** Le richieste ricevute, per controllare che non si scarichi più del necessario. */
  richieste: string[] = []
  /** Se impostato, la richiesta successiva fallisce con questo errore (rete assente). */
  errore: Error | null = null

  private prossimoId = 1

  private controllaRete() {
    if (this.errore) throw this.errore
  }

  /** Inserisce o sostituisce una riga (come un salvataggio del server). */
  scrivi(tabella: NomeTabella, riga: Riga) {
    const def = TABELLE.find((t) => t.nome === tabella)!
    const chiave = JSON.stringify(chiaveDi(def, riga))
    const elenco = this.righe[tabella]
    const posizione = elenco.findIndex((r) => JSON.stringify(chiaveDi(def, r)) === chiave)
    if (posizione >= 0) elenco[posizione] = riga
    else elenco.push(riga)
  }

  /** Elimina una riga e lascia la traccia nel registro. */
  elimina(tabella: NomeTabella, chiave: Record<string, unknown>) {
    const def = TABELLE.find((t) => t.nome === tabella)!
    const voluta = JSON.stringify(chiaveDi(def, chiave))
    this.righe[tabella] = this.righe[tabella].filter(
      (r) => JSON.stringify(chiaveDi(def, r)) !== voluta,
    )
    this.registro.push({ id: this.prossimoId++, tabella, chiave })
  }

  async cambiamenti(tabella: NomeTabella, dal: string | null, da: number, quante: number) {
    this.controllaRete()
    this.richieste.push(`${tabella} dal ${dal ?? 'inizio'} da ${da}`)
    const def = TABELLE.find((t) => t.nome === tabella)!
    return this.righe[tabella]
      .filter((r) => dal === null || Date.parse(String(r.aggiornato_il)) >= Date.parse(dal))
      .sort(
        (a, b) =>
          String(a.aggiornato_il).localeCompare(String(b.aggiornato_il)) ||
          JSON.stringify(chiaveDi(def, a)).localeCompare(JSON.stringify(chiaveDi(def, b))),
      )
      .slice(da, da + quante)
  }

  async eliminazioni(dopoId: number, quante: number) {
    this.controllaRete()
    this.richieste.push(`eliminazioni dopo ${dopoId}`)
    return this.registro.filter((e) => e.id > dopoId).slice(0, quante)
  }

  async ultimaEliminazione() {
    this.controllaRete()
    this.richieste.push('ultima eliminazione')
    return this.registro.at(-1)?.id ?? 0
  }
}
