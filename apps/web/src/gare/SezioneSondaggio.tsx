import { useState } from 'react'
import { CloudOff } from 'lucide-react'
import {
  elencoNomi,
  garaPassata,
  etichetteTurni,
  partecipantiPerTurno,
  puoAprireSondaggio,
  riepilogoSondaggio,
  sondaggioRispondibile,
  turniPossibili,
  type Gara,
} from '@arco/shared'
import { useAccesso, useAtletaCorrente } from '../accesso/contesto'
import { useAtleti } from '../atleti/dati'
import { Button } from '../componenti/Button'
import { Checkbox } from '../componenti/Checkbox'
import { ListGroup, ListRow } from '../componenti/List'
import { Notice } from '../componenti/Notice'
import { Scelte } from '../componenti/Scelte'
import { StatusLine } from '../componenti/StatusLine'
import { useSincronizzazione } from '../sync/contesto'
import { salvaRisposta, useRisposte, useSondaggio } from './sondaggio'
import styles from './SezioneSondaggio.module.css'

const NON_PARTECIPO = { valore: 'no', etichetta: 'Non partecipo' } as const
const SENZA_TURNI = [{ valore: 'si', etichetta: 'Partecipo' }, NON_PARTECIPO] as const

/**
 * Il sondaggio "Partecipo / Non partecipo" nella scheda gara (Fase 3.5). L'amministratore lo apre (gara futura con
 * l'invito), scegliendo i turni della gara (Mattia, 15/11/2026: mattina e pomeriggio di ogni giorno; nessuno = senza
 * turni), e lo chiude; ognuno risponde per sé, anche offline: con i turni sceglie il suo turno (uno solo) o "Non
 * partecipo". Tutti vedono chi partecipa (turno per turno); l'amministratore vede anche chi non partecipa e chi non
 * ha ancora risposto.
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
  /** L'amministratore sta scegliendo i turni: prima di aprire il sondaggio o per cambiarli. */
  const [scegliTurni, setScegliTurni] = useState(false)
  const amministratore = io.ruolo === 'amministratore'

  if (sondaggio === undefined || risposte === undefined || atleti === undefined) return null

  /** Apre, riapre, chiude il sondaggio o ne cambia i turni (serve la rete), poi scarica subito la novità. */
  const cambiaSondaggio = async (azione: () => Promise<void>) => {
    setOccupato(true)
    setErrore(null)
    try {
      await azione()
      await aggiorna()
      setScegliTurni(false)
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Non riuscito. Riprova tra poco.')
    } finally {
      setOccupato(false)
    }
  }

  const avviso = errore && <Notice status="error">{errore}</Notice>

  if (!sondaggio) {
    if (!amministratore || !puoAprireSondaggio(gara, oggi)) return null
    if (scegliTurni) {
      return (
        <>
          <SceltaTurni
            gara={gara}
            iniziali={[]}
            pulsante={occupato ? 'Apertura in corso…' : 'Apri sondaggio'}
            occupato={occupato}
            onConferma={(turni) =>
              void cambiaSondaggio(() => servizio.apriSondaggio(gara.codice, turni))
            }
            onAnnulla={() => setScegliTurni(false)}
          />
          {avviso}
        </>
      )
    }
    return (
      <ListGroup title="Sondaggio">
        <ListRow
          label="Apri sondaggio"
          description="Chiedi a tutti se partecipano e in che turno: ricevono una notifica e rispondono."
          onSelect={() => setScegliTurni(true)}
        />
      </ListGroup>
    )
  }

  const turni = sondaggio.turni ?? []
  const etichette = etichetteTurni(turni)
  const mia = risposte.find((r) => r.atleta_id === io.id)
  const mioTurno = mia?.partecipa && mia.turno && turni.includes(mia.turno) ? mia.turno : null
  const rispondibile = sondaggioRispondibile(sondaggio, gara, oggi)
  const riepilogo = riepilogoSondaggio(risposte, atleti)
  const perTurno = partecipantiPerTurno(riepilogo.partecipano, risposte, turni)

  const opzioni = turni.length
    ? [...turni.map((t) => ({ valore: t, etichetta: etichette.get(t) ?? t })), NON_PARTECIPO]
    : SENZA_TURNI
  const valore = !mia ? '' : !mia.partecipa ? 'no' : turni.length ? (mioTurno ?? '') : 'si'

  const rispondi = async (v: string) => {
    const partecipa = v !== 'no'
    await salvaRisposta(db, gara.codice, io.id, partecipa, partecipa && turni.length ? v : null)
    modificato()
  }

  /** "Partecipo" o "Partecipo · Sabato mattina". */
  const testoMiaRisposta = !mia
    ? 'Nessuna'
    : !mia.partecipa
      ? 'Non partecipo'
      : mioTurno
        ? `Partecipo · ${etichette.get(mioTurno)}`
        : 'Partecipo'

  return (
    <>
      {rispondibile && (
        <div className={styles.risposta}>
          <Scelte
            label={turni.length ? 'In che turno partecipi?' : 'Partecipi a questa gara?'}
            opzioni={opzioni}
            valore={valore}
            onChange={(v) => void rispondi(v)}
          />
          {mia?.da_inviare === 1 && (
            <StatusLine icon={CloudOff}>Risposta salvata: si invia appena c’è la rete.</StatusLine>
          )}
        </div>
      )}
      {mia?.partecipa &&
        (mioTurno ? (
          <Notice status="success">Partecipi a questa gara: {etichette.get(mioTurno)}.</Notice>
        ) : turni.length && rispondibile ? (
          <Notice status="warning">Scegli il turno in cui partecipi.</Notice>
        ) : (
          <Notice status="success">Partecipi a questa gara.</Notice>
        ))}
      <ListGroup title="Sondaggio">
        <ListRow
          label="Sondaggio"
          value={rispondibile ? 'Aperto' : 'Chiuso'}
          description={rispondibile ? 'Puoi cambiare risposta finché è aperto.' : undefined}
        />
        {!rispondibile && <ListRow label="La tua risposta" value={testoMiaRisposta} />}
        <ListRow
          label="Partecipano"
          value={String(riepilogo.partecipano.length)}
          description={
            turni.length ? undefined : elencoNomi(riepilogo.partecipano) || 'Ancora nessuno'
          }
        />
        {perTurno.perTurno.map(({ turno, persone }) => (
          <ListRow
            key={turno}
            label={etichette.get(turno) ?? turno}
            value={String(persone.length)}
            description={elencoNomi(persone) || 'Ancora nessuno'}
          />
        ))}
        {turni.length > 0 && perTurno.senzaTurno.length > 0 && (
          <ListRow
            label="Turno non indicato"
            value={String(perTurno.senzaTurno.length)}
            description={elencoNomi(perTurno.senzaTurno)}
          />
        )}
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
                onSelect={
                  occupato
                    ? undefined
                    : () =>
                        void cambiaSondaggio(() =>
                          sondaggio.aperto
                            ? servizio.chiudiSondaggio(gara.codice)
                            : servizio.apriSondaggio(gara.codice, turni),
                        )
                }
              />
            )}
            {!garaPassata(gara, oggi) && !scegliTurni && (
              <ListRow
                label="Modifica turni"
                description={turni.length ? undefined : 'Il sondaggio non ha turni.'}
                onSelect={occupato ? undefined : () => setScegliTurni(true)}
              />
            )}
          </>
        )}
      </ListGroup>
      {amministratore && scegliTurni && (
        <SceltaTurni
          gara={gara}
          iniziali={turni}
          pulsante={occupato ? 'Salvataggio in corso…' : 'Salva turni'}
          occupato={occupato}
          onConferma={(nuovi) =>
            void cambiaSondaggio(() => servizio.modificaTurniSondaggio(gara.codice, nuovi))
          }
          onAnnulla={() => setScegliTurni(false)}
        />
      )}
      {avviso}
    </>
  )
}

/**
 * Le caselle "Turni della gara" (mattina e pomeriggio di ogni giorno): per aprire il sondaggio o cambiarne i turni.
 * I turni si mandano nell'ordine della gara, qualunque sia l'ordine in cui si spuntano.
 */
function SceltaTurni({
  gara,
  iniziali,
  pulsante,
  occupato,
  onConferma,
  onAnnulla,
}: {
  gara: Gara
  iniziali: readonly string[]
  pulsante: string
  occupato: boolean
  onConferma(turni: string[]): void
  onAnnulla(): void
}) {
  const [scelti, setScelti] = useState<readonly string[]>(iniziali)
  const possibili = turniPossibili(gara)
  const etichette = etichetteTurni(possibili)
  return (
    <fieldset className={styles.turni}>
      <legend className="type-label">Turni della gara</legend>
      <p className={`type-caption ${styles.spiegazione}`}>
        Chi partecipa sceglie uno dei turni spuntati. Senza turni si risponde solo Partecipo o Non
        partecipo.
      </p>
      {possibili.map((t) => (
        <Checkbox
          key={t}
          label={etichette.get(t) ?? t}
          checked={scelti.includes(t)}
          onChange={(e) =>
            setScelti(e.target.checked ? [...scelti, t] : scelti.filter((x) => x !== t))
          }
        />
      ))}
      <div className={styles.azioni}>
        <Button
          variant="primary"
          disabled={occupato}
          onClick={() => onConferma(possibili.filter((t) => scelti.includes(t)))}
        >
          {pulsante}
        </Button>
        <Button variant="text" disabled={occupato} onClick={onAnnulla}>
          Annulla
        </Button>
      </div>
    </fieldset>
  )
}
