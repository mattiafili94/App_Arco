import { Calendar } from 'lucide-react'
import { anniDelCalendario, GARE_IN_EVIDENZA, garePassate, prossimeGare } from '@arco/shared'
import { LinkButton } from '../componenti/Button'
import { EmptyState } from '../componenti/EmptyState'
import { ListGroup } from '../componenti/List'
import { oggi as oggiIn, useGare, useMieGare } from '../gare/dati'
import { RigaGara } from '../gare/RigaGara'
import { useSincronizzazione } from '../sync/contesto'
import styles from './Gare.module.css'
import { PaginaTab } from './PaginaTab'

/**
 * Tab Gare: le prossime 6 gare (dalla più vicina) con i pulsanti dei calendari dell'anno, e le ultime 6
 * passate con il pulsante dello storico completo (Mattia, 10/11/2026). Tutto dai dati sul telefono.
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

  const prossime = prossimeGare(gare, oggi)
  const passate = garePassate(gare, oggi)
  const anni = anniDelCalendario(gare, oggi)

  return (
    <PaginaTab title="Gare">
      <div className={styles.gruppi}>
        <div className={styles.sezione}>
          {prossime.length > 0 && (
            <ListGroup title="Prossime">
              {prossime.slice(0, GARE_IN_EVIDENZA).map((g) => (
                <RigaGara key={g.codice} gara={g} oggi={oggi} mie={mie} />
              ))}
            </ListGroup>
          )}
          <div className={styles.pulsanti}>
            {anni.map((anno) => (
              <LinkButton key={anno} to={`/gare/calendario/${anno}`}>
                {`Calendario ${anno}`}
              </LinkButton>
            ))}
          </div>
        </div>
        {passate.length > 0 && (
          <div className={styles.sezione}>
            <ListGroup title="Passate">
              {passate.slice(0, GARE_IN_EVIDENZA).map((g) => (
                <RigaGara key={g.codice} gara={g} oggi={oggi} mie={mie} />
              ))}
            </ListGroup>
            <div className={styles.pulsanti}>
              <LinkButton to="/gare/storico">Storico completo</LinkButton>
            </div>
          </div>
        )}
      </div>
    </PaginaTab>
  )
}
