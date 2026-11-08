import { EmptyState } from '../componenti/EmptyState'
import { PaginaTab } from './PaginaTab'

/*
 * I 4 tab, per ora con lo stato vuoto: dicono cosa conterranno e da dove arriveranno i dati.
 * Nessun pulsante finché l'azione non esiste davvero (UI Top: ogni controllo ha un effetto).
 */

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
