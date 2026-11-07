import { useState, type FormEvent } from 'react'
import {
  CheckCircle2,
  LoaderCircle,
  Save,
  Trash2,
  TriangleAlert,
  UserRound,
  X,
} from 'lucide-react'

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

interface ProfilePageProps {
  user: User
  onUserChanged: (user: User) => void
  onAccountDeleted: () => void
}

export function ProfilePage({ user, onUserChanged, onAccountDeleted }: ProfilePageProps) {
  const [name, setName] = useState(user.name)
  const [email, setEmail] = useState(user.email)
  const [error, setError] = useState<ApiError | null>(null)
  const [success, setSuccess] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [deleteError, setDeleteError] = useState<ApiError | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

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

  function closeDeleteConfirmation() {
    if (isDeleting) return

    setShowDeleteConfirmation(false)
    setDeleteConfirmation('')
    setDeleteError(null)
  }

  async function handleDeleteAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setDeleteError(null)
    setIsDeleting(true)

    try {
      await authApi.deleteAccount({ confirmation: deleteConfirmation })
      onAccountDeleted()
    } catch (caughtError) {
      setDeleteError(
        caughtError instanceof ApiError
          ? caughtError
          : new ApiError('Si è verificato un errore inatteso.', 500),
      )
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 sm:px-8 lg:py-10">
      <header className="border-b border-white/10 pb-6">
        <p className="text-sm font-medium text-emerald-300">Profilo</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Account</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">Gestisci i dati personali e le impostazioni dell’account.</p>
      </header>

      <Card className="border-white/10 bg-card shadow-[0_24px_70px_-42px_rgba(15,45,34,0.32)]">
        <CardHeader>
          <div className="mb-2 grid size-10 place-items-center rounded-xl bg-emerald-500/10 text-emerald-300">
            <UserRound className="size-5" aria-hidden="true" />
          </div>
          <CardTitle>Dati personali</CardTitle>
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

      <Card className="border-red-500/20 bg-[#0b0d0c]">
        <CardHeader>
          <div className="mb-2 grid size-10 place-items-center rounded-xl bg-red-500/10 text-red-300">
            <TriangleAlert className="size-5" aria-hidden="true" />
          </div>
          <CardTitle>Gestione account</CardTitle>
          <CardDescription>
            Elimina definitivamente il tuo account e tutti i dati associati.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!showDeleteConfirmation ? (
            <Button
              className="h-11 border-red-500/35 bg-transparent px-5 text-red-300 hover:bg-red-500/10 hover:text-red-200"
              type="button"
              variant="outline"
              onClick={() => setShowDeleteConfirmation(true)}
            >
              <Trash2 aria-hidden="true" />
              Elimina account
            </Button>
          ) : (
            <form className="flex flex-col gap-4" onSubmit={handleDeleteAccount}>
              <Alert variant="destructive">
                <TriangleAlert aria-hidden="true" />
                <AlertTitle>Azione irreversibile</AlertTitle>
                <AlertDescription>
                  Verranno eliminati profilo, transazioni, obiettivi e accantonamenti. Non sarà possibile recuperarli.
                </AlertDescription>
              </Alert>

              {deleteError && Object.keys(deleteError.errors).length === 0 && (
                <Alert variant="destructive">
                  <AlertTitle>Cancellazione non completata</AlertTitle>
                  <AlertDescription>{deleteError.message}</AlertDescription>
                </Alert>
              )}

              <div className="flex flex-col gap-2">
                <Label htmlFor="delete-confirmation">
                  Scrivi <span className="font-mono font-semibold text-red-300">ELIMINA</span> per confermare
                </Label>
                <Input
                  id="delete-confirmation"
                  autoComplete="off"
                  spellCheck={false}
                  value={deleteConfirmation}
                  onChange={(event) => setDeleteConfirmation(event.target.value)}
                  aria-invalid={Boolean(deleteError?.errors.confirmation)}
                  className="border-red-500/25 focus-visible:border-red-400 focus-visible:ring-red-400/30"
                />
                {deleteError?.errors.confirmation?.[0] && (
                  <p className="text-sm text-destructive">{deleteError.errors.confirmation[0]}</p>
                )}
              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  className="h-11 bg-red-600 px-5 text-white hover:bg-red-500"
                  type="submit"
                  disabled={isDeleting || deleteConfirmation !== 'ELIMINA'}
                >
                  {isDeleting ? (
                    <LoaderCircle className="animate-spin" aria-hidden="true" />
                  ) : (
                    <Trash2 aria-hidden="true" />
                  )}
                  Elimina definitivamente
                </Button>
                <Button
                  className="h-11"
                  type="button"
                  variant="ghost"
                  disabled={isDeleting}
                  onClick={closeDeleteConfirmation}
                >
                  <X aria-hidden="true" />
                  Annulla
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
