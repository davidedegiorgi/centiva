import { describe, expect, it } from 'vitest'

import {
  getAuthenticatedStartupView,
  shouldShowImmediateCamera,
} from '@/lib/startup-view'

describe('authenticated startup view', () => {
  it('opens the camera for an already authenticated mobile startup', () => {
    expect(getAuthenticatedStartupView({
      isMobile: true,
      isGoogleAuthenticationReturn: false,
    })).toBe('capture')
  })

  it('opens the dashboard after returning from Google authentication', () => {
    expect(getAuthenticatedStartupView({
      isMobile: true,
      isGoogleAuthenticationReturn: true,
    })).toBe('dashboard')
  })

  it('opens the dashboard on desktop', () => {
    expect(getAuthenticatedStartupView({
      isMobile: false,
      isGoogleAuthenticationReturn: false,
    })).toBe('dashboard')
  })
})

describe('immediate startup camera', () => {
  it('is visible only while restoring a known mobile session', () => {
    expect(shouldShowImmediateCamera({
      isLoading: true,
      hasAuthenticationHint: true,
      isMobile: true,
      isGoogleAuthenticationReturn: false,
    })).toBe(true)
  })

  it('stays hidden during a Google authentication return', () => {
    expect(shouldShowImmediateCamera({
      isLoading: true,
      hasAuthenticationHint: true,
      isMobile: true,
      isGoogleAuthenticationReturn: true,
    })).toBe(false)
  })

  it('stays hidden without a previous authenticated session', () => {
    expect(shouldShowImmediateCamera({
      isLoading: true,
      hasAuthenticationHint: false,
      isMobile: true,
      isGoogleAuthenticationReturn: false,
    })).toBe(false)
  })
})
