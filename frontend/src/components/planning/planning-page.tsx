import { useEffect, useState, type FormEvent } from 'react'
import { CalendarClock, Gauge, LoaderCircle, PiggyBank, Plus, RefreshCw, Trash2, WalletCards } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ApiError, categoryBudgetApi, planningApi } from '@/lib/api'
import type { CategoryBudgetData, CategoryBudgetItem } from '@/types/budget'
import type { PlanningData } from '@/types/planning'

const BUDGET_CATEGORIES = [
  'Abbonamenti', 'Acquisti', 'Assicurazioni', 'Casa', 'Commissioni', 'Cura personale',
  'Istruzione', 'Prelievi', 'Ristorazione', 'Salute', 'Spesa', 'Tempo libero',
  'Trasporti', 'Utenze', 'Viaggi', 'Altro',
]

const confidenceLabel = { low: 'iniziale', medium: 'media', high: 'alta' }

function money(value: string | number, currency: string) {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency }).format(Number(value))
}

function localMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function statusText(item: CategoryBudgetItem, currency: string) {
  if (item.status === 'exceeded') return `Superato di ${money(Math.abs(Number(item.remaining)), currency)}`
  if (item.status === 'warning') return 'Vicino al limite'
  return 'Nei limiti'
}

export function PlanningPage() {
  const [data, setData] = useState<PlanningData | null>(null)
  const [budgets, setBudgets] = useState<CategoryBudgetData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [budgetError, setBudgetError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [budgetLoading, setBudgetLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [month, setMonth] = useState(localMonth)
  const [category, setCategory] = useState('Spesa')
  const [amount, setAmount] = useState('')

  async function loadBudgets(selectedMonth: string) {
    try {
      const response = await categoryBudgetApi.list(selectedMonth)
      setBudgets(response.data)
      setBudgetError(null)
    } catch (caught) {
      setBudgetError(caught instanceof ApiError ? caught.message : 'Budget non disponibili.')
    } finally {
      setBudgetLoading(false)
    }
  }

  useEffect(() => {
    planningApi.show()
      .then((response) => setData(response.data))
      .catch((caught) => setError(caught instanceof ApiError ? caught.message : 'Previsioni non disponibili.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    let active = true
    void categoryBudgetApi.list(month)
      .then((response) => {
        if (active) {
          setBudgets(response.data)
          setBudgetError(null)
        }
      })
      .catch((caught) => { if (active) setBudgetError(caught instanceof ApiError ? caught.message : 'Budget non disponibili.') })
      .finally(() => { if (active) setBudgetLoading(false) })

    return () => { active = false }
  }, [month])

  async function saveBudget(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const numericAmount = Number(amount.replace(',', '.'))
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setBudgetError('Inserisci un limite mensile maggiore di zero.')
      return
    }

    setSaving(true)
    setBudgetError(null)
    try {
      await categoryBudgetApi.save({ category, amount: numericAmount, currency: 'EUR', month })
      setAmount('')
      setBudgetLoading(true)
      await loadBudgets(month)
    } catch (caught) {
      setBudgetError(caught instanceof ApiError ? caught.message : 'Non è stato possibile salvare il budget.')
    } finally {
      setSaving(false)
    }
  }

  async function removeBudget(item: CategoryBudgetItem) {
    if (!window.confirm(`Eliminare il budget “${item.category}” per questo mese?`)) return
    setBudgetError(null)
    try {
      await categoryBudgetApi.remove(item.id)
      setBudgetLoading(true)
      await loadBudgets(month)
    } catch (caught) {
      setBudgetError(caught instanceof ApiError ? caught.message : 'Non è stato possibile eliminare il budget.')
    }
  }

  if (loading) return <main className="grid min-h-[60vh] place-items-center"><LoaderCircle className="size-6 animate-spin text-emerald-300" aria-label="Calcolo in corso" /></main>

  return <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-8">
    <div className="mb-7"><p className="text-sm font-medium text-emerald-300">Pianificazione</p><h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground">Guarda avanti</h1></div>
    {error && <Alert variant="destructive"><Gauge /><AlertTitle>Calcolo non disponibile</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
    {data && <div>
      <Card className="border-0 bg-[#0b0d0c] text-white shadow-[inset_1px_1px_rgba(255,255,255,0.08),inset_-70px_-50px_120px_rgba(0,0,0,0.7),0_40px_100px_-58px_rgba(0,0,0,1)]">
        <CardHeader><CardDescription className="text-emerald-200">Risultato previsto a fine mese</CardDescription><CardTitle className="text-4xl font-semibold">{money(data.future_balance.projected_balance, data.currency)}</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-white/8 bg-white/[0.06] p-4 backdrop-blur"><WalletCards className="mb-2 size-5 text-emerald-300" /><p className="text-xs text-emerald-100">Entrate − uscite registrate</p><p className="mt-1 font-semibold">{money(data.future_balance.current_balance, data.currency)}</p></div>
          <div className="rounded-xl border border-white/8 bg-white/[0.06] p-4 backdrop-blur"><RefreshCw className="mb-2 size-5 text-emerald-300" /><p className="text-xs text-emerald-100">Media netta giornaliera</p><p className="mt-1 font-semibold">{money(data.future_balance.average_daily_net, data.currency)}</p></div>
          <div className="rounded-xl border border-white/8 bg-white/[0.06] p-4 backdrop-blur"><CalendarClock className="mb-2 size-5 text-emerald-300" /><p className="text-xs text-emerald-100">Giorni rimanenti</p><p className="mt-1 font-semibold">{data.future_balance.days_remaining}</p></div>
        </CardContent>
        <div className="border-t border-white/10 px-6 py-4 text-xs text-emerald-100">Attendibilità {confidenceLabel[data.future_balance.confidence]} · {data.future_balance.sample_size} movimenti recenti. È una stima, non una garanzia.</div>
      </Card>
    </div>}

    <Card className="mt-6 border-white/10 bg-card">
      <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between">
        <CardTitle className="flex items-center gap-2"><PiggyBank className="size-5 text-emerald-300" /> Budget per categoria</CardTitle>
        <label className="grid gap-1.5 text-sm"><span className="text-muted-foreground">Mese</span><Input className="w-44" type="month" value={month} onChange={(event) => { setBudgetLoading(true); setMonth(event.target.value) }} /></label>
      </CardHeader>
      <CardContent className="space-y-6">
        {budgetError && <Alert variant="destructive"><AlertTitle>Budget non aggiornato</AlertTitle><AlertDescription>{budgetError}</AlertDescription></Alert>}
        <form className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.025] p-4 sm:grid-cols-[1fr_12rem_auto] sm:items-end" onSubmit={saveBudget}>
          <label className="grid gap-2 text-sm"><Label htmlFor="budget-category">Categoria</Label><select id="budget-category" className="h-9 rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50" value={category} onChange={(event) => setCategory(event.target.value)}>{BUDGET_CATEGORIES.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
          <label className="grid gap-2 text-sm"><Label htmlFor="budget-amount">Limite mensile</Label><Input id="budget-amount" inputMode="decimal" placeholder="300,00" value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
          <Button className="bg-emerald-600 text-white hover:bg-emerald-500" type="submit" disabled={saving}>{saving ? <LoaderCircle className="animate-spin" /> : <Plus />} Salva budget</Button>
        </form>

        {budgetLoading ? <div className="grid min-h-40 place-items-center"><LoaderCircle className="size-5 animate-spin text-emerald-300" /></div> : budgets && <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-white/10 p-4"><p className="text-xs text-muted-foreground">Budget impostato</p><p className="mt-1 text-xl font-semibold">{money(budgets.total_budget, budgets.currency)}</p></div>
            <div className="rounded-xl border border-white/10 p-4"><p className="text-xs text-muted-foreground">Speso nelle categorie</p><p className="mt-1 text-xl font-semibold">{money(budgets.total_spent, budgets.currency)}</p></div>
            <div className="rounded-xl border border-white/10 p-4"><p className="text-xs text-muted-foreground">Residuo complessivo</p><p className={`mt-1 text-xl font-semibold ${Number(budgets.total_remaining) < 0 ? 'text-rose-300' : 'text-emerald-300'}`}>{money(budgets.total_remaining, budgets.currency)}</p></div>
          </div>

          {budgets.items.length === 0 ? <div className="rounded-2xl border border-dashed border-white/10 px-6 py-10 text-center"><p className="font-medium">Nessun budget per questo mese</p><p className="mt-1 text-sm text-muted-foreground">Scegli una categoria e inserisci il primo limite.</p></div> : <div className="grid gap-3 md:grid-cols-2">{budgets.items.map((item) => <article className="rounded-2xl border border-white/10 bg-white/[0.02] p-4" key={item.id}>
            <div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold">{item.category}</h3><p className={`mt-1 text-xs ${item.status === 'exceeded' ? 'text-rose-300' : item.status === 'warning' ? 'text-amber-300' : 'text-emerald-300'}`}>{statusText(item, budgets.currency)}</p></div><Button variant="ghost" size="icon" type="button" aria-label={`Elimina budget ${item.category}`} onClick={() => void removeBudget(item)}><Trash2 /></Button></div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/[0.07]"><div className={`h-full rounded-full ${item.status === 'exceeded' ? 'bg-rose-400' : item.status === 'warning' ? 'bg-amber-400' : 'bg-emerald-400'}`} style={{ width: `${Math.min(100, item.percentage)}%` }} /></div>
            <div className="mt-3 flex justify-between gap-4 text-sm"><span className="text-muted-foreground">{money(item.spent, budgets.currency)} spesi</span><span>{money(item.limit, budgets.currency)} limite</span></div>
          </article>)}</div>}
        </>}
      </CardContent>
    </Card>
  </main>
}
