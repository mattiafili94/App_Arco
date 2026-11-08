import { useEffect, useRef, useState } from 'react'
import { Navigate, useParams } from 'react-router'
import {
  etichettaGiorno,
  frecceDelGiorno,
  inizioSettimana,
  leggiFrecce,
  LUNGHEZZA_MASSIMA_NOTA,
  LUNGHEZZA_MASSIMA_PROGRAMMA,
  type GiornoAllenamento,
} from '@arco/shared'
import { useAtletaCorrente } from '../accesso/contesto'
import { useGiornoAllenamento } from '../allenamento/dati'
import { salvaGiorno, type CampiGiorno } from '../allenamento/scrittura'
import { Checkbox } from '../componenti/Checkbox'
import { Field } from '../componenti/Field'
import { PageHeader } from '../componenti/PageHeader'
import { Textarea } from '../componenti/Textarea'
import { oggi as oggiIn } from '../gare/dati'
import { useSincronizzazione } from '../sync/contesto'
import styles from './Allenamento.module.css'

const RE_GIORNO = /^\d{4}-\d{2}-\d{2}$/
/** Dopo l'ultima modifica si aspetta un attimo prima di inviare al server (non a ogni lettera). */
const ATTESA_INVIO_MS = 1500

/** Il giorno scelto: cosa fare, fatto, frecce libere e nota. Ogni modifica si salva subito sul telefono. */
function Modulo({ giorno, riga }: { giorno: string; riga: GiornoAllenamento | null }) {
  const io = useAtletaCorrente()
  const { db, modificato } = useSincronizzazione()
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

  // L'invio al server parte un attimo dopo l'ultima modifica, e comunque lasciando la pagina.
  const timer = useRef<number | null>(null)
  const inAttesa = useRef(false)
  const programmaInvio = () => {
    inAttesa.current = true
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      inAttesa.current = false
      modificato()
    }, ATTESA_INVIO_MS)
  }
  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current)
      if (inAttesa.current) modificato()
    },
    [modificato],
  )

  const salva = (campi: CampiGiorno) => {
    void salvaGiorno(db, io.id, giorno, campi).then(programmaInvio)
  }

  const totale = frecceDelGiorno({ frecce_libere: valoreFrecce ?? 0 })

  return (
    <>
      <PageHeader
        title={etichettaGiorno(giorno, annoCorrente)}
        back={{ label: 'Allenamento', href: `/allenamento?settimana=${inizioSettimana(giorno)}` }}
        description={totale > 0 ? `${totale} frecce` : undefined}
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
