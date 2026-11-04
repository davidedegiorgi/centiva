import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from 'react'
import { BadgeCheck, BookOpen, CalendarDays, Car, Gift, Home, Lightbulb, LoaderCircle, Medal, Pencil, PiggyBank, Plane, Save, Shield, Smartphone, Sparkles, Target, Trash2, Trophy } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { analysisApi, ApiError, goalApi } from '@/lib/api'
import type { AnalysisData } from '@/types/analysis'
import type { GoalIcon, GoalKind, GoalPayload, ProgressUnit, SavingsFrequency, SavingsGoal } from '@/types/goal'

const selectClass = 'h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15'
const initialForm = { kind: 'goal' as GoalKind, name: '', icon: 'target' as GoalIcon, target_amount: '', currency: 'EUR', target_date: '', saving_frequency: 'monthly' as SavingsFrequency | '', progress_unit: 'currency' as ProgressUnit, challenge_template: null as GoalPayload['challenge_template'] }
const icons: Array<{ value: GoalIcon; label: string }> = [
  { value: 'target', label: 'Obiettivo' }, { value: 'plane', label: 'Vacanza' }, { value: 'car', label: 'Auto o patente' }, { value: 'shield', label: 'Emergenze' }, { value: 'phone', label: 'Tecnologia' }, { value: 'home', label: 'Casa' }, { value: 'education', label: 'Formazione' }, { value: 'gift', label: 'Regalo' }, { value: 'sparkles', label: 'Challenge' }, { value: 'calendar', label: 'Costanza' },
]
const paceLabels = { completed: 'Completato', overdue: 'Scadenza superata', on_track: 'In linea con il piano', behind: 'Da recuperare con calma' }

function localDate(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` }
function dateAfter(days: number) { const date = new Date(); date.setDate(date.getDate() + days); return localDate(date) }
function endOfMonth() { const now = new Date(); return localDate(new Date(now.getFullYear(), now.getMonth() + 1, 0)) }
function money(value: string | number, currency: string) { return new Intl.NumberFormat('it-IT', { style: 'currency', currency }).format(Number(value)) }

function GoalIconView({ icon }: { icon: GoalIcon }) {
  const iconMap: Record<GoalIcon, ReactNode> = { target: <Target />, plane: <Plane />, car: <Car />, shield: <Shield />, phone: <Smartphone />, home: <Home />, education: <BookOpen />, gift: <Gift />, sparkles: <Sparkles />, calendar: <CalendarDays /> }
  return iconMap[icon]
}

function valueLabel(value: string | number, goal: SavingsGoal) {
  if (goal.progress_unit === 'days') { const days = Number(value); return `${days} ${days === 1 ? 'giorno' : 'giorni'}` }
  return money(value, goal.currency)
}

export function GoalsPage() {
  const [goals, setGoals] = useState<SavingsGoal[]>([])
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null)
  const [form, setForm] = useState(initialForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [contributions, setContributions] = useState<Record<string, string>>({})
  const [insightGoals, setInsightGoals] = useState<Record<number, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([goalApi.list(), analysisApi.show().catch(() => null)])
      .then(([goalResponse, analysisResponse]) => { setGoals(goalResponse.data); setAnalysis(analysisResponse?.data ?? null) })
      .catch((caught) => setError(caught instanceof ApiError ? caught.message : 'Obiettivi non disponibili.'))
      .finally(() => setLoading(false))
  }, [])

  const activeCurrencyGoals = useMemo(() => goals.filter((goal) => goal.status === 'active' && goal.progress_unit === 'currency'), [goals])
  const savingInsights = useMemo(() => analysis?.insights.filter((insight) => Number(insight.potential_saving) > 0) ?? [], [analysis])
  const bestInsight = savingInsights[0] ?? null

  function payload(): GoalPayload {
    return { kind: form.kind, name: form.name.trim(), icon: form.icon, target_amount: Number(form.target_amount), currency: form.currency.toUpperCase(), target_date: form.target_date || null, saving_frequency: form.saving_frequency || null, progress_unit: form.progress_unit, challenge_template: form.challenge_template }
  }

  async function submit(event: FormEvent) {
    event.preventDefault(); setError(null)
    if (!form.name.trim() || Number(form.target_amount) <= 0) return setError('Inserisci un nome e un traguardo maggiore di zero.')
    setSaving(true)
    try {
      const response = editingId ? await goalApi.update(editingId, payload()) : await goalApi.create(payload())
      setGoals((current) => editingId ? current.map((goal) => goal.id === editingId ? response.data : goal) : [response.data, ...current])
      setForm(initialForm); setEditingId(null)
    } catch (caught) { setError(caught instanceof ApiError ? caught.message : 'Non è stato possibile salvare.') }
    finally { setSaving(false) }
  }

  function edit(goal: SavingsGoal) {
    setEditingId(goal.id)
    setForm({ kind: goal.kind, name: goal.name, icon: goal.icon, target_amount: goal.target_amount, currency: goal.currency, target_date: goal.target_date || '', saving_frequency: goal.saving_frequency || '', progress_unit: goal.progress_unit, challenge_template: goal.challenge_template })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function challenge(template: NonNullable<GoalPayload['challenge_template']>) {
    if (template === 'weekly_20') setForm({ ...initialForm, kind: 'challenge', name: 'Risparmia 20 € questa settimana', icon: 'sparkles', target_amount: '20', target_date: dateAfter(7), saving_frequency: 'weekly', challenge_template: template })
    if (template === 'no_spend_3_days') setForm({ ...initialForm, kind: 'challenge', name: 'Tre giorni senza spese superflue', icon: 'calendar', target_amount: '3', target_date: dateAfter(7), saving_frequency: '', progress_unit: 'days', challenge_template: template })
    if (template === 'category_reduction' && bestInsight) setForm({ ...initialForm, kind: 'challenge', name: `Riduci del 10%: ${bestInsight.title}`, icon: 'sparkles', target_amount: bestInsight.potential_saving, target_date: endOfMonth(), saving_frequency: 'weekly', challenge_template: template })
    document.getElementById('goal-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  async function contribute(goal: SavingsGoal, amountOverride?: number, notes: string | null = null) {
    const amount = amountOverride ?? (goal.progress_unit === 'days' ? 1 : Number(contributions[goal.id]))
    if (amount <= 0) return setError('Inserisci un importo da accantonare maggiore di zero.')
    setBusyId(goal.id); setError(null)
    try {
      const response = await goalApi.contribute(goal.id, amount, notes)
      setGoals((current) => current.map((item) => item.id === goal.id ? response.data : item))
      setContributions((current) => ({ ...current, [goal.id]: '' }))
    } catch (caught) { setError(caught instanceof ApiError ? caught.message : 'Accantonamento non riuscito.') }
    finally { setBusyId(null) }
  }

  async function applyInsight(index: number) {
    const insight = savingInsights[index]; const goal = goals.find((item) => item.id === insightGoals[index])
    if (!insight || !goal) return setError('Scegli prima l’obiettivo a cui destinare il risparmio.')
    await contribute(goal, Number(insight.potential_saving), `Accantonamento confermato da Centiva Insights: ${insight.title}`)
  }

  async function remove(goal: SavingsGoal) {
    if (!window.confirm(`Eliminare “${goal.name}” e i relativi accantonamenti?`)) return
    setBusyId(goal.id); setError(null)
    try { await goalApi.remove(goal.id); setGoals((current) => current.filter((item) => item.id !== goal.id)) }
    catch (caught) { setError(caught instanceof ApiError ? caught.message : 'Eliminazione non riuscita.') }
    finally { setBusyId(null) }
  }

  return <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-8">
    <div className="mb-7 max-w-3xl"><p className="font-data text-xs uppercase tracking-[0.28em] text-emerald-400">INcentiva</p><h1 className="mt-2 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">Il risparmio prende forma.</h1><p className="mt-3 text-muted-foreground">Piani, challenge e progressi reali. Centiva registra ciò che confermi, senza trasferire denaro.</p></div>
    {error && <Alert variant="destructive" className="mb-5"><Target /><AlertTitle>Controlla i dati</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}

    <section className="mb-7"><div className="mb-3"><p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Challenge guidate</p><h2 className="mt-1 text-xl font-semibold">Inizia con un gesto concreto</h2></div><div className="grid gap-3 md:grid-cols-3">
      <button className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 text-left transition hover:-translate-y-0.5 hover:border-emerald-400/40" type="button" onClick={() => challenge('weekly_20')}><Sparkles className="mb-5 text-emerald-400" /><strong className="block">20 € in una settimana</strong><span className="mt-1 block text-sm text-muted-foreground">Un traguardo breve e misurabile.</span></button>
      <button className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 text-left transition hover:-translate-y-0.5 hover:border-emerald-400/40" type="button" onClick={() => challenge('no_spend_3_days')}><CalendarDays className="mb-5 text-emerald-400" /><strong className="block">Tre giorni essenziali</strong><span className="mt-1 block text-sm text-muted-foreground">Conferma ogni giornata senza spese superflue.</span></button>
      <button className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 text-left transition enabled:hover:-translate-y-0.5 enabled:hover:border-emerald-400/40 disabled:cursor-not-allowed disabled:opacity-45" type="button" disabled={!bestInsight} onClick={() => challenge('category_reduction')}><Lightbulb className="mb-5 text-emerald-400" /><strong className="block">Riduci una categoria del 10%</strong><span className="mt-1 block text-sm text-muted-foreground">{bestInsight ? `Basata sui tuoi dati: ${money(bestInsight.potential_saving, analysis?.currency ?? 'EUR')}.` : 'Disponibile quando Insights trova un margine reale.'}</span></button>
    </div></section>

    <Card id="goal-form" className="mb-7 border-white/10 bg-white/[0.035]"><CardHeader><CardTitle>{editingId ? 'Modifica percorso' : 'Nuovo obiettivo personalizzato'}</CardTitle><CardDescription>Scegli traguardo e scadenza: INcentiva calcolerà il passo consigliato.</CardDescription></CardHeader><CardContent><form className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" onSubmit={(event) => void submit(event)}>
      <label className="grid gap-1.5 text-sm"><span>Tipo</span><select className={selectClass} value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value as GoalKind, challenge_template: event.target.value === 'goal' ? null : form.challenge_template })}><option value="goal">Obiettivo</option><option value="challenge">Challenge</option></select></label>
      <label className="grid gap-1.5 text-sm"><span>Icona</span><select className={selectClass} value={form.icon} onChange={(event) => setForm({ ...form, icon: event.target.value as GoalIcon })}>{icons.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
      <div className="grid gap-1.5 sm:col-span-2"><Label htmlFor="goal-name">Nome</Label><Input id="goal-name" placeholder="Fondo emergenze" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></div>
      <div className="grid gap-1.5"><Label htmlFor="goal-amount">{form.progress_unit === 'days' ? 'Numero di giorni' : 'Importo obiettivo'}</Label><Input id="goal-amount" min="0.01" step={form.progress_unit === 'days' ? '1' : '0.01'} type="number" value={form.target_amount} onChange={(event) => setForm({ ...form, target_amount: event.target.value })} /></div>
      <div className="grid gap-1.5"><Label htmlFor="goal-date">Scadenza</Label><Input id="goal-date" min={localDate(new Date())} type="date" value={form.target_date} onChange={(event) => setForm({ ...form, target_date: event.target.value })} /></div>
      <label className="grid gap-1.5 text-sm"><span>Piano</span><select className={selectClass} value={form.saving_frequency} onChange={(event) => setForm({ ...form, saving_frequency: event.target.value as SavingsFrequency | '' })}><option value="">Nessun piano</option><option value="weekly">Settimanale</option><option value="monthly">Mensile</option></select></label>
      <label className="grid gap-1.5 text-sm"><span>Misura</span><select className={selectClass} value={form.progress_unit} onChange={(event) => setForm({ ...form, progress_unit: event.target.value as ProgressUnit, saving_frequency: event.target.value === 'days' ? '' : form.saving_frequency })}><option value="currency">Euro accantonati</option><option value="days">Giorni confermati</option></select></label>
      <div className="flex gap-2 sm:col-span-2 lg:col-span-4"><Button className="bg-emerald-500 text-black hover:bg-emerald-400" disabled={saving} type="submit">{saving ? <LoaderCircle className="animate-spin" /> : <Save />}{editingId ? 'Salva modifiche' : 'Crea percorso'}</Button>{editingId && <Button variant="outline" type="button" onClick={() => { setEditingId(null); setForm(initialForm) }}>Annulla</Button>}</div>
    </form></CardContent></Card>

    {savingInsights.length > 0 && <section className="mb-8"><div className="mb-3"><p className="text-xs uppercase tracking-[0.22em] text-emerald-400">Centiva Insights × INcentiva</p><h2 className="mt-1 text-xl font-semibold">Trasforma un margine in progresso</h2><p className="mt-1 text-sm text-muted-foreground">Il progresso cambia soltanto quando confermi. Non avviene alcun trasferimento.</p></div><div className="grid gap-3 lg:grid-cols-2">{savingInsights.map((insight, index) => <Card key={`${insight.kind}-${insight.title}`} className="border-emerald-400/15 bg-emerald-400/[0.045]"><CardContent className="grid gap-4 p-5"><div className="flex items-start justify-between gap-4"><div><strong>{insight.title}</strong><p className="mt-1 text-sm text-muted-foreground">{insight.message}</p></div><span className="shrink-0 font-data text-lg text-emerald-300">{money(insight.potential_saving, analysis?.currency ?? 'EUR')}</span></div><div className="flex flex-col gap-2 sm:flex-row"><select className={selectClass} value={insightGoals[index] ?? ''} onChange={(event) => setInsightGoals((current) => ({ ...current, [index]: event.target.value }))}><option value="">Scegli un obiettivo</option>{activeCurrencyGoals.map((goal) => <option key={goal.id} value={goal.id}>{goal.name}</option>)}</select><Button className="shrink-0 bg-emerald-500 text-black hover:bg-emerald-400" disabled={busyId !== null || activeCurrencyGoals.length === 0} onClick={() => void applyInsight(index)}><PiggyBank /> Conferma</Button></div></CardContent></Card>)}</div></section>}

    {loading ? <div className="grid min-h-52 place-items-center"><LoaderCircle className="animate-spin text-emerald-300" /></div> : goals.length === 0 ? <Card><CardContent className="py-12 text-center"><Target className="mx-auto mb-3 size-10 text-emerald-300" /><h2 className="text-lg font-semibold">Il primo traguardo parte da qui</h2><p className="mt-1 text-muted-foreground">Crea un percorso: comparirà qui senza dati dimostrativi.</p></CardContent></Card> : <section><div className="mb-3"><p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Percorsi attivi e completati</p><h2 className="mt-1 text-xl font-semibold">I tuoi progressi</h2></div><div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{goals.map((goal) => <Card key={goal.id} className={`border-white/10 bg-white/[0.035] ${goal.status === 'completed' ? 'border-emerald-400/30 bg-emerald-500/[0.08]' : ''}`}>
      <CardHeader><div className="flex items-start justify-between gap-3"><span className={`grid size-11 place-items-center rounded-2xl ${goal.status === 'completed' ? 'bg-emerald-500 text-black' : 'bg-emerald-400/10 text-emerald-300'}`}>{goal.status === 'completed' ? <BadgeCheck /> : <GoalIconView icon={goal.icon} />}</span><div className="flex"><Button size="icon" variant="ghost" aria-label={`Modifica ${goal.name}`} onClick={() => edit(goal)}><Pencil /></Button><Button size="icon" variant="ghost" aria-label={`Elimina ${goal.name}`} disabled={busyId === goal.id} onClick={() => void remove(goal)}><Trash2 /></Button></div></div><CardTitle className="mt-2">{goal.name}</CardTitle><CardDescription>{goal.kind === 'challenge' ? 'Challenge' : 'Obiettivo'}{goal.target_date ? ` · ${new Date(`${goal.target_date}T12:00:00`).toLocaleDateString('it-IT')}` : ''}</CardDescription></CardHeader>
      <CardContent><div className="mb-2 flex items-end justify-between gap-3"><span className="text-2xl font-semibold">{valueLabel(goal.current_amount, goal)}</span><span className="text-sm text-muted-foreground">di {valueLabel(goal.target_amount, goal)}</span></div><div className="h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-emerald-400 transition-[width] duration-700" style={{ width: `${goal.progress_percentage}%` }} /></div><div className="mt-2 flex justify-between gap-3 text-xs"><span className="text-muted-foreground">{goal.motivation}</span><strong className="shrink-0 text-emerald-300">{goal.progress_percentage}%</strong></div>
        {goal.plan && <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl border border-white/10 bg-black/20 p-3 text-sm"><div><span className="block text-xs text-muted-foreground">Passo consigliato</span><strong>{valueLabel(goal.plan.recommended_amount, goal)} / {goal.plan.frequency === 'weekly' ? 'settimana' : 'mese'}</strong></div><div><span className="block text-xs text-muted-foreground">Ritmo</span><strong>{paceLabels[goal.plan.pace_status]}</strong></div></div>}
        {goal.badges.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{goal.badges.map((badge) => <span key={badge.key} className="inline-flex items-center gap-1 rounded-full bg-emerald-400/10 px-2.5 py-1 text-xs text-emerald-200"><Medal className="size-3.5" />{badge.label}</span>)}</div>}
        {goal.status === 'completed' ? <p className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-400/10 p-3 text-sm text-emerald-200"><Trophy className="size-4" /> Traguardo raggiunto</p> : goal.progress_unit === 'days' ? <Button className="mt-4 w-full bg-emerald-500 text-black hover:bg-emerald-400" disabled={busyId === goal.id} onClick={() => void contribute(goal, 1, 'Giornata senza spese superflue confermata')}><CalendarDays /> Conferma oggi</Button> : <div className="mt-4 flex gap-2"><Input min="0.01" step="0.01" type="number" placeholder="Importo reale" value={contributions[goal.id] || ''} onChange={(event) => setContributions((current) => ({ ...current, [goal.id]: event.target.value }))} /><Button className="bg-emerald-500 text-black hover:bg-emerald-400" disabled={busyId === goal.id} onClick={() => void contribute(goal)}><PiggyBank /> Accantona</Button></div>}
        {goal.contributions.length > 0 && <details className="mt-4 text-sm"><summary className="cursor-pointer text-muted-foreground">Ultimi progressi ({goal.contributions.length})</summary><div className="mt-2 divide-y divide-white/10">{goal.contributions.slice(0, 5).map((item) => <div key={item.id} className="flex justify-between gap-3 py-2"><span>{new Date(`${item.contributed_on}T12:00:00`).toLocaleDateString('it-IT')}</span><strong>{valueLabel(item.amount, goal)}</strong></div>)}</div></details>}
      </CardContent></Card>)}</div></section>}
  </main>
}
