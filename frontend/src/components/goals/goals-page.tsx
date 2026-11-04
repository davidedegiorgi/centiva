import { type FormEvent, useEffect, useState } from 'react'
import { CheckCircle2, Flag, LoaderCircle, Pencil, PiggyBank, Save, Target, Trash2, Trophy } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ApiError, goalApi } from '@/lib/api'
import type { GoalKind, GoalPayload, SavingsGoal } from '@/types/goal'

const selectClass = 'h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/15'
const initialForm = { kind: 'goal' as GoalKind, name: '', target_amount: '', currency: 'EUR', target_date: '' }

function money(value: string, currency: string) {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency }).format(Number(value))
}

export function GoalsPage() {
  const [goals, setGoals] = useState<SavingsGoal[]>([])
  const [form, setForm] = useState(initialForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [contributions, setContributions] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    goalApi.list().then((response) => setGoals(response.data)).catch((caught) => setError(caught instanceof ApiError ? caught.message : 'Obiettivi non disponibili.')).finally(() => setLoading(false))
  }, [])

  function payload(): GoalPayload {
    return { kind: form.kind, name: form.name.trim(), target_amount: Number(form.target_amount), currency: form.currency.toUpperCase(), target_date: form.target_date || null }
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    if (!form.name.trim() || Number(form.target_amount) <= 0) return setError('Inserisci un nome e un importo obiettivo maggiore di zero.')
    setSaving(true)
    try {
      const response = editingId ? await goalApi.update(editingId, payload()) : await goalApi.create(payload())
      setGoals((current) => editingId ? current.map((goal) => goal.id === editingId ? response.data : goal) : [response.data, ...current])
      setForm(initialForm)
      setEditingId(null)
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Non è stato possibile salvare.')
    } finally { setSaving(false) }
  }

  function edit(goal: SavingsGoal) {
    setEditingId(goal.id)
    setForm({ kind: goal.kind, name: goal.name, target_amount: goal.target_amount, currency: goal.currency, target_date: goal.target_date || '' })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function contribute(goal: SavingsGoal) {
    const amount = Number(contributions[goal.id])
    if (amount <= 0) return setError('Inserisci un importo da accantonare maggiore di zero.')
    setBusyId(goal.id); setError(null)
    try {
      const response = await goalApi.contribute(goal.id, amount, null)
      setGoals((current) => current.map((item) => item.id === goal.id ? response.data : item))
      setContributions((current) => ({ ...current, [goal.id]: '' }))
    } catch (caught) { setError(caught instanceof ApiError ? caught.message : 'Accantonamento non riuscito.') }
    finally { setBusyId(null) }
  }

  async function remove(goal: SavingsGoal) {
    if (!window.confirm(`Eliminare “${goal.name}” e i relativi accantonamenti?`)) return
    setBusyId(goal.id); setError(null)
    try { await goalApi.remove(goal.id); setGoals((current) => current.filter((item) => item.id !== goal.id)) }
    catch (caught) { setError(caught instanceof ApiError ? caught.message : 'Eliminazione non riuscita.') }
    finally { setBusyId(null) }
  }

  return <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-8">
    <div className="mb-7"><p className="text-sm font-medium text-emerald-300">INcentiva</p><h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground">Dai uno scopo al risparmio</h1><p className="mt-2 text-muted-foreground">Crea un obiettivo o una challenge e registra ogni accantonamento reale.</p></div>
    {error && <Alert variant="destructive" className="mb-5"><Flag /><AlertTitle>Controlla i dati</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}

    <Card className="mb-7 border-0 shadow-sm"><CardHeader><CardTitle>{editingId ? 'Modifica obiettivo' : 'Nuovo percorso'}</CardTitle><CardDescription>La challenge è ideale per un traguardo breve; l’obiettivo per un progetto più ampio.</CardDescription></CardHeader><CardContent>
      <form className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5" onSubmit={(event) => void submit(event)}>
        <label className="grid gap-1.5 text-sm"><span>Tipo</span><select className={selectClass} value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value as GoalKind })}><option value="goal">Obiettivo</option><option value="challenge">Challenge</option></select></label>
        <div className="grid gap-1.5 lg:col-span-2"><Label htmlFor="goal-name">Nome</Label><Input id="goal-name" placeholder="Fondo emergenze" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></div>
        <div className="grid gap-1.5"><Label htmlFor="goal-amount">Traguardo</Label><Input id="goal-amount" min="0.01" step="0.01" type="number" placeholder="1000" value={form.target_amount} onChange={(event) => setForm({ ...form, target_amount: event.target.value })} /></div>
        <div className="grid gap-1.5"><Label htmlFor="goal-date">Scadenza</Label><Input id="goal-date" type="date" value={form.target_date} onChange={(event) => setForm({ ...form, target_date: event.target.value })} /></div>
        <div className="flex gap-2 sm:col-span-2 lg:col-span-5"><Button className="bg-emerald-600 hover:bg-emerald-700" disabled={saving} type="submit">{saving ? <LoaderCircle className="animate-spin" /> : <Save />}{editingId ? 'Salva modifiche' : 'Crea'}</Button>{editingId && <Button variant="outline" type="button" onClick={() => { setEditingId(null); setForm(initialForm) }}>Annulla</Button>}</div>
      </form>
    </CardContent></Card>

    {loading ? <div className="grid min-h-52 place-items-center"><LoaderCircle className="animate-spin text-emerald-300" /></div> : goals.length === 0 ? <Card className="border-0 shadow-sm"><CardContent className="py-12 text-center"><Target className="mx-auto mb-3 size-10 text-emerald-300" /><h2 className="text-lg font-semibold">Il primo traguardo parte da qui</h2><p className="mt-1 text-muted-foreground">Crea un percorso: comparirà qui senza dati dimostrativi.</p></CardContent></Card> : <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{goals.map((goal) => <Card key={goal.id} className={`border-0 shadow-sm ${goal.status === 'completed' ? 'bg-emerald-500/[0.12]' : ''}`}>
      <CardHeader><div className="flex items-start justify-between gap-3"><span className={`grid size-10 place-items-center rounded-xl ${goal.status === 'completed' ? 'bg-emerald-600 text-white' : 'bg-emerald-400/15 text-emerald-300'}`}>{goal.status === 'completed' ? <CheckCircle2 /> : goal.kind === 'challenge' ? <Trophy /> : <Target />}</span><div className="flex"><Button size="icon" variant="ghost" aria-label={`Modifica ${goal.name}`} onClick={() => edit(goal)}><Pencil /></Button><Button size="icon" variant="ghost" aria-label={`Elimina ${goal.name}`} disabled={busyId === goal.id} onClick={() => void remove(goal)}><Trash2 /></Button></div></div><CardTitle className="mt-2">{goal.name}</CardTitle><CardDescription>{goal.kind === 'challenge' ? 'Challenge' : 'Obiettivo'}{goal.target_date ? ` · entro il ${new Date(`${goal.target_date}T12:00:00`).toLocaleDateString('it-IT')}` : ''}</CardDescription></CardHeader>
      <CardContent><div className="mb-2 flex items-end justify-between"><span className="text-2xl font-semibold text-foreground">{money(goal.current_amount, goal.currency)}</span><span className="text-sm text-muted-foreground">di {money(goal.target_amount, goal.currency)}</span></div><div className="h-2 overflow-hidden rounded-full bg-emerald-400/15"><div className="h-full rounded-full bg-emerald-600 transition-all" style={{ width: `${goal.progress_percentage}%` }} /></div><p className="mt-2 text-right text-xs font-medium text-emerald-200">{goal.progress_percentage}%</p>
        {goal.status === 'completed' ? <p className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-300/20 bg-emerald-400/10 p-3 text-sm font-medium text-emerald-200"><Trophy className="size-4" /> Traguardo raggiunto</p> : <div className="mt-4 flex gap-2"><Input min="0.01" step="0.01" type="number" placeholder="Importo" value={contributions[goal.id] || ''} onChange={(event) => setContributions((current) => ({ ...current, [goal.id]: event.target.value }))} /><Button className="bg-emerald-600 text-white hover:bg-emerald-500" disabled={busyId === goal.id} onClick={() => void contribute(goal)}>{busyId === goal.id ? <LoaderCircle className="animate-spin" /> : <PiggyBank />} Accantona</Button></div>}
        {goal.contributions.length > 0 && <details className="mt-4 text-sm"><summary className="cursor-pointer text-muted-foreground">Ultimi accantonamenti ({goal.contributions.length})</summary><div className="mt-2 divide-y">{goal.contributions.slice(0, 5).map((item) => <div key={item.id} className="flex justify-between py-2"><span>{new Date(`${item.contributed_on}T12:00:00`).toLocaleDateString('it-IT')}</span><strong>{money(item.amount, goal.currency)}</strong></div>)}</div></details>}
      </CardContent>
    </Card>)}</div>}
  </main>
}
