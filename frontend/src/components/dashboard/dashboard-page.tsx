import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  FileUp,
  Lightbulb,
  LoaderCircle,
  PiggyBank,
  Tags,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ApiError, dashboardApi } from '@/lib/api'
import { LiquidNumber } from '@/components/effects/liquid-number'
import { KineticTitle } from '@/components/effects/kinetic-title'
import type { DashboardData } from '@/types/dashboard'

const categoryColors = ['#059669', '#34d399', '#0f766e', '#84cc16', '#64748b', '#f59e0b']
gsap.registerPlugin(ScrollTrigger)

function money(value: string | number, currency: string): string {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(Number(value))
}

function shortDate(value: string): string {
  return new Intl.DateTimeFormat('it-IT', {
    day: '2-digit',
    month: 'short',
  }).format(new Date(`${value}T00:00:00`))
}

function monthLabel(value: string): string {
  return new Intl.DateTimeFormat('it-IT', {
    month: 'short',
    year: '2-digit',
  }).format(new Date(`${value}-01T00:00:00`))
}

interface DashboardPageProps {
  onOpenImport: () => void
  onOpenInsights: () => void
}

export function DashboardPage({ onOpenImport, onOpenInsights }: DashboardPageProps) {
  const [currency, setCurrency] = useState('EUR')
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const metricsSection = useRef<HTMLElement>(null)
  const metricsRail = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!dashboard || !metricsSection.current || !metricsRail.current || window.matchMedia('(max-width: 1023px), (prefers-reduced-motion: reduce)').matches) return
    const section = metricsSection.current
    const rail = metricsRail.current
    const context = gsap.context(() => {
      const distance = () => Math.max(0, rail.scrollWidth - window.innerWidth + 96)
      gsap.to(rail, {
        x: () => -distance(),
        ease: 'none',
        scrollTrigger: {
          trigger: section,
          start: 'top top+=76',
          end: () => `+=${distance() + 420}`,
          pin: true,
          scrub: 1.1,
          invalidateOnRefresh: true,
        },
      })
    }, section)
    ScrollTrigger.refresh()
    return () => context.revert()
  }, [dashboard])

  useEffect(() => {
    let isMounted = true

    dashboardApi
      .show(currency)
      .then((response) => {
        if (isMounted) {
          setDashboard(response.data)
          setError(null)
        }
      })
      .catch((caughtError: unknown) => {
        if (isMounted) {
          setError(
            caughtError instanceof ApiError
              ? caughtError
              : new ApiError('Impossibile caricare la dashboard.', 500),
          )
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
  }, [currency])

  function changeCurrency(nextCurrency: string) {
    setIsLoading(true)
    setCurrency(nextCurrency)
  }

  if (isLoading && !dashboard) {
    return (
      <main className="grid min-h-[70vh] place-items-center">
        <LoaderCircle className="size-6 animate-spin text-emerald-600" aria-label="Caricamento" />
      </main>
    )
  }

  if (!dashboard) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-8">
        <Alert variant="destructive">
          <AlertTitle>Dashboard non disponibile</AlertTitle>
          <AlertDescription>{error?.message}</AlertDescription>
        </Alert>
      </main>
    )
  }

  const chartData = dashboard.daily.map((item) => ({
    ...item,
    label: shortDate(item.date),
    income: Number(item.income),
    expenses: Number(item.expenses),
  }))
  const categoryData = dashboard.categories.map((item) => ({
    name: item.category,
    value: Number(item.total),
  }))
  const trend = dashboard.summary.expense_change_percentage
  const monthlyComparisonData = dashboard.monthly_comparison.map((item) => ({
    label: monthLabel(item.month),
    income: Number(item.income),
    expenses: Number(item.expenses),
    netSavings: Number(item.net_savings),
  }))

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-8 lg:py-12">
      <div className="relative min-h-[52vh] border-b border-white/10 pb-10 sm:min-h-[62vh]">
        <div className="flex justify-between gap-4">
        <div>
          <p className="font-data text-[0.64rem] font-semibold uppercase tracking-[0.24em] text-zinc-400">
            Centiva Financial Instrument / Live
          </p>
        </div>
        <select
          className="h-9 w-28 rounded-none border-x-0 border-t-0 border-b border-white/20 bg-transparent px-2 font-data text-xs outline-none focus:border-emerald-400"
          value={currency}
          onChange={(event) => changeCurrency(event.target.value)}
          aria-label="Valuta dashboard"
        >
          <option value="EUR">EUR</option>
          <option value="USD">USD</option>
          <option value="GBP">GBP</option>
          <option value="CHF">CHF</option>
        </select>
        </div>
        <div className="pointer-events-auto absolute inset-x-[-4vw] top-[18%] opacity-30 sm:top-[12%]">
          <KineticTitle text="RIEPILOGO MENSILE" />
        </div>
        <div className="absolute inset-x-0 bottom-10">
          <p className="mb-2 font-data text-[0.65rem] uppercase tracking-[0.24em] text-emerald-400">Risultato del mese</p>
          <h1 className="max-w-full overflow-hidden text-[clamp(3.2rem,10vw,8.6rem)] font-black leading-[0.84] tracking-[-0.09em] text-[#f4f4f0]" data-cursor-label="BALANCE">
            <LiquidNumber value={dashboard.summary.net_savings} currency={dashboard.currency} />
          </h1>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Aggiornamento non riuscito</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      )}

      <section className="grid overflow-hidden rounded-[2px] border border-white/10 bg-[#0b0d0c] text-white shadow-[inset_1px_1px_rgba(255,255,255,0.07),inset_-60px_-40px_120px_rgba(0,0,0,0.72),0_45px_110px_-60px_rgba(0,0,0,1)] lg:grid-cols-[1.1fr_1fr]">
        <div className="p-6 sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-200">
            Importazione intelligente
          </p>
          <h2 className="mt-3 max-w-lg text-2xl font-semibold tracking-tight sm:text-3xl">
            Trasforma screenshot, scontrini e CSV in transazioni
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-white/70">
            Carica il documento, controlla i dati estratti e correggi importi, date e categorie prima di salvarli.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button className="h-10 bg-emerald-400 px-4 text-emerald-950 shadow-[0_10px_35px_-12px_rgba(52,211,153,0.8)] hover:bg-emerald-300" onClick={onOpenImport}>
              <FileUp /> Carica un documento
            </Button>
            <Button className="h-10 border-white/20 bg-white/10 px-4 text-white hover:bg-white/20" variant="outline" onClick={onOpenInsights}>
              <Lightbulb /> Vedi i suggerimenti
            </Button>
          </div>
        </div>
        <div className="grid gap-px bg-white/10 sm:grid-cols-3 lg:grid-cols-1">
          <div className="flex gap-3 bg-black/10 p-5"><FileUp className="mt-0.5 size-5 shrink-0 text-emerald-300" /><div><p className="font-medium">1. Carica</p><p className="mt-1 text-xs leading-5 text-white/60">Screenshot Postepay, foto o CSV</p></div></div>
          <div className="flex gap-3 bg-black/10 p-5"><Tags className="mt-0.5 size-5 shrink-0 text-emerald-300" /><div><p className="font-medium">2. Correggi</p><p className="mt-1 text-xs leading-5 text-white/60">Rivedi i campi e le categorie suggerite</p></div></div>
          <div className="flex gap-3 bg-black/10 p-5"><Lightbulb className="mt-0.5 size-5 shrink-0 text-emerald-300" /><div><p className="font-medium">3. Risparmia</p><p className="mt-1 text-xs leading-5 text-white/60">Apri Insights dopo il salvataggio</p></div></div>
        </div>
      </section>

      <section ref={metricsSection} className="relative -mx-4 overflow-hidden border-y border-white/10 py-8 sm:-mx-8 lg:min-h-[72vh] lg:py-12">
        <div className="mb-10 flex items-end justify-between px-4 sm:px-8">
          <div><p className="font-data text-[0.62rem] uppercase tracking-[0.25em] text-zinc-500">Index / 01—04</p><h2 className="mt-3 text-4xl font-bold tracking-tighter sm:text-6xl">Strumenti finanziari</h2></div>
          <p className="hidden max-w-xs text-right text-sm leading-6 text-muted-foreground md:block">Scorri verticalmente. I dati si muovono come tavole espositive nello spazio.</p>
        </div>
        <div ref={metricsRail} className="flex w-max snap-x gap-4 overflow-x-auto px-4 pb-4 sm:px-8 lg:overflow-visible" data-cursor-label="DRAG">
        <Card className="min-h-80 w-[82vw] max-w-[760px] shrink-0 snap-center border-0 bg-[#0b0d0c] text-white shadow-[inset_0_1px_rgba(255,255,255,0.12),0_45px_100px_-60px_rgba(0,0,0,1)] sm:w-[58vw] lg:min-h-[420px]">
          <CardContent className="flex flex-col gap-5">
            <span className="grid size-10 place-items-center rounded-xl bg-white/10 text-emerald-300">
              <PiggyBank aria-hidden="true" />
            </span>
            <div>
              <p className="font-data text-xs uppercase tracking-[0.18em] text-white/45">Risultato del mese</p>
              <LiquidNumber className="mt-4 text-4xl font-semibold sm:text-6xl" value={dashboard.summary.net_savings} currency={dashboard.currency} />
            </div>
          </CardContent>
        </Card>

        <Card className="min-h-80 w-[76vw] max-w-[620px] shrink-0 snap-center border-white/10 bg-[#111312] sm:w-[46vw] lg:min-h-[420px]">
          <CardContent className="flex flex-col gap-5">
            <span className="grid size-10 place-items-center rounded-xl bg-emerald-500/10 text-emerald-300">
              <TrendingUp aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm text-muted-foreground">Entrate del mese</p>
              <LiquidNumber className="mt-4 text-4xl font-semibold sm:text-5xl" value={dashboard.summary.income} currency={dashboard.currency} />
            </div>
          </CardContent>
        </Card>

        <Card className="min-h-80 w-[76vw] max-w-[620px] shrink-0 snap-center border-white/10 bg-[#0d0f0e] sm:w-[46vw] lg:min-h-[420px]">
          <CardContent className="flex flex-col gap-5">
            <span className="grid size-10 place-items-center rounded-xl bg-white/5 text-slate-300">
              <TrendingDown aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm text-muted-foreground">Uscite del mese</p>
              <LiquidNumber className="mt-4 text-4xl font-semibold sm:text-5xl" value={dashboard.summary.expenses} currency={dashboard.currency} />
            </div>
          </CardContent>
        </Card>

        <Card className="min-h-80 w-[72vw] max-w-[540px] shrink-0 snap-center border-white/10 bg-[#16130e] sm:w-[40vw] lg:min-h-[420px]">
          <CardContent className="flex flex-col gap-5">
            <span className="grid size-10 place-items-center rounded-xl bg-amber-50 text-amber-700">
              <PiggyBank aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm text-muted-foreground">Variazione uscite</p>
              <p className="mt-4 font-data text-5xl font-semibold tracking-tighter text-amber-500">
                {trend === null ? '—' : `${trend > 0 ? '+' : ''}${trend}%`}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">rispetto al mese scorso</p>
            </div>
          </CardContent>
        </Card>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.55fr_0.85fr]">
        <Card className="border-white/10 bg-card">
          <CardHeader>
            <CardTitle>Andamento del mese</CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length === 0 ? (
              <div className="grid h-72 place-items-center text-sm text-muted-foreground">
                I movimenti del mese appariranno qui.
              </div>
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ left: -15, right: 10 }}>
                    <defs>
                      <linearGradient id="income" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#059669" stopOpacity={0.28} />
                        <stop offset="100%" stopColor="#059669" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="expenses" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#64748b" stopOpacity={0.22} />
                        <stop offset="100%" stopColor="#64748b" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} fontSize={12} />
                    <YAxis axisLine={false} tickLine={false} fontSize={12} />
                    <Tooltip formatter={(value) => money(Number(value), dashboard.currency)} />
                    <Area type="monotone" dataKey="income" name="Entrate" stroke="#059669" fill="url(#income)" strokeWidth={2} />
                    <Area type="monotone" dataKey="expenses" name="Uscite" stroke="#64748b" fill="url(#expenses)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-card">
          <CardHeader>
            <CardTitle>Uscite per categoria</CardTitle>
          </CardHeader>
          <CardContent>
            {categoryData.length === 0 ? (
              <div className="grid h-72 place-items-center text-sm text-muted-foreground">
                Nessuna uscita categorizzata nel mese.
              </div>
            ) : (
              <div className="flex flex-col gap-4 sm:flex-row xl:flex-col">
                <div className="h-48 min-w-0 flex-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={categoryData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={78} paddingAngle={3}>
                        {categoryData.map((item, index) => (
                          <Cell key={item.name} fill={categoryColors[index % categoryColors.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => money(Number(value), dashboard.currency)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-1 flex-col gap-2">
                  {categoryData.slice(0, 6).map((item, index) => (
                    <div className="flex items-center justify-between gap-3 text-sm" key={item.name}>
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: categoryColors[index % categoryColors.length] }} />
                        <span className="truncate text-muted-foreground">{item.name}</span>
                      </span>
                      <span className="font-medium text-foreground">{money(item.value, dashboard.currency)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <Card className="border-white/10 bg-card">
        <CardHeader>
          <CardTitle>Confronto con i mesi precedenti</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyComparisonData} margin={{ left: -10, right: 10, top: 10 }}>
                <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#27272a" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} fontSize={12} />
                <YAxis axisLine={false} tickLine={false} fontSize={12} />
                <Tooltip formatter={(value) => money(Number(value), dashboard.currency)} />
                <Area type="monotone" dataKey="income" name="Entrate" stroke="#10b981" fill="transparent" strokeWidth={2} />
                <Area type="monotone" dataKey="expenses" name="Uscite" stroke="#a1a1aa" fill="transparent" strokeWidth={2} />
                <Area type="monotone" dataKey="netSavings" name="Risultato del mese" stroke="#d97706" fill="transparent" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-card">
        <CardHeader>
          <CardTitle>Movimenti recenti</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col divide-y p-0">
          {dashboard.recent.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-muted-foreground">
              Non ci sono ancora transazioni.
            </p>
          ) : (
            dashboard.recent.map((transaction) => (
              <div className="flex items-center gap-3 px-5 py-4" key={transaction.id}>
                <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${transaction.type === 'income' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-white/5 text-slate-300'}`}>
                  {transaction.type === 'income' ? <ArrowDownLeft aria-hidden="true" /> : <ArrowUpRight aria-hidden="true" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">{transaction.description}</p>
                  <p className="text-xs text-muted-foreground">{shortDate(transaction.occurred_on)}</p>
                </div>
                <p className={`font-semibold ${transaction.type === 'income' ? 'text-emerald-300' : 'text-foreground'}`}>
                  {transaction.type === 'income' ? '+' : '−'} {money(transaction.amount, transaction.currency)}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Button className="self-start text-emerald-200" variant="ghost" onClick={onOpenInsights}>
        Analizza le tue abitudini e scopri come risparmiare <ArrowRight />
      </Button>
    </main>
  )
}
