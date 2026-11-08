import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import App from '@/App'
import { ExperienceLayer } from '@/components/effects/experience-layer'
import { initializePwa } from '@/lib/pwa'
import '@/index.css'

const root = document.getElementById('root')

if (!root) throw new Error('Elemento root non trovato.')

initializePwa()

createRoot(root).render(
  <StrictMode>
    <ExperienceLayer />
    <App />
  </StrictMode>,
)
