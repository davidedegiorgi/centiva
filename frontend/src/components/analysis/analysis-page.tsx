import { useEffect, useState } from 'react'
import { AlertTriangle, Copy, Lightbulb, LoaderCircle, SearchCheck, TrendingDown } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ApiError, analysisApi } from '@/lib/api'
import type { AnalysisData } from '@/types/analysis'
import type { Transaction } from '@/types/transaction'

function money(value: string, currency: string) {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency }).format(Number(value))
}

function TransactionLine({ transaction, currency }: { transaction: Transaction; currency: string }) {
  return <div className="flex items-center justify-between gap-4 border-t py-3 first:border-0 first:pt-0"><div><p className="font-medium text-foreground">{transaction.merchant || transaction.description}</p><p className="text-xs text-muted-foreground">{new Date(`${transaction.occurred_on}T12:00:00`).toLocaleDateString('it-IT')} · {transaction.category || 'Senza categoria'}</p></div><span className="font-semibold tabular-nums">{money(transaction.amount, currency)}</span></div>
}

export function AnalysisPage() {
  const [data, setData] = useState<AnalysisData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    analysisApi.show().then((response) => setData(response.data)).catch((caught) => setError(caught instanceof ApiError ? caught.message : 'Analisi non disponibile.')).finally(() => setLoading(false))
  }, [])

  if (loading) return <main className="grid min-h-[60vh] place-items-center"><LoaderCircle className="size-6 animate-spin text-emerald-300" aria-label="Analisi in corso" /></main>

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-8">
      <div className="mb-7"><p className="text-sm font-medium text-emerald-300">Centiva Insights</p><h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground">Capisci dove migliorare</h1><p className="mt-2 text-muted-foreground">Indicazioni calcolate sulle tue transazioni, aggiornate ogni volta che torni qui.</p></div>
      {error && <Alert variant="destructive"><AlertTriangle /><AlertTitle>Analisi non disponibile</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
      {data && data.sample_size === 0 && <Card className="border-0 shadow-sm"><CardContent className="py-12 text-center"><SearchCheck className="mx-auto mb-3 size-9 text-emerald-300" /><h2 className="text-lg font-semibold">Servono transazioni reali</h2><p className="mt-1 text-muted-foreground">Aggiungi o importa le tue spese per ricevere analisi attendibili.</p></CardContent></Card>}
      {data && data.sample_size > 0 && <div className="grid gap-5 lg:grid-cols-3">
        <section className="space-y-4 lg:col-span-2">
          <h2 className="text-lg font-semibold text-foreground">Suggerimenti</h2>
          {data.insights.length === 0 ? <Card><CardContent>Nessun suggerimento disponibile per il mese corrente.</CardContent></Card> : data.insights.map((insight) => <Card key={`${insight.kind}-${insight.title}`} className="border-0 shadow-sm"><CardHeader className="flex-row gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-400/15 text-emerald-300">{insight.kind === 'improvement' ? <TrendingDown /> : <Lightbulb />}</span><div><CardTitle>{insight.title}</CardTitle><CardDescription>{insight.message}</CardDescription></div></CardHeader>{Number(insight.potential_saving) > 0 && <CardContent><p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">Margine indicativo: <strong>{money(insight.potential_saving, data.currency)}</strong></p></CardContent>}</Card>)}
        </section>
        <aside className="space-y-5">
          <Card className="border-0 shadow-sm"><CardHeader><CardTitle className="flex items-center gap-2"><Copy className="size-4 text-amber-600" /> Possibili duplicati</CardTitle><CardDescription>Verifica prima di eliminare un movimento.</CardDescription></CardHeader><CardContent>{data.duplicates.length === 0 ? <p className="text-muted-foreground">Nessun duplicato rilevato.</p> : data.duplicates.map((group, index) => <div key={index} className="mb-4 rounded-lg border p-3 last:mb-0"><p className="mb-2 text-xs text-muted-foreground">{group.reason}</p>{group.transactions.map((item) => <TransactionLine key={item.id} transaction={item} currency={data.currency} />)}</div>)}</CardContent></Card>
          <Card className="border-0 shadow-sm"><CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="size-4 text-rose-600" /> Spese anomale</CardTitle><CardDescription>Importi molto diversi dalle tue abitudini.</CardDescription></CardHeader><CardContent>{data.anomalies.length === 0 ? <p className="text-muted-foreground">Nessuna anomalia significativa.</p> : data.anomalies.map((item) => <div key={item.transaction.id}><p className="text-xs text-muted-foreground">{item.reason}</p><TransactionLine transaction={item.transaction} currency={data.currency} /></div>)}</CardContent></Card>
        </aside>
      </div>}
    </main>
  )
}
