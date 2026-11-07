import { useLocation } from 'react-router'
import { ListGroup, ListRow } from '../componenti/List'
import { PageHeader } from '../componenti/PageHeader'
import { DESTINAZIONI, destinazioneDi } from '../navigazione'
import { SCELTE_TEMA } from '../tema/tema'
import { useTema } from '../tema/useTema'
import styles from './Impostazioni.module.css'

/** Impostazioni: tema e informazioni sull'app. Si torna al tab da cui si è arrivati. */
export function Impostazioni() {
  const [tema, impostaTema] = useTema()
  const stato = useLocation().state as { da?: string } | null
  const provenienza = destinazioneDi(stato?.da ?? '') ?? DESTINAZIONI[0]!

  return (
    <>
      <PageHeader
        title="Impostazioni"
        back={{ label: provenienza.label, href: provenienza.href }}
      />
      <div className={styles.groups}>
        <ListGroup title="Tema" role="radiogroup">
          {SCELTE_TEMA.map((s) => (
            <ListRow
              key={s.valore}
              label={s.etichetta}
              selected={tema === s.valore}
              onSelect={() => impostaTema(s.valore)}
            />
          ))}
        </ListGroup>
        <ListGroup title="Informazioni">
          <ListRow label="Versione" value={__VERSIONE_APP__} />
          <ListRow label="Compagnia" value="A.S.D. Compagnia Arcieri Eugubini" />
        </ListGroup>
      </div>
    </>
  )
}
