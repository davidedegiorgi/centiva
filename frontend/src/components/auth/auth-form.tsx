import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { ArrowLeft, ArrowRight, CheckCircle2, Eye, EyeOff, LoaderCircle, LockKeyhole, ShieldCheck, Sparkles } from 'lucide-react'

import { BrandLogo } from '@/components/brand-logo'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ApiError, authApi } from '@/lib/api'
import type { User } from '@/types/auth'

type AuthMode = 'login' | 'register' | 'verify' | 'forgot' | 'reset'

interface AuthFormProps {
  onAuthenticated: (user: User) => void
}

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) {
    return null
  }

  return <p className="text-sm text-destructive">{errors[0]}</p>
}

interface PasswordFieldProps {
  id: string
  label: string
  value: string
  visible: boolean
  autoComplete: string
  error?: string[]
  action?: ReactNode
  onChange: (value: string) => void
  onToggle: () => void
}

function PasswordField({ id, label, value, visible, autoComplete, error, action, onChange, onToggle }: PasswordFieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={id}>{label}</Label>
        {action}
      </div>
      <div className="relative">
        <Input
          className="pr-11"
          id={id}
          name={id.replaceAll('-', '_')}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={Boolean(error)}
        />
        <button
          className="absolute inset-y-0 right-0 grid w-11 place-items-center text-muted-foreground transition-colors hover:text-foreground"
          type="button"
          onClick={onToggle}
          aria-label={visible ? `Nascondi ${label.toLowerCase()}` : `Mostra ${label.toLowerCase()}`}
          aria-pressed={visible}
        >
          {visible ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
        </button>
      </div>
      <FieldError errors={error} />
    </div>
  )
}

export function AuthForm({ onAuthenticated }: AuthFormProps) {
  const initialParams = new URLSearchParams(window.location.search)
  const resetToken = initialParams.get('reset_token') ?? ''
  const [mode, setMode] = useState<AuthMode>(resetToken ? 'reset' : 'login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState(initialParams.get('email') ?? '')
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<ApiError | null>(() => {
    const message = initialParams.get('auth_error')
    return message ? new ApiError(message, 400) : null
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isRegister = mode === 'register'
  const isForgot = mode === 'forgot'
  const isReset = mode === 'reset'
  const isVerify = mode === 'verify'

  useEffect(() => {
    const url = new URL(window.location.href)
    if (!url.searchParams.has('auth_error') && !url.searchParams.has('auth')) return
    url.searchParams.delete('auth_error')
    url.searchParams.delete('auth')
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSuccess(null)
    setIsSubmitting(true)

    try {
      if (isForgot) {
        const response = await authApi.forgotPassword({ email })
        setSuccess(response.message)
        return
      }

      if (isReset) {
        const response = await authApi.resetPassword({
          token: resetToken,
          email,
          password,
          password_confirmation: passwordConfirmation,
        })
        const url = new URL(window.location.href)
        url.searchParams.delete('reset_token')
        url.searchParams.delete('email')
        window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
        setMode('login')
        setPassword('')
        setPasswordConfirmation('')
        setSuccess(response.message)
        return
      }

      if (isVerify) {
        const response = await authApi.verifyEmail({ email, code: verificationCode })
        onAuthenticated(response.data)
        return
      }

      if (isRegister) {
        const response = await authApi.register({
          name,
          email,
          password,
          password_confirmation: passwordConfirmation,
        })
        setEmail(response.email)
        setPassword('')
        setPasswordConfirmation('')
        setMode('verify')
        setSuccess(response.message)
        return
      }

      const response = await authApi.login({ email, password, remember: true })
      onAuthenticated(response.data)
    } catch (caughtError) {
      if (caughtError instanceof ApiError && caughtError.code === 'email_verification_required') {
        setMode('verify')
        setPassword('')
        setSuccess('Inserisci il codice ricevuto via email per completare la verifica.')
        return
      }
      setError(
        caughtError instanceof ApiError
          ? caughtError
          : new ApiError('Si è verificato un errore inatteso.', 500),
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  async function resendVerificationCode() {
    setError(null)
    setSuccess(null)
    setIsSubmitting(true)

    try {
      const response = await authApi.resendVerification({ email })
      setSuccess(response.message)
    } catch (caughtError) {
      setError(caughtError instanceof ApiError ? caughtError : new ApiError('Non è stato possibile inviare un nuovo codice.', 500))
    } finally {
      setIsSubmitting(false)
    }
  }

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode)
    setError(null)
    setSuccess(null)
    setPassword('')
    setPasswordConfirmation('')
    setVerificationCode('')
    setShowPassword(false)
    setShowConfirmation(false)
  }

  const title = isRegister
    ? 'Crea il tuo account'
    : isVerify
      ? 'Verifica la tua email'
    : isForgot
      ? 'Recupera la password'
      : isReset
        ? 'Crea una nuova password'
        : 'Bentornato'

  const description = isRegister
    ? 'Inizia a costruire una visione più chiara delle tue finanze.'
    : isVerify
      ? `Inserisci il codice di 6 cifre inviato a ${email}.`
    : isForgot
      ? 'Inserisci la tua email. Se è associata a un account, riceverai il link di recupero.'
      : isReset
        ? 'Scegli una password nuova e diversa da quella precedente.'
        : 'Accedi al tuo spazio finanziario personale.'

  const submitLabel = isRegister
    ? 'Crea account'
    : isVerify
      ? 'Verifica e accedi'
    : isForgot
      ? 'Invia link di recupero'
      : isReset
        ? 'Aggiorna password'
        : 'Accedi'

  return (
    <main className="min-h-screen bg-background lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(480px,0.78fr)]">
      <section className="relative hidden overflow-hidden border-r border-white/10 bg-[#090a09] p-12 text-white shadow-[inset_-120px_-80px_180px_rgba(0,0,0,0.78),inset_1px_0_rgba(255,255,255,0.05)] lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-24 -top-24 size-80 rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="absolute bottom-24 left-24 size-2 rounded-full bg-emerald-300 shadow-[0_0_60px_20px_rgba(52,211,153,0.25)]" />
        <BrandLogo className="relative h-10 w-auto drop-shadow-[0_0_24px_rgba(165,243,207,0.2)]" />

        <div className="relative max-w-xl">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-emerald-300">
            Chiarezza finanziaria
          </p>
          <h1 className="mt-5 text-5xl font-semibold leading-[1.08] tracking-[-0.04em]">
            Ogni centesimo racconta una storia.
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-8 text-white/65">
            Centiva trasforma ricevute, screenshot e movimenti in decisioni
            semplici e consapevoli.
          </p>
        </div>

        <div className="relative flex items-center gap-3 text-sm text-white/60">
          <Sparkles className="size-5 text-emerald-300" aria-hidden="true" />
          Meno tempo sui conti, più spazio per i tuoi obiettivi.
        </div>
      </section>

      <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-md">
          <BrandLogo className="mb-8 h-9 w-auto lg:hidden" />

          <Card className="border-white/10 bg-card shadow-[0_24px_70px_-36px_rgba(15,45,34,0.35)]">
            <CardHeader className="gap-2">
              {(isForgot || isReset || isVerify) && (
                <button
                  className="mb-2 flex w-fit items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
                  type="button"
                  onClick={() => switchMode('login')}
                >
                  <ArrowLeft className="size-4" aria-hidden="true" />
                  Torna all’accesso
                </button>
              )}
              <CardTitle className="text-2xl tracking-tight">{title}</CardTitle>
              <CardDescription className="leading-6">{description}</CardDescription>
            </CardHeader>

            <CardContent>
              {!isForgot && !isReset && !isVerify && (
                <>
                  <Button
                    className="h-11 w-full border-white/15 bg-white/[0.06] text-white hover:bg-white/[0.1] hover:text-white"
                    type="button"
                    variant="outline"
                    disabled={isSubmitting}
                    onClick={() => window.location.assign(authApi.googleRedirectUrl())}
                  >
                    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
                      <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.91h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.4Z" />
                      <path fill="#34A853" d="M12 22c2.7 0 4.98-.9 6.63-2.37l-3.24-2.54c-.9.6-2.05.96-3.39.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.62A10 10 0 0 0 12 22Z" />
                      <path fill="#FBBC05" d="M6.39 13.92A6.02 6.02 0 0 1 6.07 12c0-.67.12-1.32.32-1.92V7.46H3.04A10 10 0 0 0 2 12c0 1.61.39 3.14 1.04 4.54l3.35-2.62Z" />
                      <path fill="#EA4335" d="M12 5.95c1.47 0 2.79.51 3.83 1.5l2.87-2.88A9.64 9.64 0 0 0 12 2a10 10 0 0 0-8.96 5.46l3.35 2.62C7.18 7.71 9.39 5.95 12 5.95Z" />
                    </svg>
                    Continua con Google
                  </Button>

                  <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    <span className="h-px flex-1 bg-white/10" />
                    oppure
                    <span className="h-px flex-1 bg-white/10" />
                  </div>
                </>
              )}

              <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
                {error && Object.keys(error.errors).length === 0 && (
                  <Alert variant="destructive">
                    <LockKeyhole aria-hidden="true" />
                    <AlertTitle>Richiesta non completata</AlertTitle>
                    <AlertDescription>{error.message}</AlertDescription>
                  </Alert>
                )}
                {success && (
                  <Alert className="border-emerald-300/25 bg-emerald-500/10 text-emerald-100">
                    <CheckCircle2 className="text-emerald-300" aria-hidden="true" />
                    <AlertTitle>Operazione completata</AlertTitle>
                    <AlertDescription>{success}</AlertDescription>
                  </Alert>
                )}

                {isRegister && (
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="name">Nome</Label>
                    <Input
                      id="name"
                      name="name"
                      autoComplete="name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      aria-invalid={Boolean(error?.errors.name)}
                    />
                    <FieldError errors={error?.errors.name} />
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    readOnly={isVerify}
                    aria-invalid={Boolean(error?.errors.email)}
                  />
                  <FieldError errors={error?.errors.email} />
                </div>

                {isVerify && (
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="verification-code">Codice di verifica</Label>
                    <div className="relative">
                      <ShieldCheck className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-emerald-300" aria-hidden="true" />
                      <Input
                        className="h-12 pl-11 text-center font-data text-xl tracking-[0.38em]"
                        id="verification-code"
                        name="verification_code"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={6}
                        pattern="[0-9]{6}"
                        value={verificationCode}
                        onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                        aria-invalid={Boolean(error?.errors.code)}
                        autoFocus
                      />
                    </div>
                    <FieldError errors={error?.errors.code} />
                    <p className="text-xs leading-5 text-muted-foreground">Il codice scade dopo 10 minuti e può essere usato una sola volta.</p>
                  </div>
                )}

                {!isForgot && !isVerify && (
                  <PasswordField
                    id="password"
                    label={isReset ? 'Nuova password' : 'Password'}
                    value={password}
                    visible={showPassword}
                    autoComplete={isRegister || isReset ? 'new-password' : 'current-password'}
                    error={error?.errors.password}
                    onChange={setPassword}
                    onToggle={() => setShowPassword((current) => !current)}
                    action={mode === 'login' ? (
                      <button
                        className="text-xs font-medium text-emerald-300 hover:text-emerald-200"
                        type="button"
                        onClick={() => switchMode('forgot')}
                      >
                        Password dimenticata?
                      </button>
                    ) : undefined}
                  />
                )}

                {(isRegister || isReset) && (
                  <>
                    <PasswordField
                      id="password-confirmation"
                      label="Conferma password"
                      value={passwordConfirmation}
                      visible={showConfirmation}
                      autoComplete="new-password"
                      error={error?.errors.password_confirmation}
                      onChange={setPasswordConfirmation}
                      onToggle={() => setShowConfirmation((current) => !current)}
                    />
                    <p className="-mt-2 text-xs leading-5 text-muted-foreground">
                      Almeno 12 caratteri, con maiuscole, minuscole, numeri e simboli.
                    </p>
                  </>
                )}

                <Button
                  className="h-11 w-full bg-emerald-600 text-white hover:bg-emerald-700"
                  type="submit"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <LoaderCircle className="animate-spin" aria-hidden="true" />
                  ) : (
                    <ArrowRight aria-hidden="true" />
                  )}
                  {submitLabel}
                </Button>

                {isVerify && (
                  <button
                    className="text-sm font-medium text-emerald-300 hover:text-emerald-200 disabled:opacity-50"
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => void resendVerificationCode()}
                  >
                    Non hai ricevuto il codice? Invia di nuovo
                  </button>
                )}
              </form>

              {!isForgot && !isReset && !isVerify && (
                <p className="mt-6 text-center text-sm text-muted-foreground">
                  {isRegister ? 'Hai già un account?' : 'Non hai ancora un account?'}{' '}
                  <button
                    className="font-semibold text-emerald-300 hover:text-emerald-200"
                    type="button"
                    onClick={() => switchMode(isRegister ? 'login' : 'register')}
                  >
                    {isRegister ? 'Accedi' : 'Registrati'}
                  </button>
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  )
}
