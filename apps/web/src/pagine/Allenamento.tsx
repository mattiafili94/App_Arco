import { useState } from 'react'
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
import { copiaSettimanaScorsa } from '../allenamento/scrittura'
import { useSettimanaAllenamento, useSimulazioniSettimana } from '../allenamento/dati'
import { Button } from '../componenti/Button'
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

function descrizione(g: GiornoAllenamento | undefined): string {
  const programma = anteprima(g?.programma ?? '')
  return [g?.fatto ? 'Fatto' : null, programma || (g?.fatto ? null : 'Nessun programma')]
    .filter(Boolean)
    .join(' · ')
}

/**
 * Tab Allenamento: la settimana da lunedì a domenica. Per ogni giorno cosa c'è da fare, se è fatto e le
 * frecce tirate; in cima il riepilogo. Privato: lo vede solo l'atleta. Funziona anche offline: le
 * modifiche si inviano al server appena c'è la rete.
 */
export function Allenamento() {
  const io = useAtletaCorrente()
  const { db, modificato } = useSincronizzazione()
  const [ricerca] = useSearchParams()
  const [messaggio, setMessaggio] = useState<{ tipo: 'success' | 'warning'; testo: string } | null>(
    null,
  )
  const oggi = oggiIn()
  const richiesta = ricerca.get('settimana')
  const inizio = inizioSettimana(richiesta && RE_GIORNO.test(richiesta) ? richiesta : oggi)
  const questaSettimana = inizioSettimana(oggi)
  const giorni = useSettimanaAllenamento(inizio)
  const simulazioni = useSimulazioniSettimana(inizio)
  const annoCorrente = Number(oggi.slice(0, 4))

  const verso = (settimana: string) => `/allenamento?settimana=${settimana}`

  const copia = async () => {
    setMessaggio(null)
    const n = await copiaSettimanaScorsa(db, io.id, inizio)
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

  return (
    <PaginaTab title="Allenamento">
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
            <Link className={styles.oggi} to="/allenamento">
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
                    description={descrizione(riga)}
                    href={`/allenamento/${g}`}
                  />
                )
              })}
            </ListGroup>

            <div className={styles.azioni}>
              <Button variant="secondary" onClick={() => void copia()}>
                Copia la settimana scorsa
              </Button>
            </div>
            {messaggio && <Notice status={messaggio.tipo}>{messaggio.testo}</Notice>}
          </>
        )}
      </div>
    </PaginaTab>
  )
}
