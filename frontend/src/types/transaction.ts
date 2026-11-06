export type TransactionType = 'income' | 'expense'
export type TransactionSource = 'manual' | 'csv' | 'ocr'

export interface Transaction {
  id: string
  type: TransactionType
  amount: string
  currency: string
  occurred_on: string
  description: string
  merchant: string | null
  category: string | null
  notes: string | null
  source: TransactionSource
  created_at: string | null
  updated_at: string | null
}

export interface TransactionPayload {
  type: TransactionType
  amount: number
  currency: string
  occurred_on: string
  category: string
}

export interface TransactionFilters {
  search?: string
  type?: TransactionType | ''
  category?: string
  date_from?: string
  date_to?: string
  amount_min?: string
  amount_max?: string
  page?: number
  per_page?: 10 | 25 | 50
}

export interface PaginationMeta {
  current_page: number
  from: number | null
  last_page: number
  per_page: number
  to: number | null
  total: number
}

export interface TransactionResponse {
  data: Transaction
}

export interface TransactionListResponse {
  data: Transaction[]
  meta: PaginationMeta
}
