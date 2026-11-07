import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router'
import { matricolaValida, normalizzaMatricola } from '@arco/shared'
import { useAccesso, useAtletaCorrente } from '../accesso/contesto'
import { ERRORE_CARICAMENTO, useElencoAtleti } from '../accesso/useElencoAtleti'
import { Button } from '../componenti/Button'
import { Field } from '../componenti/Field'
import { ListGroup, ListRow } from '../componenti/List'
import { Notice } from '../componenti/Notice'
import { PageHeader } from '../componenti/PageHeader'
import styles from './Amministrazione.module.css'

/** Amministrazione: atleti della compagnia e aggiunta di un atleta. Solo per l'amministratore. */
export function Amministrazione() {
  const io = useAtletaCorrente()
  const { servizio } = useAccesso()
  const { elenco, errore, carica } = useElencoAtleti()

  const [dati, setDati] = useState({ matricola: '', nome: '', cognome: '' })
  const [errori, setErrori] = useState<Partial<Record<keyof typeof dati, string>>>({})
  const [esito, setEsito] = useState<{ tipo: 'success' | 'error'; testo: string } | null>(null)
  const [inCorso, setInCorso] = useState(false)

  if (io.ruolo !== 'amministratore') return <Navigate to="/impostazioni" replace />

  const aggiungi = async (evento: FormEvent) => {
    evento.preventDefault()
    const nuovo = {
      matricola: normalizzaMatricola(dati.matricola),
      nome: dati.nome.trim(),
      cognome: dati.cognome.trim(),
    }
    const nuoviErrori = {
      matricola: matricolaValida(nuovo.matricola) ? undefined : 'Scrivi la matricola: solo cifre.',
      nome: nuovo.nome ? undefined : 'Scrivi il nome.',
      cognome: nuovo.cognome ? undefined : 'Scrivi il cognome.',
    }
    setErrori(nuoviErrori)
    setEsito(null)
    if (Object.values(nuoviErrori).some(Boolean)) return

    setInCorso(true)
    const risultato = await servizio.aggiungiAtleta(nuovo)
    setInCorso(false)
    if (risultato.esito === 'ok') {
      setEsito({
        tipo: 'success',
        testo: `Atleta aggiunto: ${nuovo.nome} ${nuovo.cognome}. Ora genera il suo link dall'elenco.`,
      })
      setDati({ matricola: '', nome: '', cognome: '' })
      void carica()
    } else if (risultato.esito === 'duplicato') {
      setErrori({ matricola: "Questa matricola è già nell'elenco." })
    } else {
      setEsito({ tipo: 'error', testo: 'Atleta non aggiunto. Controlla la connessione e riprova.' })
    }
  }

  const campo = (chiave: keyof typeof dati) => ({
    value: dati[chiave],
    onChange: (e: { target: { value: string } }) => setDati({ ...dati, [chiave]: e.target.value }),
    error: errori[chiave],
  })

  return (
    <>
      <PageHeader title="Amministrazione" back={{ label: 'Impostazioni', href: '/impostazioni' }} />
      <div className={styles.groups}>
        {errore && (
          <div className={styles.errore}>
            <Notice status="error">{ERRORE_CARICAMENTO}</Notice>
            <div>
              <Button onClick={() => void carica()}>Riprova</Button>
            </div>
          </div>
        )}
        {elenco === null && !errore && <p className={styles.attesa}>Caricamento degli atleti…</p>}
        {elenco && (
          <ListGroup title={`Atleti (${elenco.length})`}>
            {elenco.map((a) => (
              <ListRow
                key={a.id}
                label={`${a.cognome} ${a.nome}`}
                value={a.haAccesso ? 'Accesso attivo' : 'Senza accesso'}
                href={`/amministrazione/atleti/${a.id}`}
              />
            ))}
          </ListGroup>
        )}

        <section className={styles.sezione} aria-labelledby="aggiungi">
          <h2 id="aggiungi" className="type-section-heading">
            Aggiungi atleta
          </h2>
          <form className={styles.form} onSubmit={aggiungi} noValidate>
            {esito && <Notice status={esito.tipo}>{esito.testo}</Notice>}
            <Field label="Matricola" inputMode="numeric" {...campo('matricola')} />
            <Field label="Nome" autoComplete="off" {...campo('nome')} />
            <Field label="Cognome" autoComplete="off" {...campo('cognome')} />
            <div>
              <Button type="submit" variant="primary" loading={inCorso}>
                Aggiungi atleta
              </Button>
            </div>
          </form>
        </section>
      </div>
    </>
  )
}
