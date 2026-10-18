import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

if (import.meta.env.DEV) {
  void Promise.all([import('./core/ai'), import('./core/engine')]).then(([ai, engine]) => {
    ;(window as unknown as Record<string, unknown>).__gdDebug = { aiMove: ai.aiMove, legalMoves: engine.legalMoves }
  })
}

const root = document.getElementById('root')!
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
