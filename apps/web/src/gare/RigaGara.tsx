import { descriviStato, etichettaTipologia, formattaDate, type Gara } from '@arco/shared'
import { ListRow } from '../componenti/List'
import type { Indietro } from '../navigazione'

/**
 * Una gara negli elenchi (tab Gare, calendario, storico): tipologia · luogo, date e sotto lo stato,
 * "Fuori regione" e "Hai partecipato". Apre la scheda della gara.
 */
export function RigaGara({
  gara: g,
  oggi,
  mie,
  indietro,
}: {
  gara: Gara
  oggi: string
  /** I codici delle gare dell'atleta collegato. */
  mie: ReadonlySet<string>
  /** Dove torna la freccia della scheda gara (di base il tab Gare). */
  indietro?: Indietro
}) {
  const annoCorrente = Number(oggi.slice(0, 4))
  return (
    <ListRow
      label={`${etichettaTipologia(g.tipologia)} · ${g.localita}`}
      value={formattaDate(g.dal, g.al, annoCorrente)}
      description={
        [
          descriviStato(g, oggi),
          !g.in_calendario_umbria ? 'Fuori regione' : null,
          mie.has(g.codice) ? 'Hai partecipato' : null,
        ]
          .filter(Boolean)
          .join(' · ') || undefined
      }
      href={`/gare/${g.codice}`}
      state={indietro ? { indietro } : undefined}
    />
  )
}
