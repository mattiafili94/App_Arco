import { Navigate, Route, Routes } from 'react-router'
import { useAccesso } from './accesso/contesto'
import { Accedi } from './pagine/Accedi'
import { Amministrazione } from './pagine/Amministrazione'
import { Atleti } from './pagine/Atleti'
import { Benvenuto } from './pagine/Benvenuto'
import { DettaglioAtleta } from './pagine/DettaglioAtleta'
import { DettaglioGara } from './pagine/DettaglioGara'
import { Risultati } from './pagine/Risultati'
import { SchedaAtleta } from './pagine/SchedaAtleta'
import { Gare } from './pagine/Gare'
import { Impostazioni } from './pagine/Impostazioni'
import { PaginaSemplice } from './pagine/PaginaSemplice'
import { Allenamento, Classifica } from './pagine/Tab'
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
          <Route path="gare/:codice" element={<DettaglioGara />} />
          <Route path="gare/:codice/risultati" element={<Risultati />} />
          <Route path="atleti" element={<Atleti />} />
          <Route path="atleti/:id" element={<SchedaAtleta />} />
          <Route path="classifica" element={<Classifica />} />
          <Route path="allenamento" element={<Allenamento />} />
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
