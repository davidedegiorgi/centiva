export interface User {
  id: number
  name: string
  email: string
  email_verified_at: string | null
  created_at: string | null
}

export interface UserResponse {
  data: User
}

export interface RegisterPayload {
  name: string
  email: string
  password: string
  password_confirmation: string
}

export interface RegisterResponse {
  message: string
  email: string
  verification_required: true
}

export interface VerifyEmailPayload {
  email: string
  code: string
}

export interface ResendVerificationPayload {
  email: string
}

export interface LoginPayload {
  email: string
  password: string
  remember: boolean
}

export interface ForgotPasswordPayload {
  email: string
}

export interface ResetPasswordPayload {
  token: string
  email: string
  password: string
  password_confirmation: string
}

export interface UpdateProfilePayload {
  name: string
}

export interface DeleteAccountPayload {
  confirmation: string
}
