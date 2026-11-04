import { useEffect, useState } from 'react'
import { CalendarClock, Gauge, LoaderCircle, RefreshCw, Sparkles, WalletCards } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ApiError, planningApi } from '@/lib/api'
import type { PlanningData } from '@/types/planning'

function money(value: string, currency: string) {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency }).format(Number(value))
}

const confidenceLabel = { low: 'iniziale', medium: 'media', high: 'alta' }

export function PlanningPage() {
  const [data, setData] = useState<PlanningData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    planningApi.show().then((response) => setData(response.data)).catch((caught) => setError(caught instanceof ApiError ? caught.message : 'Previsioni non disponibili.')).finally(() => setLoading(false))
  }, [])

  if (loading) return <main className="grid min-h-[60vh] place-items-center"><LoaderCircle className="size-6 animate-spin text-emerald-300" aria-label="Calcolo in corso" /></main>

  return <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-8">
    <div className="mb-7"><p className="text-sm font-medium text-emerald-300">Pianificazione</p><h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground">Guarda avanti</h1><p className="mt-2 text-muted-foreground">FutureBalance e Subscription Hunter lavorano sulla cronologia effettiva dei tuoi movimenti.</p></div>
    {error && <Alert variant="destructive"><Gauge /><AlertTitle>Calcolo non disponibile</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
    {data && <div className="grid gap-6 lg:grid-cols-5">
      <Card className="border-0 bg-[#0b0d0c] text-white shadow-[inset_1px_1px_rgba(255,255,255,0.08),inset_-70px_-50px_120px_rgba(0,0,0,0.7),0_40px_100px_-58px_rgba(0,0,0,1)] lg:col-span-3">
        <CardHeader><CardDescription className="text-emerald-200">Saldo previsto a fine mese</CardDescription><CardTitle className="text-4xl font-semibold">{money(data.future_balance.projected_balance, data.currency)}</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-white/8 bg-white/[0.06] p-4 backdrop-blur"><WalletCards className="mb-2 size-5 text-emerald-300" /><p className="text-xs text-emerald-100">Saldo attuale</p><p className="mt-1 font-semibold">{money(data.future_balance.current_balance, data.currency)}</p></div>
          <div className="rounded-xl border border-white/8 bg-white/[0.06] p-4 backdrop-blur"><RefreshCw className="mb-2 size-5 text-emerald-300" /><p className="text-xs text-emerald-100">Media netta giornaliera</p><p className="mt-1 font-semibold">{money(data.future_balance.average_daily_net, data.currency)}</p></div>
          <div className="rounded-xl border border-white/8 bg-white/[0.06] p-4 backdrop-blur"><CalendarClock className="mb-2 size-5 text-emerald-300" /><p className="text-xs text-emerald-100">Giorni rimanenti</p><p className="mt-1 font-semibold">{data.future_balance.days_remaining}</p></div>
        </CardContent>
        <div className="border-t border-white/10 px-6 py-4 text-xs text-emerald-100">Attendibilità {confidenceLabel[data.future_balance.confidence]} · {data.future_balance.sample_size} movimenti recenti. È una stima, non una garanzia.</div>
      </Card>

      <Card className="border-0 shadow-sm lg:col-span-2"><CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="size-5 text-emerald-300" /> Subscription Hunter</CardTitle><CardDescription>Addebiti regolari con importi coerenti.</CardDescription></CardHeader><CardContent className="space-y-3">{data.subscriptions.length === 0 ? <div className="py-8 text-center"><p className="font-medium">Nessuna ricorrenza confermata</p><p className="mt-1 text-sm text-muted-foreground">Servono almeno tre addebiti compatibili.</p></div> : data.subscriptions.map((item) => <div key={`${item.label}-${item.last_charge_on}`} className="rounded-xl border p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-foreground">{item.label}</p><p className="text-xs text-muted-foreground">{item.frequency === 'monthly' ? 'Mensile' : 'Annuale'} · {item.occurrences} addebiti</p></div><p className="font-semibold tabular-nums">{money(item.average_amount, data.currency)}</p></div><p className="mt-3 text-xs text-muted-foreground">Prossimo addebito stimato: {new Date(`${item.next_expected_on}T12:00:00`).toLocaleDateString('it-IT')}</p></div>)}</CardContent></Card>
    </div>}
  </main>
}
