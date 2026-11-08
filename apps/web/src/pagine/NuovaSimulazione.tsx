import { useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router'
import {
  bersagliAmmessi,
  DISTANZE_OUTDOOR,
  eIndoor,
  ETICHETTE_BERSAGLIO,
  ETICHETTE_FORMATO,
  etichettaGiorno,
  FORMATI,
  frecceTotaliSimulazione,
  proveDelFormato,
  type Bersaglio,
  type DistanzaOutdoor,
  type FormatoSimulazione,
} from '@arco/shared'
import { useAtletaCorrente } from '../accesso/contesto'
import { useInvioDifferito } from '../allenamento/invioDifferito'
import { creaSimulazione } from '../allenamento/simulazioni'
import { Button } from '../componenti/Button'
import { PageHeader } from '../componenti/PageHeader'
import { Scelte } from '../componenti/Scelte'
import { Select } from '../componenti/Select'
import { oggi as oggiIn } from '../gare/dati'
import { useSincronizzazione } from '../sync/contesto'
import styles from './Allenamento.module.css'

const RE_GIORNO = /^\d{4}-\d{2}-\d{2}$/

const OPZIONI_FORMATO = FORMATI.map((f) => ({ valore: f, etichetta: ETICHETTE_FORMATO[f] }))
const OPZIONI_DISTANZA = DISTANZE_OUTDOOR.map((d) => ({ valore: String(d), etichetta: `${d} m` }))

/** "60 frecce: 20 volée da 3, in due parziali da 30." */
function descriviStruttura(formato: FormatoSimulazione, distanza: DistanzaOutdoor): string {
  const prove = proveDelFormato(formato, distanza)
  const p = prove[0]!
  const volee = p.frecceTotali / p.frecceVolee
  const una = `${volee} volée da ${p.frecceVolee} frecce, in due parziali da ${p.frecceParziale}`
  return prove.length === 1
    ? `${frecceTotaliSimulazione({ formato, distanza })} frecce: ${una}.`
    : `${frecceTotaliSimulazione({ formato, distanza })} frecce in ${prove.length} prove (${prove.map((x) => `${x.distanza} m`).join(' e ')}), ognuna da ${una}.`
}

function Modulo({ giorno }: { giorno: string }) {
  const io = useAtletaCorrente()
  const { db } = useSincronizzazione()
  const vai = useNavigate()
  const programmaInvio = useInvioDifferito()
  const [formato, setFormato] = useState<FormatoSimulazione>('18m')
  const [distanza, setDistanza] = useState<DistanzaOutdoor>(70)
  const [scelto, setScelto] = useState<Bersaglio | null>(null)
  const [inCorso, setInCorso] = useState(false)
  const annoCorrente = Number(oggiIn().slice(0, 4))

  // Cambiando gara, se il bersaglio scelto non esiste per quella gara si torna al primo.
  const ammessi = bersagliAmmessi(formato)
  const bersaglio = scelto && ammessi.includes(scelto) ? scelto : ammessi[0]!

  const inizia = async () => {
    setInCorso(true)
    const s = await creaSimulazione(db, io.id, giorno, {
      formato,
      distanza: eIndoor(formato) ? null : distanza,
      bersaglio,
    })
    programmaInvio()
    vai(`/allenamento/${giorno}/simulazione/${s.id}`, { replace: true })
  }

  return (
    <>
      <PageHeader
        title="Nuova simulazione"
        back={{
          label: etichettaGiorno(giorno, annoCorrente),
          href: `/allenamento/${giorno}`,
        }}
        description={`Per ${etichettaGiorno(giorno, annoCorrente)}`}
      />
      <div className={styles.modulo}>
        <Select
          label="Gara"
          opzioni={OPZIONI_FORMATO}
          valore={formato}
          onChange={(v) => setFormato(v as FormatoSimulazione)}
        />
        {!eIndoor(formato) && (
          <Scelte
            label="Distanza"
            opzioni={OPZIONI_DISTANZA}
            valore={String(distanza)}
            onChange={(v) => setDistanza(Number(v) as DistanzaOutdoor)}
          />
        )}
        <Scelte
          label="Bersaglio"
          opzioni={ammessi.map((b) => ({ valore: b, etichetta: ETICHETTE_BERSAGLIO[b] }))}
          valore={bersaglio}
          onChange={(v) => setScelto(v as Bersaglio)}
        />
        <p className={`type-caption ${styles.stato}`}>{descriviStruttura(formato, distanza)}</p>
        <Button variant="primary" loading={inCorso} onClick={() => void inizia()}>
          Inizia
        </Button>
      </div>
    </>
  )
}

/** Sceglie gara, distanza e bersaglio di una nuova simulazione (`/allenamento/AAAA-MM-GG/nuova`). */
export function NuovaSimulazionePagina() {
  const { giorno = '' } = useParams()
  if (!RE_GIORNO.test(giorno) || Number.isNaN(Date.parse(giorno))) {
    return <Navigate to="/allenamento" replace />
  }
  return <Modulo key={giorno} giorno={giorno} />
}
