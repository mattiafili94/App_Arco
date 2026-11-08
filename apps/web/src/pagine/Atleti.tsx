import { Users } from 'lucide-react'
import {
  formattaDate,
  nomeDivisione,
  storicoAtleta,
  ultimaGara,
  type Gara,
  type Partecipazione,
} from '@arco/shared'
import { useAtletaCorrente } from '../accesso/contesto'
import { nomeAtleta, useAtleti, usePartecipazioni } from '../atleti/dati'
import { EmptyState } from '../componenti/EmptyState'
import { ListGroup, ListRow } from '../componenti/List'
import { oggi as oggiIn, useGare } from '../gare/dati'
import { PaginaTab } from './PaginaTab'

/** "Ricurvo · ultima gara 2 nov": l'arco dell'ultima gara e quando è stata. */
function descrizione(
  atletaId: string,
  partecipazioni: Partecipazione[],
  gare: Gara[],
  oggi: string,
  annoCorrente: number,
): string | undefined {
  const storico = storicoAtleta(atletaId, partecipazioni, gare)
  const ultima = ultimaGara(storico, oggi)
  if (!ultima) return undefined
  const riga = storico.find((r) => r.gara.codice === ultima.codice)!
  return `${nomeDivisione(riga.divisione)} · ultima gara ${formattaDate(ultima.dal, ultima.al, annoCorrente)}`
}

/**
 * Tab Atleti: i membri della compagnia con l'accesso (anche chi non è ancora entrato), tu in cima.
 * Ogni riga porta alla scheda con record, andamento e storico. Tutto dai dati sul telefono.
 */
export function Atleti() {
  const io = useAtletaCorrente()
  const atleti = useAtleti()
  const partecipazioni = usePartecipazioni()
  const gare = useGare()
  const oggi = oggiIn()

  if (atleti === undefined || partecipazioni === undefined || gare === undefined) {
    return <PaginaTab title="Atleti">{null}</PaginaTab>
  }

  if (atleti.length === 0) {
    return (
      <PaginaTab title="Atleti">
        <EmptyState
          icon={Users}
          title="Nessun atleta per ora"
          description="Qui trovi gli atleti della compagnia con record e storico. Compaiono quando l'amministratore genera il loro link di accesso: i dati arrivano con il primo aggiornamento."
        />
      </PaginaTab>
    )
  }

  const annoCorrente = Number(oggi.slice(0, 4))
  const ordinati = [...atleti].sort(
    (a, b) =>
      Number(b.id === io.id) - Number(a.id === io.id) ||
      a.cognome.localeCompare(b.cognome, 'it') ||
      a.nome.localeCompare(b.nome, 'it'),
  )

  return (
    <PaginaTab title="Atleti">
      <ListGroup title="Compagnia">
        {ordinati.map((a) => (
          <ListRow
            key={a.id}
            label={nomeAtleta(a)}
            value={a.id === io.id ? 'Tu' : undefined}
            description={descrizione(a.id, partecipazioni, gare, oggi, annoCorrente)}
            href={`/atleti/${a.id}`}
          />
        ))}
      </ListGroup>
    </PaginaTab>
  )
}
