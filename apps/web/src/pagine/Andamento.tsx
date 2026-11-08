import { useId, useState } from 'react'
import { formattaDate, medieAnnuali, serieAndamento, type Gara, type ProvaGara } from '@arco/shared'
import { GraficoAndamento, type PuntoGrafico } from '../componenti/GraficoAndamento'
import { ListGroup, ListRow } from '../componenti/List'
import styles from './Andamento.module.css'

/**
 * Andamento di un atleta: scegli la prova (e l'arco), vedi i punteggi nel tempo e la media di ogni anno.
 * Non compare se nessuna prova ha almeno due punteggi. Per chi non vede il grafico c'è la tabella.
 */
export function Andamento({ prove, gare }: { prove: readonly ProvaGara[]; gare: readonly Gara[] }) {
  const titoloId = useId()
  const [sceltaId, setSceltaId] = useState<string | null>(null)
  const serie = serieAndamento(prove)
  if (serie.length === 0) return null

  const corrente = serie.find((s) => s.id === sceltaId) ?? serie[0]!
  const perGara = new Map(gare.map((g) => [g.codice, g]))
  const punti: PuntoGrafico[] = corrente.punti.map((p, i) => {
    const g = perGara.get(p.gara_codice)
    return {
      id: `${p.gara_codice}-${i}`,
      data: p.data,
      valore: p.totale,
      descrizione: `${g?.localita ?? p.gara_codice} · ${formattaDate(p.data, p.data)}`,
      provvisorio: p.provvisoria,
    }
  })
  const medie = medieAnnuali(corrente.punti)

  return (
    <section className={styles.sezione} aria-labelledby={titoloId}>
      <h2 id={titoloId} className={`type-label ${styles.titolo}`}>
        Andamento
      </h2>
      <div className={styles.riquadro}>
        {serie.length > 1 && (
          <div className={styles.scelte} role="radiogroup" aria-label="Prova e arco">
            {serie.map((s) => (
              <button
                key={s.id}
                type="button"
                role="radio"
                aria-checked={s.id === corrente.id}
                className={styles.scelta}
                onClick={() => setSceltaId(s.id)}
              >
                {s.etichetta}
              </button>
            ))}
          </div>
        )}
        {/* `key`: cambiando prova il punto scelto riparte dall'ultimo. */}
        <GraficoAndamento
          key={corrente.id}
          punti={punti}
          titolo={`Andamento ${corrente.etichetta}`}
        />
        <details className={styles.tabella}>
          <summary>Mostra come tabella</summary>
          <table>
            <caption className="visually-hidden">Punteggi {corrente.etichetta}</caption>
            <thead>
              <tr>
                <th scope="col">Data</th>
                <th scope="col">Gara</th>
                <th scope="col">Punti</th>
              </tr>
            </thead>
            <tbody>
              {corrente.punti.map((p, i) => (
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
      </div>
      <ListGroup title="Media per anno">
        {medie.map((m) => (
          <ListRow
            key={m.anno}
            label={String(m.anno)}
            value={String(m.media).replace('.', ',')}
            description={m.gare === 1 ? '1 gara' : `${m.gare} gare`}
          />
        ))}
      </ListGroup>
    </section>
  )
}
