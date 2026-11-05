export type WebGLContextFactory = () => WebGLRenderingContext | WebGL2RenderingContext | null

function createBrowserWebGLContext(): WebGLRenderingContext | WebGL2RenderingContext | null {
  if (typeof document === 'undefined') return null

  const canvas = document.createElement('canvas')
  return canvas.getContext('webgl2') ?? canvas.getContext('webgl')
}

export function isWebGLAvailable(
  createContext: WebGLContextFactory = createBrowserWebGLContext,
): boolean {
  try {
    const context = createContext()
    if (!context) return false

    context.getExtension('WEBGL_lose_context')?.loseContext()
    return true
  } catch {
    return false
  }
}

export function getInitialWebGLStatus(
  createContext?: WebGLContextFactory,
): 'loading' | 'failed' {
  return isWebGLAvailable(createContext) ? 'loading' : 'failed'
}
