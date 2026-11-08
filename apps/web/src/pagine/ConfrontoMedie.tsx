import { confrontoMedie, nomeDivisione, proveDiAtleta, type Simulazione } from '@arco/shared'
import { useSimulazioniAtleta } from '../allenamento/dati'
import { useClassificheDi, usePartecipazioniDi } from '../atleti/dati'
import { ListGroup, ListRow } from '../componenti/List'
import { useGare } from '../gare/dati'

/** "8,43": punti per freccia con due decimali e la virgola. */
const virgola = (media: number) => media.toFixed(2).replace('.', ',')

const unaDue = (n: number, una: string, piu: string) => `${n} ${n === 1 ? una : piu}`

/**
 * "Confronto con le gare" (Fase 6.3b): la media per freccia di questa simulazione, delle altre simulazioni dello
 * stesso tipo e delle ultime gare vere (stesso tipo di prova, un solo arco). Non c'è se non ci sono né altre
 * simulazioni né gare con cui confrontare. Tutto dai dati del telefono, anche offline.
 */
export function ConfrontoMedie({ simulazione: s }: { simulazione: Simulazione }) {
  const simulazioni = useSimulazioniAtleta()
  const partecipazioni = usePartecipazioniDi(s.atleta_id)
  const classifiche = useClassificheDi(s.atleta_id)
  const gare = useGare()
  if (
    simulazioni === undefined ||
    partecipazioni === undefined ||
    classifiche === undefined ||
    gare === undefined
  ) {
    return null
  }

  const prove = proveDiAtleta(s.atleta_id, partecipazioni, gare, classifiche)
  const righe = confrontoMedie(s, simulazioni, prove)
  if (!righe.some((r) => r.allenamento !== null || r.gare !== null)) return null

  const diverse = righe.length > 1
  return (
    <ListGroup title="Confronto con le gare">
      {righe.flatMap((r) => {
        const prefisso = diverse ? `${r.nome} · ` : ''
        return [
          r.questa !== null && (
            <ListRow
              key={`${r.nome}-questa`}
              label={`${prefisso}Questa simulazione`}
              value={virgola(r.questa)}
              description="Media per freccia"
            />
          ),
          r.allenamento && (
            <ListRow
              key={`${r.nome}-allenamento`}
              label={`${prefisso}Altre simulazioni`}
              value={virgola(r.allenamento.media)}
              description={`Media per freccia · ${unaDue(r.allenamento.quanti, 'simulazione conclusa', 'simulazioni concluse')}`}
            />
          ),
          r.gare && (
            <ListRow
              key={`${r.nome}-gare`}
              label={`${prefisso}Gare · ${nomeDivisione(r.gare.divisione)}`}
              value={virgola(r.gare.media)}
              description={`Media per freccia · ${r.gare.quanti === 1 ? 'ultima gara' : `ultime ${r.gare.quanti} gare`}`}
            />
          ),
        ].filter(Boolean)
      })}
    </ListGroup>
  )
}
