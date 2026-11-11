import { useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Link, useSearchParams } from 'react-router'
import {
  aggiungiGiorni,
  descriviSettimana,
  etichettaGiorno,
  frecceDelGiorno,
  frecceDelleSimulazioni,
  giorniDellaSettimana,
  inizioSettimana,
  riepilogoSettimana,
  type GiornoAllenamento,
} from '@arco/shared'
import { useAtletaCorrente } from '../accesso/contesto'
import { autoreDelProgramma } from '../allenatore/autore'
import { useAtletiSeguiti, useNomiAtleti } from '../allenatore/dati'
import { copiaProgrammaSuAtleti, copiaSettimanaScorsa } from '../allenamento/scrittura'
import { useSettimanaAllenamento, useSimulazioniSettimana } from '../allenamento/dati'
import { nomeAtleta } from '../atleti/dati'
import { Button } from '../componenti/Button'
import { Checkbox } from '../componenti/Checkbox'
import { IconLink } from '../componenti/IconLink'
import { ListGroup, ListRow } from '../componenti/List'
import { Notice } from '../componenti/Notice'
import { oggi as oggiIn } from '../gare/dati'
import { useSincronizzazione } from '../sync/contesto'
import styles from './Allenamento.module.css'
import { PaginaTab } from './PaginaTab'

const RE_GIORNO = /^\d{4}-\d{2}-\d{2}$/

/** La prima riga del programma, accorciata: basta a ricordare cosa c'è da fare. */
function anteprima(testo: string): string {
  const riga =
    testo
      .split('\n')
      .find((r) => r.trim() !== '')
      ?.trim() ?? ''
  return riga.length > 60 ? `${riga.slice(0, 57)}…` : riga
}

function descrizione(g: GiornoAllenamento | undefined, autore: string | null): string {
  const programma = anteprima(g?.programma ?? '')
  return [
    g?.fatto ? 'Fatto' : null,
    programma || (g?.fatto ? null : 'Nessun programma'),
    programma ? autore : null,
  ]
    .filter(Boolean)
    .join(' · ')
}

/** "Copia il programma su…": l'allenatore sceglie a quali altri atleti copiare il programma della settimana. */
function CopiaSuAtleti({
  atletaId,
  inizio,
  onFatto,
}: {
  atletaId: string
  inizio: string
  onFatto(testo: string, tipo: 'success' | 'warning'): void
}) {
  const io = useAtletaCorrente()
  const { db, modificato } = useSincronizzazione()
  const seguiti = (useAtletiSeguiti() ?? []).filter((a) => a.id !== atletaId)
  const [aperta, setAperta] = useState(false)
  const [scelti, setScelti] = useState<string[]>([])
  const [sostituisci, setSostituisci] = useState(false)
  if (seguiti.length === 0) return null

  const copia = async () => {
    const n = await copiaProgrammaSuAtleti(db, atletaId, scelti, inizio, sostituisci, io.id)
    if (n > 0) modificato()
    setAperta(false)
    setScelti([])
    setSostituisci(false)
    onFatto(
      n > 0
        ? n === 1
          ? 'Copiato 1 programma.'
          : `Copiati ${n} programmi.`
        : 'Niente da copiare: gli atleti scelti hanno già un programma in quei giorni.',
      n > 0 ? 'success' : 'warning',
    )
  }

  if (!aperta) {
    return (
      <Button variant="secondary" onClick={() => setAperta(true)}>
        Copia il programma su…
      </Button>
    )
  }
  return (
    <fieldset className={styles.copia}>
      <legend className="type-label">Copia il programma di questa settimana su</legend>
      {seguiti.map((a) => (
        <Checkbox
          key={a.id}
          label={nomeAtleta(a)}
          checked={scelti.includes(a.id)}
          onChange={(e) =>
            setScelti(e.target.checked ? [...scelti, a.id] : scelti.filter((x) => x !== a.id))
          }
        />
      ))}
      <Checkbox
        label="Sostituisci anche i giorni che hanno già un programma"
        checked={sostituisci}
        onChange={(e) => setSostituisci(e.target.checked)}
      />
      <div className={styles.azioni}>
        <Button variant="primary" disabled={scelti.length === 0} onClick={() => void copia()}>
          Copia
        </Button>
        <Button variant="text" onClick={() => setAperta(false)}>
          Annulla
        </Button>
      </div>
    </fieldset>
  )
}

/**
 * La settimana di allenamento di un atleta, da lunedì a domenica: per ogni giorno cosa c'è da fare, se è fatto e
 * le frecce tirate; in cima il riepilogo. La usa l'atleta (tab Allenamento) e il suo allenatore (tab "I miei
 * atleti"), che in più può copiare il programma su altri atleti. Funziona anche offline.
 */
export function SettimanaAllenamento({
  atletaId,
  base,
  allenatore,
  intestazione,
}: {
  atletaId: string
  /** Da qui partono gli indirizzi dei giorni: `/allenamento` o `/allenatore/:atleta`. */
  base: string
  /** Chi guarda è un allenatore (non l'atleta). */
  allenatore: boolean
  intestazione(contenuto: ReactNode): ReactNode
}) {
  const io = useAtletaCorrente()
  const { db, modificato } = useSincronizzazione()
  const nomi = useNomiAtleti()
  const [ricerca] = useSearchParams()
  const [messaggio, setMessaggio] = useState<{ tipo: 'success' | 'warning'; testo: string } | null>(
    null,
  )
  const oggi = oggiIn()
  const richiesta = ricerca.get('settimana')
  const inizio = inizioSettimana(richiesta && RE_GIORNO.test(richiesta) ? richiesta : oggi)
  const questaSettimana = inizioSettimana(oggi)
  const giorni = useSettimanaAllenamento(inizio, atletaId)
  const simulazioni = useSimulazioniSettimana(inizio, atletaId)
  const annoCorrente = Number(oggi.slice(0, 4))

  const verso = (settimana: string) => `${base}?settimana=${settimana}`

  const copia = async () => {
    setMessaggio(null)
    const n = await copiaSettimanaScorsa(db, atletaId, inizio, new Date(), io.id)
    if (n > 0) modificato()
    setMessaggio(
      n > 0
        ? {
            tipo: 'success',
            testo:
              n === 1 ? 'Copiato 1 programma.' : `Copiati ${n} programmi della settimana scorsa.`,
          }
        : {
            tipo: 'warning',
            testo: 'Niente da copiare: la settimana scorsa non ha programmi, o questa li ha già.',
          },
    )
  }

  const perGiorno = new Map((giorni ?? []).map((g) => [g.giorno, g]))
  const frecceSimulazioni = frecceDelleSimulazioni(simulazioni ?? [])
  const riepilogo = riepilogoSettimana(giorni ?? [], frecceSimulazioni)
  const frecceSimulazioniDelGiorno = (g: string) =>
    frecceSimulazioni.filter((x) => x.giorno === g).reduce((t, x) => t + x.frecce, 0)

  return intestazione(
    <div className={styles.gruppi}>
      <div className={styles.navigazione}>
        <IconLink
          icon={ChevronLeft}
          label="Settimana precedente"
          to={verso(aggiungiGiorni(inizio, -7))}
        />
        <p className={`type-section-heading ${styles.settimana}`} aria-live="polite">
          {descriviSettimana(inizio, annoCorrente)}
        </p>
        <IconLink
          icon={ChevronRight}
          label="Settimana successiva"
          to={verso(aggiungiGiorni(inizio, 7))}
        />
      </div>
      {inizio !== questaSettimana && (
        <div className={styles.centro}>
          <Link className={styles.oggi} to={base}>
            Torna a questa settimana
          </Link>
        </div>
      )}

      {giorni !== undefined && simulazioni !== undefined && (
        <>
          <ListGroup title="Riepilogo della settimana">
            <ListRow
              label="Frecce"
              value={String(riepilogo.frecceTotali)}
              description={`libere ${riepilogo.frecceLibere} · in gara ${riepilogo.frecceSimulazioni}`}
            />
            <ListRow label="Giorni allenati" value={`${riepilogo.giorniAllenati} su 7`} />
          </ListGroup>

          <ListGroup title="Giorni">
            {giorniDellaSettimana(inizio).map((g) => {
              const riga = perGiorno.get(g)
              const frecce = frecceDelGiorno(riga, frecceSimulazioniDelGiorno(g))
              return (
                <ListRow
                  key={g}
                  label={`${etichettaGiorno(g, annoCorrente)}${g === oggi ? ' · Oggi' : ''}`}
                  value={frecce > 0 ? `${frecce} frecce` : undefined}
                  description={descrizione(riga, autoreDelProgramma(riga, io.id, nomi))}
                  href={`${base}/${g}`}
                />
              )
            })}
          </ListGroup>

          <div className={styles.azioni}>
            <Button variant="secondary" onClick={() => void copia()}>
              Copia la settimana scorsa
            </Button>
            {allenatore && (
              <CopiaSuAtleti
                atletaId={atletaId}
                inizio={inizio}
                onFatto={(testo, tipo) => setMessaggio({ testo, tipo })}
              />
            )}
          </div>
          {messaggio && <Notice status={messaggio.tipo}>{messaggio.testo}</Notice>}
        </>
      )}
    </div>,
  )
}

/**
 * Tab Allenamento: la settimana dell'atleta collegato. Privato: lo vedono solo lui e gli allenatori che lo
 * seguono. Le modifiche si inviano al server appena c'è la rete.
 */
export function Allenamento() {
  const io = useAtletaCorrente()
  return (
    <SettimanaAllenamento
      atletaId={io.id}
      base="/allenamento"
      allenatore={false}
      intestazione={(contenuto) => <PaginaTab title="Allenamento">{contenuto}</PaginaTab>}
    />
  )
}
