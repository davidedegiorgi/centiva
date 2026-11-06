import type { Transaction } from '@/types/transaction'

export interface AnalysisData {
  currency: string
  sample_size: number
  insights: Array<{ kind: 'category' | 'increase' | 'improvement'; title: string; message: string; potential_saving: string }>
  duplicates: Array<{ reason: string; transactions: Transaction[] }>
  anomalies: Array<{ reason: string; transaction: Transaction }>
  data_quality?: {
    current_expenses: number
    current_categorized_expenses: number
    previous_comparable_expenses: number
  }
  status?: {
    insights: 'insufficient' | 'ready'
    duplicates: 'insufficient' | 'clear' | 'findings'
    anomalies: 'insufficient' | 'clear' | 'findings'
  }
}

export interface AnalysisResponse { data: AnalysisData }
