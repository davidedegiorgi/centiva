import { describe, expect, it, vi } from 'vitest'

import {
  getInitialWebGLStatus,
  isWebGLAvailable,
} from '@/lib/webgl-support'
import { WebGLErrorBoundary } from '@/components/effects/webgl-error-boundary'

describe('WebGL compatibility guard', () => {
  it('keeps the 3D renderer enabled when a context is available', () => {
    const loseContext = vi.fn()
    const context = {
      getExtension: vi.fn(() => ({ loseContext })),
    } as unknown as WebGLRenderingContext

    expect(isWebGLAvailable(() => context)).toBe(true)
    expect(getInitialWebGLStatus(() => context)).toBe('loading')
    expect(loseContext).toHaveBeenCalledTimes(2)
  })

  it('selects the static fallback when context creation throws', () => {
    const createBrokenContext = () => {
      throw new Error('Error creating WebGL context')
    }

    expect(isWebGLAvailable(createBrokenContext)).toBe(false)
    expect(getInitialWebGLStatus(createBrokenContext)).toBe('failed')
  })

  it('selects the static fallback when the browser returns no context', () => {
    expect(getInitialWebGLStatus(() => null)).toBe('failed')
  })

  it('switches the error boundary to its fallback state', () => {
    const boundary = new WebGLErrorBoundary({
      children: '3D content',
      fallback: 'Static fallback',
    })

    boundary.state = WebGLErrorBoundary.getDerivedStateFromError()

    expect(boundary.render()).toBe('Static fallback')
  })
})
