import type { Transaction } from '@/types/transaction'

export interface AnalysisData {
  currency: string
  sample_size: number
  insights: Array<{ kind: 'category' | 'increase' | 'improvement'; title: string; message: string; potential_saving: string }>
  duplicates: Array<{ reason: string; transactions: Transaction[] }>
  anomalies: Array<{ reason: string; transaction: Transaction }>
}

export interface AnalysisResponse { data: AnalysisData }
