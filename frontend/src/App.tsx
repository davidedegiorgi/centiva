import { lazy, Suspense, useEffect, useState } from 'react'
import { LoaderCircle } from 'lucide-react'

import { BrandLogo } from '@/components/brand-logo'
import { AppShell, type AppView } from '@/components/layout/app-shell'
import { ApiError, authApi } from '@/lib/api'
import type { User } from '@/types/auth'

type TransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => { finished: Promise<void> }
}

const DashboardPage = lazy(async () => ({ default: (await import('@/components/dashboard/dashboard-page')).DashboardPage }))
const AuthForm = lazy(async () => ({ default: (await import('@/components/auth/auth-form')).AuthForm }))
const TransactionsPage = lazy(async () => ({ default: (await import('@/components/transactions/transactions-page')).TransactionsPage }))
const ImportPage = lazy(async () => ({ default: (await import('@/components/import/import-page')).ImportPage }))
const AnalysisPage = lazy(async () => ({ default: (await import('@/components/analysis/analysis-page')).AnalysisPage }))
const PlanningPage = lazy(async () => ({ default: (await import('@/components/planning/planning-page')).PlanningPage }))
const GoalsPage = lazy(async () => ({ default: (await import('@/components/goals/goals-page')).GoalsPage }))
const ProfilePage = lazy(async () => ({ default: (await import('@/components/profile/profile-page')).ProfilePage }))
const MobileCapturePage = lazy(async () => ({ default: (await import('@/components/capture/mobile-capture-page')).MobileCapturePage }))

function initialAuthenticatedView(): AppView {
  return window.matchMedia('(max-width: 767px)').matches ? 'capture' : 'dashboard'
}

function PageLoader() {
  return <div className="grid min-h-[60vh] place-items-center"><LoaderCircle className="size-6 animate-spin text-emerald-300" aria-label="Caricamento pagina" /></div>
}

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hasAuthHint, setHasAuthHint] = useState(() => window.localStorage.getItem('centiva.authenticated') === '1')
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [activeView, setActiveView] = useState<AppView>('dashboard')

  function changeView(nextView: AppView) {
    if (nextView === activeView) return

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const transitionDocument = document as TransitionDocument

    if (reducedMotion || !transitionDocument.startViewTransition) {
      setActiveView(nextView)
      return
    }

    transitionDocument.startViewTransition(() => setActiveView(nextView))
  }

  useEffect(() => {
    let isMounted = true
    const shouldWarmOcr = window.matchMedia('(max-width: 767px)').matches

    if (shouldWarmOcr) {
      void import('@/lib/ocr').then(({ warmOcr }) => warmOcr()).catch(() => undefined)
    }

    authApi
      .profile()
      .then((response) => {
        if (isMounted) {
          const initialView = initialAuthenticatedView()
          window.localStorage.setItem('centiva.authenticated', '1')
          setHasAuthHint(true)
          setUser(response.data)
          setActiveView(initialView)
        }
      })
      .catch((error: unknown) => {
        if (error instanceof ApiError && error.status === 401) {
          window.localStorage.removeItem('centiva.authenticated')
          setHasAuthHint(false)
        }
        if (!(error instanceof ApiError && error.status === 401)) {
          console.error('Impossibile verificare la sessione.', error)
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [])

  async function handleLogout() {
    setIsLoggingOut(true)

    try {
      await authApi.logout()
      window.localStorage.removeItem('centiva.authenticated')
      setHasAuthHint(false)
      setUser(null)
      setActiveView('dashboard')
    } catch (error) {
      console.error('Impossibile completare il logout.', error)
    } finally {
      setIsLoggingOut(false)
    }
  }

  function handleAccountDeleted() {
    window.localStorage.removeItem('centiva.authenticated')
    setHasAuthHint(false)
    setUser(null)
    setActiveView('dashboard')
  }

  const showImmediateCamera = isLoading && hasAuthHint && window.matchMedia('(max-width: 767px)').matches
  const showAuthenticatedCamera = !isLoading && user !== null && activeView === 'capture'

  if (showImmediateCamera || showAuthenticatedCamera) {
    return <Suspense fallback={<PageLoader />}><MobileCapturePage sessionReady={showAuthenticatedCamera} onEnterApp={() => { if (user) setActiveView('dashboard') }} /></Suspense>
  }

  if (isLoading) {
    return (
      <main className="grid min-h-screen place-items-center bg-background">
        <div className="flex flex-col items-center gap-4 text-emerald-300">
          <BrandLogo className="h-8 w-auto" />
          <LoaderCircle className="size-5 animate-spin" aria-label="Caricamento" />
        </div>
      </main>
    )
  }

  if (!user) {
    return (
      <Suspense fallback={<PageLoader />}><AuthForm
        onAuthenticated={(authenticatedUser) => {
          window.localStorage.setItem('centiva.authenticated', '1')
          setHasAuthHint(true)
          setUser(authenticatedUser)
          setActiveView(initialAuthenticatedView())
        }}
      /></Suspense>
    )
  }

  return (
    <AppShell
      user={user}
      activeView={activeView}
      isLoggingOut={isLoggingOut}
      onViewChange={changeView}
      onLogout={handleLogout}
    >
      <div className="view-stage" key={activeView}>
      <Suspense fallback={<PageLoader />}>
        {activeView === 'dashboard' ? (
          <DashboardPage
            onOpenImport={() => changeView('import')}
            onOpenInsights={() => changeView('analysis')}
          />
        ) : activeView === 'transactions' ? (
          <TransactionsPage />
        ) : activeView === 'import' ? (
          <ImportPage />
        ) : activeView === 'analysis' ? (
          <AnalysisPage />
        ) : activeView === 'planning' ? (
          <PlanningPage />
        ) : activeView === 'goals' ? (
          <GoalsPage />
        ) : (
          <ProfilePage
            user={user}
            onUserChanged={setUser}
            onAccountDeleted={handleAccountDeleted}
          />
        )}
      </Suspense>
      </div>
    </AppShell>
  )
}

export default App
