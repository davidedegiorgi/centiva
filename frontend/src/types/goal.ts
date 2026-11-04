export type GoalKind = 'goal' | 'challenge'
export type GoalStatus = 'active' | 'completed'
export type SavingsFrequency = 'weekly' | 'monthly'
export type ProgressUnit = 'currency' | 'days'
export type GoalIcon = 'target' | 'plane' | 'car' | 'shield' | 'phone' | 'home' | 'education' | 'gift' | 'sparkles' | 'calendar'

export interface SavingsPlan {
  recommended_amount: string
  frequency: SavingsFrequency
  remaining_periods: number
  days_remaining: number
  pace_status: 'completed' | 'overdue' | 'on_track' | 'behind'
}

export interface GoalBadge {
  key: 'first_contribution' | 'progress_25' | 'progress_50' | 'progress_100'
  label: string
}

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
  icon: GoalIcon
  target_amount: string
  current_amount: string
  progress_percentage: number
  currency: string
  target_date: string | null
  saving_frequency: SavingsFrequency | null
  progress_unit: ProgressUnit
  challenge_template: 'weekly_20' | 'no_spend_3_days' | 'category_reduction' | null
  status: GoalStatus
  plan: SavingsPlan | null
  badges: GoalBadge[]
  motivation: string
  contributions: GoalContribution[]
  created_at: string | null
}

export interface GoalPayload {
  kind: GoalKind
  name: string
  icon: GoalIcon
  target_amount: number
  currency: string
  target_date: string | null
  saving_frequency: SavingsFrequency | null
  progress_unit: ProgressUnit
  challenge_template: 'weekly_20' | 'no_spend_3_days' | 'category_reduction' | null
}

export interface GoalResponse { data: SavingsGoal }
export interface GoalListResponse { data: SavingsGoal[] }
