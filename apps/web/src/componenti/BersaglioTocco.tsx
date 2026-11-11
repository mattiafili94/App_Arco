import { useState, type CSSProperties, type PointerEvent } from 'react'
import {
  anelli,
  arrotondaPosizione,
  limitaPosizione,
  raggioMancata,
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

/**
 * Prima il bersaglio si disegnava in un quadrato da -1,25 a +1,25: gli anelli restano grandi come allora sullo
 * schermo (`LATO_PRIMA`), ma attorno c'è solo l'anello sottile della mancata (`raggioMancata`).
 */
const LATO_PRIMA = 2.5
/** Un po' di spazio oltre l'anello della mancata, per il bordo. */
const BORDO = 0.02
/** La lente mostra una zona larga così (in unità del bersaglio). */
const ZONA_LENTE = 0.4

/** La classe di colore di un anello, secondo i colori del bersaglio (token `target-*`). */
const classeAnello = (valore: ValoreFreccia): string => {
  if (valore === 'X' || valore === '10' || valore === '9') return styles.oro!
  if (valore === '8' || valore === '7') return styles.rosso!
  if (valore === '6' || valore === '5') return styles.blu!
  if (valore === '4' || valore === '3') return styles.nero!
  return styles.bianco!
}

/** L'anello della mancata e gli anelli che danno punti (dal più grande al più piccolo, per sovrapporli bene). */
function Anelli({
  bersaglio,
  compound,
  fuori,
}: {
  bersaglio: BersaglioConAnelli
  compound: boolean
  fuori: number
}) {
  const lista = anelli(bersaglio, compound)
  return (
    <>
      <circle r={fuori} className={styles.fuori} />
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

function Punti({
  punti,
  raggio,
  limite,
}: {
  punti: readonly PuntoSuBersaglio[]
  raggio: number
  /** I punti più lontani (segnati quando il bersaglio era un quadrato) si disegnano sul bordo. */
  limite: number
}) {
  return (
    <>
      {punti.map((p, i) => {
        const [x, y] = limitaPosizione(p.posizione, limite)
        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={raggio}
            className={`${styles.freccia} ${styles[p.stato]}`}
          >
            <title>{p.etichetta}</title>
          </circle>
        )
      })}
    </>
  )
}

/**
 * Il bersaglio da toccare (Fase 6.3a-2b). Si tiene premuto e si trascina: la **lente d'ingrandimento** sopra il
 * bersaglio mostra dove cadrebbe la freccia e che valore avrebbe; alzando il dito la freccia è segnata. Un tocco
 * veloce segna subito il punto toccato. L'area della lente è sempre riservata: il bersaglio non si sposta mentre
 * si tocca. Attorno agli anelli c'è solo l'**anello della mancata** (M): fuori da quel cerchio il tocco non segna
 * niente e la pagina si può scorrere (Mattia, 11/11/2026). Il tastierino resta l'alternativa (e l'unica per chi
 * usa la tastiera).
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
  const fuori = raggioMancata(bersaglio)
  const mezzo = fuori + BORDO
  const lato = mezzo * 2
  // Gli anelli restano grandi come prima: il disegno si stringe solo di quanto si è tolto attorno.
  const scala = { '--scala': lato / LATO_PRIMA } as CSSProperties

  /** Dal punto dello schermo al punto sul bersaglio (normalizzato), senza limiti. */
  const punto = (e: PointerEvent<SVGSVGElement>): Posizione => {
    const r = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - r.left) / (r.width || 1)) * lato - mezzo
    const y = ((e.clientY - r.top) / (r.height || 1)) * lato - mezzo
    return [x, y]
  }
  /** Il punto sul bersaglio, al massimo sul bordo dell'anello della mancata. */
  const dalloSchermo = (e: PointerEvent<SVGSVGElement>): Posizione =>
    arrotondaPosizione(limitaPosizione(punto(e), fuori))

  const alTocco = (e: PointerEvent<SVGSVGElement>) => {
    if (!attivabile) return
    // Fuori dall'anello della mancata il tocco non conta: si vuole scorrere la pagina.
    const [x, y] = punto(e)
    if (Math.hypot(x, y) > fuori) return
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
      {/* Area sempre riservata (solo se si può toccare): la lente appare lì senza spostare il bersaglio. */}
      {attivabile && (
        <div className={`${styles.lente} ${lente ? styles.lenteAperta : ''}`} aria-live="polite">
          {lente && valoreAttivo && (
            <>
              <svg
                className={styles.lenteSvg}
                viewBox={lente}
                role="img"
                aria-label="Lente d'ingrandimento"
                focusable="false"
              >
                <Anelli bersaglio={bersaglio} compound={compound} fuori={fuori} />
                <Punti punti={punti} raggio={0.012} limite={fuori} />
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
          )}
        </div>
      )}
      <svg
        className={`${styles.bersaglio} ${attivabile ? styles.attivo : ''}`}
        style={scala}
        viewBox={`${-mezzo} ${-mezzo} ${lato} ${lato}`}
        role="img"
        aria-label={etichetta}
        focusable="false"
        onPointerDown={alTocco}
        onPointerMove={alMovimento}
        onPointerUp={alRilascio}
        onPointerCancel={() => setAttivo(null)}
      >
        <Anelli bersaglio={bersaglio} compound={compound} fuori={fuori} />
        <Punti punti={punti} raggio={0.035} limite={fuori} />
        {attivo && <circle cx={attivo[0]} cy={attivo[1]} r={0.03} className={styles.mirino} />}
      </svg>
    </div>
  )
}
