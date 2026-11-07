import { useId, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { LoaderCircle, Save, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { IMPORT_CATEGORIES } from '@/lib/import-parser'
import type { TransactionPayload, TransactionType } from '@/types/transaction'

interface TransactionConfirmationModalProps {
  draft: TransactionPayload | null
  eyebrow: string
  sourceText?: string
  isSaving: boolean
  error: string | null
  onChange: (draft: TransactionPayload) => void
  onCancel: () => void
  onConfirm: () => void | Promise<void>
}

export function TransactionConfirmationModal({
  draft,
  eyebrow,
  sourceText,
  isSaving,
  error,
  onChange,
  onCancel,
  onConfirm,
}: TransactionConfirmationModalProps) {
  const id = useId()
  if (!draft) return null

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void onConfirm()
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-black/75 p-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] backdrop-blur-sm sm:p-6" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`}>
      <div className="max-h-[calc(100svh-8rem)] w-full max-w-xl overflow-y-auto rounded-[1.75rem] border border-white/15 bg-[#0b100d] p-5 shadow-[0_30px_100px_rgba(0,0,0,0.75)] sm:max-h-[calc(100svh-3rem)] sm:p-6">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">{eyebrow}</p>
            <h2 id={`${id}-title`} className="mt-1 text-xl font-semibold">Conferma i dati riconosciuti</h2>
            {sourceText && <p className="mt-2 text-sm text-muted-foreground">{sourceText}</p>}
          </div>
          <Button variant="ghost" size="icon" type="button" onClick={onCancel} aria-label="Chiudi"><X /></Button>
        </div>

        <form className="grid gap-4 sm:grid-cols-2" onSubmit={submit}>
          {error && <p className="rounded-xl border border-rose-400/25 bg-rose-400/10 p-3 text-sm text-rose-100 sm:col-span-2">{error}</p>}
          <div className="grid gap-2">
            <Label htmlFor={`${id}-type`}>Tipo</Label>
            <select id={`${id}-type`} className="h-10 rounded-lg border border-white/15 bg-black/25 px-3" value={draft.type} onChange={(event) => onChange({ ...draft, type: event.target.value as TransactionType })}>
              <option value="expense">Uscita</option>
              <option value="income">Entrata</option>
            </select>
          </div>
          <div className="grid grid-cols-[1fr_90px] gap-2">
            <div className="grid gap-2">
              <Label htmlFor={`${id}-amount`}>Importo</Label>
              <Input id={`${id}-amount`} type="number" min="0.01" step="0.01" required value={draft.amount} onChange={(event) => onChange({ ...draft, amount: Number(event.target.value) })} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`${id}-currency`}>Valuta</Label>
              <select id={`${id}-currency`} className="h-10 rounded-lg border border-white/15 bg-black/25 px-2" value={draft.currency} onChange={(event) => onChange({ ...draft, currency: event.target.value })}>
                <option>EUR</option><option>USD</option><option>GBP</option><option>CHF</option>
              </select>
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`${id}-date`}>Data</Label>
            <Input id={`${id}-date`} type="date" required value={draft.occurred_on} onChange={(event) => onChange({ ...draft, occurred_on: event.target.value })} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`${id}-category`}>Categoria</Label>
            <select id={`${id}-category`} className="h-10 rounded-lg border border-white/15 bg-black/25 px-3" required value={draft.category} onChange={(event) => onChange({ ...draft, category: event.target.value })}>
              {IMPORT_CATEGORIES.map((category) => <option key={category}>{category}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button variant="ghost" type="button" onClick={onCancel}>Annulla</Button>
            <Button className="bg-emerald-400 text-black hover:bg-emerald-300" type="submit" disabled={isSaving || draft.amount <= 0}>
              {isSaving ? <LoaderCircle className="animate-spin" /> : <Save />} Salva movimento
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  )
}
