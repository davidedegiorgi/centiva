import { lazy, StrictMode, Suspense, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'

import App from '@/App'
import { WebGLErrorBoundary } from '@/components/effects/webgl-error-boundary'
import { initializePwa } from '@/lib/pwa'
import '@/index.css'

const ExperienceLayer = lazy(async () => ({ default: (await import('@/components/effects/experience-layer')).ExperienceLayer }))
const desktopPointerQuery = '(min-width: 1024px) and (hover: hover) and (pointer: fine)'

function DeferredExperienceLayer() {
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    const desktopPointer = window.matchMedia(desktopPointerQuery)
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let timer: number | undefined

    const updateExperience = () => {
      window.clearTimeout(timer)

      if (!desktopPointer.matches || reducedMotion.matches) {
        setEnabled(false)
        return
      }

      timer = window.setTimeout(() => setEnabled(true), 1200)
    }

    updateExperience()
    desktopPointer.addEventListener('change', updateExperience)
    reducedMotion.addEventListener('change', updateExperience)

    return () => {
      window.clearTimeout(timer)
      desktopPointer.removeEventListener('change', updateExperience)
      reducedMotion.removeEventListener('change', updateExperience)
    }
  }, [])

  const fallback = <div className="webgl-field webgl-field-static" aria-hidden="true" />

  return enabled ? (
    <WebGLErrorBoundary fallback={fallback}>
      <Suspense fallback={fallback}><ExperienceLayer /></Suspense>
    </WebGLErrorBoundary>
  ) : null
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
