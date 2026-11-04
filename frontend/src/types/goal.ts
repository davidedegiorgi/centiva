export type GoalKind = 'goal' | 'challenge'
export type GoalStatus = 'active' | 'completed'

export interface GoalContribution {
  id: string
  amount: string
  contributed_on: string
  notes: string | null
}

export interface SavingsGoal {
  id: string
  kind: GoalKind
  name: string
  target_amount: string
  current_amount: string
  progress_percentage: number
  currency: string
  target_date: string | null
  status: GoalStatus
  contributions: GoalContribution[]
  created_at: string | null
}

export interface GoalPayload {
  kind: GoalKind
  name: string
  target_amount: number
  currency: string
  target_date: string | null
}

export interface GoalResponse { data: SavingsGoal }
export interface GoalListResponse { data: SavingsGoal[] }
