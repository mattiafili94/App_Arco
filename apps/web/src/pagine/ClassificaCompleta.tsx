import { useState } from 'react'
import { Navigate, useParams, useSearchParams } from 'react-router'
import { Trophy } from 'lucide-react'
import {
  CODICE_SOCIETA,
  descriviGareRanking,
  descriviLettura,
  filtraClassifica,
  filtroValido,
  formattaPunti,
  messaggioAggiornamento,
  titoloClassifica,
  type FiltroClassifica,
  type RigaClassificaRanking,
} from '@arco/shared'
import { useAtletaCorrente } from '../accesso/contesto'
import { useClassificaCompleta } from '../classifica/dati'
import { Button } from '../componenti/Button'
import { EmptyState } from '../componenti/EmptyState'
import { Field } from '../componenti/Field'
import { ListGroup, ListRow } from '../componenti/List'
import { Notice } from '../componenti/Notice'
import { PageHeader } from '../componenti/PageHeader'
import { Scelte } from '../componenti/Scelte'
import { useOnline } from '../stato/useOnline'
import styles from './Classifica.module.css'

const INDIETRO = { label: 'Classifica', href: '/classifica' }
const PER_PAGINA = 50
const OPZIONI_REGIONE = [
  { valore: 'italia', etichetta: 'Tutta Italia' },
  { valore: 'umbria', etichetta: 'Umbria' },
]

type Esito = { tipo: 'success' | 'warning' | 'error'; testo: string }

/** Quanti atleti sotto di te si vedono quando la classifica si apre dalla tua posizione. */
const SOTTO_DI_ME = 3

/**
 * L'elenco parte sempre dal 1° (Mattia, 10/11/2026) e si allunga a blocchi di 50. Aperto dalla tua posizione
 * arriva fino a te e a qualche posto sotto di te (almeno i primi 50). Ha il suo stato (quanti se ne mostrano):
 * chi lo usa gli dà una `key` che cambia con i filtri, così a ogni ricerca riparte da capo.
 */
function Elenco({
  righe,
  matricola,
  partiDaMe,
}: {
  righe: RigaClassificaRanking[]
  matricola: string
  partiDaMe: boolean
}) {
  const indiceMia = righe.findIndex((r) => r.matricola === matricola)
  const finoAMe = Math.max(PER_PAGINA, indiceMia + 1 + SOTTO_DI_ME)
  const [quante, setQuante] = useState(partiDaMe && indiceMia >= 0 ? finoAMe : PER_PAGINA)

  if (righe.length === 0) {
    return (
      <EmptyState
        icon={Trophy}
        title="Nessun atleta trovato"
        description="Cambia la ricerca o la regione per vedere altri atleti."
      />
    )
  }
  const visibili = righe.slice(0, quante)
  const fine = visibili.length

  return (
    <>
      <ListGroup title="Classifica">
        {visibili.map((r) => {
          const mia = r.matricola === matricola
          return (
            <ListRow
              key={r.matricola}
              label={`${r.posizione}. ${r.nome}${mia ? ' · Tu' : ''}`}
              value={formattaPunti(r.punti)}
              description={[r.societa_nome, descriviGareRanking(r)].filter(Boolean).join(' · ')}
              evidenziata={mia || r.societa_codice === CODICE_SOCIETA}
            />
          )
        })}
      </ListGroup>
      <p className={`type-caption ${styles.nota}`} aria-live="polite">
        {`Atleti da 1 a ${fine} su ${righe.length}.`}
      </p>
      <div className={styles.azioni}>
        {indiceMia >= 0 && fine <= indiceMia && (
          <Button variant="secondary" onClick={() => setQuante(finoAMe)}>
            Vai alla mia posizione
          </Button>
        )}
        {fine < righe.length && (
          <Button variant="secondary" onClick={() => setQuante((q) => q + PER_PAGINA)}>
            Mostra altri {Math.min(PER_PAGINA, righe.length - fine)}
          </Button>
        )}
      </div>
    </>
  )
}

/** La pagina vera e propria: i parametri dell'indirizzo sono già controllati. */
function Contenuto({ filtro }: { filtro: FiltroClassifica }) {
  const io = useAtletaCorrente()
  const online = useOnline()
  const [ricerca, impostaRicerca] = useSearchParams()
  const { classifica, verificata, errore, inCorso, aggiorna } = useClassificaCompleta(filtro)
  const [testo, setTesto] = useState('')
  const [esito, setEsito] = useState<Esito | null>(null)
  const soloUmbria = ricerca.get('regione') === 'umbria'
  // Arrivando da "La tua posizione" la lista arriva fino a te (solo senza ricerche o filtri attivi).
  const partiDaMe = ricerca.get('mia') === '1' && testo === '' && !soloUmbria

  const premiAggiorna = async () => {
    setEsito(null)
    setEsito(messaggioAggiornamento(await aggiorna()))
  }

  const intestazione = (
    <PageHeader
      title={titoloClassifica(filtro)}
      back={INDIETRO}
      description={
        classifica
          ? `${classifica.totale} atleti · letta da Fitarco ${descriviLettura(classifica.letta_il)}`
          : undefined
      }
    />
  )

  if (classifica === undefined) return intestazione

  if (classifica === null) {
    return (
      <>
        {intestazione}
        {!online ? (
          <EmptyState
            icon={Trophy}
            title="Classifica non salvata sul telefono"
            description="Serve la rete per vedere questa classifica. Appena sei online si apre da sola."
          />
        ) : errore ? (
          <Notice status="error">Non riesco a leggere i dati. Riprova tra poco.</Notice>
        ) : verificata ? (
          <EmptyState
            icon={Trophy}
            title="Questa classifica non è ancora scaricata"
            description="La classifica si scarica da Fitarco una volta: da quel momento la vedono tutti. Poi si aggiorna da sola ogni lunedì alle 10."
            action={
              <Button variant="primary" loading={inCorso} onClick={() => void premiAggiorna()}>
                Scarica da Fitarco
              </Button>
            }
          />
        ) : null}
        {esito && <Notice status={esito.tipo}>{esito.testo}</Notice>}
      </>
    )
  }

  const righe = filtraClassifica(classifica.righe, { testo, soloUmbria })

  return (
    <>
      {intestazione}
      <div className={styles.gruppi}>
        <div className={styles.controlli}>
          <Field
            label="Cerca per nome o società"
            type="search"
            value={testo}
            onChange={(e) => setTesto(e.target.value)}
          />
          <Scelte
            label="Regione"
            opzioni={OPZIONI_REGIONE}
            valore={soloUmbria ? 'umbria' : 'italia'}
            onChange={(r) =>
              impostaRicerca(
                (corrente) => {
                  const nuova = new URLSearchParams(corrente)
                  if (r === 'umbria') nuova.set('regione', 'umbria')
                  else nuova.delete('regione')
                  return nuova
                },
                { replace: true },
              )
            }
          />
          <div className={styles.azioni}>
            <Button variant="secondary" loading={inCorso} onClick={() => void premiAggiorna()}>
              Aggiorna
            </Button>
          </div>
          {!online && (
            <Notice status="warning">
              Sei offline: vedi l’ultima copia salvata sul telefono. Per aggiornare serve la rete.
            </Notice>
          )}
          {esito && <Notice status={esito.tipo}>{esito.testo}</Notice>}
        </div>

        <Elenco
          key={`${testo}|${soloUmbria}`}
          righe={righe}
          matricola={io.matricola}
          partiDaMe={partiDaMe}
        />
      </div>
    </>
  )
}

/**
 * La classifica completa di una categoria (`/classifica/:tipo/:divisione/:classe/:genere`): tutti gli atleti
 * con i punti e le due gare che contano; ricerca per nome o società, solo Umbria, "Vai alla mia posizione".
 * Si legge dalla copia sul telefono, quindi anche offline.
 */
export function ClassificaCompleta() {
  const { tipo, divisione, classe, genere } = useParams()
  const filtro = { tipo, divisione, classe, genere }
  if (!filtroValido(filtro)) return <Navigate to="/classifica" replace />
  return <Contenuto key={`${tipo}${divisione}${classe}${genere}`} filtro={filtro} />
}
