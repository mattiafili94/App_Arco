import { useState } from 'react'
import { useNavigate } from 'react-router'
import {
  descriviGareRanking,
  descriviLettura,
  formattaPunti,
  NOMI_CLASSE,
  NOMI_GENERE,
  NOMI_TIPO,
  nomeDivisione,
  percorsoClassifica,
  titoloClassifica,
  DIVISIONI_RANKING,
  type FiltroClassifica,
} from '@arco/shared'
import { useAtletaCorrente } from '../accesso/contesto'
import { useMiePosizioni } from '../classifica/dati'
import { Button } from '../componenti/Button'
import { ListGroup, ListRow } from '../componenti/List'
import { Scelte } from '../componenti/Scelte'
import { Select } from '../componenti/Select'
import styles from './Classifica.module.css'
import { PaginaTab } from './PaginaTab'

const elenco = (nomi: Record<string, string>) =>
  Object.entries(nomi).map(([valore, etichetta]) => ({ valore, etichetta }))

const OPZIONI_ARCO = DIVISIONI_RANKING.map((d) => ({ valore: d, etichetta: nomeDivisione(d) }))
const OPZIONI_REGIONE = [
  { valore: 'italia', etichetta: 'Tutta Italia' },
  { valore: 'umbria', etichetta: 'Umbria' },
]

/** Cosa si cerca se non c'è ancora una tua classifica: la più comune per la compagnia. */
const PREDEFINITO: FiltroClassifica = { tipo: 'I', divisione: 'OL', classe: 'S', genere: 'M' }

/**
 * Tab Classifica: in primo piano la tua posizione, poi la ricerca di qualsiasi classifica con i filtri
 * del sito Fitarco (tipo di gara, arco, classe, genere, regione). Cercare legge solo il nostro database.
 */
export function Classifica() {
  const io = useAtletaCorrente()
  const { posizioni } = useMiePosizioni(io.matricola)
  const navigate = useNavigate()
  const [scelta, setScelta] = useState<Partial<FiltroClassifica> & { regione?: string }>({})

  const iniziale: FiltroClassifica = posizioni?.[0] ?? PREDEFINITO
  const filtro: FiltroClassifica = {
    tipo: scelta.tipo ?? iniziale.tipo,
    divisione: scelta.divisione ?? iniziale.divisione,
    classe: scelta.classe ?? iniziale.classe,
    genere: scelta.genere ?? iniziale.genere,
  }
  const regione = scelta.regione ?? 'italia'
  const piu = (campo: keyof FiltroClassifica) => (valore: string) =>
    setScelta((s) => ({ ...s, [campo]: valore }))

  const vai = (f: FiltroClassifica, ricerca = '') => navigate(`${percorsoClassifica(f)}${ricerca}`)
  const ultimaLettura = posizioni
    ?.map((p) => p.letta_il)
    .sort()
    .at(-1)

  return (
    <PaginaTab title="Classifica">
      <div className={styles.gruppi}>
        {posizioni !== undefined && (
          <div className={styles.sezione}>
            <ListGroup title="La tua posizione">
              {posizioni.length > 0 ? (
                posizioni.map((p) => (
                  <ListRow
                    key={`${p.tipo}${p.divisione}${p.classe}${p.genere}`}
                    label={titoloClassifica(p)}
                    value={`${p.riga.posizione}°`}
                    description={`${formattaPunti(p.riga.punti)} punti · ${descriviGareRanking(p.riga)}`}
                    href={`${percorsoClassifica(p)}?mia=1`}
                  />
                ))
              ) : (
                <ListRow
                  label="Non compari ancora in nessuna classifica"
                  description="Le classifiche si scaricano ogni lunedì alle 10. Intanto puoi cercarne una qui sotto."
                />
              )}
            </ListGroup>
            {ultimaLettura && (
              <p className={`type-caption ${styles.nota}`}>
                Dati letti da Fitarco {descriviLettura(ultimaLettura)}.
              </p>
            )}
          </div>
        )}

        <section className={styles.sezione} aria-labelledby="cerca-classifica">
          <h2 id="cerca-classifica" className={`type-label ${styles.titolo}`}>
            Cerca una classifica
          </h2>
          <form
            className={styles.modulo}
            onSubmit={(e) => {
              e.preventDefault()
              vai(filtro, regione === 'umbria' ? '?regione=umbria' : '')
            }}
          >
            <Select
              label="Tipo di gara"
              opzioni={elenco(NOMI_TIPO)}
              valore={filtro.tipo}
              onChange={piu('tipo')}
            />
            <Select
              label="Arco"
              opzioni={OPZIONI_ARCO}
              valore={filtro.divisione}
              onChange={piu('divisione')}
            />
            <Select
              label="Classe"
              opzioni={elenco(NOMI_CLASSE)}
              valore={filtro.classe}
              onChange={piu('classe')}
            />
            <Select
              label="Genere"
              opzioni={elenco(NOMI_GENERE)}
              valore={filtro.genere}
              onChange={piu('genere')}
            />
            <Scelte
              label="Regione"
              opzioni={OPZIONI_REGIONE}
              valore={regione}
              onChange={(r) => setScelta((s) => ({ ...s, regione: r }))}
            />
            <Button type="submit" variant="primary">
              Mostra
            </Button>
          </form>
        </section>
      </div>
    </PaginaTab>
  )
}
