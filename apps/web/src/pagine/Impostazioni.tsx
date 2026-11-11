import { useState } from 'react'
import { useLocation } from 'react-router'
import { useAccesso, useAtletaCorrente } from '../accesso/contesto'
import { nomeCompleto } from '../accesso/servizio'
import { Button } from '../componenti/Button'
import { ListGroup, ListRow } from '../componenti/List'
import { Notice } from '../componenti/Notice'
import { PageHeader } from '../componenti/PageHeader'
import type { StatoNotifiche } from '../notifiche/servizio'
import { useNotifiche } from '../notifiche/useNotifiche'
import { useModificheDaInviare } from '../allenamento/dati'
import { useSincronizzazione } from '../sync/contesto'
import { descriviUltima } from '../sync/formato'
import { useOnline } from '../stato/useOnline'
import { DESTINAZIONI, destinazioneDi } from '../navigazione'
import { SCELTE_TEMA } from '../tema/tema'
import { useTema } from '../tema/useTema'
import { useChiMiSegue } from '../allenatore/dati'
import { AtletiCheSegui, TiSeguono } from '../allenatore/SezioneImpostazioni'
import styles from './Impostazioni.module.css'

/** La frase sotto "Nuovi inviti": spiega cosa fare o perché non si può. */
function descrizioneNotifiche(stato: StatoNotifiche, acceso: boolean): string {
  switch (stato) {
    case 'accese':
    case 'spente':
      return acceso
        ? "Ti avvisiamo quando esce l'invito di una gara. Tocca per spegnerle."
        : "Ricevi un avviso quando esce l'invito di una gara. Tocca per accenderle."
    case 'serve-home':
      return 'Su iPhone prima aggiungi l’app alla schermata Home, poi aprila da lì.'
    case 'bloccate':
      return 'Hai negato il permesso: riattivalo dalle impostazioni del telefono.'
    case 'non-supportate':
      return 'Questo telefono o browser non può ricevere le notifiche.'
    case 'caricamento':
      return 'Controllo in corso…'
  }
}

/** Impostazioni: accesso, tema e informazioni. Si torna al tab da cui si è arrivati. */
export function Impostazioni() {
  const [tema, impostaTema] = useTema()
  const atleta = useAtletaCorrente()
  const { esci } = useAccesso()
  const [confermaUscita, setConfermaUscita] = useState(false)
  const online = useOnline()
  const { stato: sync, aggiorna } = useSincronizzazione()
  // L'avviso del programma ha senso solo se qualcuno segue l'atleta (Fase 7.3).
  const chiMiSegue = useChiMiSegue()
  const haAllenatore = (chiMiSegue?.length ?? 0) > 0
  const notifiche = useNotifiche(haAllenatore)
  const daInviare = useModificheDaInviare()
  const interruttoreUtilizzabile =
    !notifiche.occupato && (notifiche.stato === 'spente' || notifiche.stato === 'accese')
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

        <ListGroup title="Notifiche">
          <ListRow
            label="Nuovi inviti"
            value={notifiche.acceso('inviti') ? 'Accese' : 'Spente'}
            description={descrizioneNotifiche(notifiche.stato, notifiche.acceso('inviti'))}
            onSelect={interruttoreUtilizzabile ? () => void notifiche.cambia('inviti') : undefined}
          />
          {haAllenatore && (notifiche.stato === 'spente' || notifiche.stato === 'accese') && (
            <ListRow
              label="Programma dell’allenatore"
              value={notifiche.acceso('programma') ? 'Accese' : 'Spente'}
              description={
                notifiche.acceso('programma')
                  ? 'Ti avvisiamo quando un tuo allenatore cambia il programma. Tocca per spegnerle.'
                  : 'Ricevi un avviso quando un tuo allenatore cambia il programma. Tocca per accenderle.'
              }
              onSelect={
                interruttoreUtilizzabile ? () => void notifiche.cambia('programma') : undefined
              }
            />
          )}
        </ListGroup>
        {notifiche.errore === 'negato' && (
          <Notice status="warning">
            Senza il permesso del telefono le notifiche non possono partire. Riprova e tocca
            “Consenti”.
          </Notice>
        )}
        {notifiche.errore === 'errore' && (
          <Notice status="error">Non è stato possibile accenderle. Riprova tra poco.</Notice>
        )}

        <TiSeguono />
        <AtletiCheSegui />

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
              {(daInviare ?? 0) > 0 && (
                <Notice status="error">
                  {daInviare === 1
                    ? 'C’è 1 modifica dell’allenamento non ancora inviata al server: uscendo ora la perdi.'
                    : `Ci sono ${daInviare} modifiche dell’allenamento non ancora inviate al server: uscendo ora le perdi.`}{' '}
                  Aspetta di essere online e che l’aggiornamento finisca.
                </Notice>
              )}
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
