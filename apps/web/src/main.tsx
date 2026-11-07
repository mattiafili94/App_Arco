import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import './styles/tokens.css'
import './styles/base.css'
import { AccessoProvider } from './accesso/AccessoContext'
import { servizioPredefinito } from './accesso/servizioPredefinito'
import { App } from './App'

const radice = document.getElementById('root')
if (!radice) throw new Error('Elemento #root mancante in index.html')

createRoot(radice).render(
  <StrictMode>
    <BrowserRouter>
      <AccessoProvider servizio={servizioPredefinito}>
        <App />
      </AccessoProvider>
    </BrowserRouter>
  </StrictMode>,
)
