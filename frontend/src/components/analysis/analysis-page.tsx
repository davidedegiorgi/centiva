import { useEffect, useState } from 'react'
import { AlertTriangle, Copy, Lightbulb, ListMinus, LoaderCircle, SearchCheck, TrendingDown } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ApiError, analysisApi } from '@/lib/api'
import type { AnalysisData } from '@/types/analysis'
import type { Transaction } from '@/types/transaction'

function money(value: string, currency: string) {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency }).format(Number(value))
}

function TransactionLine({ transaction, currency }: { transaction: Transaction; currency: string }) {
  const title = transaction.category || 'Altro'
  const metadata = new Date(`${transaction.occurred_on}T12:00:00`).toLocaleDateString('it-IT')

  return (
    <div className="flex items-center justify-between gap-4 border-t border-white/10 py-3 first:border-0 first:pt-0">
      <div className="min-w-0">
        <p className="truncate font-medium text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{metadata}</p>
      </div>
      <span className="shrink-0 font-semibold tabular-nums">{money(transaction.amount, currency)}</span>
    </div>
  )
}

interface AnalysisPageProps {
  onOpenTransactions: () => void
}

export function AnalysisPage({ onOpenTransactions }: AnalysisPageProps) {
  const [data, setData] = useState<AnalysisData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    analysisApi.show().then((response) => setData(response.data)).catch((caught) => setError(caught instanceof ApiError ? caught.message : 'Analisi non disponibile.')).finally(() => setLoading(false))
  }, [])

  if (loading) return <main className="grid min-h-[60vh] place-items-center"><LoaderCircle className="size-6 animate-spin text-emerald-300" aria-label="Analisi in corso" /></main>

  const insightStatus = data?.status?.insights ?? (data && data.insights.length > 0 ? 'ready' : 'insufficient')
  const duplicateStatus = data?.status?.duplicates ?? (data && data.duplicates.length > 0 ? 'findings' : data && data.sample_size >= 2 ? 'clear' : 'insufficient')
  const anomalyStatus = data?.status?.anomalies ?? (data && data.anomalies.length > 0 ? 'findings' : data && data.sample_size >= 5 ? 'clear' : 'insufficient')
  const categorizedExpenseCount = data?.data_quality?.current_categorized_expenses ?? 0

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-8 lg:py-10">
      <header className="mb-7 border-b border-white/10 pb-6">
        <p className="text-sm font-medium text-emerald-300">Centiva Insights</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Analisi delle spese</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Solo osservazioni supportate dalle transazioni registrate.</p>
      </header>

      {error && <Alert variant="destructive"><AlertTriangle /><AlertTitle>Analisi non disponibile</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}

      {data && data.sample_size === 0 && (
        <Card className="border-white/10 bg-card"><CardContent className="flex flex-col items-center gap-3 py-12 text-center"><SearchCheck className="size-9 text-emerald-300" /><h2 className="text-lg font-semibold">Dati insufficienti per l’analisi</h2><p className="max-w-md text-sm leading-6 text-muted-foreground">Registra o importa alcune spese e assegna le categorie: Centiva non formulerà suggerimenti prima di avere dati reali.</p><Button type="button" onClick={onOpenTransactions}><ListMinus /> Vai ai movimenti</Button></CardContent></Card>
      )}

      {data && data.sample_size > 0 && (
        <div className="grid gap-5 lg:grid-cols-3">
          <section className="space-y-4 lg:col-span-2">
            <h2 className="text-lg font-semibold text-foreground">Osservazioni motivate</h2>
            {insightStatus === 'insufficient' ? (
              <Card className="border-white/10 bg-card"><CardContent className="flex flex-col items-start gap-3 py-6"><div><h3 className="font-semibold text-foreground">Dati insufficienti per i suggerimenti</h3><p className="mt-1 text-sm leading-6 text-muted-foreground">Servono almeno 3 spese categorizzate nel mese corrente. Al momento sono {categorizedExpenseCount}.</p></div><Button type="button" variant="outline" onClick={onOpenTransactions}><ListMinus /> Completa le categorie</Button></CardContent></Card>
            ) : data.insights.length === 0 ? (
              <Card className="border-white/10 bg-card"><CardContent className="py-6 text-sm text-muted-foreground">I dati sono sufficienti, ma non emerge ancora un’osservazione utile.</CardContent></Card>
            ) : data.insights.map((insight) => (
              <Card key={`${insight.kind}-${insight.title}`} className="border-white/10 bg-card">
                <CardHeader className="flex-row gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-400/15 text-emerald-300">{insight.kind === 'improvement' ? <TrendingDown /> : <Lightbulb />}</span><div><CardTitle>{insight.title}</CardTitle><CardDescription>{insight.message}</CardDescription></div></CardHeader>
                {Number(insight.potential_saving) > 0 && <CardContent><p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">Spesa in più rispetto allo stesso periodo precedente: <strong>{money(insight.potential_saving, data.currency)}</strong></p></CardContent>}
              </Card>
            ))}
          </section>

          <aside className="space-y-5">
            <Card className="border-white/10 bg-card"><CardHeader><CardTitle className="flex items-center gap-2"><Copy className="size-4 text-amber-400" /> Possibili duplicati</CardTitle><CardDescription>Stessa data e stesso importo: verifica prima di eliminare.</CardDescription></CardHeader><CardContent>
              {duplicateStatus === 'insufficient' ? <p className="text-sm leading-6 text-muted-foreground">Dati insufficienti: servono almeno 2 spese per cercare corrispondenze.</p> : duplicateStatus === 'clear' ? <p className="text-sm leading-6 text-muted-foreground">Analisi completata: nessun possibile duplicato rilevato.</p> : data.duplicates.map((group, index) => <div key={index} className="mb-4 rounded-lg border border-white/10 p-3 last:mb-0"><p className="mb-2 text-xs text-muted-foreground">{group.reason}</p>{group.transactions.map((item) => <TransactionLine key={item.id} transaction={item} currency={data.currency} />)}</div>)}
            </CardContent></Card>

            <Card className="border-white/10 bg-card"><CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="size-4 text-rose-400" /> Spese anomale</CardTitle><CardDescription>Importi confrontati con le tue abitudini registrate.</CardDescription></CardHeader><CardContent>
              {anomalyStatus === 'insufficient' ? <p className="text-sm leading-6 text-muted-foreground">Dati insufficienti: servono almeno 5 spese per calcolare una soglia personale.</p> : anomalyStatus === 'clear' ? <p className="text-sm leading-6 text-muted-foreground">Analisi completata: nessuna anomalia rilevata.</p> : data.anomalies.map((item) => <div key={item.transaction.id}><p className="text-xs text-muted-foreground">{item.reason}</p><TransactionLine transaction={item.transaction} currency={data.currency} /></div>)}
            </CardContent></Card>
          </aside>
        </div>
      )}
    </main>
  )
}
