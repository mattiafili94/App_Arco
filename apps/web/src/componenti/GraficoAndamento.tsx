import { useState } from 'react'
import { assePunteggi, formattaDate } from '@arco/shared'
import styles from './GraficoAndamento.module.css'

export interface PuntoGrafico {
  id: string
  /** "AAAA-MM-GG". */
  data: string
  valore: number
  /** Cosa dice il punto quando lo si sceglie: "Gubbio (PG) · 12 gen 2026". */
  descrizione: string
  /** Il risultato non è ancora definitivo: il punto è vuoto. */
  provvisorio: boolean
}

export interface GraficoAndamentoProps {
  punti: readonly PuntoGrafico[]
  /** Per i lettori di schermo: cosa mostra il grafico ("Andamento 18 m · Ricurvo"). */
  titolo: string
}

const LARGHEZZA = 320
const ALTEZZA = 200
const MARGINI = { sinistra: 40, destra: 16, alto: 20, basso: 30 }

/**
 * Grafico a linea di una sola serie (UI Top: un solo asse). Ogni punto si sceglie con il tocco o con la
 * tastiera e la sua descrizione compare sotto il grafico. Il colore della linea non è l'unico
 * indizio: i punti provvisori sono vuoti e l'ultimo valore è scritto sul grafico.
 */
export function GraficoAndamento({ punti, titolo }: GraficoAndamentoProps) {
  const [scelto, setScelto] = useState<string | null>(null)
  const selezionato = punti.find((p) => p.id === scelto) ?? punti.at(-1)!

  const { min, max, tacche } = assePunteggi(punti.map((p) => p.valore))
  const tempi = punti.map((p) => Date.parse(p.data))
  const primo = Math.min(...tempi)
  const ultimo = Math.max(...tempi)
  const larghezzaUtile = LARGHEZZA - MARGINI.sinistra - MARGINI.destra
  const altezzaUtile = ALTEZZA - MARGINI.alto - MARGINI.basso
  const x = (data: string) =>
    MARGINI.sinistra +
    (ultimo === primo
      ? larghezzaUtile / 2
      : ((Date.parse(data) - primo) / (ultimo - primo)) * larghezzaUtile)
  const y = (valore: number) => MARGINI.alto + (1 - (valore - min) / (max - min)) * altezzaUtile

  const ultimoPunto = punti.at(-1)!
  const etichettaPunto = (p: PuntoGrafico) =>
    `${p.valore} punti, ${p.descrizione}${p.provvisorio ? ', provvisorio' : ''}`

  return (
    <figure className={styles.figura}>
      <svg
        className={styles.svg}
        viewBox={`0 0 ${LARGHEZZA} ${ALTEZZA}`}
        role="group"
        aria-label={titolo}
      >
        {tacche.map((t) => (
          <g key={t}>
            <line
              className={styles.griglia}
              x1={MARGINI.sinistra}
              x2={LARGHEZZA - MARGINI.destra}
              y1={y(t)}
              y2={y(t)}
            />
            <text
              className={styles.asse}
              x={MARGINI.sinistra - 6}
              y={y(t)}
              textAnchor="end"
              dy="0.32em"
            >
              {t}
            </text>
          </g>
        ))}
        <text className={styles.asse} x={MARGINI.sinistra} y={ALTEZZA - 8} textAnchor="start">
          {formattaDate(punti[0]!.data, punti[0]!.data)}
        </text>
        {ultimo !== primo && (
          <text
            className={styles.asse}
            x={LARGHEZZA - MARGINI.destra}
            y={ALTEZZA - 8}
            textAnchor="end"
          >
            {formattaDate(ultimoPunto.data, ultimoPunto.data)}
          </text>
        )}

        <polyline
          className={styles.linea}
          points={punti.map((p) => `${x(p.data)},${y(p.valore)}`).join(' ')}
        />
        {punti.map((p) => (
          <circle
            key={p.id}
            className={p.provvisorio ? styles.puntoVuoto : styles.punto}
            cx={x(p.data)}
            cy={y(p.valore)}
            r={p.id === selezionato.id ? 7 : 5}
          />
        ))}
        {/* Il valore dell'ultimo punto, scritto sul grafico (non solo il colore o il tooltip). */}
        <text
          className={styles.valore}
          x={Math.min(x(ultimoPunto.data), LARGHEZZA - MARGINI.destra - 8)}
          y={y(ultimoPunto.valore) - 12}
          textAnchor="middle"
        >
          {ultimoPunto.valore}
        </text>
        {/* Aree di tocco più grandi dei punti (almeno 28 px), raggiungibili con la tastiera. */}
        {punti.map((p) => (
          <circle
            key={`tocco-${p.id}`}
            className={styles.tocco}
            cx={x(p.data)}
            cy={y(p.valore)}
            r={14}
            role="button"
            tabIndex={0}
            aria-label={etichettaPunto(p)}
            aria-pressed={p.id === selezionato.id}
            onClick={() => setScelto(p.id)}
            onFocus={() => setScelto(p.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                setScelto(p.id)
              }
            }}
          />
        ))}
      </svg>
      <figcaption className={`type-caption ${styles.didascalia}`} aria-live="polite">
        <strong>{selezionato.valore}</strong> · {selezionato.descrizione}
        {selezionato.provvisorio ? ' · provvisorio' : ''}
      </figcaption>
    </figure>
  )
}
