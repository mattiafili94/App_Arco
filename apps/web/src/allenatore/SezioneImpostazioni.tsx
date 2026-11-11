import { useState } from 'react'
import { useAccesso, useAtletaCorrente } from '../accesso/contesto'
import { nomeAtleta, useAtleti } from '../atleti/dati'
import { Checkbox } from '../componenti/Checkbox'
import { ListGroup, ListRow } from '../componenti/List'
import { Notice } from '../componenti/Notice'
import { useOnline } from '../stato/useOnline'
import { useSincronizzazione } from '../sync/contesto'
import { useAtletiSeguiti, useChiMiSegue, useSonoAllenatore } from './dati'
import styles from './SezioneImpostazioni.module.css'

/**
 * Impostazioni → "Atleti che segui" (solo per gli allenatori): ogni allenatore sceglie da solo quali atleti
 * seguire (Mattia, 11/11/2026). Serve la rete: la scelta la registra il server.
 */
export function AtletiCheSegui() {
  const io = useAtletaCorrente()
  const { servizio } = useAccesso()
  const { modificato } = useSincronizzazione()
  const online = useOnline()
  const allenatore = useSonoAllenatore()
  const atleti = useAtleti()
  const seguiti = useAtletiSeguiti()
  const [inCorso, setInCorso] = useState<string | null>(null)
  const [errore, setErrore] = useState<string | null>(null)
  // La scelta si vede subito, prima che arrivi dalla sincronizzazione (se il server dice di no, si torna indietro).
  const [scelte, setScelte] = useState<Record<string, boolean>>({})
  if (!allenatore || atleti === undefined || seguiti === undefined) return null

  const altri = atleti
    .filter((a) => a.id !== io.id)
    .sort((a, b) => a.cognome.localeCompare(b.cognome) || a.nome.localeCompare(b.nome))
  const segui = async (atletaId: string, valore: boolean) => {
    setErrore(null)
    setInCorso(atletaId)
    setScelte((x) => ({ ...x, [atletaId]: valore }))
    try {
      await servizio.seguiAtleta(atletaId, valore)
      // La scelta arriva al telefono con la sincronizzazione (subito, o appena finisce quella in corso).
      modificato()
    } catch (e) {
      setErrore((e as Error).message)
      setScelte((x) => Object.fromEntries(Object.entries(x).filter(([id]) => id !== atletaId)))
    } finally {
      setInCorso(null)
    }
  }

  return (
    <section id="atleti-che-segui" className={styles.sezione} aria-labelledby="titolo-seguiti">
      <h2 id="titolo-seguiti" className={`type-label ${styles.titolo}`}>
        Atleti che segui
      </h2>
      <div className={styles.riquadro}>
        <p className={`type-caption ${styles.aiuto}`}>
          Di chi spunti vedi l’allenamento e scrivi il programma, nel tab “I miei atleti”.
        </p>
        {altri.length === 0 ? (
          <p className={styles.aiuto}>Non ci sono altri atleti nell’app.</p>
        ) : (
          altri.map((a) => (
            <Checkbox
              key={a.id}
              label={nomeAtleta(a)}
              checked={scelte[a.id] ?? seguiti.some((s) => s.id === a.id)}
              disabled={!online || inCorso !== null}
              onChange={(e) => void segui(a.id, e.target.checked)}
            />
          ))
        )}
        {!online && (
          <p className={`type-caption ${styles.aiuto}`}>Serve la rete per cambiare la scelta.</p>
        )}
      </div>
      {errore && <Notice status="error">{errore}</Notice>}
    </section>
  )
}

/** "Ti seguono: …": l'atleta sa chi vede il suo allenamento. Non c'è se nessuno lo segue. */
export function TiSeguono() {
  const nomi = useChiMiSegue()
  if (!nomi || nomi.length === 0) return null
  return (
    <ListGroup title="Allenamento">
      <ListRow
        label="Ti seguono"
        description={`${nomi.join(', ')}: vedono il tuo allenamento e possono scrivere il programma.`}
      />
    </ListGroup>
  )
}
