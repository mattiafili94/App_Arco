import { Navigate, Route, Routes } from 'react-router'
import { useAccesso } from './accesso/contesto'
import { Accedi } from './pagine/Accedi'
import { Allenamento } from './pagine/Allenamento'
import { Amministrazione } from './pagine/Amministrazione'
import { Atleti } from './pagine/Atleti'
import { Classifica } from './pagine/Classifica'
import { ClassificaCompleta } from './pagine/ClassificaCompleta'
import { Benvenuto } from './pagine/Benvenuto'
import { DettaglioAtleta } from './pagine/DettaglioAtleta'
import { DettaglioGara } from './pagine/DettaglioGara'
import { Risultati } from './pagine/Risultati'
import { GareAtleta, ProvaAtleta, SchedaAtleta } from './pagine/SchedaAtleta'
import { SimulazionePagina } from './pagine/SimulazionePagina'
import { Gare } from './pagine/Gare'
import {
  GiornoSeguito,
  MieiAtleti,
  SettimanaSeguito,
  SimulazioneSeguito,
} from './pagine/MieiAtleti'
import { CalendarioAnno, StoricoGare } from './pagine/ElenchiGare'
import { GiornoAllenamentoPagina } from './pagine/GiornoAllenamento'
import { Impostazioni } from './pagine/Impostazioni'
import { NuovaSimulazionePagina } from './pagine/NuovaSimulazione'
import { PaginaSemplice } from './pagine/PaginaSemplice'
import { Sincronizzazione } from './sync/Sincronizzazione'
import { Shell } from './Shell'

/**
 * Le pagine dell'app. Chi non ha fatto l'accesso vede solo la pagina Accedi (qualunque sia
 * l'indirizzo); chi è membro vede i tab. Un indirizzo sconosciuto porta alle Gare.
 */
export function App() {
  const { stato } = useAccesso()

  // All'avvio la sessione si legge dal telefono in un attimo: niente da mostrare nel frattempo.
  if (stato.tipo === 'caricamento') return null

  if (stato.tipo === 'ospite') {
    return (
      <PaginaSemplice>
        <Accedi />
      </PaginaSemplice>
    )
  }

  return (
    <Sincronizzazione>
      <Routes>
        <Route element={<Shell />}>
          <Route index element={<Navigate to="/gare" replace />} />
          <Route path="gare" element={<Gare />} />
          <Route path="gare/calendario/:anno" element={<CalendarioAnno />} />
          <Route path="gare/storico" element={<StoricoGare />} />
          <Route path="gare/:codice" element={<DettaglioGara />} />
          <Route path="gare/:codice/risultati" element={<Risultati />} />
          <Route path="atleti" element={<Atleti />} />
          <Route path="atleti/:id" element={<SchedaAtleta />} />
          <Route path="atleti/:id/prova/:serie" element={<ProvaAtleta />} />
          <Route path="atleti/:id/gare" element={<GareAtleta />} />
          <Route path="classifica" element={<Classifica />} />
          <Route
            path="classifica/:tipo/:divisione/:classe/:genere"
            element={<ClassificaCompleta />}
          />
          <Route path="allenamento" element={<Allenamento />} />
          <Route path="allenamento/:giorno" element={<GiornoAllenamentoPagina />} />
          <Route path="allenamento/:giorno/nuova" element={<NuovaSimulazionePagina />} />
          <Route path="allenamento/:giorno/simulazione/:id" element={<SimulazionePagina />} />
          <Route path="allenatore" element={<MieiAtleti />} />
          <Route path="allenatore/:atleta" element={<SettimanaSeguito />} />
          <Route path="allenatore/:atleta/:giorno" element={<GiornoSeguito />} />
          <Route
            path="allenatore/:atleta/:giorno/simulazione/:id"
            element={<SimulazioneSeguito />}
          />
          <Route path="impostazioni" element={<Impostazioni />} />
          <Route path="amministrazione" element={<Amministrazione />} />
          <Route path="amministrazione/atleti/:id" element={<DettaglioAtleta />} />
          <Route path="accesso" element={<Benvenuto />} />
          <Route path="*" element={<Navigate to="/gare" replace />} />
        </Route>
      </Routes>
    </Sincronizzazione>
  )
}
