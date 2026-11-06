import { describe, expect, it } from 'vitest'

import { parseVoiceTransaction } from '@/lib/voice-command'

const now = new Date(2026, 10, 6, 12)

describe('parseVoiceTransaction', () => {
  it('parses an expense with explicit category and today', () => {
    expect(parseVoiceTransaction('spesa 25,50 euro categoria spesa oggi', now)).toMatchObject({
      type: 'expense', amount: 25.5, currency: 'EUR', occurred_on: '2026-11-06', category: 'Spesa',
    })
  })

  it('parses an income and infers its category', () => {
    expect(parseVoiceTransaction('entrata 1.200 euro stipendio ieri', now)).toMatchObject({
      type: 'income', amount: 1200, currency: 'EUR', occurred_on: '2026-11-05', category: 'Stipendio',
    })
  })

  it('parses a foreign currency and an explicit calendar date', () => {
    expect(parseVoiceTransaction('uscita 30 dollari ristorante il 2 novembre', now)).toMatchObject({
      type: 'expense', amount: 30, currency: 'USD', occurred_on: '2026-11-02', category: 'Ristorazione',
    })
  })

  it('requires both movement type and amount', () => {
    expect(parseVoiceTransaction('ho comprato qualcosa oggi', now)).toBeNull()
    expect(parseVoiceTransaction('venticinque euro', now)).toBeNull()
  })
})
