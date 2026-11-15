import { Navigate } from 'react-router'
import {
  CLASSIFICHE_COPPA_REGIONI,
  NOMI_CLASSE,
  NOMI_GENERE,
  nomeDivisione,
  percorsoClassifica,
  type ClassificaCoppa,
} from '@arco/shared'
import { useSonoTecnicoRegionale } from '../classifica/dati'
import { ListGroup, ListRow } from '../componenti/List'
import { PageHeader } from '../componenti/PageHeader'
import styles from './Classifica.module.css'

const INDIETRO = { label: 'Classifica', href: '/classifica' }
const QUI = { label: 'Coppa delle Regioni', href: '/classifica/coppa-regioni' }

/** "Olimpico · Junior 70 m · Femminile" (la Campagna non ha la distanza). */
const etichettaCoppa = (c: ClassificaCoppa) =>
  `${nomeDivisione(c.divisione)} · ${NOMI_CLASSE[c.classe] ?? c.classe}${c.distanza ? ` ${c.distanza} m` : ''} · ${NOMI_GENERE[c.genere]}`

const GRUPPI = [
  { titolo: 'Targa', tipo: 'T' },
  { titolo: 'Campagna', tipo: 'C' },
] as const

/**
 * "Coppa delle Regioni" (ruolo tecnico regionale, Mattia 15/11/2026): l'elenco delle classifiche nazionali delle
 * categorie della Coppa Italia delle Regioni. Toccandone una si apre la classifica con i soli atleti umbri.
 * Solo da guardare: i dati sono quelli del nostro database (aggiornati ogni lunedì).
 */
export function CoppaRegioni() {
  const tecnico = useSonoTecnicoRegionale()
  if (tecnico === undefined) return <PageHeader title="Coppa delle Regioni" back={INDIETRO} />
  if (!tecnico) return <Navigate to="/classifica" replace />

  return (
    <>
      <PageHeader
        title="Coppa delle Regioni"
        back={INDIETRO}
        description="Le classifiche nazionali degli atleti umbri, per categoria"
      />
      <div className={styles.gruppi}>
        {GRUPPI.map((g) => (
          <ListGroup key={g.tipo} title={g.titolo}>
            {CLASSIFICHE_COPPA_REGIONI.filter((c) => c.tipo === g.tipo).map((c) => (
              <ListRow
                key={percorsoClassifica(c)}
                label={etichettaCoppa(c)}
                href={`${percorsoClassifica(c)}?regione=umbria`}
                state={{ indietro: QUI }}
              />
            ))}
          </ListGroup>
        ))}
      </div>
    </>
  )
}
