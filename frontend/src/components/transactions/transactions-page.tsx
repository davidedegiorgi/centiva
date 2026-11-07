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
import { VoiceCommandButton } from '@/components/voice-command-button'
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

function primaryText(transaction: Transaction): string {
  return transaction.category?.trim() || 'Altro'
}

function needsReview(transaction: Transaction): boolean {
  return transaction.source !== 'manual' && transaction.category === 'Altro'
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
  const [isSelecting, setIsSelecting] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isDeleting, setIsDeleting] = useState(false)
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
          setSelectedIds((current) => new Set(
            [...current].filter((id) => response.data.some((transaction) => transaction.id === id)),
          ))
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

  function handleVoiceSaved() {
    setIsLoading(true)
    setError(null)
    setRefreshKey((value) => value + 1)
  }

  function toggleSelection(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAllVisible() {
    const visibleIds = transactions.map((transaction) => transaction.id)
    const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id))
    setSelectedIds(allVisibleSelected ? new Set() : new Set(visibleIds))
  }

  function stopSelecting() {
    setIsSelecting(false)
    setSelectedIds(new Set())
  }

  async function handleBulkDelete() {
    if (selectedIds.size === 0) return
    const confirmed = window.confirm(
      `Eliminare definitivamente ${selectedIds.size} ${selectedIds.size === 1 ? 'transazione' : 'transazioni'}?`,
    )

    if (!confirmed) return

    setIsDeleting(true)
    setError(null)

    try {
      await transactionApi.removeMany([...selectedIds])
      stopSelecting()
      setIsLoading(true)
      setRefreshKey((value) => value + 1)
    } catch (caughtError) {
      setError(
        caughtError instanceof ApiError
          ? caughtError
          : new ApiError('Impossibile eliminare le transazioni selezionate.', 500),
      )
      setIsLoading(true)
      setRefreshKey((value) => value + 1)
    } finally {
      setIsDeleting(false)
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
        <div className="flex flex-wrap gap-2">
          <VoiceCommandButton placement="transactions" onSaved={handleVoiceSaved} />
          <Button
            className="h-10 bg-emerald-600 px-4 text-white hover:bg-emerald-700"
            type="button"
            onClick={openCreateForm}
          >
            <Plus aria-hidden="true" />
            Nuova transazione
          </Button>
        </div>
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
                  placeholder="Cerca per categoria"
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

      <div className="flex min-h-10 flex-wrap items-center gap-2">
        <Button
          className="h-10 border-rose-300/25 text-rose-200 hover:bg-rose-500/10 hover:text-rose-100"
          variant="outline"
          type="button"
          disabled={transactions.length === 0 && !isSelecting}
          onClick={() => isSelecting ? stopSelecting() : setIsSelecting(true)}
        >
          <Trash2 aria-hidden="true" />
          {isSelecting ? 'Annulla selezione' : 'Elimina movimenti'}
        </Button>
        {isSelecting && transactions.length > 0 && (
          <>
            <Button variant="ghost" size="sm" type="button" disabled={isDeleting} onClick={toggleAllVisible}>
              {transactions.every((transaction) => selectedIds.has(transaction.id)) ? 'Deseleziona tutte' : 'Seleziona tutte'}
            </Button>
            <Button className="bg-rose-600 text-white hover:bg-rose-500" size="sm" type="button" disabled={selectedIds.size === 0 || isDeleting} onClick={() => void handleBulkDelete()}>
              {isDeleting ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Trash2 aria-hidden="true" />}
              Elimina {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
            </Button>
          </>
        )}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Operazione non completata</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      )}

      <Card className="mb-4 overflow-hidden border-white/10 bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
          <p className="font-medium text-foreground">
            {isSelecting
              ? `${selectedIds.size} ${selectedIds.size === 1 ? 'selezionata' : 'selezionate'}`
              : (meta.total === 1 ? '1 transazione' : `${meta.total} transazioni`)}
          </p>
          <div className="flex items-center gap-2">
            {isLoading && <LoaderCircle className="size-4 animate-spin text-emerald-600" aria-label="Caricamento" />}
          </div>
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
                <thead className="border-b border-white/10 bg-white/[0.035] text-xs uppercase tracking-wide text-zinc-400">
                  <tr>
                    {isSelecting && <th className="w-12 px-5 py-3"><span className="sr-only">Seleziona</span></th>}
                    <th className="px-5 py-3 font-medium">Data</th>
                    <th className="px-5 py-3 font-medium">Movimento</th>
                    <th className="px-5 py-3 font-medium">Categoria e stato</th>
                    <th className="px-5 py-3 text-right font-medium">Importo</th>
                    {!isSelecting && <th className="w-20 px-5 py-3"><span className="sr-only">Azioni</span></th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {transactions.map((transaction) => (
                    <tr key={transaction.id} className="transition-colors hover:bg-white/[0.035]">
                      {isSelecting && (
                        <td className="px-5 py-4">
                          <input
                            className="size-4 cursor-pointer accent-emerald-400"
                            type="checkbox"
                            checked={selectedIds.has(transaction.id)}
                            aria-label={`Seleziona ${primaryText(transaction)}`}
                            onChange={() => toggleSelection(transaction.id)}
                          />
                        </td>
                      )}
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
                            <p className="truncate font-medium text-foreground">{primaryText(transaction)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-2">
                          <span className={`rounded-full px-2.5 py-1 text-xs ${transaction.category ? 'bg-white/[0.06] text-zinc-300' : 'bg-amber-500/10 text-amber-200'}`}>
                            {transaction.category || 'Senza categoria'}
                          </span>
                          {needsReview(transaction) && <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-xs text-amber-200">Dati da verificare</span>}
                        </div>
                      </td>
                      <td className={`whitespace-nowrap px-5 py-4 text-right font-semibold ${transaction.type === 'income' ? 'text-emerald-300' : 'text-foreground'}`}>
                        {transaction.type === 'income' ? '+' : '−'} {formatAmount(transaction)}
                      </td>
                      {!isSelecting && <td className="px-5 py-4">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" type="button" onClick={() => openEditForm(transaction)} aria-label={`Modifica ${primaryText(transaction)}`}>
                            <Pencil aria-hidden="true" />
                          </Button>
                        </div>
                      </td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-white/10 md:hidden">
              {transactions.map((transaction) => (
                <article className={`flex flex-col gap-3 p-4 ${selectedIds.has(transaction.id) ? 'bg-emerald-400/[0.06]' : ''}`} key={transaction.id}>
                  <div className="flex items-start justify-between gap-4">
                    {isSelecting && (
                      <input
                        className="mt-1 size-5 shrink-0 cursor-pointer accent-emerald-400"
                        type="checkbox"
                        checked={selectedIds.has(transaction.id)}
                        aria-label={`Seleziona ${primaryText(transaction)}`}
                        onChange={() => toggleSelection(transaction.id)}
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-foreground">{primaryText(transaction)}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatDate(transaction.occurred_on)}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {!transaction.category && <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-xs text-amber-200">Senza categoria</span>}
                        {needsReview(transaction) && <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-xs text-amber-200">Dati da verificare</span>}
                      </div>
                    </div>
                    <p className={`shrink-0 font-semibold ${transaction.type === 'income' ? 'text-emerald-300' : 'text-foreground'}`}>
                      {transaction.type === 'income' ? '+' : '−'} {formatAmount(transaction)}
                    </p>
                  </div>
                  {!isSelecting && <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="sm" type="button" onClick={() => openEditForm(transaction)}>
                      <Pencil aria-hidden="true" /> Modifica
                    </Button>
                  </div>}
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
