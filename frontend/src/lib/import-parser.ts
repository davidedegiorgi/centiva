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

  const italian = value.match(/^(\d{1,2})[-/.,](\d{1,2})[-/.,](\d{2,4})/)
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

export const IMPORT_CATEGORIES = [
  'Abbonamenti', 'Acquisti', 'Altro', 'Assicurazioni', 'Bonifico ricevuto',
  'Casa', 'Commissioni', 'Cura personale', 'Entrate', 'Istruzione', 'Pensione',
  'Prelievi', 'Rimborso', 'Ristorazione', 'Salute', 'Spesa', 'Stipendio',
  'Tempo libero', 'Trasporti', 'Utenze', 'Viaggi',
] as const

type CategoryRule = [category: string, keywords: string[]]

function searchableText(value: string): { words: string; compact: string } {
  const words = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

  return { words, compact: words.replace(/\s/g, '') }
}

function editDistance(left: string, right: string): number {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index)

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex]
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      )
    }
    previous.splice(0, previous.length, ...current)
  }

  return previous[right.length]
}

function keywordScore(text: { words: string; compact: string }, keyword: string): number {
  const keywordText = searchableText(keyword)
  if (keywordText.compact.length <= 3) {
    return ` ${text.words} `.includes(` ${keywordText.words} `) ? 100 : 0
  }

  if (` ${text.words} `.includes(` ${keywordText.words} `)) return 130 + keywordText.compact.length
  if (text.compact.includes(keywordText.compact)) return 115 + keywordText.compact.length

  const textTokens = text.words.split(' ').filter(Boolean)
  const keywordTokens = keywordText.words.split(' ').filter(Boolean)
  let totalDistance = 0

  const everyTokenMatches = keywordTokens.every((keywordToken) => {
    if (keywordToken.length < 5) return textTokens.includes(keywordToken)
    const maximumDistance = keywordToken.length >= 9 ? 2 : 1
    const distance = Math.min(...textTokens.map((token) => editDistance(token, keywordToken)))
    totalDistance += distance
    return distance <= maximumDistance
  })

  return everyTokenMatches ? 80 + keywordText.compact.length - totalDistance * 12 : 0
}

export function suggestCategory(text: string, type: 'income' | 'expense' = 'expense'): string {
  const value = searchableText(text)

  const incomeCategories: CategoryRule[] = [
    ['Stipendio', ['stipendio', 'salary', 'paghe', 'retribuzione', 'emolumenti']],
    ['Pensione', ['pensione', 'inps']],
    ['Rimborso', ['rimborso', 'cashback', 'storno', 'refund']],
    ['Bonifico ricevuto', ['bonifico', 'stripe', 'accredito', 'giroconto']],
  ]
  const expenseCategories: CategoryRule[] = [
    ['Prelievi', ['prelievo', 'cash withdrawal', 'sportello atm']],
    ['Commissioni', ['commissione', 'canone carta', 'imposta di bollo', 'spese bancarie']],
    ['Abbonamenti', ['amazon prime', 'prime video', 'netflix', 'spotify', 'disney plus', 'dazn', 'sky', 'now tv', 'apple.com/bill', 'icloud', 'google one', 'youtube premium', 'chatgpt', 'openai', 'microsoft 365', 'adobe', 'canva', 'abbonamento']],
    ['Ristorazione', ['ristorante', 'ristorazione', 'pizzeria', 'trattoria', 'osteria', 'caffe', 'bar', 'pub', 'gelateria', 'pasticceria', 'paninoteca', 'tavola calda', 'coperto', 'coperti', 'menu', 'pranzo', 'cena', 'pizza', 'antipasto', 'mcdonald', 'burger king', 'kfc', 'starbucks', 'deliveroo', 'just eat', 'glovo', 'uber eats', 'autogrill']],
    ['Spesa', ['supermercato', 'alimentari', 'market', 'minimarket', 'discount', 'ortofrutta', 'macelleria', 'salumeria', 'panificio', 'caseificio', 'conad', 'coop', 'esselunga', 'lidl', 'aldi', 'carrefour', 'pam panorama', 'eurospin', 'md discount', 'despar', 'iper', 'bennet', 'tigros', 'penny market', 'todis', 'crai', 'famila', 'unes', 'iperal', 'il gigante', 'natura si', 'eataly', 'pasta', 'latte', 'pane', 'formaggio', 'yogurt', 'biscotti', 'detersivo', 'ortaggi', 'frutta', 'verdura', 'farina', 'acqua', 'bibita', 'surgelato']],
    ['Trasporti', ['trenitalia', 'italo treno', 'biglietto treno', 'metro', 'autobus', 'trasporto', 'taxi', 'uber', 'freenow', 'telepass', 'autostrade', 'pedaggio', 'parcheggio', 'benzina', 'gasolio', 'diesel', 'carburante', 'distributore', 'eni station', 'q8', 'tamoil', 'ip gruppo api', 'atm milano']],
    ['Utenze', ['bolletta', 'energia', 'elettricita', 'luce e gas', 'enel', 'a2a', 'hera', 'iren', 'acea', 'telefono', 'telefonia', 'vodafone', 'tim', 'windtre', 'iliad', 'fastweb', 'internet fibra']],
    ['Casa', ['affitto', 'condominio', 'mutuo', 'ikea', 'leroy merlin', 'brico', 'mobilificio', 'ferramenta', 'casalinghi', 'arredamento']],
    ['Salute', ['farmacia', 'parafarmacia', 'medico', 'dentista', 'clinica', 'ospedale', 'sanitaria', 'ottica', 'laboratorio analisi', 'ticket sanitario']],
    ['Assicurazioni', ['assicurazione', 'polizza', 'unipol', 'generali', 'allianz', 'axa', 'zurich']],
    ['Viaggi', ['hotel', 'albergo', 'booking.com', 'airbnb', 'ryanair', 'easyjet', 'ita airways', 'compagnia aerea', 'volo', 'agenzia viaggi']],
    ['Istruzione', ['scuola', 'universita', 'corso', 'udemy', 'coursera', 'libreria', 'libro scolastico']],
    ['Cura personale', ['parrucchiere', 'barbiere', 'estetista', 'profumeria', 'sephora', 'douglas']],
    ['Tempo libero', ['cinema', 'teatro', 'museo', 'concerto', 'ticketone', 'videogioco', 'playstation', 'steam', 'palestra']],
    ['Acquisti', ['amazon', 'zalando', 'ebay', 'shein', 'temu', 'negozio', 'shopping', 'abbigliamento', 'zara', 'hm.com', 'decathlon', 'mediaworld', 'unieuro', 'apple store']],
  ]
  const rules = type === 'income' ? incomeCategories : expenseCategories

  const ranked = rules.map(([category, keywords], ruleIndex) => ({
    category,
    ruleIndex,
    score: Math.max(...keywords.map((keyword) => keywordScore(value, keyword))),
  })).filter((result) => result.score > 0)
    .sort((left, right) => right.score - left.score || left.ruleIndex - right.ruleIndex)

  return ranked[0]?.category ?? (type === 'income' ? 'Entrate' : 'Altro')
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

const numericDatePattern = /\b\d{1,2}[/.,-]\d{1,2}[/.,-]\d{2,4}\b/i
const textualDatePattern = /\b\d{1,2}\s+(?:gen(?:naio)?|feb(?:braio)?|mar(?:zo)?|apr(?:ile)?|mag(?:gio)?|giu(?:gno)?|lug(?:lio)?|ago(?:sto)?|set(?:t|tembre)?|ott(?:obre)?|nov(?:embre)?|dic(?:embre)?)(?:\s+\d{2,4})?\b/i
const colonTimePattern = /\b(?:[01]?\d|2[0-3])[:;]\d{2}(?::\d{2})?\b/g
const dotTimePattern = /\b(?:[01]?\d|2[0-3])[.]\d{2}\b/g
const moneyPattern = /(?:€\s*)?[+-]?\s*\d+(?:[.\s]\d{3})*(?:[.,:;]\d{1,2})(?:\s*(?:€|EUR))?|(?:€\s*)[+-]?\s*\d+|[+-]?\s*\d+\s*(?:€|EUR)/gi
export const OCR_VARIANT_SEPARATOR = '\n<<<CENTIVA_OCR_VARIANT>>>\n'

interface AmountCandidate { value: number; raw: string; index: number; score: number }
interface DetectedEntry { candidate: AmountCandidate; relativeIndex: number }
interface ReceiptAmountCandidate extends AmountCandidate { lineIndex: number; receiptScore: number }

function dateIn(value: string): string | null {
  return value.match(numericDatePattern)?.[0]
    ?? value.match(textualDatePattern)?.[0]
    ?? value.match(/\b(?:oggi|ieri)\b/i)?.[0]
    ?? null
}

function amountCandidates(line: string): AmountCandidate[] {
  const date = dateIn(line)
  let normalizedMoney = line
    .replace(/(\d)\s+([0-9]{2})(?=\s*(?:€|EUR)(?:\s|$))/gi, '$1,$2')
    .replace(/(€\s*\d+)\s+([0-9]{2})\b/gi, '$1,$2')
    .replace(/(\d)[,.:;](\d)[)\]oO](?=\D|$)/g, '$1,$20')
  if (/totale|importo|pagamento|pagato|contante|carta|bancomat|pos/i.test(line)) {
    normalizedMoney = normalizedMoney.replace(/\b(\d{1,6})\s+([0-9]{2})\b/g, '$1,$2')
  }
  let sanitized = date ? normalizedMoney.replace(date, ' '.repeat(date.length)) : normalizedMoney
  sanitized = sanitized.replace(colonTimePattern, (time) => ' '.repeat(time.length))
  sanitized = sanitized.replace(dotTimePattern, (time, offset: number) => {
    const nearby = sanitized.slice(Math.max(0, offset - 5), offset + time.length + 6)
    const monetaryContext = /[€]|EUR|[+-]\s*$/i.test(nearby)
    return (date || /\bore?\b/i.test(line)) && !monetaryContext ? ' '.repeat(time.length) : time
  })

  return [...sanitized.matchAll(moneyPattern)].flatMap((match): AmountCandidate[] => {
    const raw = match[0]
    const value = parseAmount(raw.replace(/[:;]/g, ','))
    if (value === null) return []
    const index = match.index ?? 0
    const context = sanitized.slice(Math.max(0, index - 12), index + raw.length + 12)
    const dotParts = raw.trim().match(/^[+\-€\s]*(\d{1,2})[.](\d{2})/)
    const looksLikeTime = Boolean(dotParts && Number(dotParts[1]) <= 23 && Number(dotParts[2]) <= 59)
    const hasCurrency = /€|EUR/i.test(raw) || /€|EUR/i.test(context)
    const hasSign = /[+-]/.test(raw)
    const hasMoneyWord = /totale|importo|addebito|accredito|pagamento|prelievo|rimborso|saldo/i.test(line)
    if (looksLikeTime && !hasCurrency && !hasSign && !hasMoneyWord) return []

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

function isReceiptText(lines: string[]): boolean {
  const text = lines.join(' ')
  const candidates = lines.flatMap((line) => amountCandidates(line))
  const signedAmounts = candidates.filter((candidate) => /[+-]/.test(candidate.raw)).length
  const dates = lines.filter((line) => dateIn(line)).length
  const hasStrongReceiptSignal = /scontrino|ricevuta|documento commerciale|partita\s+iva|p\.?\s*iva|imponibile|subtotale|\biva\b|\bresto\b/i.test(text)
  const hasExplicitTotal = /totale(?:\s+(?:da\s+pagare|complessivo|dovuto|documento))?|\bsomma\b|importo\s+(?:pagato|dovuto)/i.test(text)
  const hasBankMovementSignal = /pagamento\s+(?:pos|e-?commerce)|bonifico|accredito|prelievo|operazione\s+carta|carte\s+postepay/i.test(text)
  const hasReceiptStructure = candidates.length >= 2 && signedAmounts <= 1 && dates <= 1 && !hasBankMovementSignal

  return hasStrongReceiptSignal || (hasExplicitTotal && !hasBankMovementSignal) || hasReceiptStructure
}

function normalizeReceiptLabels(value: string): string {
  return value
    .toLowerCase()
    .replace(/0/g, 'o')
    .replace(/1/g, 'l')
    .replace(/5/g, 's')
    .replace(/\blva\b/g, 'iva')
}

function receiptScore(line: string, candidate: AmountCandidate): number {
  const normalizedLine = normalizeReceiptLabels(line)
  const prefix = normalizedLine.slice(Math.max(0, candidate.index - 64), candidate.index)
  const suffix = normalizedLine.slice(candidate.index + candidate.raw.length, candidate.index + candidate.raw.length + 32)
  let score = candidate.score

  if (/\b(?:iva|imposta|imponibile|subtotale|resto|sconto|risparmio|acconto|commissione|aliquota|di\s+cui|numero|codice|transazione|terminale|autorizzazione|lotteria|matricola)\b[^\d]*$/i.test(prefix)) {
    score -= 120
  } else if (/(?:totale(?:\s+(?:da\s+pagare|complessivo|dovuto|documento))?|\bsomma|importo\s+(?:pagato|dovuto)|da\s+pagare)[^\d]*$/i.test(prefix)) {
    score += 140
  } else if (/\btotale[^\d]*$/i.test(prefix)) {
    score += 100
  } else if (/\b(?:pagamento|pagato|carta|bancomat|pos)\b[^\d]*$/i.test(prefix)) {
    score += 70
  } else if (/\bcontan[a-z]*\b[^\d]*$/i.test(prefix)) {
    score += 55
  }

  if (/^\s*(?:totale|da\s+pagare)\b/i.test(suffix)) score += 90
  if (/\b(?:iva|imponibile|subtotale|resto|sconto)\b/i.test(normalizedLine) && score < 80) score -= 45

  return score
}

function receiptDraft(lines: string[]): ImportDraft | null {
  const candidates = lines.flatMap((line, lineIndex) => amountCandidates(line).flatMap((candidate): ReceiptAmountCandidate[] => {
    if (candidate.value <= 0 || Math.abs(candidate.value) > 100000) return []
    let score = receiptScore(line, candidate)
    const precedingLabels = normalizeReceiptLabels(lines.slice(Math.max(0, lineIndex - 2), lineIndex).join(' '))
    if (/(?:totale|importo\s+pagato|da\s+pagare)\s*$/i.test(precedingLabels)) score += 130
    if (/(?:iva|imponibile|subtotale|resto|sconto)\s*$/i.test(precedingLabels)) score -= 120
    return [{ ...candidate, lineIndex, receiptScore: score }]
  }))
  if (candidates.length === 0) return null

  candidates.forEach((candidate) => {
    const matchingAmounts = candidates.filter((other) => Math.abs(other.value - candidate.value) < 0.005).length
    candidate.receiptScore += Math.min(50, (matchingAmounts - 1) * 25)
  })

  const explicitTotals = candidates.filter((candidate) => candidate.receiptScore >= 80)
  const labelledPayments = candidates.filter((candidate) => candidate.receiptScore >= 25)
  const selected = explicitTotals.sort((left, right) => right.receiptScore - left.receiptScore || right.lineIndex - left.lineIndex)[0]
    ?? labelledPayments.sort((left, right) => right.receiptScore - left.receiptScore || right.lineIndex - left.lineIndex)[0]
  if (!selected) return null

  const text = lines.join(' ')
  const date = dateIn(text)
  const merchant = lines.find((line) => (
    /[a-zà-ÿ]{3}/i.test(line)
    && !/scontrino|ricevuta|documento commerciale|partita\s+iva|p\.?\s*iva|totale|subtotale|imponibile|\biva\b/i.test(line)
    && amountCandidates(line).length === 0
  )) ?? ''

  return {
    id: crypto.randomUUID(),
    type: 'expense',
    amount: Math.abs(selected.value).toFixed(2),
    currency: /\b(?:USD|GBP|CHF)\b/i.test(text) ? text.match(/\b(?:USD|GBP|CHF)\b/i)![0].toUpperCase() : 'EUR',
    occurred_on: date ? parseDate(date) : new Date().toISOString().slice(0, 10),
    description: merchant ? `Acquisto presso ${merchant}` : 'Spesa rilevata da scontrino',
    merchant,
    category: suggestCategory(text),
    notes: '',
    source: 'ocr',
  }
}

function parseSingleOcrText(text: string): ImportDraft[] {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  if (isReceiptText(lines)) {
    const receipt = receiptDraft(lines)
    return receipt ? [receipt] : []
  }

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
      const contextLines = blockLines.slice(Math.max(0, relativeIndex - 3), relativeIndex + 1)
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
        category: suggestCategory(`${context} ${description}`, type),
        notes: '',
        source: 'ocr',
      })
    })
  })

  if (dated.length > 0) return dated

  const totalLine = [...lines].reverse().find((line) => /totale|total|somma|importo/i.test(line) && findAmounts(line).length > 0)
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
    category: suggestCategory(text),
    notes: '',
    source: 'ocr',
  }]
}

function weightedReceiptTotal(variants: string[]): number | null {
  let bestItemCount = 0
  let bestTotal: number | null = null

  for (const variant of variants) {
    if (!/(?:bilancia|€\s*\/\s*kg|euro\s*\/\s*kg)/i.test(variant)) continue

    const weights = [...variant.matchAll(/\b(\d{1,3}[,.]\d{3})\b/g)]
    const itemTotals: number[] = []

    weights.forEach((weightMatch, index) => {
      const weight = parseAmount(weightMatch[1])
      if (weight === null || weight <= 0 || weight >= 10) return

      const start = (weightMatch.index ?? 0) + weightMatch[0].length
      const end = weights[index + 1]?.index ?? variant.length
      const following = variant.slice(start, end)
      const values = [...following.matchAll(/\b(\d{1,5}[,.]\d{2})\b/g)]
        .map((match) => parseAmount(match[1]))
        .filter((value): value is number => value !== null && value > 0)

      if (values.length < 2) return
      const unitPrice = values[0]
      const shownLineTotal = values[1]
      if (unitPrice < shownLineTotal || unitPrice > 1000) return

      itemTotals.push(Math.round(weight * unitPrice * 100) / 100)
    })

    if (itemTotals.length < 2) continue
    const total = Math.round(itemTotals.reduce((sum, value) => sum + value, 0) * 100) / 100
    if (itemTotals.length > bestItemCount) {
      bestItemCount = itemTotals.length
      bestTotal = total
    }
  }

  return bestTotal
}

export function parseOcrText(text: string): ImportDraft[] {
  const variants = text
    .split(OCR_VARIANT_SEPARATOR)
    .map((variant) => variant.trim())
    .filter(Boolean)
  const parsedVariants = variants.map(parseSingleOcrText)
  const combinedText = variants.join(' ')
  const taxAmounts = new Set(variants.flatMap((variant) => variant
    .split(/\r?\n/)
    .filter((line) => /\b(?:iva|imposta|imponibile|aliquota|di\s+cui)\b/i.test(line))
    .flatMap((line) => amountCandidates(line).map((candidate) => Math.abs(candidate.value).toFixed(2)))))
  const confirmedAmounts = new Set(variants.flatMap((variant) => variant
    .split(/\r?\n/)
    .filter((line) => /totale|somma|da\s+pagare|importo\W*pag|pagamento\W*(?:carta|contante|bancomat|pos)/i.test(normalizeReceiptLabels(line)))
    .flatMap((line) => amountCandidates(line).map((candidate) => Math.abs(candidate.value).toFixed(2)))))
  const safeVariants = parsedVariants.map((rows) => rows.filter((row) => (
    !taxAmounts.has(Number(row.amount).toFixed(2))
    || confirmedAmounts.has(Number(row.amount).toFixed(2))
  )))
  const receiptLike = variants.some((variant) => isReceiptText(variant.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)))
  const selectedRows = receiptLike
    ? [...safeVariants].reverse().find((rows) => rows.length > 0) ?? []
    : safeVariants.reduce<ImportDraft[]>((best, rows) => rows.length > best.length ? rows : best, [])
  const calculatedWeightedTotal = receiptLike ? weightedReceiptTotal(variants) : null

  return selectedRows.map((row) => ({
    ...row,
    amount: calculatedWeightedTotal === null ? row.amount : calculatedWeightedTotal.toFixed(2),
    category: (() => {
      const suggested = suggestCategory(combinedText, row.type)
      return suggested === 'Altro' && receiptLike ? 'Acquisti' : suggested
    })(),
  }))
}
