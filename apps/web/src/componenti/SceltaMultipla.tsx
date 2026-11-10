import { ChevronDown } from 'lucide-react'
import { useId } from 'react'
import { Checkbox } from './Checkbox'
import { Icon } from './Icon'
import styles from './SceltaMultipla.module.css'

export interface OpzioneMultipla {
  valore: string
  etichetta: string
}

export interface SceltaMultiplaProps {
  /** Il nome della scelta, sempre visibile sopra la tendina ("Anni"). */
  label: string
  /** L'opzione "tutto" in cima (es. "Tutta la carriera"): spuntata, vale come tutte le altre insieme. */
  tutto: string
  opzioni: readonly OpzioneMultipla[]
  /** I valori scelti, oppure `'tutti'`. */
  scelti: readonly string[] | 'tutti'
  onChange(scelti: readonly string[] | 'tutti'): void
  /** Cosa è scelto, in breve, sul pulsante della tendina ("2025, 2026"). */
  riassunto: string
}

/**
 * Tendina a scelta multipla (UI Top: le scelte si vedono tutte insieme e la scelta attuale resta scritta sul
 * pulsante). Si apre con un tocco (elemento `details` del browser: funziona anche da tastiera e con i lettori di
 * schermo) e dentro ci sono caselle da spuntare. Togliendo l'ultima scelta si torna a "tutto": non resta mai vuota.
 */
export function SceltaMultipla({
  label,
  tutto,
  opzioni,
  scelti,
  onChange,
  riassunto,
}: SceltaMultiplaProps) {
  const etichettaId = useId()
  const attiva = (valore: string) => scelti !== 'tutti' && scelti.includes(valore)
  const cambia = (valore: string, spuntata: boolean) => {
    const attuali = scelti === 'tutti' ? [] : scelti
    const nuovi = spuntata ? [...attuali, valore] : attuali.filter((v) => v !== valore)
    onChange(nuovi.length === 0 ? 'tutti' : nuovi)
  }
  return (
    <div className={styles.campo}>
      <span id={etichettaId} className={`type-label ${styles.etichetta}`}>
        {label}
      </span>
      <details className={styles.tendina}>
        <summary className={styles.pulsante} aria-describedby={etichettaId}>
          <span>
            <span className="visually-hidden">{`${label}: `}</span>
            {riassunto}
          </span>
          <Icon icon={ChevronDown} className={styles.freccia} />
        </summary>
        <fieldset className={styles.elenco}>
          <legend className="visually-hidden">{label}</legend>
          <Checkbox
            label={tutto}
            checked={scelti === 'tutti'}
            onChange={(e) =>
              onChange(e.target.checked ? 'tutti' : opzioni[0] ? [opzioni[0].valore] : 'tutti')
            }
          />
          {opzioni.map((o) => (
            <Checkbox
              key={o.valore}
              label={o.etichetta}
              checked={attiva(o.valore)}
              onChange={(e) => cambia(o.valore, e.target.checked)}
            />
          ))}
        </fieldset>
      </details>
    </div>
  )
}
