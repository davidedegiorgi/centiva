import Papa from 'papaparse'

import type { ImportDraft } from '@/types/import'

type CsvRow = Record<string, unknown>

const aliases = {
  date: ['data', 'date', 'occurredon', 'datatransazione', 'datacontabile'],
  description: ['descrizione', 'description', 'causale', 'operazione', 'dettagli'],
  amount: ['importo', 'amount', 'valore', 'totale'],
  type: ['tipo', 'type', 'movimento'],
  merchant: ['esercente', 'merchant', 'negozio', 'beneficiario'],
  category: ['categoria', 'category'],
  currency: ['valuta', 'currency'],
  notes: ['note', 'notes'],
} as const

function normalized(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function valueFor(row: CsvRow, names: readonly string[]): string {
  const entry = Object.entries(row).find(([key]) => names.includes(normalized(key)))
  return entry?.[1] == null ? '' : String(entry[1]).trim()
}

export function parseAmount(value: string): number | null {
  const cleaned = value.replace(/[^0-9,.-]/g, '')
  if (!cleaned) return null

  const lastComma = cleaned.lastIndexOf(',')
  const lastDot = cleaned.lastIndexOf('.')
  const decimalSeparator = lastComma > lastDot ? ',' : '.'
  let canonical = cleaned

  if (lastComma >= 0 && lastDot >= 0) {
    canonical = cleaned
      .replace(decimalSeparator === ',' ? /\./g : /,/g, '')
      .replace(decimalSeparator, '.')
  } else if (lastComma >= 0) {
    canonical = cleaned.replace(',', '.')
  }

  const amount = Number(canonical)
  return Number.isFinite(amount) ? amount : null
}

export function parseDate(value: string): string {
  const localIsoDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  if (/^oggi$/i.test(value.trim())) return localIsoDate(new Date())
  if (/^ieri$/i.test(value.trim())) {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    return localIsoDate(yesterday)
  }

  const iso = value.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/)
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`

  const italian = value.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/)
  if (italian) {
    const year = italian[3].length === 2 ? `20${italian[3]}` : italian[3]
    return `${year}-${italian[2].padStart(2, '0')}-${italian[1].padStart(2, '0')}`
  }

  const months: Record<string, number> = {
    gen: 1, gennaio: 1, feb: 2, febbraio: 2, mar: 3, marzo: 3,
    apr: 4, aprile: 4, mag: 5, maggio: 5, giu: 6, giugno: 6,
    lug: 7, luglio: 7, ago: 8, agosto: 8, set: 9, sett: 9, settembre: 9,
    ott: 10, ottobre: 10, nov: 11, novembre: 11, dic: 12, dicembre: 12,
  }
  const textual = value.toLowerCase().match(/\b(\d{1,2})\s+(gen(?:naio)?|feb(?:braio)?|mar(?:zo)?|apr(?:ile)?|mag(?:gio)?|giu(?:gno)?|lug(?:lio)?|ago(?:sto)?|set(?:t|tembre)?|ott(?:obre)?|nov(?:embre)?|dic(?:embre)?)(?:\s+(\d{2,4}))?\b/i)
  if (textual) {
    const month = months[normalized(textual[2])]
    const suppliedYear = textual[3]
    const year = suppliedYear ? (suppliedYear.length === 2 ? `20${suppliedYear}` : suppliedYear) : String(new Date().getFullYear())
    if (month) return `${year}-${String(month).padStart(2, '0')}-${textual[1].padStart(2, '0')}`
  }

  return new Date().toISOString().slice(0, 10)
}

function detectType(type: string, amount: number): 'income' | 'expense' {
  const lowered = normalized(type)
  if (['entrata', 'income', 'accredito', 'credito'].some((word) => lowered.includes(word))) {
    return 'income'
  }
  return amount > 0 && ['avere', 'positivo'].some((word) => lowered.includes(word))
    ? 'income'
    : 'expense'
}

export function suggestCategory(text: string, type: 'income' | 'expense' = 'expense'): string {
  if (type === 'income') return 'Entrate'

  const value = normalized(text)
  const categories: Array<[string, string[]]> = [
    ['Spesa', ['supermercato', 'conad', 'coop', 'esselunga', 'lidl', 'alimentari']],
    ['Ristorazione', ['ristorante', 'pizzeria', 'bar', 'caffe', 'deliveroo', 'justeat']],
    ['Trasporti', ['benzina', 'carburante', 'eni', 'q8', 'trenitalia', 'atm', 'autostrade']],
    ['Abbonamenti', ['netflix', 'spotify', 'disney', 'primevideo', 'icloud', 'abbonamento']],
    ['Casa', ['enel', 'energia', 'gas', 'affitto', 'condominio', 'ikea']],
    ['Salute', ['farmacia', 'medico', 'dentista', 'sanitaria']],
    ['Acquisti', ['amazon', 'zalando', 'negozio', 'shopping']],
    ['Tempo libero', ['cinema', 'teatro', 'museo', 'ticketone']],
  ]

  return categories.find(([, keywords]) => keywords.some((keyword) => value.includes(keyword)))?.[0] ?? ''
}

function draftFromRow(row: CsvRow, index: number): ImportDraft | null {
  const rawAmount = valueFor(row, aliases.amount)
  const amount = parseAmount(rawAmount)
  if (amount === null) return null

  const description = valueFor(row, aliases.description)
  const merchant = valueFor(row, aliases.merchant)
  const type = detectType(valueFor(row, aliases.type), amount)

  return {
    id: crypto.randomUUID(),
    type,
    amount: Math.abs(amount).toFixed(2),
    currency: (valueFor(row, aliases.currency) || 'EUR').toUpperCase().slice(0, 3),
    occurred_on: parseDate(valueFor(row, aliases.date)),
    description: description || `Movimento importato ${index + 1}`,
    merchant,
    category: valueFor(row, aliases.category) || suggestCategory(`${merchant} ${description}`, type),
    notes: valueFor(row, aliases.notes),
    source: 'csv',
  }
}

export function parseCsv(file: File): Promise<ImportDraft[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
      complete: ({ data, errors }) => {
        if (errors.length > 0 && data.length === 0) {
          reject(new Error(errors[0].message))
          return
        }
        resolve(data.map(draftFromRow).filter((row): row is ImportDraft => row !== null))
      },
      error: (error) => reject(error),
    })
  })
}

const numericDatePattern = /\b\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}\b/i
const textualDatePattern = /\b\d{1,2}\s+(?:gen(?:naio)?|feb(?:braio)?|mar(?:zo)?|apr(?:ile)?|mag(?:gio)?|giu(?:gno)?|lug(?:lio)?|ago(?:sto)?|set(?:t|tembre)?|ott(?:obre)?|nov(?:embre)?|dic(?:embre)?)(?:\s+\d{2,4})?\b/i
const colonTimePattern = /\b(?:[01]?\d|2[0-3])[:;]\d{2}(?::\d{2})?\b/g
const dotTimePattern = /\b(?:[01]?\d|2[0-3])[.]\d{2}\b/g
const moneyPattern = /(?:€\s*)?[+-]?\s*\d{1,3}(?:[.\s]\d{3})*(?:,\d{2})(?:\s*(?:€|EUR))?|(?:€\s*)?[+-]?\s*\d+(?:[.,]\d{2})(?:\s*(?:€|EUR))?/gi

interface AmountCandidate { value: number; raw: string; index: number; score: number }
interface DetectedEntry { candidate: AmountCandidate; relativeIndex: number }

function dateIn(value: string): string | null {
  return value.match(numericDatePattern)?.[0]
    ?? value.match(textualDatePattern)?.[0]
    ?? value.match(/\b(?:oggi|ieri)\b/i)?.[0]
    ?? null
}

function amountCandidates(line: string): AmountCandidate[] {
  const date = dateIn(line)
  let sanitized = date ? line.replace(date, ' '.repeat(date.length)) : line
  sanitized = sanitized.replace(colonTimePattern, (time) => ' '.repeat(time.length))
  sanitized = sanitized.replace(dotTimePattern, (time, offset: number) => {
    const nearby = sanitized.slice(Math.max(0, offset - 5), offset + time.length + 6)
    const monetaryContext = /[€]|EUR|[+-]\s*$/i.test(nearby)
    return (date || /\bore?\b/i.test(line)) && !monetaryContext ? ' '.repeat(time.length) : time
  })

  return [...sanitized.matchAll(moneyPattern)].flatMap((match): AmountCandidate[] => {
    const raw = match[0]
    const value = parseAmount(raw)
    if (value === null) return []
    const index = match.index ?? 0
    const context = sanitized.slice(Math.max(0, index - 12), index + raw.length + 12)
    const dotParts = raw.trim().match(/^[+\-€\s]*(\d{1,2})[.](\d{2})/)
    const looksLikeTime = Boolean(dotParts && Number(dotParts[1]) <= 23 && Number(dotParts[2]) <= 59)
    const hasCurrency = /€|EUR/i.test(raw) || /€|EUR/i.test(context)
    const hasSign = /[+-]/.test(raw)
    const hasMoneyWord = /totale|importo|addebito|accredito|pagamento|prelievo|rimborso|saldo/i.test(line)
    if (looksLikeTime && !hasCurrency && !hasSign) return []

    let score = 0
    if (hasCurrency) score += 6
    if (hasSign) score += 4
    if (raw.includes(',')) score += 3
    if (hasMoneyWord) score += 2
    if (/saldo disponibile|saldo contabile/i.test(line)) score -= 5
    return [{ value, raw, index, score }]
  }).sort((left, right) => right.score - left.score || right.index - left.index)
}

function findAmounts(line: string): number[] {
  return amountCandidates(line).map((candidate) => candidate.value)
}

function cleanDescription(block: string, date: string, amountRaw: string): string {
  return block
    .replace(date, ' ')
    .replace(colonTimePattern, ' ')
    .replace(dotTimePattern, ' ')
    .replace(amountRaw, ' ')
    .replace(/\b(?:EUR|eseguit[oa]|contabilizzat[oa]|pagamento pos|operazione carta)\b/gi, ' ')
    .replace(/[€|]/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function deduplicateNearbyEntries(entries: DetectedEntry[]): DetectedEntry[] {
  return entries.reduce<DetectedEntry[]>((unique, entry) => {
    const duplicateIndex = unique.findIndex((existing) => (
      Math.abs(existing.candidate.value).toFixed(2) === Math.abs(entry.candidate.value).toFixed(2)
      && Math.abs(existing.relativeIndex - entry.relativeIndex) <= 2
    ))

    if (duplicateIndex === -1) {
      unique.push(entry)
    } else if (entry.candidate.score > unique[duplicateIndex].candidate.score) {
      unique[duplicateIndex] = entry
    }

    return unique
  }, [])
}

export function parseOcrText(text: string): ImportDraft[] {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  const dated: ImportDraft[] = []
  const dateIndexes = lines.flatMap((line, index) => dateIn(line) ? [index] : [])

  dateIndexes.forEach((lineIndex, dateIndex) => {
    const nextDateIndex = dateIndexes[dateIndex + 1] ?? lines.length
    const blockLines = lines.slice(lineIndex, nextDateIndex)
    const date = dateIn(blockLines.join(' '))
    if (!date) return

    const entries = deduplicateNearbyEntries(blockLines.flatMap((line, relativeIndex) => {
      const candidate = amountCandidates(line)[0]
      return candidate ? [{ candidate, relativeIndex }] : []
    }))

    entries.forEach(({ candidate, relativeIndex }) => {
      const contextLines = blockLines.slice(Math.max(0, relativeIndex - 2), Math.min(blockLines.length, relativeIndex + 2))
      const context = contextLines.join(' | ')
      const signedExpense = /-/.test(candidate.raw) || /addebito|pagamento|prelievo|uscita/i.test(context)
      const type = !signedExpense && /\+|accredito|entrata|rimborso/i.test(context) ? 'income' : 'expense'
      const description = cleanDescription(context, date, candidate.raw)
      dated.push({
        id: crypto.randomUUID(),
        type,
        amount: Math.abs(candidate.value).toFixed(2),
        currency: 'EUR',
        occurred_on: parseDate(date),
        description: description || 'Movimento rilevato da immagine',
        merchant: '',
        category: suggestCategory(description, type),
        notes: '',
        source: 'ocr',
      })
    })
  })

  if (dated.length > 0) return dated

  const totalLine = [...lines].reverse().find((line) => /totale|total|importo/i.test(line) && findAmounts(line).length > 0)
  const fallbackLine = totalLine ?? [...lines].reverse().find((line) => findAmounts(line).length > 0)
  if (!fallbackLine) return []

  const amount = findAmounts(fallbackLine).at(-1)!
  const merchant = lines.find((line) => /[a-zà-ÿ]{3}/i.test(line) && !/scontrino|ricevuta|totale/i.test(line)) ?? ''

  return [{
    id: crypto.randomUUID(),
    type: 'expense',
    amount: Math.abs(amount).toFixed(2),
    currency: 'EUR',
    occurred_on: new Date().toISOString().slice(0, 10),
    description: merchant ? `Acquisto presso ${merchant}` : 'Spesa rilevata da immagine',
    merchant,
    category: suggestCategory(`${merchant} ${fallbackLine}`),
    notes: '',
    source: 'ocr',
  }]
}
