import { useParams } from 'react-router'
import { anniDelCalendario, calendarioPerMese, storicoPerAnno, type GruppoGare } from '@arco/shared'
import { EmptyState } from '../componenti/EmptyState'
import { ListGroup } from '../componenti/List'
import { PageHeader } from '../componenti/PageHeader'
import { oggi as oggiIn, useGare, useMieGare } from '../gare/dati'
import { RigaGara } from '../gare/RigaGara'
import type { Indietro } from '../navigazione'
import { Calendar, History } from 'lucide-react'
import styles from './Gare.module.css'

const INDIETRO = { label: 'Gare', href: '/gare' }

/** Un elenco di gare a gruppi (mesi o anni), dai dati sul telefono. */
function Gruppi({
  gruppi,
  oggi,
  mie,
  indietro,
}: {
  gruppi: GruppoGare[]
  oggi: string
  mie: Set<string>
  indietro: Indietro
}) {
  return (
    <div className={styles.gruppi}>
      {gruppi.map((gr) => (
        <ListGroup key={gr.titolo} title={gr.titolo}>
          {gr.gare.map((g) => (
            <RigaGara key={g.codice} gara={g} oggi={oggi} mie={mie} indietro={indietro} />
          ))}
        </ListGroup>
      ))}
    </div>
  )
}

/**
 * Il calendario di un anno (`/gare/calendario/:anno`): tutte le gare, mese per mese, anche quelle già fatte.
 * Si aprono solo l'anno in corso e, quando c'è, quello dopo (gli altri anni stanno nello storico).
 */
export function CalendarioAnno() {
  const { anno = '' } = useParams()
  const gare = useGare()
  const mie = useMieGare()
  const oggi = oggiIn()
  const titolo = `Calendario ${anno}`

  if (gare === undefined || mie === undefined) return <PageHeader title={titolo} back={INDIETRO} />
  // Un anno senza calendario (passato, o il prossimo finché non è definitivo): lo si dice, senza
  // spostarsi altrove (al primo avvio le gare possono essere ancora in arrivo).
  if (!anniDelCalendario(gare, oggi).includes(Number(anno))) {
    return (
      <>
        <PageHeader title={titolo} back={INDIETRO} />
        <EmptyState
          icon={Calendar}
          title="Calendario non disponibile"
          description="Qui c'è il calendario dell'anno in corso e, quando Fitarco lo rende definitivo, quello dell'anno dopo. Le gare degli anni passati sono nello storico."
        />
      </>
    )
  }

  const mesi = calendarioPerMese(gare, Number(anno))
  return (
    <>
      <PageHeader title={titolo} back={INDIETRO} />
      {mesi.length > 0 ? (
        <Gruppi
          gruppi={mesi}
          oggi={oggi}
          mie={mie}
          indietro={{ label: titolo, href: `/gare/calendario/${anno}` }}
        />
      ) : (
        <EmptyState
          icon={Calendar}
          title="Nessuna gara in calendario"
          description="Le gare di quest'anno arrivano da Fitarco con il prossimo aggiornamento dei dati."
        />
      )}
    </>
  )
}

/** Lo storico (`/gare/storico`): le gare passate dell'anno in corso e dell'anno prima, anno per anno. */
export function StoricoGare() {
  const gare = useGare()
  const mie = useMieGare()
  const oggi = oggiIn()

  if (gare === undefined || mie === undefined) {
    return <PageHeader title="Storico gare" back={INDIETRO} />
  }
  const anni = storicoPerAnno(gare, oggi)
  return (
    <>
      <PageHeader title="Storico gare" back={INDIETRO} />
      {anni.length > 0 ? (
        <Gruppi
          gruppi={anni}
          oggi={oggi}
          mie={mie}
          indietro={{ label: 'Storico gare', href: '/gare/storico' }}
        />
      ) : (
        <EmptyState
          icon={History}
          title="Nessuna gara passata"
          description="Qui compariranno le gare già disputate."
        />
      )}
    </>
  )
}
