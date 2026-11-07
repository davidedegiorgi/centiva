import type { ReactNode } from 'react'
import { CalendarClock, ChartNoAxesCombined, Lightbulb, ListMinus, LoaderCircle, LogOut, Plus, type LucideIcon } from 'lucide-react'

import { BrandLogo } from '@/components/brand-logo'
import { Button } from '@/components/ui/button'
import type { User } from '@/types/auth'

export type AppView = 'capture' | 'dashboard' | 'transactions' | 'import' | 'analysis' | 'planning' | 'profile'

const navigationItems: Array<{ view: AppView; label: string; icon: LucideIcon }> = [
  { view: 'dashboard', label: 'Dashboard', icon: ChartNoAxesCombined },
  { view: 'transactions', label: 'Movimenti', icon: ListMinus },
  { view: 'capture', label: 'Aggiungi', icon: Plus },
  { view: 'analysis', label: 'Insights', icon: Lightbulb },
  { view: 'planning', label: 'Pianifica', icon: CalendarClock },
]

interface AppShellProps {
  user: User
  activeView: AppView
  isLoggingOut: boolean
  immersive?: boolean
  children: ReactNode
  onViewChange: (view: AppView) => void
  onLogout: () => void
}

export function AppShell({
  user,
  activeView,
  isLoggingOut,
  immersive = false,
  children,
  onViewChange,
  onLogout,
}: AppShellProps) {
  const userInitial = user.name.trim().charAt(0).toLocaleUpperCase('it-IT')
    || user.email.trim().charAt(0).toLocaleUpperCase('it-IT')

  return (
    <div className={`relative bg-background ${immersive ? 'h-[100svh] overflow-hidden overscroll-none' : 'min-h-screen overflow-x-hidden'}`}>
      <div className="pointer-events-none fixed -left-40 top-20 size-96 rounded-full bg-emerald-500/[0.07] blur-3xl" />
      <div className="pointer-events-none fixed -right-48 top-[38%] size-[30rem] rounded-full bg-teal-400/[0.05] blur-3xl" />
      {!immersive && <header className="sticky top-0 z-30 border-b border-white/[0.07] bg-[#080d0b]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-8">
          <button
            className="flex items-center"
            type="button"
            onClick={() => onViewChange('dashboard')}
            aria-label="Vai alla dashboard"
          >
            <BrandLogo className="h-8 w-auto sm:h-9" />
          </button>

          <div className="ml-auto flex items-center gap-2">
            <span className="hidden max-w-40 truncate text-sm text-muted-foreground md:block">
              {user.name}
            </span>
            <Button
              variant="ghost"
              type="button"
              disabled={isLoggingOut}
              onClick={onLogout}
              aria-label="Esci"
            >
              {isLoggingOut ? (
                <LoaderCircle className="animate-spin" aria-hidden="true" />
              ) : (
                <LogOut aria-hidden="true" />
              )}
              <span className="hidden sm:inline">Esci</span>
            </Button>
            <button
              className={`grid size-9 shrink-0 place-items-center rounded-full border font-data text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 ${activeView === 'profile' ? 'border-emerald-300 bg-emerald-400 text-emerald-950' : 'border-white/15 bg-white/[0.07] text-emerald-200 hover:border-emerald-300/50 hover:bg-emerald-400/10'}`}
              type="button"
              onClick={() => onViewChange('profile')}
              aria-label="Apri il profilo"
              aria-current={activeView === 'profile' ? 'page' : undefined}
              title="Profilo"
            >
              {userInitial}
            </button>
          </div>
        </div>
      </header>}

      <div className={immersive ? 'h-full overflow-hidden' : 'pb-[calc(10rem+env(safe-area-inset-bottom))] sm:pb-[calc(11rem+env(safe-area-inset-bottom))]'}>{children}</div>

      <nav
        className="fixed bottom-[calc(0.75rem+env(safe-area-inset-bottom))] left-1/2 z-40 w-[calc(100%-1rem)] max-w-3xl -translate-x-1/2 touch-pan-x overscroll-none rounded-[1.4rem] border border-white/15 bg-[#090c0a]/90 p-1.5 shadow-[0_24px_70px_rgba(0,0,0,0.55),inset_0_1px_rgba(255,255,255,0.07)] backdrop-blur-2xl"
        aria-label="Navigazione principale"
      >
        <div className="flex min-w-0 touch-pan-x items-stretch gap-1 overflow-x-auto overflow-y-hidden overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {navigationItems.map(({ view, label, icon: Icon }) => {
            const isActive = activeView === view || (view === 'capture' && activeView === 'import')
            const isAddAction = view === 'capture'

            return (
              <button
                key={view}
                className={`group relative flex min-w-[4.6rem] flex-1 flex-col items-center justify-center gap-1 rounded-[1rem] px-2 py-2.5 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 ${isAddAction ? '-my-1 border border-emerald-200/45 bg-emerald-400 text-emerald-950 shadow-[0_10px_28px_rgba(16,185,129,0.3),inset_0_1px_rgba(255,255,255,0.45)] hover:-translate-y-0.5 hover:bg-emerald-300' : isActive ? 'bg-white/[0.09] text-emerald-300 shadow-[inset_0_1px_rgba(255,255,255,0.06)]' : 'text-zinc-500 hover:bg-white/[0.05] hover:text-zinc-200'}`}
                type="button"
                aria-current={isActive ? 'page' : undefined}
                onPointerEnter={view === 'capture' ? () => {
                  void import('@/lib/ocr').then(({ warmOcr }) => warmOcr()).catch(() => undefined)
                } : undefined}
                onClick={() => {
                  const target = view === 'capture' && window.matchMedia('(min-width: 768px)').matches
                    ? 'import'
                    : view
                  onViewChange(target)
                }}
              >
                <Icon className={`${isAddAction ? 'size-6 stroke-[2.5]' : 'size-5'} transition-transform duration-500 group-hover:-translate-y-0.5 ${isActive && !isAddAction ? 'drop-shadow-[0_0_10px_rgba(52,211,153,0.45)]' : ''}`} aria-hidden="true" />
                <span className={`font-data text-[0.6rem] tracking-tight ${isAddAction ? 'font-bold' : 'font-medium'}`}>{label}</span>
                {isActive && !isAddAction && <span className="absolute bottom-0.5 h-0.5 w-4 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]" />}
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
