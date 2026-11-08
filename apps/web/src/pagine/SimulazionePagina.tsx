import { useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router'
import { Target } from 'lucide-react'
import {
  ETICHETTE_BERSAGLIO,
  allineaPosizioni,
  durataTiroMs,
  eAPiazzole,
  eBersaglioConAnelli,
  etichetteConteggi,
  haTimer,
  NOTA_VOLEE_MASSIMA,
  notaVolee,
  etichettaGiorno,
  nomeSimulazione,
  puntiFreccia,
  riepilogoSimulazione,
  statoTiro,
  unitaDiTiro,
  valoriAmmessi,
  type Posizione,
  type Simulazione,
  type ValoreFreccia,
} from '@arco/shared'
import { useSimulazione } from '../allenamento/dati'
import { useInvioDifferito } from '../allenamento/invioDifferito'
import {
  annullaUltimaFreccia,
  correggiValore,
  eliminaSimulazione,
  salvaNotaVolee,
  segnaFreccia,
} from '../allenamento/simulazioni'
import { BersaglioTocco, type PuntoSuBersaglio } from '../componenti/BersaglioTocco'
import { Button } from '../componenti/Button'
import { ConfrontoMedie } from './ConfrontoMedie'
import { EmptyState } from '../componenti/EmptyState'
import { ListGroup, ListRow } from '../componenti/List'
import { Notice } from '../componenti/Notice'
import { PageHeader } from '../componenti/PageHeader'
import { Scelte } from '../componenti/Scelte'
import { Textarea } from '../componenti/Textarea'
import { TimerVolee } from '../componenti/TimerVolee'
import { oggi as oggiIn } from '../gare/dati'
import { useSincronizzazione } from '../sync/contesto'
import styles from './SimulazionePagina.module.css'

/** Il colore della zona del bersaglio in cui cade il valore (la X e il 10 sono oro, come il bersaglio). */
const ZONA: Record<ValoreFreccia, string> = {
  X: 'oro',
  '11': 'oro',
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

/** " · 70 m" se la prova ha una distanza (campagna e 3D no). */
const metri = (distanza: number | null) => (distanza === null ? '' : ` · ${distanza} m`)

/** La zona di un valore: oro, rosso, blu, nero, bianco o mancata. */
const classeZona = (v: ValoreFreccia) => styles[ZONA[v]!]!

/** La nota di una volée: si scrive e si salva subito sul telefono. */
function NotaVolee({
  indice,
  testo,
  etichetta,
  onSalva,
}: {
  indice: number
  testo: string
  etichetta: string
  onSalva(indice: number, testo: string): void
}) {
  const [valore, setValore] = useState(testo)
  return (
    <Textarea
      label={etichetta}
      rows={2}
      maxLength={NOTA_VOLEE_MASSIMA}
      value={valore}
      onChange={(e) => {
        setValore(e.target.value)
        onSalva(indice, e.target.value)
      }}
    />
  )
}

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

type Modo = 'tastierino' | 'bersaglio'
const CHIAVE_MODO = 'arco.segnapunti.modo'

/** Come si segnano le frecce: tastierino o bersaglio. Il telefono si ricorda l'ultima scelta. */
function useModoSegnapunti(): [Modo, (m: Modo) => void] {
  const [modo, setModo] = useState<Modo>(() => {
    try {
      return localStorage.getItem(CHIAVE_MODO) === 'bersaglio' ? 'bersaglio' : 'tastierino'
    } catch {
      return 'tastierino'
    }
  })
  const imposta = (m: Modo) => {
    setModo(m)
    try {
      localStorage.setItem(CHIAVE_MODO, m)
    } catch {
      // Senza memoria del browser (finestra privata) la scelta vale solo per questa pagina.
    }
  }
  return [modo, imposta]
}

function Tiro({ simulazione: s }: { simulazione: Simulazione }) {
  const { db } = useSincronizzazione()
  const vai = useNavigate()
  const programmaInvio = useInvioDifferito()
  const [selezionata, setSelezionata] = useState<number | null>(null)
  const [conferma, setConferma] = useState(false)
  const [notaAperta, setNotaAperta] = useState<number | null>(null)
  const [modo, impostaModo] = useModoSegnapunti()
  const annoCorrente = Number(oggiIn().slice(0, 4))

  const r = riepilogoSimulazione(s)
  const stato = statoTiro(s)
  const valori = valoriAmmessi(s.bersaglio)
  const [nome1, nome2] = etichetteConteggi(s.formato)
  const unita = unitaDiTiro(s.formato)
  // Il bersaglio da toccare esiste solo per indoor e outdoor; campagna e 3D hanno solo il tastierino.
  const conAnelli = eBersaglioConAnelli(s.bersaglio) ? s.bersaglio : null
  const modoEffettivo: Modo = conAnelli === null ? 'tastierino' : modo

  const premi = async (v: ValoreFreccia, posizione: Posizione | null = null) => {
    if (selezionata !== null) {
      await correggiValore(db, s.id, selezionata, v, posizione)
      setSelezionata(null)
    } else {
      await segnaFreccia(db, s.id, v, posizione)
    }
    programmaInvio()
  }
  const annulla = async () => {
    await annullaUltimaFreccia(db, s.id)
    setSelezionata(null)
    programmaInvio()
  }
  const salvaNota = (indice: number, testo: string) => {
    void salvaNotaVolee(db, s.id, indice, testo).then(programmaInvio)
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
  // Numero della volée in corso contato da zero su tutta la simulazione (le note si legano a questo).
  const voleePrimaDellaProva = r.prove
    .slice(0, stato.prova)
    .reduce((t, p) => t + p.prova.frecceTotali / p.prova.frecceVolee, 0)
  const indiceVoleeInCorso = voleePrimaDellaProva + stato.volee - 1
  // Le frecce della prova in corso con la loro posizione (se segnate toccando il bersaglio).
  const posizioni = allineaPosizioni(s.posizioni, s.frecce.length)
  const puntiProva: PuntoSuBersaglio[] = s.frecce.flatMap((v, i) => {
    const pos = posizioni[i]
    const dentro = i >= primaDellaProva && i < primaDellaProva + provaInCorso.prova.frecceTotali
    if (!pos || !dentro) return []
    const inVolee = i >= primaDellaVolee && i < primaDellaVolee + provaInCorso.prova.frecceVolee
    return [
      { posizione: pos, etichetta: `Freccia ${i + 1}: ${v}`, stato: inVolee ? 'volee' : 'prima' },
    ]
  })
  if (selezionata !== null && posizioni[selezionata]) {
    puntiProva.push({
      posizione: posizioni[selezionata]!,
      etichetta: `Freccia ${selezionata + 1} da correggere`,
      stato: 'scelta',
    })
  }
  const totaleVolee = voleeInCorso.reduce((t, v) => t + puntiFreccia(v), 0)
  // A volée finita si passa alla successiva: il totale di quella appena tirata resta in vista.
  const precedente =
    voleeInCorso.length === 0 ? provaInCorso.volee[stato.volee - 2]?.totale : undefined

  const dove = stato.finita
    ? 'Tutte le frecce sono state segnate'
    : `${stato.prove > 1 ? `Prova ${stato.prova + 1} di ${stato.prove} · ` : ''}${stato.distanza === null ? '' : `${stato.distanza} m · `}${unita.maiuscolo} ${stato.volee} di ${stato.voleeTotali}`

  return (
    <>
      <PageHeader
        title={
          eAPiazzole(s.formato)
            ? nomeSimulazione(s)
            : `${nomeSimulazione(s)} · ${ETICHETTE_BERSAGLIO[s.bersaglio]}`
        }
        back={{
          label: etichettaGiorno(s.giorno, annoCorrente),
          href: `/allenamento/${s.giorno}`,
        }}
        description={dove}
      />
      <div className={styles.pagina}>
        <section className={styles.volee} aria-label={`${unita.maiuscolo} in corso`}>
          <div className={styles.frecce}>
            {Array.from({ length: provaInCorso.prova.frecceVolee }, (_, i) => (
              <Casella
                key={i}
                valore={voleeInCorso[i] ?? null}
                indice={primaDellaVolee + i}
                selezionata={selezionata === primaDellaVolee + i}
                onScegli={setSelezionata}
                etichetta={`Freccia ${i + 1} della ${unita.minuscolo} ${stato.volee}`}
              />
            ))}
          </div>
          <p className={`type-caption ${styles.nota}`} aria-live="polite">
            {`${unita.maiuscolo}: ${totaleVolee}${precedente === undefined ? '' : ` · ${unita.maiuscolo} precedente: ${precedente}`} · Totale: ${r.totale} · ${r.frecceSegnate} frecce su ${r.frecceTotali}`}
          </p>
        </section>

        {!stato.finita && haTimer(s.formato) && <TimerVolee durataTiro={durataTiroMs(s.formato)} />}

        <details className={styles.dettagli}>
          <summary>
            {notaVolee(s, indiceVoleeInCorso) === ''
              ? `Nota della ${unita.minuscolo} ${stato.volee} (facoltativa)`
              : `Nota della ${unita.minuscolo} ${stato.volee}: ${notaVolee(s, indiceVoleeInCorso)}`}
          </summary>
          {/* `key`: cambiando volée si riparte dalla nota di quella volée. */}
          <NotaVolee
            key={indiceVoleeInCorso}
            indice={indiceVoleeInCorso}
            testo={notaVolee(s, indiceVoleeInCorso)}
            etichetta={`Nota della ${unita.minuscolo} ${stato.volee}`}
            onSalva={salvaNota}
          />
        </details>

        {selezionata !== null && (
          <Notice status="warning">
            Correggi la freccia {selezionata + 1}: tocca il valore giusto.{' '}
            <button type="button" className={styles.testo} onClick={() => setSelezionata(null)}>
              Annulla la correzione
            </button>
          </Notice>
        )}

        {conAnelli !== null && (
          <Scelte
            label="Come segni le frecce"
            opzioni={[
              { valore: 'tastierino', etichetta: 'Tastierino' },
              { valore: 'bersaglio', etichetta: 'Bersaglio' },
            ]}
            valore={modo}
            onChange={(v) => impostaModo(v === 'bersaglio' ? 'bersaglio' : 'tastierino')}
          />
        )}
        {modoEffettivo === 'bersaglio' && conAnelli !== null ? (
          <BersaglioTocco
            bersaglio={conAnelli}
            compound={s.compound ?? false}
            punti={puntiProva}
            onSegna={(posizione, valore) => void premi(valore, posizione)}
            disabilitato={stato.finita && selezionata === null}
            etichetta="Bersaglio: tocca dove è arrivata la freccia. In alternativa usa il tastierino."
          />
        ) : (
          <div
            className={styles.tastierino}
            role="group"
            aria-label="Valore della freccia"
            data-colonne={valori.length > 8 || s.bersaglio === 'campagna' ? 4 : 3}
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
        )}
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
                    r.prove.length > 1 ? `Prova ${i + 1}${metri(p.prova.distanza)}` : 'Punteggio'
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

            <ConfrontoMedie simulazione={s} />

            {r.prove.map((p, i) => {
              const prima = r.prove.slice(0, i).reduce((t, x) => t + x.prova.frecceTotali, 0)
              const punti: PuntoSuBersaglio[] = s.frecce.flatMap((v, k) => {
                const pos = posizioni[k]
                return pos && k >= prima && k < prima + p.prova.frecceTotali
                  ? [
                      {
                        posizione: pos,
                        etichetta: `Freccia ${k - prima + 1}: ${v}`,
                        stato: 'prima' as const,
                      },
                    ]
                  : []
              })
              if (punti.length === 0 || conAnelli === null) return null
              return (
                <section
                  key={i}
                  className={styles.mappa}
                  aria-label={`Dove sono arrivate le frecce${r.prove.length > 1 ? ` · prova ${i + 1}` : ''}`}
                >
                  <h2 className={`type-label ${styles.titolo}`}>
                    {r.prove.length > 1
                      ? `Dove sono arrivate · prova ${i + 1}`
                      : 'Dove sono arrivate le frecce'}
                  </h2>
                  <BersaglioTocco
                    bersaglio={conAnelli}
                    compound={s.compound ?? false}
                    punti={punti}
                    etichetta={`Bersaglio con ${punti.length} frecce`}
                  />
                </section>
              )
            })}

            <section className={styles.elenco} aria-label={`Tutte le ${unita.plurale}`}>
              {r.prove.map((p, i) => {
                const prima = r.prove.slice(0, i).reduce((t, x) => t + x.prova.frecceTotali, 0)
                const voleePrima = r.prove
                  .slice(0, i)
                  .reduce((t, x) => t + x.prova.frecceTotali / x.prova.frecceVolee, 0)
                let progressivo = 0
                return (
                  <div key={i}>
                    <h2 className={`type-label ${styles.titolo}`}>
                      {r.prove.length > 1
                        ? `Prova ${i + 1}${metri(p.prova.distanza)}`
                        : unita.maiuscolo}
                    </h2>
                    <ol
                      className={styles.listaVolee}
                      aria-label={`${unita.maiuscolo}${r.prove.length > 1 ? ` della prova ${i + 1}` : ''}`}
                    >
                      {p.volee.map((v, j) => {
                        progressivo += v.totale
                        const indiceVolee = voleePrima + j
                        const nota = notaVolee(s, indiceVolee)
                        return (
                          <li key={j} className={styles.voleeRiga}>
                            <div className={styles.testata}>
                              <span className={styles.numero}>
                                {unita.maiuscolo} {j + 1}
                              </span>
                              <span className={styles.totali}>
                                {`${unita.maiuscolo} ${v.totale} · Totale ${progressivo}`}
                              </span>
                              <button
                                type="button"
                                className={styles.pulsanteNota}
                                aria-expanded={notaAperta === indiceVolee}
                                onClick={() =>
                                  setNotaAperta(notaAperta === indiceVolee ? null : indiceVolee)
                                }
                              >
                                <span className="visually-hidden">{`Nota della ${unita.minuscolo} ${j + 1}: `}</span>{' '}
                                {nota === '' ? 'Aggiungi' : 'Modifica'}
                              </button>
                            </div>
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
                                    etichetta={`Freccia ${k + 1} della ${unita.minuscolo} ${j + 1}`}
                                  />
                                )
                              })}
                            </div>
                            {notaAperta === indiceVolee ? (
                              <NotaVolee
                                indice={indiceVolee}
                                testo={nota}
                                etichetta={`Nota della ${unita.minuscolo} ${j + 1}`}
                                onSalva={salvaNota}
                              />
                            ) : (
                              nota !== '' && (
                                <p className={styles.testoNota}>
                                  <span className="visually-hidden">{`Nota della ${unita.minuscolo} ${j + 1}: `}</span>
                                  {nota}
                                </p>
                              )
                            )}
                          </li>
                        )
                      })}
                    </ol>
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
