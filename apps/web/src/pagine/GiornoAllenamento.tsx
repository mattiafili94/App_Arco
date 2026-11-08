import { useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router'
import {
  ETICHETTE_BERSAGLIO,
  etichettaGiorno,
  frecceDelleSimulazioni,
  nomeSimulazione,
  riepilogoSimulazione,
  type Simulazione,
  frecceDelGiorno,
  inizioSettimana,
  leggiFrecce,
  LUNGHEZZA_MASSIMA_NOTA,
  LUNGHEZZA_MASSIMA_PROGRAMMA,
  type GiornoAllenamento,
} from '@arco/shared'
import { useAtletaCorrente } from '../accesso/contesto'
import { useGiornoAllenamento, useSimulazioniGiorno } from '../allenamento/dati'
import { useInvioDifferito } from '../allenamento/invioDifferito'
import { salvaGiorno, type CampiGiorno } from '../allenamento/scrittura'
import { Button } from '../componenti/Button'
import { Checkbox } from '../componenti/Checkbox'
import { Field } from '../componenti/Field'
import { ListGroup, ListRow } from '../componenti/List'
import { PageHeader } from '../componenti/PageHeader'
import { Textarea } from '../componenti/Textarea'
import { oggi as oggiIn } from '../gare/dati'
import { useSincronizzazione } from '../sync/contesto'
import styles from './Allenamento.module.css'

const RE_GIORNO = /^\d{4}-\d{2}-\d{2}$/

/** Le simulazioni di gara del giorno e il pulsante per iniziarne una nuova. */
function ElencoSimulazioni({
  giorno,
  simulazioni,
}: {
  giorno: string
  simulazioni: Simulazione[]
}) {
  const vai = useNavigate()
  return (
    <div className={styles.simulazioni}>
      <ListGroup title="Simulazioni di gara">
        {simulazioni.length === 0 ? (
          <ListRow
            label="Nessuna simulazione"
            description="Tira una gara in allenamento e segna le frecce: si sommano alle frecce del giorno."
          />
        ) : (
          simulazioni.map((s) => {
            const r = riepilogoSimulazione(s)
            return (
              <ListRow
                key={s.id}
                label={`${nomeSimulazione(s)} · ${ETICHETTE_BERSAGLIO[s.bersaglio]}`}
                value={String(r.totale)}
                description={`${r.frecceSegnate} frecce di ${r.frecceTotali} · ${r.completa ? 'Conclusa' : 'In corso'}`}
                href={`/allenamento/${giorno}/simulazione/${s.id}`}
              />
            )
          })
        )}
      </ListGroup>
      <Button variant="primary" onClick={() => vai(`/allenamento/${giorno}/nuova`)}>
        Nuova simulazione
      </Button>
    </div>
  )
}

/** Il giorno scelto: cosa fare, fatto, frecce libere e nota. Ogni modifica si salva subito sul telefono. */
function Modulo({ giorno, riga }: { giorno: string; riga: GiornoAllenamento | null }) {
  const io = useAtletaCorrente()
  const { db } = useSincronizzazione()
  const [programma, setProgramma] = useState(riga?.programma ?? '')
  const [nota, setNota] = useState(riga?.nota ?? '')
  const [fatto, setFatto] = useState(riga?.fatto ?? false)
  const [frecce, setFrecce] = useState(riga ? String(riga.frecce_libere) : '')
  const daInviare = (riga as unknown as { da_inviare?: number } | null)?.da_inviare === 1
  // Quando i dati arrivano (o cambiano) dal server e sul telefono non ci sono modifiche in sospeso, il modulo
  // li adotta: si aggiorna per esempio se la pagina si apre prima della sincronizzazione.
  const [adottata, setAdottata] = useState<string | null>(null)
  if (riga && !daInviare && riga.modificato_il !== adottata) {
    setAdottata(riga.modificato_il)
    setProgramma(riga.programma)
    setNota(riga.nota)
    setFatto(riga.fatto)
    setFrecce(String(riga.frecce_libere))
  }
  const valoreFrecce = leggiFrecce(frecce)
  const annoCorrente = Number(oggiIn().slice(0, 4))

  const programmaInvio = useInvioDifferito()

  const salva = (campi: CampiGiorno) => {
    void salvaGiorno(db, io.id, giorno, campi).then(programmaInvio)
  }

  const simulazioni = useSimulazioniGiorno(giorno)
  const frecceSimulazioni = frecceDelleSimulazioni(simulazioni ?? []).reduce(
    (t, x) => t + x.frecce,
    0,
  )
  const totale = frecceDelGiorno({ frecce_libere: valoreFrecce ?? 0 }, frecceSimulazioni)

  return (
    <>
      <PageHeader
        title={etichettaGiorno(giorno, annoCorrente)}
        back={{ label: 'Allenamento', href: `/allenamento?settimana=${inizioSettimana(giorno)}` }}
        description={totale > 0 ? `${totale} frecce in tutto` : undefined}
      />
      <div className={styles.modulo}>
        <Textarea
          label="Cosa devo fare"
          hint="Il programma di questo giorno, come te l'ha dato l'allenatore o come lo hai pensato."
          rows={5}
          maxLength={LUNGHEZZA_MASSIMA_PROGRAMMA}
          value={programma}
          onChange={(e) => {
            setProgramma(e.target.value)
            salva({ programma: e.target.value })
          }}
        />
        <Checkbox
          label="Fatto"
          checked={fatto}
          onChange={(e) => {
            setFatto(e.target.checked)
            salva({ fatto: e.target.checked })
          }}
        />
        <Field
          label="Frecce tirate"
          hint="Quante frecce hai tirato liberamente in questo giorno."
          inputMode="numeric"
          autoComplete="off"
          value={frecce}
          error={valoreFrecce === null ? 'Scrivi un numero da 0 a 9999.' : undefined}
          onChange={(e) => {
            setFrecce(e.target.value)
            const n = leggiFrecce(e.target.value)
            if (n !== null) salva({ frecce_libere: n })
          }}
        />
        <Textarea
          label="Note"
          hint="Come è andata, sensazioni, materiale. Facoltativo."
          rows={4}
          maxLength={LUNGHEZZA_MASSIMA_NOTA}
          value={nota}
          onChange={(e) => {
            setNota(e.target.value)
            salva({ nota: e.target.value })
          }}
        />
        <p className={`type-caption ${styles.stato}`} aria-live="polite">
          {riga === null
            ? 'Scrivi qui sopra: si salva da solo.'
            : daInviare
              ? 'Salvato sul telefono. Si invia al server appena c’è la rete.'
              : 'Salvato.'}
        </p>
      </div>
      {simulazioni !== undefined && <ElencoSimulazioni giorno={giorno} simulazioni={simulazioni} />}
    </>
  )
}

/** Un giorno di allenamento (`/allenamento/AAAA-MM-GG`). */
export function GiornoAllenamentoPagina() {
  const { giorno = '' } = useParams()
  const valido = RE_GIORNO.test(giorno) && !Number.isNaN(Date.parse(giorno))
  const riga = useGiornoAllenamento(valido ? giorno : '1970-01-01')
  if (!valido) return <Navigate to="/allenamento" replace />
  if (riga === undefined) {
    return <PageHeader title="Giorno" back={{ label: 'Allenamento', href: '/allenamento' }} />
  }
  // `key`: cambiando giorno il modulo riparte dai dati di quel giorno.
  return <Modulo key={giorno} giorno={giorno} riga={riga} />
}
