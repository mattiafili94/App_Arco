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
import { useNomiAtleti } from '../allenatore/dati'
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

/** Le simulazioni di gara del giorno e, per l'atleta, il pulsante per iniziarne una nuova. */
function ElencoSimulazioni({
  giorno,
  simulazioni,
  base,
  allenatore,
}: {
  giorno: string
  simulazioni: Simulazione[]
  base: string
  allenatore: boolean
}) {
  const vai = useNavigate()
  return (
    <div className={styles.simulazioni}>
      <ListGroup title="Simulazioni di gara">
        {simulazioni.length === 0 ? (
          <ListRow
            label="Nessuna simulazione"
            description={
              allenatore
                ? 'In questo giorno l’atleta non ha tirato simulazioni di gara.'
                : 'Tira una gara in allenamento e segna le frecce: si sommano alle frecce del giorno.'
            }
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
                href={`${base}/${giorno}/simulazione/${s.id}`}
              />
            )
          })
        )}
      </ListGroup>
      {!allenatore && (
        <Button variant="primary" onClick={() => vai(`${base}/${giorno}/nuova`)}>
          Nuova simulazione
        </Button>
      )}
    </div>
  )
}

/** "Ultima modifica: tu", "… dall'atleta", "… da Mattia Rossi (allenatore)". */
function descriviAutore(
  riga: GiornoAllenamento | null,
  io: string,
  nomi: ReadonlyMap<string, string> | undefined,
): string | null {
  const da = riga?.programma_modificato_da
  if (!riga || riga.programma.trim() === '' || !da) return null
  if (da === io) return 'Programma scritto da te.'
  if (da === riga.atleta_id) return 'Programma scritto dall’atleta.'
  return `Programma scritto da ${nomi?.get(da) ?? 'un allenatore'} (allenatore).`
}

/**
 * Il giorno scelto: cosa fare, fatto, frecce libere e nota. Ogni modifica si salva subito sul telefono.
 * L'allenatore scrive solo il programma: il resto lo vede come l'ha segnato l'atleta.
 */
function Modulo({
  atletaId,
  giorno,
  riga,
  base,
  allenatore,
  indietro,
}: {
  atletaId: string
  giorno: string
  riga: GiornoAllenamento | null
  base: string
  allenatore: boolean
  indietro: string
}) {
  const io = useAtletaCorrente()
  const { db } = useSincronizzazione()
  const nomi = useNomiAtleti()
  const [programma, setProgramma] = useState(riga?.programma ?? '')
  const [nota, setNota] = useState(riga?.nota ?? '')
  const [fatto, setFatto] = useState(riga?.fatto ?? false)
  const [frecce, setFrecce] = useState(riga ? String(riga.frecce_libere) : '')
  const daInviare = (riga as unknown as { da_inviare?: number } | null)?.da_inviare === 1
  // Quando i dati arrivano (o cambiano) dal server e sul telefono non ci sono modifiche in sospeso, il modulo
  // li adotta: si aggiorna per esempio se la pagina si apre prima della sincronizzazione, o se l'altro (atleta o
  // allenatore) ha cambiato qualcosa.
  const versione = riga ? `${riga.modificato_il}|${riga.programma_modificato_il ?? ''}` : null
  const [adottata, setAdottata] = useState<string | null>(null)
  if (riga && !daInviare && versione !== adottata) {
    setAdottata(versione)
    setProgramma(riga.programma)
    setNota(riga.nota)
    setFatto(riga.fatto)
    setFrecce(String(riga.frecce_libere))
  }
  const valoreFrecce = leggiFrecce(frecce)
  const annoCorrente = Number(oggiIn().slice(0, 4))

  const programmaInvio = useInvioDifferito()

  const salva = (campi: CampiGiorno) => {
    void salvaGiorno(db, atletaId, giorno, campi, new Date(), io.id).then(programmaInvio)
  }

  const simulazioni = useSimulazioniGiorno(giorno, atletaId)
  const frecceSimulazioni = frecceDelleSimulazioni(simulazioni ?? []).reduce(
    (t, x) => t + x.frecce,
    0,
  )
  const totale = frecceDelGiorno({ frecce_libere: valoreFrecce ?? 0 }, frecceSimulazioni)
  const autore = descriviAutore(riga, io.id, nomi)

  return (
    <>
      <PageHeader
        title={etichettaGiorno(giorno, annoCorrente)}
        back={{ label: indietro, href: `${base}?settimana=${inizioSettimana(giorno)}` }}
        description={totale > 0 ? `${totale} frecce in tutto` : undefined}
      />
      <div className={styles.modulo}>
        <Textarea
          label={allenatore ? 'Programma' : 'Cosa devo fare'}
          hint={
            allenatore
              ? 'Cosa deve fare l’atleta in questo giorno. Lo vede subito, e lo può cambiare anche lui.'
              : "Il programma di questo giorno, come te l'ha dato l'allenatore o come lo hai pensato."
          }
          rows={5}
          maxLength={LUNGHEZZA_MASSIMA_PROGRAMMA}
          value={programma}
          onChange={(e) => {
            setProgramma(e.target.value)
            salva({ programma: e.target.value })
          }}
        />
        {autore && <p className={`type-caption ${styles.autore}`}>{autore}</p>}
        {allenatore ? (
          <ListGroup title="Segnato dall’atleta">
            <ListRow label="Fatto" value={fatto ? 'Sì' : 'No'} />
            <ListRow label="Frecce tirate" value={String(riga?.frecce_libere ?? 0)} />
            <ListRow label="Note" description={nota.trim() === '' ? 'Nessuna nota' : nota} />
          </ListGroup>
        ) : (
          <>
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
          </>
        )}
        <p className={`type-caption ${styles.stato}`} aria-live="polite">
          {riga === null
            ? 'Scrivi qui sopra: si salva da solo.'
            : daInviare
              ? 'Salvato sul telefono. Si invia al server appena c’è la rete.'
              : 'Salvato.'}
        </p>
      </div>
      {simulazioni !== undefined && (
        <ElencoSimulazioni
          giorno={giorno}
          simulazioni={simulazioni}
          base={base}
          allenatore={allenatore}
        />
      )}
    </>
  )
}

/**
 * Un giorno di allenamento di un atleta. L'usano l'atleta (`/allenamento/AAAA-MM-GG`) e il suo allenatore
 * (`/allenatore/:atleta/AAAA-MM-GG`).
 */
export function GiornoAllenamento({
  atletaId,
  base,
  allenatore,
  indietro,
}: {
  atletaId: string
  base: string
  allenatore: boolean
  /** Il nome della pagina della settimana (per la freccia indietro). */
  indietro: string
}) {
  const { giorno = '' } = useParams()
  const valido = RE_GIORNO.test(giorno) && !Number.isNaN(Date.parse(giorno))
  const riga = useGiornoAllenamento(valido ? giorno : '1970-01-01', atletaId)
  if (!valido) return <Navigate to={base} replace />
  if (riga === undefined) {
    return <PageHeader title="Giorno" back={{ label: indietro, href: base }} />
  }
  // `key`: cambiando giorno il modulo riparte dai dati di quel giorno.
  return (
    <Modulo
      key={`${atletaId}|${giorno}`}
      atletaId={atletaId}
      giorno={giorno}
      riga={riga}
      base={base}
      allenatore={allenatore}
      indietro={indietro}
    />
  )
}

/** Un giorno di allenamento dell'atleta collegato (`/allenamento/AAAA-MM-GG`). */
export function GiornoAllenamentoPagina() {
  const io = useAtletaCorrente()
  return (
    <GiornoAllenamento
      atletaId={io.id}
      base="/allenamento"
      allenatore={false}
      indietro="Allenamento"
    />
  )
}
