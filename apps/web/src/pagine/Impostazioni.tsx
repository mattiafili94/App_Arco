import { useState } from 'react'
import { useLocation } from 'react-router'
import { useAccesso, useAtletaCorrente } from '../accesso/contesto'
import { nomeCompleto } from '../accesso/servizio'
import { Button } from '../componenti/Button'
import { ListGroup, ListRow } from '../componenti/List'
import { Notice } from '../componenti/Notice'
import { PageHeader } from '../componenti/PageHeader'
import { useSincronizzazione } from '../sync/contesto'
import { descriviUltima } from '../sync/formato'
import { useOnline } from '../stato/useOnline'
import { DESTINAZIONI, destinazioneDi } from '../navigazione'
import { SCELTE_TEMA } from '../tema/tema'
import { useTema } from '../tema/useTema'
import styles from './Impostazioni.module.css'

/** Impostazioni: accesso, tema e informazioni. Si torna al tab da cui si è arrivati. */
export function Impostazioni() {
  const [tema, impostaTema] = useTema()
  const atleta = useAtletaCorrente()
  const { esci } = useAccesso()
  const [confermaUscita, setConfermaUscita] = useState(false)
  const online = useOnline()
  const { stato: sync, aggiorna } = useSincronizzazione()
  const stato = useLocation().state as { da?: string } | null
  const provenienza = destinazioneDi(stato?.da ?? '') ?? DESTINAZIONI[0]!

  return (
    <>
      <PageHeader
        title="Impostazioni"
        back={{ label: provenienza.label, href: provenienza.href }}
      />
      <div className={styles.groups}>
        <ListGroup title="Accesso">
          <ListRow label="Atleta" value={nomeCompleto(atleta)} />
          <ListRow label="Matricola" value={atleta.matricola} />
          {atleta.ruolo === 'amministratore' && (
            <ListRow label="Amministrazione" href="/amministrazione" />
          )}
        </ListGroup>

        <ListGroup title="Dati">
          <ListRow label="Ultimo aggiornamento" value={descriviUltima(sync.ultima)} />
          <ListRow
            label="Aggiorna ora"
            value={
              sync.fase === 'in-corso'
                ? 'In corso…'
                : sync.fase === 'errore'
                  ? 'Non riuscito, riprova'
                  : !online
                    ? 'Offline'
                    : undefined
            }
            onSelect={() => void aggiorna()}
          />
        </ListGroup>

        <ListGroup title="Tema" role="radiogroup">
          {SCELTE_TEMA.map((s) => (
            <ListRow
              key={s.valore}
              label={s.etichetta}
              selected={tema === s.valore}
              onSelect={() => impostaTema(s.valore)}
            />
          ))}
        </ListGroup>

        <ListGroup title="Informazioni">
          <ListRow label="Versione" value={__VERSIONE_APP__} />
          <ListRow label="Compagnia" value="A.S.D. Compagnia Arcieri Eugubini" />
        </ListGroup>

        {/* Azione che toglie l'accesso: in fondo, separata, con conferma (UI Top). */}
        <section className={styles.esci} aria-label="Esci">
          {confermaUscita ? (
            <>
              <Notice status="warning">
                Uscendo, per rientrare su questo telefono ti servirà di nuovo il codice personale.
              </Notice>
              <div className={styles.azioni}>
                <Button variant="destructive" onClick={() => void esci()}>
                  Esci da questo telefono
                </Button>
                <Button variant="text" onClick={() => setConfermaUscita(false)}>
                  Annulla
                </Button>
              </div>
            </>
          ) : (
            <div>
              <Button variant="destructive" onClick={() => setConfermaUscita(true)}>
                Esci
              </Button>
            </div>
          )}
        </section>
      </div>
    </>
  )
}
