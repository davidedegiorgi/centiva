export interface PlanningData {
  currency: string
  future_balance: {
    current_balance: string
    projected_balance: string
    average_daily_net: string
    days_remaining: number
    sample_size: number
    confidence: 'low' | 'medium' | 'high'
  }
  subscriptions: Array<{
    label: string
    average_amount: string
    frequency: 'monthly' | 'yearly'
    occurrences: number
    last_charge_on: string
    next_expected_on: string
  }>
}

export interface PlanningResponse { data: PlanningData }
