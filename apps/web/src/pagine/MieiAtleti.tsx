import type { ReactNode } from 'react'
import { ClipboardList } from 'lucide-react'
import { useParams } from 'react-router'
import { useAtletaSeguito, useAtletiSeguiti, useSonoAllenatore } from '../allenatore/dati'
import { nomeAtleta, type AtletaSalvato } from '../atleti/dati'
import { LinkButton } from '../componenti/Button'
import { EmptyState } from '../componenti/EmptyState'
import { ListGroup, ListRow } from '../componenti/List'
import { PageHeader } from '../componenti/PageHeader'
import { SettimanaAllenamento } from './Allenamento'
import { GiornoAllenamento } from './GiornoAllenamento'
import { PaginaTab } from './PaginaTab'
import { SimulazioneAtleta } from './SimulazionePagina'
import styles from './Gare.module.css'

const MIEI_ATLETI = { label: 'I miei atleti', href: '/allenatore' }

/**
 * Tab "I miei atleti" (Fase 7, solo per chi ha il ruolo di allenatore): gli atleti che segue. Toccandone uno si
 * apre la sua settimana di allenamento. Gli atleti da seguire si scelgono in Impostazioni.
 */
export function MieiAtleti() {
  const allenatore = useSonoAllenatore()
  const seguiti = useAtletiSeguiti()
  if (allenatore === undefined || seguiti === undefined) {
    return <PaginaTab title="I miei atleti">{null}</PaginaTab>
  }
  if (!allenatore) {
    return (
      <PaginaTab title="I miei atleti">
        <EmptyState
          icon={ClipboardList}
          title="Sezione per gli allenatori"
          description="Qui gli allenatori seguono l’allenamento dei loro atleti. Il ruolo lo dà l’amministratore."
        />
      </PaginaTab>
    )
  }
  return (
    <PaginaTab title="I miei atleti">
      <div className={styles.gruppi}>
        {seguiti.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="Non segui ancora nessun atleta"
            description="Scegli in Impostazioni gli atleti di cui vuoi seguire l’allenamento."
          />
        ) : (
          <ListGroup title="Atleti che segui">
            {seguiti.map((a) => (
              <ListRow key={a.id} label={nomeAtleta(a)} href={`/allenatore/${a.id}`} />
            ))}
          </ListGroup>
        )}
        <div className={styles.pulsanti}>
          <LinkButton to="/impostazioni#atleti-che-segui">Scegli gli atleti</LinkButton>
        </div>
      </div>
    </PaginaTab>
  )
}

/** Controlla che l'atleta dell'indirizzo sia seguito; se no lo dice. */
function ConAtletaSeguito({
  titolo,
  figlio,
}: {
  titolo: string
  figlio(atleta: AtletaSalvato): ReactNode
}) {
  const { atleta: atletaId = '' } = useParams()
  const atleta = useAtletaSeguito(atletaId)
  if (atleta === undefined) return <PageHeader title={titolo} back={MIEI_ATLETI} />
  if (atleta === null) {
    return (
      <>
        <PageHeader title={titolo} back={MIEI_ATLETI} />
        <EmptyState
          icon={ClipboardList}
          title="Atleta non seguito"
          description="Non segui questo atleta. Lo puoi scegliere in Impostazioni, tra gli atleti che segui."
        />
      </>
    )
  }
  return <>{figlio(atleta)}</>
}

/** La settimana di un atleta seguito (`/allenatore/:atleta`). */
export function SettimanaSeguito() {
  return (
    <ConAtletaSeguito
      titolo="Allenamento"
      figlio={(a) => (
        <SettimanaAllenamento
          atletaId={a.id}
          base={`/allenatore/${a.id}`}
          allenatore
          intestazione={(contenuto) => (
            <>
              <PageHeader
                title={nomeAtleta(a)}
                back={MIEI_ATLETI}
                description="Allenamento della settimana"
              />
              {contenuto}
            </>
          )}
        />
      )}
    />
  )
}

/** Un giorno di un atleta seguito (`/allenatore/:atleta/AAAA-MM-GG`): l'allenatore scrive il programma. */
export function GiornoSeguito() {
  return (
    <ConAtletaSeguito
      titolo="Giorno"
      figlio={(a) => (
        <GiornoAllenamento
          atletaId={a.id}
          base={`/allenatore/${a.id}`}
          allenatore
          indietro={nomeAtleta(a)}
        />
      )}
    />
  )
}

/** Una simulazione di un atleta seguito, solo da guardare. */
export function SimulazioneSeguito() {
  return (
    <ConAtletaSeguito
      titolo="Simulazione"
      figlio={(a) => (
        <SimulazioneAtleta
          atletaId={a.id}
          base={`/allenatore/${a.id}`}
          solaLettura
          indietro={nomeAtleta(a)}
        />
      )}
    />
  )
}
