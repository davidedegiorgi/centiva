import type { Transaction } from '@/types/transaction'

export interface DashboardData {
  currency: string
  period: {
    from: string
    to: string
  }
  summary: {
    income: string
    expenses: string
    net_savings: string
    previous_month_expenses: string
    expense_change_percentage: number | null
  }
  daily: Array<{
    date: string
    income: string
    expenses: string
  }>
  monthly_comparison: Array<{
    month: string
    income: string
    expenses: string
    net_savings: string
  }>
  categories: Array<{
    category: string
    total: string
  }>
  recent: Transaction[]
}

export interface DashboardResponse {
  data: DashboardData
}
