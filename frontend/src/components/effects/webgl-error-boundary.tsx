import { Component, type ErrorInfo, type ReactNode } from 'react'

interface WebGLErrorBoundaryProps {
  children: ReactNode
  fallback: ReactNode
}

interface WebGLErrorBoundaryState {
  hasError: boolean
}

export class WebGLErrorBoundary extends Component<
  WebGLErrorBoundaryProps,
  WebGLErrorBoundaryState
> {
  state: WebGLErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): WebGLErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.warn('Rendering WebGL non disponibile. Attivato il fallback statico.', {
      error,
      componentStack: errorInfo.componentStack,
    })
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children
  }
}
