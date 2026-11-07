import { useEffect, useRef, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { Check, LoaderCircle, Mic, MicOff, Save, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ApiError, transactionApi } from '@/lib/api'
import { IMPORT_CATEGORIES } from '@/lib/import-parser'
import { parseVoiceTransaction, voiceCommandExamples, type VoiceTransactionDraft } from '@/lib/voice-command'
import type { TransactionType } from '@/types/transaction'

interface SpeechRecognitionEventLike { results: ArrayLike<{ 0: { transcript: string } }> }
interface SpeechRecognitionErrorEventLike { error: string }
interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike
type SpeechWindow = Window & typeof globalThis & { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor }

interface VoiceCommandButtonProps {
  placement?: 'header' | 'camera'
}

export function VoiceCommandButton({ placement = 'header' }: VoiceCommandButtonProps) {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const processingTimerRef = useRef<number | null>(null)
  const [isListening, setIsListening] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [draft, setDraft] = useState<VoiceTransactionDraft | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const speechWindow = window as SpeechWindow
  const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition

  useEffect(() => () => {
    recognitionRef.current?.stop()
    if (processingTimerRef.current !== null) window.clearTimeout(processingTimerRef.current)
  }, [])

  function startListening() {
    if (!Recognition) {
      setMessage('Il comando vocale non è supportato da questo browser.')
      return
    }
    if (isListening) return recognitionRef.current?.stop()

    setError(null)
    const recognition = new Recognition()
    recognition.lang = 'it-IT'
    recognition.continuous = false
    recognition.interimResults = false
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim() ?? ''
      setMessage(null)
      setIsProcessing(true)
      processingTimerRef.current = window.setTimeout(() => {
        const parsed = parseVoiceTransaction(transcript)
        setIsProcessing(false)
        processingTimerRef.current = null
        if (!parsed) {
          setMessage(`Non ho riconosciuto tipo e importo. ${voiceCommandExamples}`)
          return
        }
        setDraft(parsed)
      }, 350)
    }
    recognition.onerror = (event) => {
      setIsProcessing(false)
      setMessage(event.error === 'not-allowed'
        ? 'Consenti l’uso del microfono nelle impostazioni del browser.'
        : 'Non sono riuscito ad ascoltare. Riprova.')
    }
    recognition.onend = () => { setIsListening(false); recognitionRef.current = null }
    recognitionRef.current = recognition
    setMessage('Ti ascolto… puoi dire semplicemente “50 spesa”.')
    setIsListening(true)
    recognition.start()
  }

  function updateDraft<K extends keyof VoiceTransactionDraft>(key: K, value: VoiceTransactionDraft[K]) {
    setDraft((current) => current ? { ...current, [key]: value } : current)
  }

  async function saveTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!draft) return
    setIsSaving(true)
    setError(null)
    try {
      const response = await transactionApi.create({
        type: draft.type,
        amount: draft.amount,
        currency: draft.currency,
        occurred_on: draft.occurred_on,
        category: draft.category || (draft.type === 'income' ? 'Entrate' : 'Altro'),
      })
      setDraft(null)
      setMessage('Movimento registrato correttamente.')
      window.dispatchEvent(new CustomEvent('centiva:transactions-changed', {
        detail: { transaction: response.data },
      }))
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Non è stato possibile registrare il movimento.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
      <Button
        className={placement === 'camera'
          ? `size-12 rounded-full border border-white/20 bg-black/50 p-0 text-white shadow-[0_12px_35px_rgba(0,0,0,0.35)] backdrop-blur-xl hover:bg-emerald-400 hover:text-black ${isListening ? 'border-emerald-200 bg-emerald-400 text-black shadow-[0_0_30px_rgba(52,211,153,0.4)]' : ''}`
          : isListening ? 'bg-emerald-400 text-black hover:bg-emerald-300' : ''}
        variant={placement === 'camera' ? 'outline' : isListening ? 'default' : 'ghost'}
        size={placement === 'camera' ? 'icon' : 'default'}
        type="button"
        onClick={startListening}
        disabled={isProcessing}
        aria-label={isProcessing ? 'Elaborazione del movimento vocale' : isListening ? 'Interrompi registrazione vocale' : 'Registra movimento con la voce'}
        aria-pressed={isListening}
      >
        {isProcessing ? <LoaderCircle className={`${placement === 'camera' ? 'size-5' : ''} animate-spin`} aria-hidden="true" /> : isListening ? <MicOff className={placement === 'camera' ? 'size-5' : undefined} aria-hidden="true" /> : <Mic className={placement === 'camera' ? 'size-5' : undefined} aria-hidden="true" />}
        {placement === 'header' && <span className="hidden lg:inline">Registra con la voce</span>}
      </Button>

      {createPortal(<>
      {isProcessing && <div className="fixed left-1/2 top-[calc(1rem+env(safe-area-inset-top))] z-[110] flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 items-center justify-center gap-3 rounded-2xl border border-emerald-300/25 bg-[#090c0a]/95 px-4 py-3 text-sm text-emerald-100 shadow-[0_18px_60px_rgba(16,185,129,0.18)] backdrop-blur-xl" role="status" aria-live="polite"><LoaderCircle className="size-4 animate-spin text-emerald-300" aria-hidden="true" /><span>Elaborazione del movimento…</span></div>}
      {message && <div className="fixed left-1/2 top-[calc(1rem+env(safe-area-inset-top))] z-[110] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 rounded-2xl border border-white/15 bg-[#090c0a]/95 px-4 py-3 text-center text-sm text-zinc-200 shadow-2xl backdrop-blur-xl" role="status"><span className="inline-flex items-center gap-2">{message.startsWith('Movimento') && <Check className="size-4 text-emerald-300" />}{message}</span><button className="ml-3 text-emerald-300" type="button" onClick={() => setMessage(null)}>Chiudi</button></div>}

      {draft && (
        <div className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-black/75 p-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] backdrop-blur-sm sm:p-6" role="dialog" aria-modal="true" aria-labelledby="voice-transaction-title">
          <div className="max-h-[calc(100svh-8rem)] w-full max-w-xl overflow-y-auto rounded-[1.75rem] border border-white/15 bg-[#0b100d] p-5 shadow-[0_30px_100px_rgba(0,0,0,0.75)] sm:max-h-[calc(100svh-3rem)] sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-4"><div><p className="text-xs uppercase tracking-[0.2em] text-emerald-300">Movimento vocale</p><h2 id="voice-transaction-title" className="mt-1 text-xl font-semibold">Conferma i dati riconosciuti</h2><p className="mt-2 text-sm text-muted-foreground">“{draft.transcript}”</p></div><Button variant="ghost" size="icon" type="button" onClick={() => setDraft(null)} aria-label="Chiudi"><X /></Button></div>
            <form className="grid gap-4 sm:grid-cols-2" onSubmit={saveTransaction}>
              {error && <p className="rounded-xl border border-rose-400/25 bg-rose-400/10 p-3 text-sm text-rose-100 sm:col-span-2">{error}</p>}
              <div className="grid gap-2"><Label htmlFor="voice-type">Tipo</Label><select id="voice-type" className="h-10 rounded-lg border border-white/15 bg-black/25 px-3" value={draft.type} onChange={(event) => updateDraft('type', event.target.value as TransactionType)}><option value="expense">Uscita</option><option value="income">Entrata</option></select></div>
              <div className="grid grid-cols-[1fr_90px] gap-2"><div className="grid gap-2"><Label htmlFor="voice-amount">Importo</Label><Input id="voice-amount" type="number" min="0.01" step="0.01" required value={draft.amount} onChange={(event) => updateDraft('amount', Number(event.target.value))} /></div><div className="grid gap-2"><Label htmlFor="voice-currency">Valuta</Label><select id="voice-currency" className="h-10 rounded-lg border border-white/15 bg-black/25 px-2" value={draft.currency} onChange={(event) => updateDraft('currency', event.target.value)}><option>EUR</option><option>USD</option><option>GBP</option><option>CHF</option></select></div></div>
              <div className="grid gap-2"><Label htmlFor="voice-date">Data</Label><Input id="voice-date" type="date" required value={draft.occurred_on} onChange={(event) => updateDraft('occurred_on', event.target.value)} /></div>
              <div className="grid gap-2"><Label htmlFor="voice-category">Categoria</Label><select id="voice-category" className="h-10 rounded-lg border border-white/15 bg-black/25 px-3" required value={draft.category} onChange={(event) => updateDraft('category', event.target.value)}>{IMPORT_CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select></div>
              <div className="flex justify-end gap-2 sm:col-span-2"><Button variant="ghost" type="button" onClick={() => setDraft(null)}>Annulla</Button><Button className="bg-emerald-400 text-black hover:bg-emerald-300" type="submit" disabled={isSaving || draft.amount <= 0}>{isSaving ? <LoaderCircle className="animate-spin" /> : <Save />} Salva movimento</Button></div>
            </form>
          </div>
        </div>
      )}
      </>, document.body)}
    </>
  )
}
