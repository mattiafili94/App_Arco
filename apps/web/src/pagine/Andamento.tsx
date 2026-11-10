import { useId, useState } from 'react'
import {
  anniDellaSerie,
  anniPredefiniti,
  descriviAnni,
  filtraPerAnni,
  formattaDate,
  type AnniScelti,
  type Gara,
  type ProvaGara,
} from '@arco/shared'
import { GraficoAndamento, type PuntoGrafico } from '../componenti/GraficoAndamento'
import { SceltaMultipla } from '../componenti/SceltaMultipla'
import { oggi as oggiIn } from '../gare/dati'
import styles from './Andamento.module.css'

/**
 * L'andamento di una prova con un arco: i punteggi nel tempo, con la scelta degli anni (tendina a scelta
 * multipla, di base l'anno in corso; "Tutta la carriera" li prende tutti). Per chi non vede il grafico c'è la
 * tabella con gli stessi punteggi. Non compare con meno di due punteggi in tutta la carriera.
 */
export function Andamento({
  punti: tutti,
  etichetta,
  gare,
}: {
  /** I punteggi della prova, in qualsiasi ordine. */
  punti: readonly ProvaGara[]
  /** "18 m · Ricurvo". */
  etichetta: string
  gare: readonly Gara[]
}) {
  const titoloId = useId()
  const anni = anniDellaSerie(tutti)
  const [scelti, setScelti] = useState<AnniScelti>(() => anniPredefiniti(anni, oggiIn()))
  if (tutti.length < 2) return null

  const perGara = new Map(gare.map((g) => [g.codice, g]))
  const visibili = filtraPerAnni(tutti, scelti).sort(
    (a, b) => a.data.localeCompare(b.data) || a.gara_codice.localeCompare(b.gara_codice),
  )
  const grafico: PuntoGrafico[] = visibili.map((p, i) => ({
    id: `${p.gara_codice}-${i}`,
    data: p.data,
    valore: p.totale,
    descrizione: `${perGara.get(p.gara_codice)?.localita ?? p.gara_codice} · ${formattaDate(p.data, p.data)}`,
    provvisorio: p.provvisoria,
  }))

  return (
    <section className={styles.sezione} aria-labelledby={titoloId}>
      <h2 id={titoloId} className={`type-label ${styles.titolo}`}>
        Andamento
      </h2>
      <div className={styles.riquadro}>
        <SceltaMultipla
          label="Anni"
          tutto="Tutta la carriera"
          opzioni={anni.map((a) => ({ valore: String(a), etichetta: String(a) }))}
          scelti={scelti === 'tutti' ? 'tutti' : scelti.map(String)}
          onChange={(v) => setScelti(v === 'tutti' ? 'tutti' : v.map(Number))}
          riassunto={descriviAnni(scelti)}
        />
        {grafico.length > 0 ? (
          // `key`: cambiando anni il punto scelto riparte dall'ultimo.
          <GraficoAndamento
            key={descriviAnni(scelti)}
            punti={grafico}
            titolo={`Andamento ${etichetta}, ${descriviAnni(scelti)}`}
          />
        ) : (
          <p className={styles.vuoto}>Nessun punteggio negli anni scelti.</p>
        )}
        {grafico.length > 0 && (
          <details className={styles.tabella}>
            <summary>Mostra come tabella</summary>
            <table>
              <caption className="visually-hidden">Punteggi {etichetta}</caption>
              <thead>
                <tr>
                  <th scope="col">Data</th>
                  <th scope="col">Gara</th>
                  <th scope="col">Punti</th>
                </tr>
              </thead>
              <tbody>
                {visibili.map((p, i) => (
                  <tr key={`${p.gara_codice}-${i}`}>
                    <td>{formattaDate(p.data, p.data)}</td>
                    <td>{perGara.get(p.gara_codice)?.localita ?? p.gara_codice}</td>
                    <td>
                      {p.totale}
                      {p.provvisoria ? ' (provvisorio)' : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        )}
      </div>
    </section>
  )
}
