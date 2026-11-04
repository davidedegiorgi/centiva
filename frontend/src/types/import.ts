import type { TransactionSource, TransactionType } from '@/types/transaction'

export interface ImportDraft {
  id: string
  type: TransactionType
  amount: string
  currency: string
  occurred_on: string
  description: string
  merchant: string
  category: string
  notes: string
  source: Extract<TransactionSource, 'csv' | 'ocr'>
}

export interface BulkImportPayload {
  transactions: Array<{
    type: TransactionType
    amount: number
    currency: string
    occurred_on: string
    description: string
    merchant: string | null
    category: string | null
    notes: string | null
    source: Extract<TransactionSource, 'csv' | 'ocr'>
  }>
}
