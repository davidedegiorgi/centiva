import { IMPORT_CATEGORIES, suggestCategory } from '@/lib/import-parser'
import type { TransactionPayload, TransactionType } from '@/types/transaction'

export interface VoiceTransactionDraft extends TransactionPayload {
  transcript: string
}

const months = [
  'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre',
]

function localDate(date: Date): string {
  return new Intl.DateTimeFormat('en-CA').format(date)
}

function parseAmount(transcript: string): number | null {
  const match = transcript.match(/(\d+(?:[.\s]\d{3})*(?:[,.]\d{1,2})?)\s*(?:€|euro|eur|dollari?|usd|sterline?|gbp|franchi?|chf)\b/i)
    ?? transcript.match(/\b(?:spesa|uscita|entrata|incasso|accredito|pagato|ricevuto|stipendio|pensione|rimborso)\s+(?:di\s+)?(\d+(?:[.\s]\d{3})*(?:[,.]\d{1,2})?)/i)
    ?? transcript.match(/\b(\d+(?:[.\s]\d{3})*(?:[,.]\d{1,2})?)\s+(?:di\s+)?(?:spesa|uscita|entrata|incasso|accredito|pagato|ricevuto|stipendio|pensione|rimborso)\b/i)

  if (!match) return null
  const raw = match[1].replace(/\s/g, '')
  const normalized = raw.includes(',')
    ? raw.replace(/\./g, '').replace(',', '.')
    : raw.replace(/(?<=\d)\.(?=\d{3}(?:\D|$))/g, '')
  const amount = Number(normalized)
  return Number.isFinite(amount) && amount > 0 ? amount : null
}

function parseType(transcript: string): TransactionType | null {
  if (/\b(?:entrata|incasso|accredito|ricevuto|stipendio|pensione|rimborso|guadagnato)\b/i.test(transcript)) return 'income'
  if (/\b(?:spesa|uscita|pagato|pagamento|addebito|acquisto|speso)\b/i.test(transcript)) return 'expense'
  return null
}

function parseCurrency(transcript: string): string {
  if (/\b(?:dollar[oi]|usd)\b/i.test(transcript)) return 'USD'
  if (/\b(?:sterlin[ae]|gbp)\b/i.test(transcript)) return 'GBP'
  if (/\b(?:franch[io]|chf)\b/i.test(transcript)) return 'CHF'
  return 'EUR'
}

function parseOccurredOn(transcript: string, now: Date): string {
  const date = new Date(now)
  if (/\bl['’]?altro ieri\b/i.test(transcript)) date.setDate(date.getDate() - 2)
  else if (/\bieri\b/i.test(transcript)) date.setDate(date.getDate() - 1)
  else {
    const explicit = transcript.toLocaleLowerCase('it-IT').match(/\b(?:il\s+)?(\d{1,2})\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)(?:\s+(\d{4}))?\b/)
    if (explicit) {
      const year = explicit[3] ? Number(explicit[3]) : now.getFullYear()
      const candidate = new Date(year, months.indexOf(explicit[2]), Number(explicit[1]), 12)
      if (!Number.isNaN(candidate.getTime())) return localDate(candidate)
    }
  }
  return localDate(date)
}

function parseCategory(transcript: string, type: TransactionType): string {
  const explicit = transcript.match(/\bcategoria\s+([a-zà-ÿ ]+?)(?=\s+(?:oggi|ieri|il\s+\d|in\s+euro|in\s+dollari|$)|$)/i)?.[1]?.trim()
  if (explicit) {
    const normalized = explicit.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('it-IT')
    const exact = IMPORT_CATEGORIES.find((category) => category.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('it-IT') === normalized)
    if (exact) return exact
  }
  return suggestCategory(transcript, type)
}

export function parseVoiceTransaction(transcript: string, now = new Date()): VoiceTransactionDraft | null {
  const normalized = transcript.trim()
  const type = parseType(normalized)
  const amount = parseAmount(normalized)
  if (!type || amount === null) return null

  return {
    transcript: normalized,
    type,
    amount,
    currency: parseCurrency(normalized),
    occurred_on: parseOccurredOn(normalized, now),
    category: parseCategory(normalized, type),
  }
}

export const voiceCommandExamples = 'Prova semplicemente: “50 spesa” oppure “20 entrata”.'
