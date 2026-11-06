import { describe, expect, it } from 'vitest'

import {
  getAuthenticatedStartupView,
} from '@/lib/startup-view'

describe('authenticated startup view', () => {
  it('always opens the dashboard after authentication or session restore', () => {
    expect(getAuthenticatedStartupView()).toBe('dashboard')
  })
})
