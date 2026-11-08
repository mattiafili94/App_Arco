import { Users } from 'lucide-react'
import { useParams } from 'react-router'
import {
  etichettaTipologia,
  formattaDate,
  nomeDivisione,
  nomeProva,
  proveDiAtleta,
  recordPersonali,
  storicoAtleta,
  type ProvaGara,
} from '@arco/shared'
import { nomeAtleta, useAtleta, useClassificheDi, usePartecipazioniDi } from '../atleti/dati'
import { EmptyState } from '../componenti/EmptyState'
import { ListGroup, ListRow } from '../componenti/List'
import { PageHeader } from '../componenti/PageHeader'
import { oggi as oggiIn, useGare } from '../gare/dati'
import styles from './Gare.module.css'

const INDIETRO = { label: 'Atleti', href: '/atleti' }

/**
 * Scheda di un atleta: record personali (per prova e arco) e storico delle gare. Le gare composte
 * contano per prova; i risultati non ancora omologati si segnalano "provvisorio".
 */
export function SchedaAtleta() {
  const { id = '' } = useParams()
  const atleta = useAtleta(id)
  const partecipazioni = usePartecipazioniDi(id)
  const classifiche = useClassificheDi(id)
  const gare = useGare()
  const annoCorrente = Number(oggiIn().slice(0, 4))

  if (
    atleta === undefined ||
    partecipazioni === undefined ||
    classifiche === undefined ||
    gare === undefined
  ) {
    return <PageHeader title="Atleta" back={INDIETRO} />
  }
  if (atleta === null) {
    return (
      <>
        <PageHeader title="Atleta" back={INDIETRO} />
        <EmptyState
          icon={Users}
          title="Atleta non trovato"
          description="Questo atleta non è nei dati salvati sul telefono. Torna all'elenco: se è un atleta nuovo arriverà con il prossimo aggiornamento."
        />
      </>
    )
  }

  const record = recordPersonali(proveDiAtleta(id, partecipazioni, gare, classifiche))
  const storico = storicoAtleta(id, partecipazioni, gare)
  const gareDelRecord = new Map(gare.map((g) => [g.codice, g]))

  const rigaRecord = (p: ProvaGara) => {
    const g = gareDelRecord.get(p.gara_codice)!
    return (
      <ListRow
        key={`${p.chiave}|${p.divisione}`}
        label={`${nomeProva(p)} · ${nomeDivisione(p.divisione)}`}
        value={String(p.totale)}
        description={[
          `${g.localita} · ${formattaDate(g.dal, g.al, annoCorrente)}`,
          p.provvisoria ? 'provvisorio' : null,
        ]
          .filter(Boolean)
          .join(' · ')}
        href={`/gare/${p.gara_codice}`}
      />
    )
  }

  return (
    <>
      <PageHeader title={nomeAtleta(atleta)} back={INDIETRO} />
      <div className={styles.gruppi}>
        <ListGroup title="Record personali">
          {record.length > 0 ? (
            record.map(rigaRecord)
          ) : (
            <ListRow
              label="Nessun record per ora"
              description="I record compaiono con i risultati delle gare."
            />
          )}
        </ListGroup>

        <ListGroup title="Storico gare">
          {storico.length > 0 ? (
            storico.map((r) => (
              <ListRow
                key={`${r.gara.codice}|${r.divisione}`}
                label={`${etichettaTipologia(r.gara.tipologia)} · ${r.gara.localita}`}
                value={r.totale === null ? undefined : String(r.totale)}
                description={[
                  formattaDate(r.gara.dal, r.gara.al, annoCorrente),
                  nomeDivisione(r.divisione),
                  r.posizione === null ? null : `${r.posizione}° posto`,
                ]
                  .filter(Boolean)
                  .join(' · ')}
                href={`/gare/${r.gara.codice}`}
              />
            ))
          ) : (
            <ListRow
              label="Nessuna gara per ora"
              description="Lo storico arriva da Fitarco con il primo aggiornamento."
            />
          )}
        </ListGroup>
      </div>
    </>
  )
}
