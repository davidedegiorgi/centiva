import { useState, type FormEvent } from 'react'
import { LoaderCircle, Save, X } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ApiError, transactionApi } from '@/lib/api'
import { IMPORT_CATEGORIES } from '@/lib/import-parser'
import type {
  Transaction,
  TransactionPayload,
  TransactionType,
} from '@/types/transaction'

interface TransactionFormProps {
  transaction: Transaction | null
  onCancel: () => void
  onSaved: (transaction: Transaction) => void
}

function today(): string {
  return new Intl.DateTimeFormat('en-CA').format(new Date())
}

export function TransactionForm({
  transaction,
  onCancel,
  onSaved,
}: TransactionFormProps) {
  const [type, setType] = useState<TransactionType>(transaction?.type ?? 'expense')
  const [amount, setAmount] = useState(transaction?.amount ?? '')
  const [currency, setCurrency] = useState(transaction?.currency ?? 'EUR')
  const [occurredOn, setOccurredOn] = useState(transaction?.occurred_on ?? today())
  const [category, setCategory] = useState(transaction?.category ?? 'Altro')
  const [error, setError] = useState<ApiError | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const categoryOptions = Array.from(new Set([category, ...IMPORT_CATEGORIES].filter(Boolean)))

  function updateType(nextType: TransactionType) {
    setType(nextType)

    if (!transaction) {
      setCategory(nextType === 'income' ? 'Entrate' : 'Altro')
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsSaving(true)

    const payload: TransactionPayload = {
      type,
      amount: Number(amount),
      currency,
      occurred_on: occurredOn,
      category: category.trim() || 'Altro',
    }

    try {
      const response = transaction
        ? await transactionApi.update(transaction.id, payload)
        : await transactionApi.create(payload)

      onSaved(response.data)
    } catch (caughtError) {
      setError(
        caughtError instanceof ApiError
          ? caughtError
          : new ApiError('Si è verificato un errore inatteso.', 500),
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Card className="border-emerald-100 bg-card shadow-[0_24px_70px_-42px_rgba(15,45,34,0.3)]">
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <CardTitle>
            {transaction ? 'Modifica transazione' : 'Nuova transazione'}
          </CardTitle>
          <CardDescription>
            Inserisci i dati così come compaiono sul movimento.
          </CardDescription>
        </div>
        <Button variant="ghost" size="icon" type="button" onClick={onCancel} aria-label="Chiudi">
          <X aria-hidden="true" />
        </Button>
      </CardHeader>

      <CardContent>
        <form className="grid gap-5 sm:grid-cols-2" onSubmit={handleSubmit}>
          {error && Object.keys(error.errors).length === 0 && (
            <Alert className="sm:col-span-2" variant="destructive">
              <AlertTitle>Operazione non completata</AlertTitle>
              <AlertDescription>{error.message}</AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="transaction-type">Tipo</Label>
            <select
              id="transaction-type"
              className="h-9 rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
              value={type}
              onChange={(event) => updateType(event.target.value as TransactionType)}
            >
              <option value="expense">Uscita</option>
              <option value="income">Entrata</option>
            </select>
            {error?.errors.type?.[0] && (
              <p className="text-sm text-destructive">{error.errors.type[0]}</p>
            )}
          </div>

          <div className="grid grid-cols-[1fr_92px] gap-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="transaction-amount">Importo</Label>
              <Input
                id="transaction-amount"
                type="number"
                min="0.01"
                step="0.01"
                inputMode="decimal"
                required
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                aria-invalid={Boolean(error?.errors.amount)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="transaction-currency">Valuta</Label>
              <select
                id="transaction-currency"
                className="h-9 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
                value={currency}
                onChange={(event) => setCurrency(event.target.value)}
              >
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
                <option value="GBP">GBP</option>
                <option value="CHF">CHF</option>
              </select>
            </div>
            {error?.errors.amount?.[0] && (
              <p className="col-span-2 text-sm text-destructive">{error.errors.amount[0]}</p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="transaction-date">Data</Label>
            <Input
              id="transaction-date"
              type="date"
              required
              value={occurredOn}
              onChange={(event) => setOccurredOn(event.target.value)}
              aria-invalid={Boolean(error?.errors.occurred_on)}
            />
            {error?.errors.occurred_on?.[0] && (
              <p className="text-sm text-destructive">{error.errors.occurred_on[0]}</p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="transaction-category">Categoria</Label>
            <select
              id="transaction-category"
              className="h-9 rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
              required
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              aria-invalid={Boolean(error?.errors.category)}
            >
              {categoryOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
            {error?.errors.category?.[0] && (
              <p className="text-sm text-destructive">{error.errors.category[0]}</p>
            )}
          </div>

          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button variant="ghost" type="button" onClick={onCancel}>
              Annulla
            </Button>
            <Button
              className="bg-emerald-600 text-white hover:bg-emerald-700"
              type="submit"
              disabled={isSaving}
            >
              {isSaving ? (
                <LoaderCircle className="animate-spin" aria-hidden="true" />
              ) : (
                <Save aria-hidden="true" />
              )}
              Salva
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
