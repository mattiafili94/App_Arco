import { Trophy } from 'lucide-react'
import { useParams, useSearchParams } from 'react-router'
import {
  CODICE_SOCIETA,
  descriviConteggi,
  descriviPosizione,
  descriviPunteggi,
  eNostro,
  etichettaTipologia,
  formattaNome,
  raggruppaPerCategoria,
  type RigaClassifica,
} from '@arco/shared'
import { EmptyState } from '../componenti/EmptyState'
import { ListGroup, ListRow } from '../componenti/List'
import { Notice } from '../componenti/Notice'
import { PageHeader } from '../componenti/PageHeader'
import { useClassifica, useGara } from '../gare/dati'
import styles from './Gare.module.css'

const riga = (r: RigaClassifica, conCategoria: boolean) => {
  const dettagli = [
    conCategoria ? r.categoria : r.societa_nome,
    descriviPunteggi(r),
    descriviConteggi(r),
  ].filter(Boolean)
  return (
    <ListRow
      key={`${r.categoria}|${r.ordine}`}
      label={`${descriviPosizione(r)} ${formattaNome(r)}`}
      value={String(r.totale)}
      description={dettagli.join(' · ')}
      evidenziata={eNostro(r, CODICE_SOCIETA)}
    />
  )
}

/**
 * Risultati di una gara: prima i nostri atleti (in tutte le categorie), poi l'elenco delle categorie.
 * Aprendo una categoria si vede la sua classifica, con i nostri evidenziati.
 */
export function Risultati() {
  const { codice = '' } = useParams()
  const [parametri] = useSearchParams()
  const gara = useGara(codice)
  const classifica = useClassifica(codice)

  const scheda = {
    label: gara ? etichettaTipologia(gara.tipologia) : 'Gara',
    href: `/gare/${codice}`,
  }
  if (gara === undefined || classifica === undefined) {
    return <PageHeader title="Risultati" back={scheda} />
  }
  if (gara === null || classifica.length === 0) {
    return (
      <>
        <PageHeader title="Risultati" back={scheda} />
        <EmptyState
          icon={Trophy}
          title="Risultati non salvati"
          description="Per questa gara non ci sono classifiche sul telefono. Se la gara è finita da poco arriveranno con un prossimo aggiornamento."
        />
      </>
    )
  }

  const categorie = raggruppaPerCategoria(classifica, CODICE_SOCIETA)
  const provvisori = classifica.some((r) => r.provvisoria)
  const nomeCategoria = parametri.get('categoria')
  const categoria = categorie.find((c) => c.nome === nomeCategoria)

  if (nomeCategoria && !categoria) {
    return (
      <>
        <PageHeader title="Risultati" back={scheda} />
        <EmptyState
          icon={Trophy}
          title="Categoria non trovata"
          description="Questa categoria non è nella classifica. Torna all'elenco delle categorie."
        />
      </>
    )
  }

  const avviso = provvisori && (
    <Notice status="info">
      Risultati provvisori: la gara non è ancora omologata e i punteggi possono cambiare.
    </Notice>
  )

  if (categoria) {
    return (
      <>
        <PageHeader
          title={categoria.nome}
          back={{ label: 'Risultati', href: `/gare/${codice}/risultati` }}
          description={`${categoria.righe.length} atleti`}
        />
        <div className={styles.gruppi}>
          {avviso}
          <ListGroup title="Classifica">{categoria.righe.map((r) => riga(r, false))}</ListGroup>
        </div>
      </>
    )
  }

  const nostri = categorie
    .flatMap((c) => c.righe)
    .filter((r) => eNostro(r, CODICE_SOCIETA))
    .sort(
      (a, b) =>
        a.cognome.localeCompare(b.cognome, 'it') || a.categoria.localeCompare(b.categoria, 'it'),
    )

  return (
    <>
      <PageHeader
        title="Risultati"
        back={scheda}
        description={gara ? `${gara.localita} · ${classifica.length} atleti` : undefined}
      />
      <div className={styles.gruppi}>
        {avviso}
        {nostri.length > 0 && (
          <ListGroup title={`I nostri atleti (${nostri.length})`}>
            {nostri.map((r) => riga(r, true))}
          </ListGroup>
        )}
        <ListGroup title={`Categorie (${categorie.length})`}>
          {categorie.map((c) => (
            <ListRow
              key={c.nome}
              label={c.nome}
              description={[
                `${c.righe.length} atleti`,
                c.nostri > 0 ? `${c.nostri} dei nostri` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
              href={`/gare/${codice}/risultati?categoria=${encodeURIComponent(c.nome)}`}
            />
          ))}
        </ListGroup>
      </div>
    </>
  )
}
