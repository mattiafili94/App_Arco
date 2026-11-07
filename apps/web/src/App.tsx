import { Navigate, Route, Routes } from 'react-router'
import { Impostazioni } from './pagine/Impostazioni'
import { Allenamento, Atleti, Classifica, Gare } from './pagine/Tab'
import { Shell } from './Shell'

/** Le pagine dell'app. Qualsiasi indirizzo sconosciuto porta alle Gare. */
export function App() {
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route index element={<Navigate to="/gare" replace />} />
        <Route path="gare" element={<Gare />} />
        <Route path="atleti" element={<Atleti />} />
        <Route path="classifica" element={<Classifica />} />
        <Route path="allenamento" element={<Allenamento />} />
        <Route path="impostazioni" element={<Impostazioni />} />
        <Route path="*" element={<Navigate to="/gare" replace />} />
      </Route>
    </Routes>
  )
}
