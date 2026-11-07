import { useEffect, useState, type ReactNode } from 'react'
import {
  ArrowDownLeft, ArrowRight, ArrowUpRight, ChevronDown, FileUp, Lightbulb,
  LoaderCircle, Tags, TrendingDown, TrendingUp,
} from 'lucide-react'
import {
  Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts'

import { LiquidNumber } from '@/components/effects/liquid-number'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ApiError, dashboardApi } from '@/lib/api'
import type { DashboardData } from '@/types/dashboard'

const categoryColors = ['#10b981', '#34d399', '#0f766e', '#84cc16', '#64748b', '#f59e0b']
const importGuideStorageKey = 'centiva.import-guide-seen'

function money(value: string | number, currency: string): string {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(value))
}

function shortDate(value: string): string {
  return new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: 'short' }).format(new Date(`${value}T00:00:00`))
}

function monthLabel(value: string): string {
  return new Intl.DateTimeFormat('it-IT', { month: 'short', year: '2-digit' }).format(new Date(`${value}-01T00:00:00`))
}

function ChartUnavailable({ children }: { children: ReactNode }) {
  return <div className="grid min-h-52 place-items-center rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-6 text-center"><p className="max-w-sm text-sm leading-6 text-muted-foreground">{children}</p></div>
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
  const [isImportGuideExpanded, setIsImportGuideExpanded] = useState(() => window.localStorage.getItem(importGuideStorageKey) !== '1')

  useEffect(() => {
    if (window.localStorage.getItem(importGuideStorageKey) !== '1') window.localStorage.setItem(importGuideStorageKey, '1')
  }, [])

  useEffect(() => {
    let isMounted = true
    const loadDashboard = () => dashboardApi.show(currency).then((response) => {
      if (isMounted) {
        setDashboard(response.data)
        setError(null)
      }
    }).catch((caughtError: unknown) => {
      if (isMounted) setError(caughtError instanceof ApiError ? caughtError : new ApiError('Impossibile caricare la dashboard.', 500))
    }).finally(() => {
      if (isMounted) setIsLoading(false)
    })
    void loadDashboard()
    window.addEventListener('centiva:transactions-changed', loadDashboard)
    return () => {
      isMounted = false
      window.removeEventListener('centiva:transactions-changed', loadDashboard)
    }
  }, [currency])

  function changeCurrency(nextCurrency: string) {
    setIsLoading(true)
    setCurrency(nextCurrency)
  }

  if (isLoading && !dashboard) return <main className="grid min-h-[70vh] place-items-center"><LoaderCircle className="size-6 animate-spin text-emerald-300" aria-label="Caricamento" /></main>

  if (!dashboard) return <main className="mx-auto max-w-7xl px-4 py-10 sm:px-8"><Alert variant="destructive"><AlertTitle>Dashboard non disponibile</AlertTitle><AlertDescription>{error?.message}</AlertDescription></Alert></main>

  const chartData = dashboard.daily.map((item) => ({ ...item, label: shortDate(item.date), income: Number(item.income), expenses: Number(item.expenses) }))
  const categoryData = dashboard.categories.filter((item) => item.category !== 'Senza categoria').map((item) => ({ name: item.category, value: Number(item.total) }))
  const monthlyComparisonData = dashboard.monthly_comparison.map((item) => ({ label: monthLabel(item.month), income: Number(item.income), expenses: Number(item.expenses), netSavings: Number(item.net_savings) }))
  const activeComparisonMonths = monthlyComparisonData.filter((item) => item.income !== 0 || item.expenses !== 0).length

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-7 sm:px-8 lg:py-10">
      <header className="flex flex-col gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-emerald-300">Dashboard</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl lg:text-5xl">Riepilogo mensile</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Entrate e uscite che hai registrato nel mese corrente.</p>
        </div>
        <select className="h-10 w-28 rounded-lg border border-white/15 bg-[#0b0d0c] px-3 font-data text-xs text-foreground outline-none focus:border-emerald-400" value={currency} onChange={(event) => changeCurrency(event.target.value)} aria-label="Valuta dashboard">
          <option value="EUR">EUR</option><option value="USD">USD</option><option value="GBP">GBP</option><option value="CHF">CHF</option>
        </select>
      </header>

      {error && <Alert variant="destructive"><AlertTitle>Aggiornamento non riuscito</AlertTitle><AlertDescription>{error.message}</AlertDescription></Alert>}

      <section className="grid gap-3 md:grid-cols-3" aria-label="Riepilogo del mese">
        <Card className="border-emerald-400/20 bg-[#0b0d0c] shadow-[inset_0_1px_rgba(255,255,255,0.08),0_26px_70px_-48px_rgba(16,185,129,0.7)]"><CardContent className="flex min-h-32 flex-col justify-between gap-3 p-4 sm:min-h-40 sm:gap-4 sm:p-6"><div><p className="text-sm text-emerald-200">Risultato del mese</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Entrate − uscite registrate. Non è il saldo del conto.</p></div><LiquidNumber className="text-2xl font-semibold text-emerald-200 sm:text-4xl" value={dashboard.summary.net_savings} currency={dashboard.currency} /></CardContent></Card>
        <Card className="border-white/10 bg-[#0b0d0c]"><CardContent className="flex min-h-32 flex-col justify-between gap-3 p-4 sm:min-h-40 sm:gap-5 sm:p-6"><div className="flex items-center gap-2 text-sm text-emerald-200"><span className="grid size-8 place-items-center rounded-lg bg-emerald-500/10"><TrendingUp className="size-4" aria-hidden="true" /></span>Entrate del mese</div><LiquidNumber className="text-2xl font-semibold sm:text-4xl" value={dashboard.summary.income} currency={dashboard.currency} /></CardContent></Card>
        <Card className="border-white/10 bg-[#0b0d0c]"><CardContent className="flex min-h-32 flex-col justify-between gap-3 p-4 sm:min-h-40 sm:gap-5 sm:p-6"><div className="flex items-center gap-2 text-sm text-zinc-300"><span className="grid size-8 place-items-center rounded-lg bg-white/5"><TrendingDown className="size-4" aria-hidden="true" /></span>Uscite del mese</div><LiquidNumber className="text-2xl font-semibold sm:text-4xl" value={dashboard.summary.expenses} currency={dashboard.currency} /></CardContent></Card>
      </section>

      <Card className="border-white/10 bg-card">
        <CardHeader className="flex-row items-center justify-between gap-3"><CardTitle>Movimenti recenti</CardTitle><span className="text-xs text-muted-foreground">Ultimi {dashboard.recent.length}</span></CardHeader>
        <CardContent className="flex flex-col divide-y divide-white/10 p-0">
          {dashboard.recent.length === 0 ? <div className="flex flex-col items-center gap-3 px-6 py-10 text-center"><p className="text-sm text-muted-foreground">Non ci sono ancora transazioni registrate.</p><Button type="button" size="sm" onClick={onOpenImport}><FileUp /> Importa il primo movimento</Button></div> : dashboard.recent.map((transaction) => (
            <div className="flex items-center gap-3 px-5 py-4" key={transaction.id}>
              <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${transaction.type === 'income' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-white/5 text-slate-300'}`}>{transaction.type === 'income' ? <ArrowDownLeft aria-hidden="true" /> : <ArrowUpRight aria-hidden="true" />}</span>
              <div className="min-w-0 flex-1"><p className="truncate font-medium text-foreground">{transaction.category || 'Altro'}</p><p className="truncate text-xs text-muted-foreground">{shortDate(transaction.occurred_on)}</p></div>
              <p className={`shrink-0 font-semibold ${transaction.type === 'income' ? 'text-emerald-300' : 'text-foreground'}`}>{transaction.type === 'income' ? '+' : '−'} {money(transaction.amount, transaction.currency)}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <section className="overflow-hidden rounded-xl border border-white/10 bg-[#0b0d0c]">
        <button className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left sm:px-6" type="button" aria-expanded={isImportGuideExpanded} onClick={() => setIsImportGuideExpanded((value) => !value)}>
          <span><span className="block text-sm font-semibold text-emerald-200">Importazione intelligente</span><span className="mt-1 block text-xs text-muted-foreground">Screenshot, scontrini e CSV con revisione prima del salvataggio.</span></span>
          <ChevronDown className={`size-5 shrink-0 text-muted-foreground transition-transform ${isImportGuideExpanded ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>
        {isImportGuideExpanded && <div className="grid border-t border-white/10 lg:grid-cols-[1.1fr_1fr]">
          <div className="p-5 sm:p-6"><h2 className="text-xl font-semibold tracking-tight">Trasforma un documento in transazioni</h2><p className="mt-2 max-w-xl text-sm leading-6 text-white/65">Controlla sempre importi, date e categorie estratti prima di salvarli.</p><div className="mt-5 flex flex-wrap gap-3"><Button className="bg-emerald-400 text-emerald-950 hover:bg-emerald-300" onClick={onOpenImport}><FileUp /> Carica un documento</Button><Button className="border-white/20 bg-white/5 text-white hover:bg-white/10" variant="outline" onClick={onOpenInsights}><Lightbulb /> Apri Insights</Button></div></div>
          <div className="grid gap-px bg-white/10 sm:grid-cols-3 lg:grid-cols-1"><div className="flex gap-3 bg-black/20 p-4"><FileUp className="size-5 shrink-0 text-emerald-300" /><div><p className="font-medium">1. Carica</p><p className="mt-1 text-xs text-white/55">Immagine o CSV</p></div></div><div className="flex gap-3 bg-black/20 p-4"><Tags className="size-5 shrink-0 text-emerald-300" /><div><p className="font-medium">2. Controlla</p><p className="mt-1 text-xs text-white/55">Dati e categorie</p></div></div><div className="flex gap-3 bg-black/20 p-4"><Lightbulb className="size-5 shrink-0 text-emerald-300" /><div><p className="font-medium">3. Salva</p><p className="mt-1 text-xs text-white/55">Solo dopo la revisione</p></div></div></div>
        </div>}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.55fr_0.85fr]">
        <Card className="border-white/10 bg-card"><CardHeader><CardTitle>Andamento del mese</CardTitle></CardHeader><CardContent>
          {chartData.length < 3 ? <ChartUnavailable>Il grafico apparirà dopo movimenti registrati in almeno 3 giorni diversi.</ChartUnavailable> : <div className="h-72 w-full"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData} margin={{ left: -15, right: 10 }}><defs><linearGradient id="income" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10b981" stopOpacity={0.28} /><stop offset="100%" stopColor="#10b981" stopOpacity={0} /></linearGradient><linearGradient id="expenses" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#64748b" stopOpacity={0.22} /><stop offset="100%" stopColor="#64748b" stopOpacity={0} /></linearGradient></defs><CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#27272a" /><XAxis dataKey="label" axisLine={false} tickLine={false} fontSize={12} /><YAxis axisLine={false} tickLine={false} fontSize={12} /><Tooltip formatter={(value) => money(Number(value), dashboard.currency)} /><Area type="monotone" dataKey="income" name="Entrate" stroke="#10b981" fill="url(#income)" strokeWidth={2} /><Area type="monotone" dataKey="expenses" name="Uscite" stroke="#a1a1aa" fill="url(#expenses)" strokeWidth={2} /></AreaChart></ResponsiveContainer></div>}
        </CardContent></Card>
        <Card className="border-white/10 bg-card"><CardHeader><CardTitle>Uscite per categoria</CardTitle></CardHeader><CardContent>
          {categoryData.length < 2 ? <ChartUnavailable>Servono almeno 2 categorie valorizzate per un confronto utile. Correggi i movimenti senza categoria.</ChartUnavailable> : <div className="flex flex-col gap-4 sm:flex-row xl:flex-col"><div className="h-48 min-w-0 flex-1 outline-none [&_.recharts-sector]:outline-none [&_.recharts-surface]:outline-none" onMouseDown={(event) => event.preventDefault()}><ResponsiveContainer width="100%" height="100%"><PieChart style={{ outline: 'none' }}><Pie data={categoryData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={78} paddingAngle={3}>{categoryData.map((item, index) => <Cell key={item.name} fill={categoryColors[index % categoryColors.length]} style={{ outline: 'none' }} />)}</Pie><Tooltip formatter={(value) => money(Number(value), dashboard.currency)} /></PieChart></ResponsiveContainer></div><div className="flex flex-1 flex-col gap-2">{categoryData.slice(0, 6).map((item, index) => <div className="flex items-center justify-between gap-3 text-sm" key={item.name}><span className="flex min-w-0 items-center gap-2"><span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: categoryColors[index % categoryColors.length] }} /><span className="truncate text-muted-foreground">{item.name}</span></span><span className="font-medium text-foreground">{money(item.value, dashboard.currency)}</span></div>)}</div></div>}
        </CardContent></Card>
      </section>

      <Card className="border-white/10 bg-card"><CardHeader><CardTitle>Confronto con i mesi precedenti</CardTitle></CardHeader><CardContent>
        {activeComparisonMonths < 2 ? <ChartUnavailable>Il confronto sarà disponibile quando ci saranno movimenti in almeno 2 mesi.</ChartUnavailable> : <div className="h-72 w-full"><ResponsiveContainer width="100%" height="100%"><AreaChart data={monthlyComparisonData} margin={{ left: -10, right: 10, top: 10 }}><CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#27272a" /><XAxis dataKey="label" axisLine={false} tickLine={false} fontSize={12} /><YAxis axisLine={false} tickLine={false} fontSize={12} /><Tooltip formatter={(value) => money(Number(value), dashboard.currency)} /><Area type="monotone" dataKey="income" name="Entrate" stroke="#10b981" fill="transparent" strokeWidth={2} /><Area type="monotone" dataKey="expenses" name="Uscite" stroke="#a1a1aa" fill="transparent" strokeWidth={2} /><Area type="monotone" dataKey="netSavings" name="Risultato del mese" stroke="#d97706" fill="transparent" strokeWidth={2} /></AreaChart></ResponsiveContainer></div>}
      </CardContent></Card>

      <Button className="self-start text-emerald-200" variant="ghost" onClick={onOpenInsights}>Apri Centiva Insights <ArrowRight /></Button>
    </main>
  )
}
