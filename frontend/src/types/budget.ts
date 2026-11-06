export type CategoryBudgetStatus = 'on_track' | 'warning' | 'exceeded'

export interface CategoryBudgetItem {
  id: string
  category: string
  limit: string
  spent: string
  remaining: string
  percentage: number
  status: CategoryBudgetStatus
}

export interface CategoryBudgetData {
  month: string
  currency: string
  total_budget: string
  total_spent: string
  total_remaining: string
  items: CategoryBudgetItem[]
}

export interface CategoryBudgetResponse { data: CategoryBudgetData }

export interface CategoryBudgetPayload {
  category: string
  amount: number
  currency: string
  month: string
}
