import type { ReactElement } from 'react'
import { Users } from 'lucide-react'
import { useLocation, useParams } from 'react-router'
import {
  etichettaTipologia,
  formattaDate,
  idSerie,
  medieAnnuali,
  nomeDivisione,
  proveDiAtleta,
  recordPersonali,
  riconosciTipologia,
  serieAtleta,
  storicoAtleta,
  storicoPerAnnoDellaSerie,
  type Gara,
  type Partecipazione,
  type ProvaGara,
  type RigaClassifica,
} from '@arco/shared'
import { Andamento } from './Andamento'
import {
  nomeAtleta,
  useAtleta,
  useClassificheDi,
  usePartecipazioniDi,
  type AtletaSalvato,
} from '../atleti/dati'
import { LinkButton } from '../componenti/Button'
import { EmptyState } from '../componenti/EmptyState'
import { ListGroup, ListRow } from '../componenti/List'
import { PageHeader } from '../componenti/PageHeader'
import { oggi as oggiIn, useGare } from '../gare/dati'
import type { Indietro } from '../navigazione'
import andamento from './Andamento.module.css'
import styles from './Gare.module.css'

const ATLETI = { label: 'Atleti', href: '/atleti' }

const indirizzoProva = (atleta: string, p: Pick<ProvaGara, 'chiave' | 'divisione'>) =>
  `/atleti/${atleta}/prova/${encodeURIComponent(idSerie(p))}`

interface DatiAtleta {
  atleta: AtletaSalvato
  partecipazioni: Partecipazione[]
  classifiche: RigaClassifica[]
  gare: Gara[]
}

/**
 * I dati di un atleta dal telefono. Restituisce la pagina da mostrare mentre si leggono o se l'atleta non c'è
 * (con il titolo e la freccia giusti), oppure i dati.
 */
function useDatiAtleta(
  id: string,
  titolo: string,
  indietro: Indietro,
): { pagina: ReactElement } | { dati: DatiAtleta } {
  const atleta = useAtleta(id)
  const partecipazioni = usePartecipazioniDi(id)
  const classifiche = useClassificheDi(id)
  const gare = useGare()
  if (
    atleta === undefined ||
    partecipazioni === undefined ||
    classifiche === undefined ||
    gare === undefined
  ) {
    return { pagina: <PageHeader title={titolo} back={indietro} /> }
  }
  if (atleta === null) {
    return {
      pagina: (
        <>
          <PageHeader title={titolo} back={indietro} />
          <EmptyState
            icon={Users}
            title="Atleta non trovato"
            description="Questo atleta non è nei dati salvati sul telefono. Torna all'elenco: se è un atleta nuovo arriverà con il prossimo aggiornamento."
          />
        </>
      ),
    }
  }
  return { dati: { atleta, partecipazioni, classifiche, gare } }
}

/**
 * Scheda di un atleta (`/atleti/:id`): un pulsante per ogni prova con il suo arco ("18 m · Ricurvo") e, in fondo,
 * "Tutte le gare". Ogni prova apre la sua pagina con record, andamento, media per anno e storico (Mattia,
 * 10/11/2026).
 */
export function SchedaAtleta() {
  const { id = '' } = useParams()
  const r = useDatiAtleta(id, 'Atleta', ATLETI)
  if ('pagina' in r) return r.pagina
  const { atleta, partecipazioni, classifiche, gare } = r.dati
  const serie = serieAtleta(proveDiAtleta(id, partecipazioni, gare, classifiche))

  return (
    <>
      <PageHeader title={nomeAtleta(atleta)} back={ATLETI} />
      <div className={styles.gruppi}>
        {serie.length > 0 ? (
          <nav aria-label="Prove" className={andamento.prove}>
            {serie.map((s) => (
              <LinkButton key={s.id} to={indirizzoProva(id, s)}>
                {s.etichetta}
              </LinkButton>
            ))}
          </nav>
        ) : (
          <ListGroup title="Prove">
            <ListRow
              label="Nessun punteggio per ora"
              description="Record e andamento compaiono con i risultati delle gare."
            />
          </ListGroup>
        )}
        <div className={styles.pulsanti}>
          <LinkButton to={`/atleti/${id}/gare`}>Tutte le gare</LinkButton>
        </div>
      </div>
    </>
  )
}

/**
 * Una prova di un atleta con un arco (`/atleti/:id/prova/:serie`): record personale, andamento (con la scelta
 * degli anni), media per anno e storico delle gare della prova, anno per anno. Le gare composte (25+18, doppio
 * 70 m) compaiono con il punteggio della prova e il nome della gara.
 */
export function ProvaAtleta() {
  const { id = '', serie: serieTesto = '' } = useParams()
  const { pathname } = useLocation()
  const scheda = { label: 'Atleta', href: `/atleti/${id}` }
  const r = useDatiAtleta(id, 'Prova', scheda)
  if ('pagina' in r) return r.pagina
  const { atleta, partecipazioni, classifiche, gare } = r.dati
  const prove = proveDiAtleta(id, partecipazioni, gare, classifiche)
  const serie = serieAtleta(prove).find((s) => s.id === serieTesto)
  const indietroScheda = { label: nomeAtleta(atleta), href: `/atleti/${id}` }

  if (!serie) {
    return (
      <>
        <PageHeader title="Prova" back={indietroScheda} />
        <EmptyState
          icon={Users}
          title="Prova non trovata"
          description="Questa prova non ha punteggi per questo atleta. Torna alla scheda per vedere le altre."
        />
      </>
    )
  }

  const perGara = new Map(gare.map((g) => [g.codice, g]))
  const annoCorrente = Number(oggiIn().slice(0, 4))
  // Dalla scheda di una gara si torna qui.
  const qui = { indietro: { label: serie.etichetta, href: pathname } }
  const [record] = recordPersonali(serie.punti)
  const gara = (p: ProvaGara) => perGara.get(p.gara_codice)
  /** "Gubbio (PG) · 24–25 ott · gara 25+18 m · provvisorio" */
  const descrizione = (p: ProvaGara) => {
    const g = gara(p)
    const composta = g && (riconosciTipologia(g.tipologia)?.prove.length ?? 1) > 1
    return [
      g ? formattaDate(g.dal, g.al, annoCorrente) : null,
      composta ? `gara ${etichettaTipologia(g.tipologia)}` : null,
      p.provvisoria ? 'provvisorio' : null,
    ]
      .filter(Boolean)
      .join(' · ')
  }
  const medie = medieAnnuali(serie.punti)

  return (
    <>
      <PageHeader title={serie.etichetta} back={indietroScheda} description={nomeAtleta(atleta)} />
      <div className={styles.gruppi}>
        {record && (
          <ListGroup title="Record personale">
            <ListRow
              label={gara(record)?.localita ?? record.gara_codice}
              value={String(record.totale)}
              description={descrizione(record)}
              href={`/gare/${record.gara_codice}`}
              state={qui}
            />
          </ListGroup>
        )}

        <Andamento punti={serie.punti} etichetta={serie.etichetta} gare={gare} />

        <ListGroup title="Media per anno">
          {medie.map((m) => (
            <ListRow
              key={m.anno}
              label={String(m.anno)}
              value={String(m.media).replace('.', ',')}
              description={m.gare === 1 ? '1 gara' : `${m.gare} gare`}
            />
          ))}
        </ListGroup>

        {storicoPerAnnoDellaSerie(serie.punti).map((a) => (
          <ListGroup key={a.anno} title={`Gare del ${a.anno}`}>
            {a.punti.map((p, i) => (
              <ListRow
                key={`${p.gara_codice}-${i}`}
                label={gara(p)?.localita ?? p.gara_codice}
                value={String(p.totale)}
                description={descrizione(p)}
                href={`/gare/${p.gara_codice}`}
                state={qui}
              />
            ))}
          </ListGroup>
        ))}
      </div>
    </>
  )
}

/** Tutte le gare di un atleta (`/atleti/:id/gare`), anno per anno: anche quelle che non stanno in una prova. */
export function GareAtleta() {
  const { id = '' } = useParams()
  const { pathname } = useLocation()
  const r = useDatiAtleta(id, 'Tutte le gare', { label: 'Atleta', href: `/atleti/${id}` })
  if ('pagina' in r) return r.pagina
  const { atleta, partecipazioni, gare } = r.dati
  const storico = storicoAtleta(id, partecipazioni, gare)
  const annoCorrente = Number(oggiIn().slice(0, 4))
  const anni = [...new Set(storico.map((s) => s.gara.dal.slice(0, 4)))]
  const qui = { indietro: { label: 'Tutte le gare', href: pathname } }

  return (
    <>
      <PageHeader
        title="Tutte le gare"
        back={{ label: nomeAtleta(atleta), href: `/atleti/${id}` }}
        description={nomeAtleta(atleta)}
      />
      <div className={styles.gruppi}>
        {storico.length === 0 && (
          <ListGroup title="Storico gare">
            <ListRow
              label="Nessuna gara per ora"
              description="Lo storico arriva da Fitarco con il primo aggiornamento."
            />
          </ListGroup>
        )}
        {anni.map((anno) => (
          <ListGroup key={anno} title={anno}>
            {storico
              .filter((s) => s.gara.dal.startsWith(`${anno}-`))
              .map((s) => (
                <ListRow
                  key={`${s.gara.codice}|${s.divisione}`}
                  label={`${etichettaTipologia(s.gara.tipologia)} · ${s.gara.localita}`}
                  value={s.totale === null ? undefined : String(s.totale)}
                  description={[
                    formattaDate(s.gara.dal, s.gara.al, annoCorrente),
                    nomeDivisione(s.divisione),
                    s.posizione === null ? null : `${s.posizione}° posto`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  href={`/gare/${s.gara.codice}`}
                  state={qui}
                />
              ))}
          </ListGroup>
        ))}
      </div>
    </>
  )
}
