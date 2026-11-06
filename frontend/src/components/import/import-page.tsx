import { useEffect, useRef, useState } from 'react'
import { AlertCircle, Camera, CheckCircle2, FileScan, FileSpreadsheet, ImageUp, LoaderCircle, Maximize2, Plus, Save, Trash2, Upload, X } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ReceiptMonolith } from '@/components/effects/receipt-monolith'
import { ApiError, transactionApi } from '@/lib/api'
import { IMPORT_CATEGORIES, parseCsv, parseOcrText, suggestCategory } from '@/lib/import-parser'
import { recognizeImage, warmOcr } from '@/lib/ocr'
import type { ImportDraft } from '@/types/import'

const fieldClass = 'h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/15'

function emptyDraft(source: 'csv' | 'ocr' = 'csv'): ImportDraft {
  return {
    id: crypto.randomUUID(), type: 'expense', amount: '', currency: 'EUR',
    occurred_on: new Date().toISOString().slice(0, 10), description: 'Movimento importato', merchant: '',
    category: 'Altro', notes: '', source,
  }
}

export function ImportPage() {
  const fileInput = useRef<HTMLInputElement>(null)
  const cameraInput = useRef<HTMLInputElement>(null)
  const [drafts, setDrafts] = useState<ImportDraft[]>([])
  const [isReading, setIsReading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [ocrText, setOcrText] = useState('')
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [isMonolithExpanded, setIsMonolithExpanded] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void warmOcr().catch(() => {
        // La scansione mostrerà l'errore se il motore non è disponibile.
      })
    }, 50)

    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview)
  }, [imagePreview])

  useEffect(() => {
    if (!isMonolithExpanded) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [isMonolithExpanded])

  function update(id: string, field: keyof ImportDraft, value: string) {
    setDrafts((current) => current.map((draft) => draft.id === id ? { ...draft, [field]: value } : draft))
  }

  function updateType(id: string, type: ImportDraft['type']) {
    setDrafts((current) => current.map((draft) => draft.id === id ? {
      ...draft,
      type,
      category: suggestCategory(`${draft.merchant} ${draft.description}`, type),
    } : draft))
  }

  async function handleFile(file: File) {
    setError(null)
    setSuccess(null)
    setIsReading(true)
    setProgress(0)

    try {
      if (file.name.toLowerCase().endsWith('.csv') || file.type === 'text/csv') {
        setImagePreview(null)
        const rows = await parseCsv(file)
        if (rows.length === 0) throw new Error('Il CSV non contiene righe riconoscibili. Controlla le intestazioni e gli importi.')
        setDrafts(rows)
        setOcrText('')
      } else if (file.type.startsWith('image/')) {
        setImagePreview(URL.createObjectURL(file))
        const text = await recognizeImage(file, setProgress)
        setOcrText(text)
        const rows = parseOcrText(text)
        if (rows.length === 0) throw new Error('Non ho riconosciuto importi. Prova una foto più nitida oppure aggiungi la riga manualmente.')
        setDrafts(rows)
      } else {
        throw new Error('Formato non supportato. Carica un CSV oppure un’immagine JPG, PNG o WebP.')
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Non è stato possibile leggere il file.')
    } finally {
      setIsReading(false)
      if (fileInput.current) fileInput.current.value = ''
      if (cameraInput.current) cameraInput.current.value = ''
    }
  }

  async function save() {
    setError(null)
    setSuccess(null)
    if (drafts.some((draft) => !draft.occurred_on || Number(draft.amount) <= 0 || draft.currency.length !== 3 || !draft.category.trim())) {
      setError('Correggi le righe incomplete: tipo, importo, valuta, data e categoria sono obbligatori.')
      return
    }

    setIsSaving(true)
    try {
      const response = await transactionApi.bulk({
        transactions: drafts.map((draft) => ({
          type: draft.type,
          amount: Number(draft.amount),
          currency: draft.currency.toUpperCase(),
          occurred_on: draft.occurred_on,
          description: draft.description.trim() || 'Movimento importato',
          merchant: draft.merchant.trim() || null,
          category: draft.category.trim() || 'Altro',
          notes: draft.notes.trim() || null,
          source: draft.source,
        })),
      })
      setSuccess(`${response.data.length} ${response.data.length === 1 ? 'transazione importata' : 'transazioni importate'} correttamente.`)
      setDrafts([])
      setOcrText('')
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Non è stato possibile salvare le transazioni.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-8">
      <div className="mb-7">
        <p className="text-sm font-medium text-emerald-300">Importazione intelligente</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground">Dal documento ai movimenti</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">Carica un CSV oppure una foto. Controlla sempre i dati riconosciuti prima di salvarli.</p>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle>Scegli il file</CardTitle>
          <CardDescription>CSV bancari, screenshot di transazioni, scontrini e appunti fotografati.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-[1fr_13rem] md:block">
            <button
              type="button"
              className="flex min-h-40 w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-emerald-300/30 bg-emerald-400/[0.06] px-6 py-8 text-center shadow-[inset_0_0_60px_rgba(16,185,129,0.035)] transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-emerald-300/60 hover:bg-emerald-400/10 disabled:opacity-60"
              disabled={isReading}
              onClick={() => fileInput.current?.click()}
              data-cursor-label="UPLOAD"
            >
              {isReading ? <FileScan className="mb-3 size-8 text-emerald-300" /> : <Upload className="mb-3 size-8 text-emerald-300" />}
              <span className="font-medium text-foreground">{isReading ? `Analisi in corso${progress ? ` · ${progress}%` : '…'}` : 'Carica file o screenshot'}</span>
              <span className="mt-1 text-sm text-muted-foreground">CSV, JPG, PNG o WebP</span>
            </button>
            <button
              type="button"
              className="flex min-h-32 flex-col items-center justify-center rounded-xl border border-emerald-300/25 bg-emerald-500/10 px-5 py-6 text-center text-emerald-50 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-emerald-300/50 hover:bg-emerald-500/15 disabled:opacity-60 sm:min-h-40 md:hidden"
              disabled={isReading}
              onClick={() => cameraInput.current?.click()}
              data-cursor-label="CAMERA"
            >
              <span className="mb-3 grid size-11 place-items-center rounded-full bg-emerald-400/15">
                <Camera className="size-6 text-emerald-300" aria-hidden="true" />
              </span>
              <span className="font-medium">Scatta foto</span>
              <span className="mt-1 text-xs text-emerald-100/60">Fotocamera posteriore</span>
            </button>
          </div>
          <input ref={fileInput} className="sr-only" type="file" accept=".csv,text/csv,image/jpeg,image/png,image/webp" onChange={(event) => event.target.files?.[0] && void handleFile(event.target.files[0])} />
          <input ref={cameraInput} className="sr-only" type="file" accept="image/*" capture="environment" onChange={(event) => event.target.files?.[0] && void handleFile(event.target.files[0])} />
          <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><FileSpreadsheet className="size-4" /> Colonne italiane o inglesi</span>
            <span className="flex items-center gap-1.5"><ImageUp className="size-4" /> Foto dritta e ben illuminata</span>
          </div>
        </CardContent>
      </Card>

      {imagePreview && <section className={`${isMonolithExpanded ? 'receipt-reveal fixed inset-0 z-50 m-0' : 'relative mt-8'} grid items-stretch gap-0 border-y border-white/10 bg-[#0a0a0c] lg:grid-cols-[0.42fr_1fr]`}>
        <Button className="absolute right-4 top-4 z-20 border-white/15 bg-black/50 text-white backdrop-blur hover:bg-white/10" variant="outline" size="icon" aria-label={isMonolithExpanded ? 'Riduci anteprima' : 'Espandi anteprima'} data-cursor-label={isMonolithExpanded ? 'CLOSE' : 'ZOOM'} onClick={() => setIsMonolithExpanded((current) => !current)}>
          {isMonolithExpanded ? <X /> : <Maximize2 />}
        </Button>
        <div className="flex flex-col justify-between border-b border-white/10 p-6 lg:border-b-0 lg:border-r lg:p-8">
          <div>
            <p className="font-data text-[0.65rem] uppercase tracking-[0.24em] text-emerald-400">Optical analysis / 01</p>
            <h2 className="mt-5 text-3xl font-bold tracking-tighter">Receipt<br />Monolith</h2>
            <p className="mt-4 max-w-sm text-sm leading-6 text-muted-foreground">La superficie viene letta attraverso una lente rifrattiva. Muovi il puntatore sul documento per ispezionare la scansione.</p>
          </div>
          <div className="mt-10 border-t border-white/10 pt-5 font-data text-xs text-zinc-400">
            <div className="flex justify-between"><span>STATUS</span><span className={isReading ? 'text-amber-500' : 'text-emerald-400'}>{isReading ? 'SCANNING' : 'EXTRACTED'}</span></div>
            <div className="mt-3 flex justify-between"><span>OCR CONFIDENCE</span><span>{isReading ? `${progress}%` : 'REVIEW REQUIRED'}</span></div>
          </div>
        </div>
        <ReceiptMonolith imageUrl={imagePreview} scanning={isReading} />
      </section>}

      {error && <Alert variant="destructive" className="mt-5"><AlertCircle /><AlertTitle>Controlla l’importazione</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
      {success && <Alert className="mt-5 border-emerald-300/25 bg-emerald-500/10 text-emerald-100"><CheckCircle2 className="text-emerald-300" /><AlertTitle>Importazione completata</AlertTitle><AlertDescription>{success}</AlertDescription></Alert>}

      {drafts.length > 0 && (
        <section className="mt-7">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div><h2 className="text-xl font-semibold text-foreground">Revisione</h2><p className="text-sm text-muted-foreground">{drafts.length} {drafts.length === 1 ? 'movimento rilevato' : 'movimenti rilevati'}</p></div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setDrafts((current) => [...current, emptyDraft(current[0]?.source)])}><Plus /> Aggiungi riga</Button>
              <Button className="bg-emerald-600 hover:bg-emerald-700" disabled={isSaving} onClick={() => void save()}>{isSaving ? <LoaderCircle className="animate-spin" /> : <Save />} Salva</Button>
            </div>
          </div>

          <div className="space-y-3">
            {drafts.map((draft, index) => (
              <Card key={draft.id} className="border-0 shadow-sm">
                <CardHeader className="flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2"><span className="grid size-7 place-items-center rounded-full bg-emerald-400/15 text-xs text-emerald-200">{index + 1}</span> Movimento</CardTitle>
                  <Button size="icon" variant="ghost" aria-label={`Elimina riga ${index + 1}`} onClick={() => setDrafts((current) => current.filter((item) => item.id !== draft.id))}><Trash2 /></Button>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                  <label className="grid gap-1.5 text-sm"><span>Tipo</span><select className={fieldClass} value={draft.type} onChange={(event) => updateType(draft.id, event.target.value as ImportDraft['type'])}><option value="expense">Uscita</option><option value="income">Entrata</option></select></label>
                  <div className="grid gap-1.5"><Label htmlFor={`amount-${draft.id}`}>Importo</Label><Input id={`amount-${draft.id}`} min="0.01" step="0.01" type="number" value={draft.amount} onChange={(event) => update(draft.id, 'amount', event.target.value)} /></div>
                  <div className="grid gap-1.5"><Label htmlFor={`currency-${draft.id}`}>Valuta</Label><Input id={`currency-${draft.id}`} maxLength={3} value={draft.currency} onChange={(event) => update(draft.id, 'currency', event.target.value.toUpperCase())} /></div>
                  <div className="grid gap-1.5"><Label htmlFor={`date-${draft.id}`}>Data</Label><Input id={`date-${draft.id}`} type="date" value={draft.occurred_on} onChange={(event) => update(draft.id, 'occurred_on', event.target.value)} /></div>
                  <label className="grid gap-1.5 text-sm" htmlFor={`category-${draft.id}`}><span>Categoria</span><select id={`category-${draft.id}`} className={fieldClass} value={draft.category} onChange={(event) => update(draft.id, 'category', event.target.value)}>{!IMPORT_CATEGORIES.some((category) => category === draft.category) && <option value={draft.category}>{draft.category}</option>}{IMPORT_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
                </CardContent>
              </Card>
            ))}
          </div>

          {ocrText && <details className="mt-4 rounded-lg bg-card p-4 text-sm shadow-sm"><summary className="cursor-pointer font-medium">Testo riconosciuto</summary><pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap text-xs text-muted-foreground">{ocrText}</pre></details>}
        </section>
      )}
    </main>
  )
}
