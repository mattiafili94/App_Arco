import { Calendar } from 'lucide-react'
import {
  descriviStato,
  etichettaTipologia,
  formattaDate,
  garaPassata,
  type Gara,
} from '@arco/shared'
import { EmptyState } from '../componenti/EmptyState'
import { ListGroup, ListRow } from '../componenti/List'
import { oggi as oggiIn, useGare, useMieGare } from '../gare/dati'
import { useSincronizzazione } from '../sync/contesto'
import styles from './Gare.module.css'
import { PaginaTab } from './PaginaTab'

/**
 * Tab Gare: il calendario dell'Umbria dell'anno e le gare dei nostri atleti (anche fuori regione).
 * Prima le prossime, poi le passate (le più recenti per prime). Tutto dai dati sul telefono.
 */
export function Gare() {
  const gare = useGare()
  const mie = useMieGare()
  const { stato } = useSincronizzazione()
  const oggi = oggiIn()

  if (gare === undefined || mie === undefined) return <PaginaTab title="Gare">{null}</PaginaTab>

  if (gare.length === 0) {
    return (
      <PaginaTab title="Gare">
        <EmptyState
          icon={Calendar}
          title="Nessuna gara salvata"
          description={
            stato.ultima === null
              ? 'Le gare arrivano con il primo aggiornamento dei dati, che richiede la rete. Appena sei online si scaricano da sole.'
              : "Il calendario non ha ancora gare. Quando l'amministratore le importerà compariranno qui."
          }
        />
      </PaginaTab>
    )
  }

  const prossime = gare
    .filter((g) => !garaPassata(g, oggi))
    .sort((a, b) => a.dal.localeCompare(b.dal))
  const passate = gare
    .filter((g) => garaPassata(g, oggi))
    .sort((a, b) => b.dal.localeCompare(a.dal))
  const annoCorrente = Number(oggi.slice(0, 4))

  const riga = (g: Gara) => (
    <ListRow
      key={g.codice}
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
    />
  )

  return (
    <PaginaTab title="Gare">
      <div className={styles.gruppi}>
        {prossime.length > 0 && <ListGroup title="Prossime">{prossime.map(riga)}</ListGroup>}
        {passate.length > 0 && <ListGroup title="Passate">{passate.map(riga)}</ListGroup>}
      </div>
    </PaginaTab>
  )
}
