import { Calendar } from 'lucide-react'
import { useParams } from 'react-router'
import {
  creaIcs,
  descriviStato,
  etichettaTipologia,
  formattaDate,
  garaPassata,
  linkGoogleCalendar,
  nomeFileIcs,
} from '@arco/shared'
import { EmptyState } from '../componenti/EmptyState'
import { ListGroup, ListRow } from '../componenti/List'
import { PageHeader } from '../componenti/PageHeader'
import { oggi as oggiIn, useGara, useInvito } from '../gare/dati'
import { scaricaTesto } from '../gare/scarica'
import styles from './Gare.module.css'

const INDIETRO = { label: 'Gare', href: '/gare' }

/**
 * Scheda di una gara: dettagli, invito (testo completo) e "Aggiungi al calendario" per le gare
 * che devono ancora venire. Tutto dai dati sul telefono, quindi anche offline.
 */
export function DettaglioGara() {
  const { codice = '' } = useParams()
  const gara = useGara(codice)
  const invito = useInvito(codice)
  const oggi = oggiIn()

  if (gara === undefined || invito === undefined) {
    return <PageHeader title="Gara" back={INDIETRO} />
  }
  if (gara === null) {
    return (
      <>
        <PageHeader title="Gara" back={INDIETRO} />
        <EmptyState
          icon={Calendar}
          title="Gara non trovata"
          description="Questa gara non è nei dati salvati sul telefono. Torna all'elenco: se è una gara nuova arriverà con il prossimo aggiornamento."
        />
      </>
    )
  }

  const passata = garaPassata(gara, oggi)
  const stato = descriviStato(gara, oggi)
  const daAggiungere = !passata && gara.stato !== 'annullata'
  const invitoAttesa = !passata && !invito && (gara.ha_invito || gara.stato === 'invito')

  return (
    <>
      <PageHeader
        title={etichettaTipologia(gara.tipologia)}
        back={INDIETRO}
        description={`${gara.localita} · ${formattaDate(gara.dal, gara.al)}`}
      />
      <div className={styles.gruppi}>
        <ListGroup title="Gara">
          <ListRow label="Data" value={formattaDate(gara.dal, gara.al)} />
          <ListRow label="Luogo" value={gara.localita} />
          <ListRow label="Tipologia" value={gara.tipologia} />
          {gara.societa_nome && <ListRow label="Organizza" value={gara.societa_nome} />}
          <ListRow label="Calendario" value={gara.calendario} />
          {stato && <ListRow label="Stato" value={stato} />}
          {!gara.in_calendario_umbria && <ListRow label="Regione" value="Fuori regione" />}
        </ListGroup>

        {daAggiungere && (
          <ListGroup title="Aggiungi al calendario">
            <ListRow
              label="Calendario del telefono"
              description="Scarica il file e aprilo con il calendario"
              onSelect={() =>
                scaricaTesto(nomeFileIcs(gara), creaIcs(gara), 'text/calendar;charset=utf-8')
              }
            />
            <ListRow label="Google Calendar" href={linkGoogleCalendar(gara)} esterno />
          </ListGroup>
        )}

        {invito && (
          <>
            {(invito.luogo || invito.riferimento || invito.email || invito.web) && (
              <ListGroup title="Contatti">
                {invito.luogo && <ListRow label="Luogo di gara" value={invito.luogo} />}
                {invito.riferimento && <ListRow label="Referente" value={invito.riferimento} />}
                {invito.email && (
                  <ListRow
                    label="Email"
                    value={invito.email}
                    href={`mailto:${invito.email}`}
                    esterno
                  />
                )}
                {invito.web && (
                  <ListRow label="Sito" value={invito.web} href={invito.web} esterno />
                )}
              </ListGroup>
            )}
            {invito.testo && (
              <ListGroup title="Invito">
                <p className={styles.testo}>{invito.testo}</p>
              </ListGroup>
            )}
          </>
        )}
        {invitoAttesa && (
          <ListGroup title="Invito">
            <ListRow
              label="Invito in arrivo"
              description="C'è un invito su Fitarco: si scarica con il prossimo aggiornamento."
            />
          </ListGroup>
        )}

        {gara.url_risultati && (
          <ListGroup title="Risultati">
            <ListRow label="PDF dei risultati" href={gara.url_risultati} esterno />
          </ListGroup>
        )}
      </div>
    </>
  )
}
