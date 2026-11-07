import { TIPOLOGIE } from '@arco/shared'

/**
 * Pagina provvisoria: serve solo a verificare che la web app funzioni e che legga
 * il pacchetto condiviso. Verrà sostituita dallo scheletro con i 4 tab (passo 3),
 * dopo aver portato i token del design system "UI Top" (passo 2).
 */
export function App() {
  return (
    <main>
      <h1>Arcieri Eugubini</h1>
      <p>L'app è in costruzione. Tipologie di gara riconosciute:</p>
      <ul>
        {TIPOLOGIE.map((tipologia) => (
          <li key={tipologia.id}>{tipologia.etichetta}</li>
        ))}
      </ul>
    </main>
  )
}
