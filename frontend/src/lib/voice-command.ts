import { IMPORT_CATEGORIES, suggestCategory } from '@/lib/import-parser'
import type { TransactionPayload, TransactionType } from '@/types/transaction'

export interface VoiceTransactionDraft extends TransactionPayload {
  transcript: string
}

const months = [
  'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre',
]

const numberWords: Record<string, number> = {
  zero: 0, un: 1, uno: 1, una: 1, due: 2, tre: 3, quattro: 4, cinque: 5,
  sei: 6, sette: 7, otto: 8, nove: 9, dieci: 10, undici: 11, dodici: 12,
  tredici: 13, quattordici: 14, quindici: 15, sedici: 16, diciassette: 17,
  diciotto: 18, diciannove: 19, venti: 20, trenta: 30, quaranta: 40,
  cinquanta: 50, sessanta: 60, settanta: 70, ottanta: 80, novanta: 90,
}

const tensWords: Array<[string, number]> = [
  ['novanta', 90], ['ottanta', 80], ['settanta', 70], ['sessanta', 60],
  ['cinquanta', 50], ['quaranta', 40], ['trenta', 30], ['venti', 20],
  ['novant', 90], ['ottant', 80], ['settant', 70], ['sessant', 60],
  ['cinquant', 50], ['quarant', 40], ['trent', 30], ['vent', 20],
]

function integerWordValue(word: string): number | null {
  if (word in numberWords) return numberWords[word]

  const thousands = word.match(/^(mille|([a-z]+)mila)(.*)$/)
  if (thousands) {
    const multiplier = thousands[1] === 'mille' ? 1 : integerWordValue(thousands[2])
    const remainder = thousands[3] ? integerWordValue(thousands[3]) : 0
    if (multiplier !== null && remainder !== null) return multiplier * 1000 + remainder
  }

  const hundreds = word.match(/^([a-z]+)?cent(?:o)?(.*)$/)
  if (hundreds) {
    const multiplier = hundreds[1] ? integerWordValue(hundreds[1]) : 1
    const remainder = hundreds[2] ? integerWordValue(hundreds[2]) : 0
    if (multiplier !== null && multiplier < 10 && remainder !== null) return multiplier * 100 + remainder
  }

  for (const [prefix, value] of tensWords) {
    if (!word.startsWith(prefix) || word === prefix) continue
    const suffix = word.slice(prefix.length)
    const unit = numberWords[suffix]
    if (unit !== undefined && unit > 0 && unit < 10) return value + unit
  }

  return null
}

function amountFromWords(transcript: string): number | null {
  const cleaned = transcript
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\b(?:il\s+)?(?:primo|due|tre|quattro|cinque|sei|sette|otto|nove|dieci|undici|dodici|tredici|quattordici|quindici|sedici|diciassette|diciotto|diciannove|venti|ventuno|ventidue|ventitre|ventiquattro|venticinque|ventisei|ventisette|ventotto|ventinove|trenta|trentuno)\s+(?:gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\b/g, ' ')
  const tokens = cleaned.match(/[a-z]+/g) ?? []

  const candidates: Array<{ amount: number; score: number }> = []
  const currencies = new Set(['euro', 'eur', 'dollaro', 'dollari', 'sterlina', 'sterline', 'franco', 'franchi'])

  for (let start = 0; start < tokens.length; start += 1) {
    let total = 0
    let current = 0
    let consumed = 0
    let decimal: number | null = null

    for (let index = start; index < Math.min(tokens.length, start + 7); index += 1) {
      const token = tokens[index]
      if (token === 'e' && consumed > 0) continue
      if (token === 'virgola' && consumed > 0) {
        const decimalValue = integerWordValue(tokens[index + 1] ?? '')
        if (decimalValue !== null) decimal = decimalValue / (decimalValue >= 10 ? 100 : 10)
        break
      }
      if (token === 'mila') {
        total += Math.max(1, current) * 1000
        current = 0
        consumed += 1
        continue
      }
      if (token === 'cento') {
        current += 100
        consumed += 1
        continue
      }
      const value = integerWordValue(token)
      if (value === null) break
      current += value
      consumed += 1
    }

    const amount = total + current + (decimal ?? 0)
    if (consumed > 0 && amount > 0) {
      const token = tokens[start]
      const nextToken = tokens[start + consumed]
      const previousToken = tokens[start - 1]
      const looksLikeArticle = ['un', 'uno', 'una'].includes(token) && !currencies.has(nextToken)
      if (!looksLikeArticle) {
        const currencyScore = currencies.has(nextToken) || currencies.has(previousToken) ? 100 : 0
        candidates.push({ amount, score: currencyScore + consumed * 10 })
      }
    }
  }

  return candidates.sort((left, right) => right.score - left.score)[0]?.amount ?? null
}

function localDate(date: Date): string {
  return new Intl.DateTimeFormat('en-CA').format(date)
}

function parseAmount(transcript: string): number | null {
  const withoutDatesAndTimes = transcript
    .replace(/\b\d{1,2}[/.]\d{1,2}[/.]\d{2,4}\b/g, ' ')
    .replace(/\b(?:il\s+)?\d{1,2}\s+(?:gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)(?:\s+\d{4})?\b/gi, ' ')
    .replace(/\b(?:[01]?\d|2[0-3])[:.]\d{2}\b/g, ' ')
  const match = withoutDatesAndTimes.match(/(\d+(?:[.\s]\d{3})*(?:[,.]\d{1,2})?)\s*(?:€|(?:euro|eur|dollari?|usd|sterline?|gbp|franchi?|chf)\b)/i)
    ?? withoutDatesAndTimes.match(/(?:€|(?:euro|eur|dollari?|usd|sterline?|gbp|franchi?|chf)\b)\s*(\d+(?:[.\s]\d{3})*(?:[,.]\d{1,2})?)/i)
    ?? transcript.match(/\b(?:spesa|uscita|entrata|incasso|accredito|pagato|ricevuto|stipendio|pensione|rimborso)\s+(?:di\s+)?(\d+(?:[.\s]\d{3})*(?:[,.]\d{1,2})?)/i)
    ?? transcript.match(/\b(\d+(?:[.\s]\d{3})*(?:[,.]\d{1,2})?)\s+(?:di\s+)?(?:spesa|uscita|entrata|incasso|accredito|pagato|ricevuto|stipendio|pensione|rimborso)\b/i)
    ?? withoutDatesAndTimes.match(/\b(\d+(?:[.\s]\d{3})*(?:[,.]\d{1,2})?)\b/)

  if (match) {
    const raw = match[1].replace(/\s/g, '')
    const normalized = raw.includes(',')
      ? raw.replace(/\./g, '').replace(',', '.')
      : raw.replace(/(?<=\d)\.(?=\d{3}(?:\D|$))/g, '')
    const amount = Number(normalized)
    if (Number.isFinite(amount) && amount > 0) return amount
  }

  return amountFromWords(transcript)
}

function parseType(transcript: string): TransactionType | null {
  if (/\b(?:entrata|incasso|incassato|accredito|accreditato|ricevuto|stipendio|pensione|rimborso|guadagno|guadagnato)\b/i.test(transcript)) return 'income'
  if (/\b(?:spesa|uscita|pagato|pagamento|addebito|acquisto|comprato|costo|speso)\b/i.test(transcript)) return 'expense'
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
  const suggested = suggestCategory(transcript, type)
  if (type === 'expense' && suggested === 'Altro' && /\bspesa\b/i.test(transcript)) return 'Spesa'
  return suggested
}

export function parseVoiceTransaction(transcript: string, now = new Date()): VoiceTransactionDraft | null {
  const normalized = transcript.trim()
  const amount = parseAmount(normalized)
  if (amount === null) return null
  const type = parseType(normalized) ?? 'expense'

  return {
    transcript: normalized,
    type,
    amount,
    currency: parseCurrency(normalized),
    occurred_on: parseOccurredOn(normalized, now),
    category: parseCategory(normalized, type),
  }
}

export const voiceCommandExamples = 'Prova: “spesa 50”, “50 benzina”, “ho incassato 200” o “trenta euro farmacia”.'
