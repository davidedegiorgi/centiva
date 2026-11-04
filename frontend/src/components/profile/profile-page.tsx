import { useEffect, useState, type FormEvent } from 'react'
import { CheckCircle2, Download, LoaderCircle, Save, Smartphone, UserRound } from 'lucide-react'

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
import {
  canInstallApp,
  isRunningStandalone,
  requestAppInstallation,
  subscribeToInstallState,
} from '@/lib/pwa'
import type { User } from '@/types/auth'

interface ProfilePageProps {
  user: User
  onUserChanged: (user: User) => void
}

export function ProfilePage({ user, onUserChanged }: ProfilePageProps) {
  const [name, setName] = useState(user.name)
  const [email, setEmail] = useState(user.email)
  const [error, setError] = useState<ApiError | null>(null)
  const [success, setSuccess] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isInstalled, setIsInstalled] = useState(isRunningStandalone)
  const [canInstall, setCanInstall] = useState(canInstallApp)
  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent)

  useEffect(() => subscribeToInstallState(() => {
    setIsInstalled(isRunningStandalone())
    setCanInstall(canInstallApp())
  }), [])

  async function handleInstall(): Promise<void> {
    const wasAccepted = await requestAppInstallation()

    if (wasAccepted) {
      setIsInstalled(true)
      setCanInstall(false)
    }
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSuccess(false)
    setIsSaving(true)

    try {
      const response = await authApi.updateProfile({ name, email })
      onUserChanged(response.data)
      setSuccess(true)
    } catch (caughtError) {
      setError(
        caughtError instanceof ApiError
          ? caughtError
          : new ApiError('Si è verificato un errore inatteso.', 500),
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <main className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-8 lg:grid-cols-[0.7fr_1.3fr] lg:py-16">
      <section>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300">
          Il tuo account
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Ciao, {user.name.split(' ')[0]}.
        </h1>
        <p className="mt-4 max-w-md leading-7 text-muted-foreground">
          Gestisci qui i dati essenziali del tuo profilo.
        </p>
      </section>

      <Card className="border-white/10 bg-card shadow-[0_24px_70px_-42px_rgba(15,45,34,0.32)]">
        <CardHeader>
          <div className="mb-2 grid size-10 place-items-center rounded-xl bg-emerald-500/10 text-emerald-300">
            <UserRound className="size-5" aria-hidden="true" />
          </div>
          <CardTitle>Profilo personale</CardTitle>
          <CardDescription>Aggiorna nome e indirizzo email.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-5" onSubmit={handleSave}>
            {success && (
              <Alert className="border-emerald-300/25 bg-emerald-500/10 text-emerald-100">
                <CheckCircle2 aria-hidden="true" />
                <AlertTitle>Profilo aggiornato</AlertTitle>
                <AlertDescription>Le modifiche sono state salvate.</AlertDescription>
              </Alert>
            )}

            {error && Object.keys(error.errors).length === 0 && (
              <Alert variant="destructive">
                <AlertTitle>Richiesta non completata</AlertTitle>
                <AlertDescription>{error.message}</AlertDescription>
              </Alert>
            )}

            <div className="flex flex-col gap-2">
              <Label htmlFor="profile-name">Nome</Label>
              <Input
                id="profile-name"
                autoComplete="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                aria-invalid={Boolean(error?.errors.name)}
              />
              {error?.errors.name?.[0] && (
                <p className="text-sm text-destructive">{error.errors.name[0]}</p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="profile-email">Email</Label>
              <Input
                id="profile-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                aria-invalid={Boolean(error?.errors.email)}
              />
              {error?.errors.email?.[0] && (
                <p className="text-sm text-destructive">{error.errors.email[0]}</p>
              )}
            </div>

            <Button
              className="mt-2 h-11 self-start bg-emerald-600 px-5 text-white hover:bg-emerald-700"
              type="submit"
              disabled={isSaving}
            >
              {isSaving ? (
                <LoaderCircle className="animate-spin" aria-hidden="true" />
              ) : (
                <Save aria-hidden="true" />
              )}
              Salva modifiche
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-[#0b0d0c] lg:col-start-2">
        <CardHeader>
          <div className="mb-2 grid size-10 place-items-center rounded-xl bg-emerald-500/10 text-emerald-300">
            <Smartphone className="size-5" aria-hidden="true" />
          </div>
          <CardTitle>Installa Centiva</CardTitle>
          <CardDescription>
            Aprila dalla schermata Home o dal desktop come una vera applicazione.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-start gap-4">
          {isInstalled ? (
            <Alert className="border-emerald-300/25 bg-emerald-500/10 text-emerald-100">
              <CheckCircle2 aria-hidden="true" />
              <AlertTitle>Centiva è installata</AlertTitle>
              <AlertDescription>Puoi avviarla direttamente dall’icona sul dispositivo.</AlertDescription>
            </Alert>
          ) : canInstall ? (
            <>
              <Button
                className="h-11 bg-emerald-400 px-5 text-emerald-950 hover:bg-emerald-300"
                type="button"
                onClick={() => void handleInstall()}
              >
                <Download aria-hidden="true" />
                Installa l’app
              </Button>
              <p className="text-sm leading-6 text-muted-foreground">
                L’installazione non occupa lo spazio di un’app tradizionale e mantiene gli aggiornamenti automatici.
              </p>
            </>
          ) : (
            <p className="text-sm leading-6 text-muted-foreground">
              {isIos
                ? 'Su iPhone o iPad apri Centiva in Safari, tocca Condividi e scegli “Aggiungi alla schermata Home”.'
                : 'Apri il menu del browser e scegli “Installa app” o “Aggiungi alla schermata Home”.'}
            </p>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
