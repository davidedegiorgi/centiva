import { lazy, StrictMode, Suspense, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'

import App from '@/App'
import { initializePwa } from '@/lib/pwa'
import '@/index.css'

const ExperienceLayer = lazy(async () => ({ default: (await import('@/components/effects/experience-layer')).ExperienceLayer }))

function DeferredExperienceLayer() {
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    const canRenderWebGl = window.matchMedia('(pointer: fine)').matches
      && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!canRenderWebGl) return

    const timer = window.setTimeout(() => setEnabled(true), 1200)
    return () => window.clearTimeout(timer)
  }, [])

  return enabled ? <Suspense fallback={null}><ExperienceLayer /></Suspense> : null
}

const root = document.getElementById('root')

if (!root) throw new Error('Elemento root non trovato.')

initializePwa()

createRoot(root).render(
  <StrictMode>
    <DeferredExperienceLayer />
    <App />
  </StrictMode>,
)
