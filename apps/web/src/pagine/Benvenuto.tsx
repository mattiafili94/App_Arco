import { Navigate, useNavigate } from 'react-router'
import { formattaCodice } from '@arco/shared'
import { useAccesso, useAtletaCorrente } from '../accesso/contesto'
import { Button } from '../componenti/Button'
import { Notice } from '../componenti/Notice'
import { PageHeader } from '../componenti/PageHeader'
import { appInstallata } from '../stato/installata'
import styles from './Accedi.module.css'

/**
 * Dopo l'accesso dal link: spiega come installare l'app. Su iPhone l'app installata non vede
 * l'accesso fatto in Safari, quindi mostra matricola e codice da scrivere la prima volta.
 */
export function Benvenuto() {
  const atleta = useAtletaCorrente()
  const navigate = useNavigate()
  const { stato } = useAccesso()
  const codice = stato.tipo === 'membro' ? stato.codiceDaLink : undefined

  if (!codice || appInstallata()) return <Navigate to="/gare" replace />

  return (
    <>
      <PageHeader title={`Benvenuto, ${atleta.nome}`} />
      <div className={styles.steps}>
        <Notice status="success">Accesso fatto. Ora installa l'app sul telefono.</Notice>

        <section className={styles.step} aria-labelledby="android">
          <h2 id="android" className="type-section-heading">
            Android
          </h2>
          <ol>
            <li>Tocca il menu ⋮ in alto a destra.</li>
            <li>Scegli "Installa app" (o "Aggiungi a schermata Home").</li>
            <li>Apri l'app dall'icona: sei già dentro.</li>
          </ol>
        </section>

        <section className={styles.step} aria-labelledby="iphone">
          <h2 id="iphone" className="type-section-heading">
            iPhone
          </h2>
          <ol>
            <li>Tocca Condividi, poi "Aggiungi alla schermata Home".</li>
            <li>Apri l'app dall'icona e, solo la prima volta, scrivi:</li>
          </ol>
          {codice && (
            <dl className={styles.credenziali}>
              <dt>Matricola</dt>
              <dd className="type-numeric">{atleta.matricola}</dd>
              <dt>Codice</dt>
              <dd className="type-numeric">{formattaCodice(codice)}</dd>
            </dl>
          )}
        </section>

        <div>
          <Button variant="primary" onClick={() => navigate('/gare', { replace: true })}>
            Continua nel browser
          </Button>
        </div>
      </div>
    </>
  )
}
