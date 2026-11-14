import {
  descriviStato,
  etichettaTipologia,
  formattaDate,
  garaPassata,
  type Gara,
} from '@arco/shared'
import { ListRow } from '../componenti/List'
import type { Indietro } from '../navigazione'
import { useGareCuiPartecipo } from './sondaggio'

/**
 * Una gara negli elenchi (tab Gare, calendario, storico): tipologia · luogo, date e sotto lo stato,
 * "Fuori regione" e "Hai partecipato". Le gare future a cui hai risposto "Partecipo" al sondaggio sono in verde, con
 * "Partecipi" (Fase 3.5). Apre la scheda della gara.
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
  const partecipi = useGareCuiPartecipo().has(g.codice) && !garaPassata(g, oggi)
  return (
    <ListRow
      label={`${etichettaTipologia(g.tipologia)} · ${g.localita}`}
      value={formattaDate(g.dal, g.al, annoCorrente)}
      description={
        [
          partecipi ? 'Partecipi' : null,
          descriviStato(g, oggi),
          !g.in_calendario_umbria ? 'Fuori regione' : null,
          mie.has(g.codice) ? 'Hai partecipato' : null,
        ]
          .filter(Boolean)
          .join(' · ') || undefined
      }
      positiva={partecipi}
      href={`/gare/${g.codice}`}
      state={indietro ? { indietro } : undefined}
    />
  )
}
