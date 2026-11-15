import {
  descriviStato,
  etichettaTipologia,
  formattaDate,
  statoSondaggioGara,
  type Gara,
  type StatoSondaggioGara,
} from '@arco/shared'
import { ListRow, type TonoRiga } from '../componenti/List'
import type { Indietro } from '../navigazione'
import { useSondaggiPerMe } from './sondaggio'

/** Colore e scritta di una gara futura secondo il sondaggio (Mattia, 15/11/2026): mai solo il colore. */
const ASPETTO: Record<StatoSondaggioGara, { tono: TonoRiga; testo: string }> = {
  'da-rispondere': { tono: 'avviso', testo: 'Sondaggio aperto: rispondi' },
  partecipi: { tono: 'positivo', testo: 'Partecipi' },
  'non-partecipi': { tono: 'negativo', testo: 'Non partecipi' },
}

/**
 * Una gara negli elenchi (tab Gare, calendario, storico): tipologia · luogo, date e sotto lo stato,
 * "Fuori regione" e "Hai partecipato". Le gare future con un sondaggio (Fase 3.5) sono in giallo se il sondaggio è
 * aperto e non hai risposto, in verde se partecipi, in rosso se non partecipi, con la scritta. Apre la scheda.
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
  const perMe = useSondaggiPerMe().get(g.codice)
  const stato = perMe
    ? statoSondaggioGara(
        perMe,
        perMe.partecipa === undefined ? null : { partecipa: perMe.partecipa },
        g,
        oggi,
      )
    : null
  const aspetto = stato ? ASPETTO[stato] : undefined
  return (
    <ListRow
      label={`${etichettaTipologia(g.tipologia)} · ${g.localita}`}
      value={formattaDate(g.dal, g.al, annoCorrente)}
      description={
        [
          aspetto?.testo,
          descriviStato(g, oggi),
          !g.in_calendario_umbria ? 'Fuori regione' : null,
          mie.has(g.codice) ? 'Hai partecipato' : null,
        ]
          .filter(Boolean)
          .join(' · ') || undefined
      }
      tono={aspetto?.tono}
      href={`/gare/${g.codice}`}
      state={indietro ? { indietro } : undefined}
    />
  )
}
