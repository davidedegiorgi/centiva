import { Canvas, type RootState } from '@react-three/fiber'
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from 'react'

import { WebGLErrorBoundary } from '@/components/effects/webgl-error-boundary'
import { getInitialWebGLStatus } from '@/lib/webgl-support'

type CanvasProps = ComponentProps<typeof Canvas>

interface SafeCanvasProps extends Omit<CanvasProps, 'fallback' | 'onCreated'> {
  fallback: ReactNode
  initializationTimeoutMs?: number
  onCreated?: CanvasProps['onCreated']
  resetKey?: string
}

function SafeCanvasContent({
  fallback,
  initializationTimeoutMs = 6000,
  onCreated,
  style,
  ...canvasProps
}: SafeCanvasProps) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>(
    getInitialWebGLStatus,
  )
  const activeCanvas = useRef<HTMLCanvasElement | null>(null)

  const handleContextLost = useCallback((event: Event) => {
    event.preventDefault()
    setStatus('failed')
  }, [])

  const handleCreated = useCallback((state: RootState) => {
    activeCanvas.current?.removeEventListener('webglcontextlost', handleContextLost)
    activeCanvas.current = state.gl.domElement
    activeCanvas.current.addEventListener('webglcontextlost', handleContextLost, { once: true })
    setStatus('ready')
    onCreated?.(state)
  }, [handleContextLost, onCreated])

  useEffect(() => {
    if (status !== 'loading') return

    const timeout = window.setTimeout(() => setStatus('failed'), initializationTimeoutMs)
    return () => window.clearTimeout(timeout)
  }, [initializationTimeoutMs, status])

  useEffect(() => () => {
    activeCanvas.current?.removeEventListener('webglcontextlost', handleContextLost)
  }, [handleContextLost])

  if (status === 'failed') return fallback

  return (
    <div className="relative size-full">
      {status === 'loading' && (
        <div className="absolute inset-0 z-0" aria-hidden="true">
          {fallback}
        </div>
      )}
      <Canvas
        {...canvasProps}
        onCreated={handleCreated}
        style={{
          ...style,
          opacity: status === 'ready' ? 1 : 0,
          transition: 'opacity 500ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      />
    </div>
  )
}

export function SafeCanvas({ fallback, resetKey, ...props }: SafeCanvasProps) {
  return (
    <WebGLErrorBoundary key={resetKey} fallback={fallback}>
      <SafeCanvasContent {...props} fallback={fallback} />
    </WebGLErrorBoundary>
  )
}
