import { useEffect, useRef, useState, type FormEvent } from 'react'
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

export function VoiceCommandButton() {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const [isListening, setIsListening] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [draft, setDraft] = useState<VoiceTransactionDraft | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const speechWindow = window as SpeechWindow
  const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition

  useEffect(() => () => recognitionRef.current?.stop(), [])

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
      const parsed = parseVoiceTransaction(transcript)
      if (!parsed) {
        setMessage(`Non ho riconosciuto tipo e importo. ${voiceCommandExamples}`)
        return
      }
      setDraft(parsed)
      setMessage(null)
    }
    recognition.onerror = (event) => setMessage(event.error === 'not-allowed'
      ? 'Consenti l’uso del microfono nelle impostazioni del browser.'
      : 'Non sono riuscito ad ascoltare. Riprova.')
    recognition.onend = () => { setIsListening(false); recognitionRef.current = null }
    recognitionRef.current = recognition
    setMessage('Ti ascolto… pronuncia tipo, importo, categoria e data.')
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
      await transactionApi.create({
        type: draft.type,
        amount: draft.amount,
        currency: draft.currency,
        occurred_on: draft.occurred_on,
        category: draft.category || (draft.type === 'income' ? 'Entrate' : 'Altro'),
      })
      setDraft(null)
      setMessage('Movimento registrato correttamente.')
      window.dispatchEvent(new CustomEvent('centiva:transactions-changed'))
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Non è stato possibile registrare il movimento.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
      <Button className={isListening ? 'bg-emerald-400 text-black hover:bg-emerald-300' : ''} variant={isListening ? 'default' : 'ghost'} type="button" onClick={startListening} aria-label={isListening ? 'Interrompi registrazione vocale' : 'Registra movimento con la voce'} aria-pressed={isListening}>
        {isListening ? <MicOff aria-hidden="true" /> : <Mic aria-hidden="true" />}
        <span className="hidden lg:inline">Registra con la voce</span>
      </Button>

      {message && <div className="fixed left-1/2 top-20 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 rounded-2xl border border-white/15 bg-[#090c0a]/95 px-4 py-3 text-center text-sm text-zinc-200 shadow-2xl backdrop-blur-xl" role="status"><span className="inline-flex items-center gap-2">{message.startsWith('Movimento') && <Check className="size-4 text-emerald-300" />}{message}</span><button className="ml-3 text-emerald-300" type="button" onClick={() => setMessage(null)}>Chiudi</button></div>}

      {draft && (
        <div className="fixed inset-0 z-[80] grid place-items-end bg-black/75 p-3 backdrop-blur-sm sm:place-items-center" role="dialog" aria-modal="true" aria-labelledby="voice-transaction-title">
          <div className="w-full max-w-xl rounded-[1.75rem] border border-white/15 bg-[#0b100d] p-5 shadow-[0_30px_100px_rgba(0,0,0,0.75)] sm:p-6">
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
    </>
  )
}
