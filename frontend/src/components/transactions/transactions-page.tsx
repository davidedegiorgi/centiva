import { useEffect, useState, type FormEvent } from 'react'
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  WalletCards,
} from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ApiError, transactionApi } from '@/lib/api'
import type {
  PaginationMeta,
  Transaction,
  TransactionFilters,
  TransactionType,
} from '@/types/transaction'

import { TransactionForm } from './transaction-form'

const emptyMeta: PaginationMeta = {
  current_page: 1,
  from: null,
  last_page: 1,
  per_page: 25,
  to: null,
  total: 0,
}

function formatAmount(transaction: Transaction): string {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: transaction.currency,
  }).format(Number(transaction.amount))
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat('it-IT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${date}T00:00:00`))
}

export function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [meta, setMeta] = useState<PaginationMeta>(emptyMeta)
  const [filters, setFilters] = useState<TransactionFilters>({ per_page: 25 })
  const [search, setSearch] = useState('')
  const [type, setType] = useState<TransactionType | ''>('')
  const [category, setCategory] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let isMounted = true

    transactionApi
      .list(filters)
      .then((response) => {
        if (isMounted) {
          setTransactions(response.data)
          setMeta(response.meta)
        }
      })
      .catch((caughtError: unknown) => {
        if (isMounted) {
          setError(
            caughtError instanceof ApiError
              ? caughtError
              : new ApiError('Impossibile caricare le transazioni.', 500),
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
  }, [filters, refreshKey])

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsLoading(true)
    setError(null)
    setFilters({
      search: search.trim(),
      type,
      category: category.trim(),
      date_from: dateFrom,
      date_to: dateTo,
      page: 1,
      per_page: 25,
    })
  }

  function clearFilters() {
    setSearch('')
    setType('')
    setCategory('')
    setDateFrom('')
    setDateTo('')
    setIsLoading(true)
    setError(null)
    setFilters({ per_page: 25 })
  }

  function openCreateForm() {
    setEditingTransaction(null)
    setIsFormOpen(true)
  }

  function openEditForm(transaction: Transaction) {
    setEditingTransaction(transaction)
    setIsFormOpen(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleSaved() {
    setIsFormOpen(false)
    setEditingTransaction(null)
    setIsLoading(true)
    setError(null)
    setRefreshKey((value) => value + 1)
  }

  async function handleDelete(transaction: Transaction) {
    const confirmed = window.confirm(
      `Eliminare definitivamente “${transaction.description}”?`,
    )

    if (!confirmed) {
      return
    }

    setDeletingId(transaction.id)
    setError(null)

    try {
      await transactionApi.remove(transaction.id)
      setIsLoading(true)
      setRefreshKey((value) => value + 1)
    } catch (caughtError) {
      setError(
        caughtError instanceof ApiError
          ? caughtError
          : new ApiError('Impossibile eliminare la transazione.', 500),
      )
    } finally {
      setDeletingId(null)
    }
  }

  function goToPage(page: number) {
    setIsLoading(true)
    setError(null)
    setFilters((current) => ({ ...current, page }))
  }

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-8 lg:py-12">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300">
            Movimenti
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Transazioni
          </h1>
          <p className="mt-2 text-muted-foreground">
            Registra e ritrova entrate e uscite in un unico posto.
          </p>
        </div>
        <Button
          className="h-10 bg-emerald-600 px-4 text-white hover:bg-emerald-700"
          type="button"
          onClick={openCreateForm}
        >
          <Plus aria-hidden="true" />
          Nuova transazione
        </Button>
      </div>

      {isFormOpen && (
        <TransactionForm
          key={editingTransaction?.id ?? 'new'}
          transaction={editingTransaction}
          onCancel={() => setIsFormOpen(false)}
          onSaved={handleSaved}
        />
      )}

      <Card className="border-white/10 bg-card">
        <CardContent>
          <form className="grid gap-4 md:grid-cols-2 xl:grid-cols-6" onSubmit={applyFilters}>
            <div className="flex flex-col gap-2 md:col-span-2 xl:col-span-2">
              <Label htmlFor="transaction-search">Cerca</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input
                  id="transaction-search"
                  className="pl-9"
                  placeholder="Descrizione, esercente o categoria"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="filter-type">Tipo</Label>
              <select
                id="filter-type"
                className="h-9 rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
                value={type}
                onChange={(event) => setType(event.target.value as TransactionType | '')}
              >
                <option value="">Tutti</option>
                <option value="expense">Uscite</option>
                <option value="income">Entrate</option>
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="filter-category">Categoria</Label>
              <Input
                id="filter-category"
                placeholder="Tutte"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="filter-date-from">Dal</Label>
              <Input
                id="filter-date-from"
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="filter-date-to">Al</Label>
              <Input
                id="filter-date-to"
                type="date"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
              />
            </div>

            <div className="flex items-end gap-2 md:col-span-2 xl:col-span-6 xl:justify-end">
              <Button variant="ghost" type="button" onClick={clearFilters}>
                Azzera
              </Button>
              <Button type="submit">
                <SlidersHorizontal aria-hidden="true" />
                Applica filtri
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Operazione non completata</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      )}

      <Card className="overflow-hidden border-white/10 bg-card">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <p className="font-medium text-foreground">
            {meta.total === 1 ? '1 transazione' : `${meta.total} transazioni`}
          </p>
          {isLoading && <LoaderCircle className="size-4 animate-spin text-emerald-600" aria-label="Caricamento" />}
        </div>

        {!isLoading && transactions.length === 0 ? (
          <div className="grid min-h-72 place-items-center px-6 py-12 text-center">
            <div className="flex max-w-sm flex-col items-center gap-3">
              <span className="grid size-12 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-300">
                <WalletCards aria-hidden="true" />
              </span>
              <h2 className="text-lg font-semibold text-foreground">Nessuna transazione trovata</h2>
              <p className="text-sm leading-6 text-muted-foreground">
                Aggiungi il primo movimento oppure modifica i filtri di ricerca.
              </p>
              <Button className="mt-1" type="button" onClick={openCreateForm}>
                <Plus aria-hidden="true" />
                Aggiungi transazione
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3 font-medium">Data</th>
                    <th className="px-5 py-3 font-medium">Descrizione</th>
                    <th className="px-5 py-3 font-medium">Categoria</th>
                    <th className="px-5 py-3 text-right font-medium">Importo</th>
                    <th className="w-28 px-5 py-3"><span className="sr-only">Azioni</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {transactions.map((transaction) => (
                    <tr key={transaction.id} className="hover:bg-slate-50/70">
                      <td className="whitespace-nowrap px-5 py-4 text-muted-foreground">
                        {formatDate(transaction.occurred_on)}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${transaction.type === 'income' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-white/5 text-slate-300'}`}>
                            {transaction.type === 'income' ? (
                              <ArrowDownLeft className="size-4" aria-hidden="true" />
                            ) : (
                              <ArrowUpRight className="size-4" aria-hidden="true" />
                            )}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-foreground">{transaction.description}</p>
                            {transaction.merchant && (
                              <p className="truncate text-xs text-muted-foreground">{transaction.merchant}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-muted-foreground">
                        {transaction.category ?? '—'}
                      </td>
                      <td className={`whitespace-nowrap px-5 py-4 text-right font-semibold ${transaction.type === 'income' ? 'text-emerald-300' : 'text-foreground'}`}>
                        {transaction.type === 'income' ? '+' : '−'} {formatAmount(transaction)}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" type="button" onClick={() => openEditForm(transaction)} aria-label={`Modifica ${transaction.description}`}>
                            <Pencil aria-hidden="true" />
                          </Button>
                          <Button variant="ghost" size="icon" type="button" disabled={deletingId === transaction.id} onClick={() => handleDelete(transaction)} aria-label={`Elimina ${transaction.description}`}>
                            {deletingId === transaction.id ? (
                              <LoaderCircle className="animate-spin" aria-hidden="true" />
                            ) : (
                              <Trash2 aria-hidden="true" />
                            )}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="divide-y md:hidden">
              {transactions.map((transaction) => (
                <article className="flex flex-col gap-3 p-4" key={transaction.id}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{transaction.description}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatDate(transaction.occurred_on)} · {transaction.category ?? 'Senza categoria'}
                      </p>
                    </div>
                    <p className={`shrink-0 font-semibold ${transaction.type === 'income' ? 'text-emerald-300' : 'text-foreground'}`}>
                      {transaction.type === 'income' ? '+' : '−'} {formatAmount(transaction)}
                    </p>
                  </div>
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="sm" type="button" onClick={() => openEditForm(transaction)}>
                      <Pencil aria-hidden="true" /> Modifica
                    </Button>
                    <Button variant="ghost" size="sm" type="button" disabled={deletingId === transaction.id} onClick={() => handleDelete(transaction)}>
                      <Trash2 aria-hidden="true" /> Elimina
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}

        {meta.last_page > 1 && (
          <div className="flex items-center justify-between border-t px-5 py-4 text-sm text-muted-foreground">
            <span>Pagina {meta.current_page} di {meta.last_page}</span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                type="button"
                disabled={meta.current_page <= 1 || isLoading}
                onClick={() => goToPage(meta.current_page - 1)}
              >
                <ChevronLeft aria-hidden="true" /> Precedente
              </Button>
              <Button
                variant="outline"
                size="sm"
                type="button"
                disabled={meta.current_page >= meta.last_page || isLoading}
                onClick={() => goToPage(meta.current_page + 1)}
              >
                Successiva <ChevronRight aria-hidden="true" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </main>
  )
}
