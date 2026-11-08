import { useState, type PointerEvent } from 'react'
import {
  anelli,
  arrotondaPosizione,
  limitaPosizione,
  valoreDaPosizione,
  type BersaglioConAnelli,
  type Posizione,
  type ValoreFreccia,
} from '@arco/shared'
import styles from './BersaglioTocco.module.css'

/** Un punto già segnato sul bersaglio. */
export interface PuntoSuBersaglio {
  posizione: Posizione
  /** Per i lettori di schermo: "Freccia 2 della volée 1: 9". */
  etichetta: string
  /** `volee`: la volée in corso (in evidenza); `prima`: le altre; `scelta`: la freccia da correggere. */
  stato: 'volee' | 'prima' | 'scelta'
}

export interface BersaglioToccoProps {
  bersaglio: BersaglioConAnelli
  compound: boolean
  punti: readonly PuntoSuBersaglio[]
  /** Chiamata quando si alza il dito: il punto e il valore che ha. Senza, il bersaglio è solo da guardare. */
  onSegna?: (posizione: Posizione, valore: ValoreFreccia) => void
  disabilitato?: boolean
  /** Il nome per i lettori di schermo. */
  etichetta: string
}

/** Il bersaglio si disegna da -MARGINE a +MARGINE: così si vedono anche le frecce appena fuori. */
const LATO = 2.5
const MEZZO = LATO / 2
/** La lente mostra una zona larga così (in unità del bersaglio): ingrandisce di LATO / ZONA_LENTE volte. */
const ZONA_LENTE = 0.4

/** La classe di colore di un anello, secondo i colori del bersaglio (token `target-*`). */
const classeAnello = (valore: ValoreFreccia): string => {
  if (valore === 'X' || valore === '10' || valore === '9') return styles.oro!
  if (valore === '8' || valore === '7') return styles.rosso!
  if (valore === '6' || valore === '5') return styles.blu!
  if (valore === '4' || valore === '3') return styles.nero!
  return styles.bianco!
}

/** Gli anelli (dal più grande al più piccolo, per sovrapporli bene). */
function Anelli({ bersaglio, compound }: { bersaglio: BersaglioConAnelli; compound: boolean }) {
  const lista = anelli(bersaglio, compound)
  return (
    <>
      {[...lista].reverse().map((a) => (
        <circle
          key={`${a.valore}-${a.raggio}`}
          r={a.raggio}
          className={`${styles.anello} ${classeAnello(a.valore)}`}
        />
      ))}
    </>
  )
}

function Punti({ punti, raggio }: { punti: readonly PuntoSuBersaglio[]; raggio: number }) {
  return (
    <>
      {punti.map((p, i) => (
        <circle
          key={i}
          cx={p.posizione[0]}
          cy={p.posizione[1]}
          r={raggio}
          className={`${styles.freccia} ${styles[p.stato]}`}
        >
          <title>{p.etichetta}</title>
        </circle>
      ))}
    </>
  )
}

/**
 * Il bersaglio da toccare (Fase 6.3a-2b). Si tiene premuto e si trascina: la **lente d'ingrandimento** sopra il
 * bersaglio mostra dove cadrebbe la freccia e che valore avrebbe; alzando il dito la freccia è segnata. Un tocco
 * veloce segna subito il punto toccato. L'area della lente è sempre riservata: il bersaglio non si sposta
 * mentre si tocca. Il tastierino resta l'alternativa (e l'unica per chi usa la tastiera).
 */
export function BersaglioTocco({
  bersaglio,
  compound,
  punti,
  onSegna,
  disabilitato = false,
  etichetta,
}: BersaglioToccoProps) {
  const [attivo, setAttivo] = useState<Posizione | null>(null)
  const attivabile = onSegna !== undefined && !disabilitato

  /** Dal punto dello schermo al punto sul bersaglio (normalizzato). */
  const dalloSchermo = (e: PointerEvent<SVGSVGElement>): Posizione => {
    const r = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - r.left) / (r.width || 1)) * LATO - MEZZO
    const y = ((e.clientY - r.top) / (r.height || 1)) * LATO - MEZZO
    return arrotondaPosizione(limitaPosizione([x, y]))
  }

  const alTocco = (e: PointerEvent<SVGSVGElement>) => {
    if (!attivabile) return
    // Il dito resta "agganciato" al bersaglio anche se esce un po' dal bordo.
    e.currentTarget.setPointerCapture?.(e.pointerId)
    setAttivo(dalloSchermo(e))
  }
  const alMovimento = (e: PointerEvent<SVGSVGElement>) => {
    if (attivo) setAttivo(dalloSchermo(e))
  }
  const alRilascio = (e: PointerEvent<SVGSVGElement>) => {
    if (!attivo) return
    const posizione = dalloSchermo(e)
    setAttivo(null)
    onSegna?.(posizione, valoreDaPosizione(bersaglio, compound, posizione))
  }

  const valoreAttivo = attivo ? valoreDaPosizione(bersaglio, compound, attivo) : null
  const lente = attivo
    ? `${attivo[0] - ZONA_LENTE / 2} ${attivo[1] - ZONA_LENTE / 2} ${ZONA_LENTE} ${ZONA_LENTE}`
    : null

  return (
    <div className={styles.contenitore}>
      {/* Area sempre riservata: la lente appare lì senza spostare il bersaglio. */}
      <div className={styles.lente} aria-live="polite">
        {lente && valoreAttivo ? (
          <>
            <svg
              className={styles.lenteSvg}
              viewBox={lente}
              role="img"
              aria-label="Lente d'ingrandimento"
              focusable="false"
            >
              <Anelli bersaglio={bersaglio} compound={compound} />
              <Punti punti={punti} raggio={0.012} />
              <circle cx={attivo![0]} cy={attivo![1]} r={0.008} className={styles.mirino} />
              <path
                className={styles.mirino}
                d={`M ${attivo![0] - 0.04} ${attivo![1]} H ${attivo![0] + 0.04} M ${attivo![0]} ${attivo![1] - 0.04} V ${attivo![1] + 0.04}`}
              />
            </svg>
            <p className={styles.valore}>
              <span className="visually-hidden">Valore: </span>
              {valoreAttivo}
            </p>
          </>
        ) : (
          <p className={`type-caption ${styles.aiuto}`}>
            {attivabile
              ? 'Tieni premuto sul bersaglio e trascina: la lente mostra dove cade la freccia. Alza il dito per segnarla.'
              : 'Bersaglio con le frecce segnate.'}
          </p>
        )}
      </div>
      <svg
        className={`${styles.bersaglio} ${attivabile ? styles.attivo : ''}`}
        viewBox={`${-MEZZO} ${-MEZZO} ${LATO} ${LATO}`}
        role="img"
        aria-label={etichetta}
        focusable="false"
        onPointerDown={alTocco}
        onPointerMove={alMovimento}
        onPointerUp={alRilascio}
        onPointerCancel={() => setAttivo(null)}
      >
        <Anelli bersaglio={bersaglio} compound={compound} />
        <Punti punti={punti} raggio={0.035} />
        {attivo && <circle cx={attivo[0]} cy={attivo[1]} r={0.03} className={styles.mirino} />}
      </svg>
    </div>
  )
}
