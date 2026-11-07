import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useLocation } from 'react-router'
import {
  codiceValido,
  formattaCodice,
  leggiLinkAccesso,
  matricolaValida,
  normalizzaCodice,
  normalizzaMatricola,
} from '@arco/shared'
import { useAccesso } from '../accesso/contesto'
import { Button } from '../componenti/Button'
import { Field } from '../componenti/Field'
import { Notice } from '../componenti/Notice'
import { PageHeader } from '../componenti/PageHeader'
import { useOnline } from '../stato/useOnline'
import styles from './Accedi.module.css'

const MESSAGGI = {
  errato: 'Matricola o codice non corretti. Controlla e riprova.',
  offline: 'Serve la rete per il primo accesso. Riprova quando sei connesso.',
  'non-membro':
    "Questa matricola non è attiva nell'app. Chiedi all'amministratore della compagnia.",
  errore: 'Accesso non riuscito. Riprova tra poco.',
} as const

/**
 * Pagina Accedi: l'unica visibile a chi non ha ancora fatto l'accesso.
 * Si entra dal link personale (matricola e codice dopo il #) oppure scrivendoli a mano.
 */
export function Accedi() {
  const { accedi, stato } = useAccesso()
  const { pathname, hash } = useLocation()
  const online = useOnline()

  // Il link personale (matricola e codice dopo il #) si legge una volta sola, all'apertura.
  const [link] = useState(() => (hash ? { dati: leggiLinkAccesso(hash) } : null))

  const [matricola, setMatricola] = useState(link?.dati?.matricola ?? '')
  const [codice, setCodice] = useState(link?.dati ? formattaCodice(link.dati.codice) : '')
  const [errori, setErrori] = useState<{ matricola?: string; codice?: string }>({})
  const [messaggio, setMessaggio] = useState<string | null>(() => {
    if (link && !link.dati) return 'Il link non è completo. Scrivi matricola e codice qui sotto.'
    return stato.tipo === 'ospite' ? (stato.avviso ?? null) : null
  })
  // Con un link valido l'accesso parte subito: il pulsante nasce già "in corso".
  const [inCorso, setInCorso] = useState(Boolean(link?.dati))
  const linkGestito = useRef(false)

  /** Esito dell'accesso. Se riesce, l'app passa da sola alle pagine dei membri, sullo stesso
   * indirizzo: dal link si arriva su /accesso, dove c'è la pagina Benvenuto. */
  const concludi = (esito: Awaited<ReturnType<typeof accedi>>) => {
    setInCorso(false)
    if (esito.esito !== 'ok') setMessaggio(MESSAGGI[esito.esito])
  }

  // Arrivo dal link personale: si toglie il codice dall'indirizzo e si entra.
  useEffect(() => {
    if (linkGestito.current || !link) return
    linkGestito.current = true
    window.history.replaceState(window.history.state, '', pathname)
    if (link.dati) {
      void accedi(link.dati.matricola, link.dati.codice, { daLink: true }).then(concludi)
    }
    // concludi cambia a ogni disegno; il link va gestito una volta sola
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [link, pathname, accedi])

  const invia = (evento: FormEvent) => {
    evento.preventDefault()
    const m = normalizzaMatricola(matricola)
    const c = normalizzaCodice(codice)
    const nuoviErrori = {
      matricola: matricolaValida(m) ? undefined : 'Scrivi la matricola Fitarco: solo cifre.',
      codice: codiceValido(c) ? undefined : 'Il codice ha 10 caratteri, tra lettere e cifre.',
    }
    setErrori(nuoviErrori)
    if (nuoviErrori.matricola || nuoviErrori.codice) return
    setMessaggio(null)
    setInCorso(true)
    void accedi(m, c).then(concludi)
  }

  return (
    <>
      <PageHeader
        title="Accedi"
        description="Scrivi la tua matricola Fitarco e il codice personale che ti ha dato l'amministratore della compagnia."
      />
      <form className={styles.form} onSubmit={invia} noValidate>
        {!online && (
          <Notice status="warning">Sei offline. Per il primo accesso serve la rete.</Notice>
        )}
        {messaggio && <Notice status="error">{messaggio}</Notice>}
        <Field
          label="Matricola"
          inputMode="numeric"
          autoComplete="username"
          value={matricola}
          onChange={(e) => setMatricola(e.target.value)}
          error={errori.matricola}
        />
        <Field
          label="Codice personale"
          hint="10 caratteri, per esempio K7PM3-XQR9A"
          autoComplete="current-password"
          autoCapitalize="characters"
          spellCheck={false}
          value={codice}
          onChange={(e) => setCodice(e.target.value)}
          error={errori.codice}
        />
        <div>
          <Button type="submit" variant="primary" loading={inCorso}>
            Entra
          </Button>
        </div>
      </form>
    </>
  )
}
