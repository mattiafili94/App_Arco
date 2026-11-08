import { EmptyState } from '../componenti/EmptyState'
import { PaginaTab } from './PaginaTab'

/*
 * I 4 tab, per ora con lo stato vuoto: dicono cosa conterranno e da dove arriveranno i dati.
 * Nessun pulsante finché l'azione non esiste davvero (UI Top: ogni controllo ha un effetto).
 */

export function Atleti() {
  return (
    <PaginaTab title="Atleti">
      <EmptyState
        title="Nessun atleta per ora"
        description="Qui troverai gli atleti della compagnia con storico, record e andamento. Ognuno comparirà dopo il suo primo accesso."
      />
    </PaginaTab>
  )
}

export function Classifica() {
  return (
    <PaginaTab title="Classifica">
      <EmptyState
        title="Classifica non ancora scaricata"
        description="Qui vedrai la posizione di ogni atleta nella classifica per l'ammissione ai Campionati Italiani, presa da Fitarco."
      />
    </PaginaTab>
  )
}

export function Allenamento() {
  return (
    <PaginaTab title="Allenamento">
      <EmptyState
        title="Nessun allenamento registrato"
        description="Qui scriverai il programma della settimana, il diario e i punteggi delle simulazioni. Questa parte la vedi solo tu."
      />
    </PaginaTab>
  )
}
