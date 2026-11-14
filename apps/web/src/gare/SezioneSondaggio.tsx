import { useState } from 'react'
import { CloudOff } from 'lucide-react'
import {
  elencoNomi,
  puoAprireSondaggio,
  riepilogoSondaggio,
  sondaggioRispondibile,
  type Gara,
} from '@arco/shared'
import { useAccesso, useAtletaCorrente } from '../accesso/contesto'
import { useAtleti } from '../atleti/dati'
import { ListGroup, ListRow } from '../componenti/List'
import { Notice } from '../componenti/Notice'
import { Scelte } from '../componenti/Scelte'
import { StatusLine } from '../componenti/StatusLine'
import { useSincronizzazione } from '../sync/contesto'
import { salvaRisposta, useRisposte, useSondaggio } from './sondaggio'
import styles from './SezioneSondaggio.module.css'

const SCELTE = [
  { valore: 'si', etichetta: 'Partecipo' },
  { valore: 'no', etichetta: 'Non partecipo' },
] as const

/**
 * Il sondaggio "Partecipo / Non partecipo" nella scheda gara (Fase 3.5). L'amministratore lo apre (gara futura con
 * l'invito) e lo chiude; ognuno risponde per sé, anche offline. Tutti vedono chi partecipa; l'amministratore vede
 * anche chi non partecipa e chi non ha ancora risposto.
 */
export function SezioneSondaggio({ gara, oggi }: { gara: Gara; oggi: string }) {
  const io = useAtletaCorrente()
  const { servizio } = useAccesso()
  const { db, aggiorna, modificato } = useSincronizzazione()
  const sondaggio = useSondaggio(gara.codice)
  const risposte = useRisposte(gara.codice)
  const atleti = useAtleti()
  const [occupato, setOccupato] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)
  const amministratore = io.ruolo === 'amministratore'

  if (sondaggio === undefined || risposte === undefined || atleti === undefined) return null

  /** Apre, riapre o chiude il sondaggio (serve la rete), poi scarica subito la novità. */
  const cambiaSondaggio = async (aperto: boolean) => {
    setOccupato(true)
    setErrore(null)
    try {
      if (aperto) await servizio.apriSondaggio(gara.codice)
      else await servizio.chiudiSondaggio(gara.codice)
      await aggiorna()
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Non riuscito. Riprova tra poco.')
    } finally {
      setOccupato(false)
    }
  }

  const avviso = errore && <Notice status="error">{errore}</Notice>

  if (!sondaggio) {
    if (!amministratore || !puoAprireSondaggio(gara, oggi)) return null
    return (
      <>
        <ListGroup title="Sondaggio">
          <ListRow
            label={occupato ? 'Apertura in corso…' : 'Apri sondaggio'}
            description="Chiedi a tutti se partecipano: ricevono una notifica e rispondono Partecipo o Non partecipo."
            onSelect={occupato ? undefined : () => void cambiaSondaggio(true)}
          />
        </ListGroup>
        {avviso}
      </>
    )
  }

  const mia = risposte.find((r) => r.atleta_id === io.id)
  const rispondibile = sondaggioRispondibile(sondaggio, gara, oggi)
  const riepilogo = riepilogoSondaggio(risposte, atleti)

  const rispondi = async (valore: string) => {
    await salvaRisposta(db, gara.codice, io.id, valore === 'si')
    modificato()
  }

  return (
    <>
      {rispondibile && (
        <div className={styles.risposta}>
          <Scelte
            label="Partecipi a questa gara?"
            opzioni={SCELTE}
            valore={mia ? (mia.partecipa ? 'si' : 'no') : ''}
            onChange={(v) => void rispondi(v)}
          />
          {mia?.da_inviare === 1 && (
            <StatusLine icon={CloudOff}>Risposta salvata: si invia appena c’è la rete.</StatusLine>
          )}
        </div>
      )}
      {mia?.partecipa && <Notice status="success">Partecipi a questa gara.</Notice>}
      <ListGroup title="Sondaggio">
        <ListRow
          label="Sondaggio"
          value={rispondibile ? 'Aperto' : 'Chiuso'}
          description={rispondibile ? 'Puoi cambiare risposta finché è aperto.' : undefined}
        />
        {!rispondibile && (
          <ListRow
            label="La tua risposta"
            value={mia ? (mia.partecipa ? 'Partecipo' : 'Non partecipo') : 'Nessuna'}
          />
        )}
        <ListRow
          label="Partecipano"
          value={String(riepilogo.partecipano.length)}
          description={elencoNomi(riepilogo.partecipano) || 'Ancora nessuno'}
        />
        {amministratore && (
          <>
            <ListRow
              label="Non partecipano"
              value={String(riepilogo.nonPartecipano.length)}
              description={elencoNomi(riepilogo.nonPartecipano) || undefined}
            />
            <ListRow
              label="Non hanno risposto"
              value={String(riepilogo.senzaRisposta.length)}
              description={elencoNomi(riepilogo.senzaRisposta) || undefined}
            />
            {(sondaggio.aperto || puoAprireSondaggio(gara, oggi)) && (
              <ListRow
                label={
                  occupato
                    ? 'In corso…'
                    : sondaggio.aperto
                      ? 'Chiudi sondaggio'
                      : 'Riapri sondaggio'
                }
                onSelect={occupato ? undefined : () => void cambiaSondaggio(!sondaggio.aperto)}
              />
            )}
          </>
        )}
      </ListGroup>
      {avviso}
    </>
  )
}
