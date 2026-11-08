import { useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router'
import { Target } from 'lucide-react'
import {
  ETICHETTE_BERSAGLIO,
  etichetteConteggi,
  etichettaGiorno,
  nomeSimulazione,
  puntiFreccia,
  riepilogoSimulazione,
  statoTiro,
  valoriAmmessi,
  type Simulazione,
  type ValoreFreccia,
} from '@arco/shared'
import { useSimulazione } from '../allenamento/dati'
import { useInvioDifferito } from '../allenamento/invioDifferito'
import {
  annullaUltimaFreccia,
  correggiValore,
  eliminaSimulazione,
  segnaFreccia,
} from '../allenamento/simulazioni'
import { Button } from '../componenti/Button'
import { EmptyState } from '../componenti/EmptyState'
import { ListGroup, ListRow } from '../componenti/List'
import { Notice } from '../componenti/Notice'
import { PageHeader } from '../componenti/PageHeader'
import { oggi as oggiIn } from '../gare/dati'
import { useSincronizzazione } from '../sync/contesto'
import styles from './SimulazionePagina.module.css'

/** Il colore della zona del bersaglio in cui cade il valore (la X e il 10 sono oro, come il bersaglio). */
const ZONA: Record<ValoreFreccia, string> = {
  X: 'oro',
  '10': 'oro',
  '9': 'oro',
  '8': 'rosso',
  '7': 'rosso',
  '6': 'blu',
  '5': 'blu',
  '4': 'nero',
  '3': 'nero',
  '2': 'bianco',
  '1': 'bianco',
  M: 'mancata',
}

/** La zona di un valore: oro, rosso, blu, nero, bianco o mancata. */
const classeZona = (v: ValoreFreccia) => styles[ZONA[v]!]!

/** Un valore segnato (nella volée o nell'elenco): è un pulsante, per poterlo correggere. */
function Casella({
  valore,
  indice,
  selezionata,
  onScegli,
  etichetta,
}: {
  valore: ValoreFreccia | null
  indice: number
  selezionata: boolean
  onScegli(indice: number): void
  etichetta: string
}) {
  if (valore === null) {
    return (
      <span className={`${styles.casella} ${styles.vuota}`} aria-hidden="true">
        –
      </span>
    )
  }
  return (
    <button
      type="button"
      className={`${styles.casella} ${classeZona(valore)} ${selezionata ? styles.scelta : ''}`}
      aria-label={`${etichetta}: ${valore}. Tocca per correggere.`}
      aria-pressed={selezionata}
      onClick={() => onScegli(indice)}
    >
      {valore}
    </button>
  )
}

function Tiro({ simulazione: s }: { simulazione: Simulazione }) {
  const { db } = useSincronizzazione()
  const vai = useNavigate()
  const programmaInvio = useInvioDifferito()
  const [selezionata, setSelezionata] = useState<number | null>(null)
  const [conferma, setConferma] = useState(false)
  const annoCorrente = Number(oggiIn().slice(0, 4))

  const r = riepilogoSimulazione(s)
  const stato = statoTiro(s)
  const valori = valoriAmmessi(s.bersaglio)
  const [nome1, nome2] = etichetteConteggi(s.formato)

  const premi = async (v: ValoreFreccia) => {
    if (selezionata !== null) {
      await correggiValore(db, s.id, selezionata, v)
      setSelezionata(null)
    } else {
      await segnaFreccia(db, s.id, v)
    }
    programmaInvio()
  }
  const annulla = async () => {
    await annullaUltimaFreccia(db, s.id)
    setSelezionata(null)
    programmaInvio()
  }
  const elimina = async () => {
    await eliminaSimulazione(db, s.id)
    programmaInvio()
    vai(`/allenamento/${s.giorno}`, { replace: true })
  }

  const provaInCorso = r.prove[stato.prova]!
  const voleeInCorso = provaInCorso.volee[stato.volee - 1]?.frecce ?? []
  // Indice della prima freccia della prova in corso dentro tutte le frecce della simulazione.
  const primaDellaProva = r.prove
    .slice(0, stato.prova)
    .reduce((t, p) => t + p.prova.frecceTotali, 0)
  const primaDellaVolee = primaDellaProva + (stato.volee - 1) * provaInCorso.prova.frecceVolee
  const totaleVolee = voleeInCorso.reduce((t, v) => t + puntiFreccia(v), 0)
  // A volée finita si passa alla successiva: il totale di quella appena tirata resta in vista.
  const precedente =
    voleeInCorso.length === 0 ? provaInCorso.volee[stato.volee - 2]?.totale : undefined

  const dove = stato.finita
    ? 'Tutte le frecce sono state segnate'
    : `${stato.prove > 1 ? `Prova ${stato.prova + 1} di ${stato.prove} · ` : ''}${stato.distanza} m · Volée ${stato.volee} di ${stato.voleeTotali}`

  return (
    <>
      <PageHeader
        title={`${nomeSimulazione(s)} · ${ETICHETTE_BERSAGLIO[s.bersaglio]}`}
        back={{
          label: etichettaGiorno(s.giorno, annoCorrente),
          href: `/allenamento/${s.giorno}`,
        }}
        description={dove}
      />
      <div className={styles.pagina}>
        <section className={styles.volee} aria-label="Volée in corso">
          <div className={styles.frecce}>
            {Array.from({ length: provaInCorso.prova.frecceVolee }, (_, i) => (
              <Casella
                key={i}
                valore={voleeInCorso[i] ?? null}
                indice={primaDellaVolee + i}
                selezionata={selezionata === primaDellaVolee + i}
                onScegli={setSelezionata}
                etichetta={`Freccia ${i + 1} della volée ${stato.volee}`}
              />
            ))}
          </div>
          <p className={`type-caption ${styles.nota}`} aria-live="polite">
            {`Volée: ${totaleVolee}${precedente === undefined ? '' : ` · Volée precedente: ${precedente}`} · Totale: ${r.totale} · ${r.frecceSegnate} frecce su ${r.frecceTotali}`}
          </p>
        </section>

        {selezionata !== null && (
          <Notice status="warning">
            Correggi la freccia {selezionata + 1}: tocca il valore giusto.{' '}
            <button type="button" className={styles.testo} onClick={() => setSelezionata(null)}>
              Annulla la correzione
            </button>
          </Notice>
        )}

        <div
          className={styles.tastierino}
          role="group"
          aria-label="Valore della freccia"
          data-colonne={valori.length > 8 ? 4 : 3}
        >
          {valori.map((v) => (
            <button
              key={v}
              type="button"
              className={`${styles.tasto} ${classeZona(v)}`}
              disabled={stato.finita && selezionata === null}
              onClick={() => void premi(v)}
            >
              {v}
            </button>
          ))}
        </div>
        <div className={styles.azioni}>
          <Button
            variant="secondary"
            disabled={s.frecce.length === 0}
            onClick={() => void annulla()}
          >
            Annulla ultima freccia
          </Button>
        </div>

        {r.frecceSegnate > 0 && (
          <>
            <ListGroup title="Riepilogo">
              {r.prove.map((p, i) => (
                <ListRow
                  key={i}
                  label={
                    r.prove.length > 1 ? `Prova ${i + 1} · ${p.prova.distanza} m` : 'Punteggio'
                  }
                  value={String(p.totale)}
                  description={`Parziali ${p.parziali[0]} + ${p.parziali[1]}`}
                />
              ))}
              {r.prove.length > 1 && <ListRow label="Totale" value={String(r.totale)} />}
              <ListRow
                label={`${nome1} e ${nome2}`}
                value={`${r.conteggi[0]} · ${r.conteggi[1]}`}
              />
              {r.media !== null && (
                <ListRow label="Media per freccia" value={String(r.media).replace('.', ',')} />
              )}
            </ListGroup>

            <section className={styles.elenco} aria-label="Tutte le volée">
              {r.prove.map((p, i) => {
                const prima = r.prove.slice(0, i).reduce((t, x) => t + x.prova.frecceTotali, 0)
                let progressivo = 0
                return (
                  <div key={i}>
                    <h2 className={`type-label ${styles.titolo}`}>
                      {r.prove.length > 1 ? `Prova ${i + 1} · ${p.prova.distanza} m` : 'Volée'}
                    </h2>
                    <table className={styles.tabella}>
                      <caption className="visually-hidden">
                        Volée {r.prove.length > 1 ? `della prova ${i + 1}` : ''}
                      </caption>
                      <thead>
                        <tr>
                          <th scope="col">N.</th>
                          <th scope="col">Frecce</th>
                          <th scope="col">Volée</th>
                          <th scope="col">Totale</th>
                        </tr>
                      </thead>
                      <tbody>
                        {p.volee.map((v, j) => {
                          progressivo += v.totale
                          return (
                            <tr key={j}>
                              <th scope="row">{j + 1}</th>
                              <td>
                                <div className={styles.frecce}>
                                  {v.frecce.map((valore, k) => {
                                    const indice = prima + j * p.prova.frecceVolee + k
                                    return (
                                      <Casella
                                        key={k}
                                        valore={valore}
                                        indice={indice}
                                        selezionata={selezionata === indice}
                                        onScegli={setSelezionata}
                                        etichetta={`Freccia ${k + 1} della volée ${j + 1}`}
                                      />
                                    )
                                  })}
                                </div>
                              </td>
                              <td>{v.totale}</td>
                              <td>{progressivo}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )
              })}
            </section>
          </>
        )}

        <div className={styles.azioni}>
          {conferma ? (
            <>
              <Notice status="warning">
                La simulazione e tutte le sue frecce verranno cancellate.
              </Notice>
              <Button variant="destructive" onClick={() => void elimina()}>
                Elimina la simulazione
              </Button>
              <Button variant="text" onClick={() => setConferma(false)}>
                Annulla
              </Button>
            </>
          ) : (
            <Button variant="text" onClick={() => setConferma(true)}>
              Elimina la simulazione
            </Button>
          )}
        </div>
      </div>
    </>
  )
}

/** Una simulazione di gara (`/allenamento/AAAA-MM-GG/simulazione/:id`): tastierino, volée e riepilogo. */
export function SimulazionePagina() {
  const { giorno = '', id = '' } = useParams()
  const s = useSimulazione(id)
  if (s === undefined) {
    return <PageHeader title="Simulazione" back={{ label: 'Allenamento', href: '/allenamento' }} />
  }
  if (s === null) {
    return (
      <>
        <PageHeader
          title="Simulazione"
          back={{ label: 'Allenamento', href: giorno ? `/allenamento/${giorno}` : '/allenamento' }}
        />
        <EmptyState
          icon={Target}
          title="Simulazione non trovata"
          description="Questa simulazione non è sul telefono: può essere stata cancellata. Torna al giorno per vedere le altre."
        />
      </>
    )
  }
  if (giorno !== s.giorno)
    return <Navigate to={`/allenamento/${s.giorno}/simulazione/${s.id}`} replace />
  return <Tiro key={s.id} simulazione={s} />
}
