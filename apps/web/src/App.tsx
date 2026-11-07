import { useEffect, useState } from 'react'
import { TIPOLOGIE } from '@arco/shared'
import { Button } from './componenti/Button'
import { EmptyState } from './componenti/EmptyState'
import { ListGroup, ListRow } from './componenti/List'
import { NavigationBar } from './componenti/NavigationBar'
import { Notice } from './componenti/Notice'
import { PageHeader } from './componenti/PageHeader'
import { DESTINAZIONI } from './navigazione'
import { SCELTE_TEMA } from './tema/tema'
import { useTema } from './tema/useTema'
import styles from './App.module.css'

const destinazioneDaIndirizzo = () => {
  const id = window.location.hash.slice(1)
  return DESTINAZIONI.some((d) => d.id === id) ? id : 'gare'
}

/**
 * Vetrina provvisoria del passo 2: mostra temi e componenti del design system.
 * Al passo 3 diventa lo scheletro vero con i 4 tab e le Impostazioni.
 */
export function App() {
  const [tema, impostaTema] = useTema()
  const [attiva, setAttiva] = useState(destinazioneDaIndirizzo)
  const [inCorso, setInCorso] = useState(false)

  useEffect(() => {
    const aggiorna = () => setAttiva(destinazioneDaIndirizzo())
    window.addEventListener('hashchange', aggiorna)
    return () => window.removeEventListener('hashchange', aggiorna)
  }, [])

  const prova = () => {
    setInCorso(true)
    window.setTimeout(() => setInCorso(false), 1500)
  }

  return (
    <div className={styles.shell}>
      <main className={styles.page}>
        <PageHeader
          title="Arcieri Eugubini"
          description="App in costruzione. Qui puoi provare i temi e i componenti dell'interfaccia."
        />

        <div className={styles.groups}>
          <Notice status="info">
            Questa è una pagina di prova: le gare e i risultati arriveranno nei prossimi passi.
          </Notice>

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

          <ListGroup title="Tipologie di gara riconosciute">
            {TIPOLOGIE.map((t) => (
              <ListRow
                key={t.id}
                label={t.etichetta}
                value={`${t.prove.length} ${t.prove.length === 1 ? 'prova' : 'prove'}`}
              />
            ))}
          </ListGroup>

          <section className={styles.buttons} aria-label="Pulsanti di prova">
            <Button variant="primary" loading={inCorso} onClick={prova}>
              Crea promemoria
            </Button>
            <Button>Aggiorna dati</Button>
            <Button variant="text">Vedi invito</Button>
          </section>

          <EmptyState
            title="Nessuna gara salvata"
            description="Il calendario dell'Umbria non è ancora stato importato. Lo potrai importare dall'area amministratore."
          />
        </div>
      </main>
      <NavigationBar destinations={DESTINAZIONI} current={attiva} />
    </div>
  )
}
