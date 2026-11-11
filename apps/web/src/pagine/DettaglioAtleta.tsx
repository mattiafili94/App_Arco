import { useState } from 'react'
import { Navigate, useParams } from 'react-router'
import { formattaCodice } from '@arco/shared'
import { useAccesso, useAtletaCorrente } from '../accesso/contesto'
import { nomeCompleto } from '../accesso/servizio'
import { Button } from '../componenti/Button'
import { Checkbox } from '../componenti/Checkbox'
import { ListGroup, ListRow } from '../componenti/List'
import { Notice } from '../componenti/Notice'
import { PageHeader } from '../componenti/PageHeader'
import { ERRORE_CARICAMENTO, useElencoAtleti } from '../accesso/useElencoAtleti'
import styles from './Amministrazione.module.css'

type Esito = { tipo: 'success' | 'error'; testo: string }

/** Un atleta, per l'amministratore: generare il link personale o revocare l'accesso. */
export function DettaglioAtleta() {
  const io = useAtletaCorrente()
  const { servizio } = useAccesso()
  const { id } = useParams()
  const { elenco, errore, carica } = useElencoAtleti()

  const [link, setLink] = useState<{ link: string; codice: string } | null>(null)
  const [esito, setEsito] = useState<Esito | null>(null)
  const [inCorso, setInCorso] = useState<'genera' | 'revoca' | 'ruolo' | null>(null)
  const [confermaRevoca, setConfermaRevoca] = useState(false)
  // Il ruolo scelto si vede subito, prima che l'elenco si ricarichi dal server.
  const [ruolo, setRuolo] = useState<boolean | null>(null)

  if (io.ruolo !== 'amministratore') return <Navigate to="/impostazioni" replace />

  const indietro = { label: 'Amministrazione', href: '/amministrazione' }
  if (errore) {
    return (
      <>
        <PageHeader title="Atleta" back={indietro} />
        <Notice status="error">{ERRORE_CARICAMENTO}</Notice>
      </>
    )
  }
  if (!elenco) return <PageHeader title="Atleta" back={indietro} />
  const atleta = elenco.find((a) => a.id === id)
  if (!atleta) return <Navigate to="/amministrazione" replace />
  const sonoIo = atleta.id === io.id

  const cambiaRuolo = async (allenatore: boolean) => {
    setEsito(null)
    setInCorso('ruolo')
    setRuolo(allenatore)
    try {
      await servizio.impostaAllenatore(atleta.id, allenatore)
      carica()
      setEsito({
        tipo: 'success',
        testo: allenatore
          ? `${atleta.nome} ora è anche allenatore.`
          : `${atleta.nome} non è più allenatore: non segue più nessun atleta.`,
      })
    } catch (e) {
      setRuolo(null)
      setEsito({ tipo: 'error', testo: (e as Error).message })
    } finally {
      setInCorso(null)
    }
  }

  const genera = async () => {
    setEsito(null)
    setInCorso('genera')
    try {
      setLink(await servizio.generaLink(atleta.id))
      void carica()
    } catch (e) {
      setEsito({ tipo: 'error', testo: (e as Error).message })
    } finally {
      setInCorso(null)
    }
  }

  const revoca = async () => {
    setEsito(null)
    setInCorso('revoca')
    try {
      await servizio.revocaAccesso(atleta.id)
      setLink(null)
      setConfermaRevoca(false)
      setEsito({
        tipo: 'success',
        testo: `Accesso revocato: ${nomeCompleto(atleta)} è stato scollegato.`,
      })
      void carica()
    } catch (e) {
      setEsito({ tipo: 'error', testo: (e as Error).message })
    } finally {
      setInCorso(null)
    }
  }

  const messaggio = link
    ? `Ciao ${atleta.nome}, ecco il tuo link per l'app della Compagnia Arcieri Eugubini: ${link.link}`
    : ''
  const condividi = async () => {
    if (!link) return
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Arcieri Eugubini', text: messaggio })
      } catch {
        // condivisione annullata: niente da fare
      }
      return
    }
    try {
      await navigator.clipboard.writeText(messaggio)
      setEsito({ tipo: 'success', testo: 'Messaggio con il link copiato. Incollalo su WhatsApp.' })
    } catch {
      setEsito({ tipo: 'error', testo: 'Copia non riuscita: seleziona il link e copialo a mano.' })
    }
  }

  return (
    <>
      <PageHeader title={nomeCompleto(atleta)} back={indietro} />
      <div className={styles.groups}>
        <ListGroup title="Atleta">
          <ListRow label="Matricola" value={atleta.matricola} />
          <ListRow
            label="Ruolo"
            value={atleta.ruolo === 'amministratore' ? 'Amministratore' : 'Atleta'}
          />
          <ListRow label="Accesso" value={atleta.haAccesso ? 'Attivo' : 'Nessuno'} />
        </ListGroup>

        {/* Il ruolo di allenatore (Fase 7): può seguire l'allenamento degli atleti che sceglie. */}
        <Checkbox
          label="Allenatore: può seguire l’allenamento degli atleti che sceglie e scrivere il loro programma"
          checked={ruolo ?? atleta.allenatore ?? false}
          disabled={inCorso !== null}
          onChange={(e) => void cambiaRuolo(e.target.checked)}
        />

        {esito && <Notice status={esito.tipo}>{esito.testo}</Notice>}

        {sonoIo ? (
          <Notice status="info">
            Questo è il tuo accesso: si gestisce dal Terminale, non dall'app (vedi
            supabase/README.md).
          </Notice>
        ) : (
          <section className={styles.sezione} aria-labelledby="link-personale">
            <h2 id="link-personale" className="type-section-heading">
              Link personale
            </h2>
            {link ? (
              <div className={styles.azioni}>
                <Notice status="success">
                  Link pronto. Mandalo a {atleta.nome}: vale finché non ne generi un altro.
                </Notice>
                <p className={`type-caption ${styles.link}`}>{link.link}</p>
                <p>
                  Codice da scrivere a mano, se serve:{' '}
                  <span className="type-numeric">{formattaCodice(link.codice)}</span>
                </p>
                <div className={styles.pulsanti}>
                  <Button variant="primary" onClick={() => void condividi()}>
                    {typeof navigator.share === 'function' ? 'Condividi' : 'Copia messaggio'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className={styles.azioni}>
                <p>
                  {atleta.haAccesso
                    ? 'Generando un nuovo link, il telefono che usa quello vecchio verrà scollegato.'
                    : `Genera il link e mandalo a ${atleta.nome}: con un tocco entra nell'app.`}
                </p>
                <div>
                  <Button
                    variant="primary"
                    loading={inCorso === 'genera'}
                    onClick={() => void genera()}
                  >
                    {atleta.haAccesso ? 'Genera nuovo link' : 'Genera link'}
                  </Button>
                </div>
              </div>
            )}
          </section>
        )}

        {!sonoIo && atleta.haAccesso && (
          <section className={styles.sezione} aria-labelledby="revoca">
            <h2 id="revoca" className="type-section-heading">
              Revoca accesso
            </h2>
            {confermaRevoca ? (
              <div className={styles.azioni}>
                <Notice status="warning">
                  {nomeCompleto(atleta)} verrà scollegato da tutti i telefoni. Potrai generare un
                  nuovo link quando vuoi.
                </Notice>
                <div className={styles.pulsanti}>
                  <Button
                    variant="destructive"
                    loading={inCorso === 'revoca'}
                    onClick={() => void revoca()}
                  >
                    Revoca l'accesso di {atleta.nome}
                  </Button>
                  <Button variant="text" onClick={() => setConfermaRevoca(false)}>
                    Annulla
                  </Button>
                </div>
              </div>
            ) : (
              <div>
                <Button variant="destructive" onClick={() => setConfermaRevoca(true)}>
                  Revoca accesso
                </Button>
              </div>
            )}
          </section>
        )}
      </div>
    </>
  )
}
