import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/tokens.css'
import './styles/base.css'
import { App } from './App'

const radice = document.getElementById('root')
if (!radice) throw new Error('Elemento #root mancante in index.html')

createRoot(radice).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
