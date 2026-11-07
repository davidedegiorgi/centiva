import type {
  DeleteAccountPayload,
  ForgotPasswordPayload,
  LoginPayload,
  RegisterPayload,
  RegisterResponse,
  ResendVerificationPayload,
  ResetPasswordPayload,
  UpdateProfilePayload,
  UserResponse,
  VerifyEmailPayload,
} from '@/types/auth'
import type {
  TransactionFilters,
  TransactionListResponse,
  TransactionPayload,
  TransactionResponse,
} from '@/types/transaction'
import type { DashboardResponse } from '@/types/dashboard'
import type { AnalysisResponse } from '@/types/analysis'
import type { BulkImportPayload } from '@/types/import'
import type { PlanningResponse } from '@/types/planning'
import type { GoalListResponse, GoalPayload, GoalResponse } from '@/types/goal'
import type { CategoryBudgetPayload, CategoryBudgetResponse } from '@/types/budget'

const backendUrl = (
  import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:8000'
).replace(/\/$/, '')

const oauthBackendUrl = (
  import.meta.env.VITE_OAUTH_BACKEND_URL
    ?? (backendUrl === '/backend' ? 'https://centiva-api.onrender.com' : backendUrl)
).replace(/\/$/, '')

type ValidationErrors = Record<string, string[]>

export class ApiError extends Error {
  readonly status: number
  readonly errors: ValidationErrors
  readonly code: string | null

  constructor(
    message: string,
    status: number,
    errors: ValidationErrors = {},
    code: string | null = null,
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.errors = errors
    this.code = code
  }
}

function getCookie(name: string): string | null {
  const prefix = `${name}=`
  const cookie = document.cookie
    .split('; ')
    .find((item) => item.startsWith(prefix))

  return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : null
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers)
  headers.set('Accept', 'application/json')

  if (options.body) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(`${backendUrl}${path}`, {
    ...options,
    credentials: 'include',
    headers,
  })

  if (response.status === 204) {
    return undefined as T
  }

  const payload = (await response.json().catch(() => null)) as {
    message?: string
    errors?: ValidationErrors
    code?: string
  } | null

  if (!response.ok) {
    throw new ApiError(
      payload?.message ?? 'Non è stato possibile completare la richiesta.',
      response.status,
      payload?.errors,
      payload?.code ?? null,
    )
  }

  return payload as T
}

async function stateChangingRequest<T>(
  path: string,
  method: 'POST' | 'PATCH' | 'DELETE',
  body?: unknown,
): Promise<T> {
  await request<void>('/sanctum/csrf-cookie')

  const csrfToken = getCookie('XSRF-TOKEN')

  if (!csrfToken) {
    throw new ApiError('Impossibile avviare la richiesta. Riprova.', 419)
  }

  return request<T>(path, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: {
      'X-XSRF-TOKEN': csrfToken,
    },
  })
}

export const authApi = {
  googleRedirectUrl(): string {
    return `${oauthBackendUrl}/auth/google/redirect`
  },

  async profile(): Promise<UserResponse> {
    return request<UserResponse>('/api/v1/profile')
  },

  async register(payload: RegisterPayload): Promise<RegisterResponse> {
    return stateChangingRequest<RegisterResponse>(
      '/api/v1/auth/register',
      'POST',
      payload,
    )
  },

  async verifyEmail(payload: VerifyEmailPayload): Promise<UserResponse> {
    return stateChangingRequest<UserResponse>('/api/v1/auth/verify-email', 'POST', payload)
  },

  async resendVerification(payload: ResendVerificationPayload): Promise<{ message: string }> {
    return stateChangingRequest<{ message: string }>('/api/v1/auth/resend-verification', 'POST', payload)
  },

  async login(payload: LoginPayload): Promise<UserResponse> {
    return stateChangingRequest<UserResponse>(
      '/api/v1/auth/login',
      'POST',
      payload,
    )
  },

  async forgotPassword(payload: ForgotPasswordPayload): Promise<{ message: string }> {
    return stateChangingRequest<{ message: string }>(
      '/api/v1/auth/forgot-password',
      'POST',
      payload,
    )
  },

  async resetPassword(payload: ResetPasswordPayload): Promise<{ message: string }> {
    return stateChangingRequest<{ message: string }>(
      '/api/v1/auth/reset-password',
      'POST',
      payload,
    )
  },

  async logout(): Promise<void> {
    return stateChangingRequest<void>('/api/v1/auth/logout', 'POST')
  },

  async updateProfile(payload: UpdateProfilePayload): Promise<UserResponse> {
    return stateChangingRequest<UserResponse>('/api/v1/profile', 'PATCH', payload)
  },

  async deleteAccount(payload: DeleteAccountPayload): Promise<void> {
    return stateChangingRequest<void>('/api/v1/profile', 'DELETE', payload)
  },
}

export const transactionApi = {
  async list(filters: TransactionFilters = {}): Promise<TransactionListResponse> {
    const query = new URLSearchParams()

    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        query.set(key, String(value))
      }
    })

    const suffix = query.size > 0 ? `?${query.toString()}` : ''

    return request<TransactionListResponse>(`/api/v1/transactions${suffix}`)
  },

  async create(payload: TransactionPayload): Promise<TransactionResponse> {
    return stateChangingRequest<TransactionResponse>(
      '/api/v1/transactions',
      'POST',
      {
        ...payload,
        // Compatibilità temporanea con il backend Render precedente.
        // Non è un campo utente e il backend aggiornato lo ignora.
        description: 'Movimento',
      },
    )
  },

  async update(
    id: string,
    payload: TransactionPayload,
  ): Promise<TransactionResponse> {
    return stateChangingRequest<TransactionResponse>(
      `/api/v1/transactions/${id}`,
      'PATCH',
      {
        ...payload,
        description: 'Movimento',
      },
    )
  },

  async remove(id: string): Promise<void> {
    return stateChangingRequest<void>(`/api/v1/transactions/${id}`, 'DELETE')
  },

  async removeMany(ids: string[]): Promise<{ deleted: number }> {
    // Le rotte singole sono disponibili anche sulle versioni precedenti di Render
    // e limitano l'operazione esclusivamente agli ID selezionati dall'utente.
    await Promise.all(ids.map((id) => transactionApi.remove(id)))

    return { deleted: ids.length }
  },

  async bulk(payload: BulkImportPayload): Promise<{ data: TransactionResponse['data'][] }> {
    return stateChangingRequest<{ data: TransactionResponse['data'][] }>(
      '/api/v1/transactions/bulk',
      'POST',
      payload,
    )
  },
}

export const dashboardApi = {
  async show(currency = 'EUR'): Promise<DashboardResponse> {
    const query = new URLSearchParams({ currency })

    return request<DashboardResponse>(`/api/v1/dashboard?${query.toString()}`)
  },
}

export const analysisApi = {
  async show(currency = 'EUR'): Promise<AnalysisResponse> {
    return request<AnalysisResponse>(`/api/v1/analysis?${new URLSearchParams({ currency })}`)
  },
}

export const planningApi = {
  async show(currency = 'EUR'): Promise<PlanningResponse> {
    return request<PlanningResponse>(`/api/v1/planning?${new URLSearchParams({ currency })}`)
  },
}

export const categoryBudgetApi = {
  async list(month: string, currency = 'EUR'): Promise<CategoryBudgetResponse> {
    const query = new URLSearchParams({ month, currency })
    return request<CategoryBudgetResponse>(`/api/v1/category-budgets?${query.toString()}`)
  },
  async save(payload: CategoryBudgetPayload): Promise<void> {
    return stateChangingRequest<void>('/api/v1/category-budgets', 'POST', payload)
  },
  async remove(id: string): Promise<void> {
    return stateChangingRequest<void>(`/api/v1/category-budgets/${id}`, 'DELETE')
  },
}

export const goalApi = {
  async list(): Promise<GoalListResponse> {
    return request<GoalListResponse>('/api/v1/savings-goals')
  },
  async create(payload: GoalPayload): Promise<GoalResponse> {
    return stateChangingRequest<GoalResponse>('/api/v1/savings-goals', 'POST', payload)
  },
  async update(id: string, payload: GoalPayload): Promise<GoalResponse> {
    return stateChangingRequest<GoalResponse>(`/api/v1/savings-goals/${id}`, 'PATCH', payload)
  },
  async remove(id: string): Promise<void> {
    return stateChangingRequest<void>(`/api/v1/savings-goals/${id}`, 'DELETE')
  },
  async contribute(id: string, amount: number, notes: string | null = null): Promise<GoalResponse> {
    return stateChangingRequest<GoalResponse>(`/api/v1/savings-goals/${id}/contributions`, 'POST', {
      amount, notes, contributed_on: new Date().toISOString().slice(0, 10),
    })
  },
}
