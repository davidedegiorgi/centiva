import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, LoaderCircle, Mic, MicOff } from 'lucide-react'

import { TransactionConfirmationModal } from '@/components/transaction-confirmation-modal'
import { Button } from '@/components/ui/button'
import { ApiError, transactionApi } from '@/lib/api'
import { parseVoiceTransaction, voiceCommandExamples, type VoiceTransactionDraft } from '@/lib/voice-command'

interface SpeechRecognitionResultLike extends ArrayLike<{ transcript: string }> { length: number }
interface SpeechRecognitionEventLike { results: ArrayLike<SpeechRecognitionResultLike> }
interface SpeechRecognitionErrorEventLike { error: string }
interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike
type SpeechWindow = Window & typeof globalThis & { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor }

interface VoiceCommandButtonProps {
  placement?: 'header' | 'camera' | 'transactions'
  onSaved?: () => void
}

export function VoiceCommandButton({ placement = 'header', onSaved }: VoiceCommandButtonProps) {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const processingTimerRef = useRef<number | null>(null)
  const listeningTimerRef = useRef<number | null>(null)
  const retryTimerRef = useRef<number | null>(null)
  const candidatesRef = useRef<string[]>([])
  const recognitionErrorRef = useRef<string | null>(null)
  const stoppedByUserRef = useRef(false)
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
    if (listeningTimerRef.current !== null) window.clearTimeout(listeningTimerRef.current)
    if (retryTimerRef.current !== null) window.clearTimeout(retryTimerRef.current)
  }, [])

  function clearListeningTimer() {
    if (listeningTimerRef.current === null) return
    window.clearTimeout(listeningTimerRef.current)
    listeningTimerRef.current = null
  }

  function collectCandidates(event: SpeechRecognitionEventLike) {
    const resultGroups = Array.from(
      { length: event.results.length },
      (_, resultIndex) => {
        const result = event.results[resultIndex]
        return Array.from(
          { length: result?.length ?? 0 },
          (_, alternativeIndex) => result?.[alternativeIndex]?.transcript?.trim() ?? '',
        ).filter(Boolean)
      },
    ).filter((group) => group.length > 0)

    const primaryTranscript = resultGroups.map((group) => group[0]).join(' ').trim()
    return Array.from(new Set([
      primaryTranscript,
      ...resultGroups.flat(),
      ...candidatesRef.current,
    ].filter(Boolean)))
  }

  function processCandidates() {
    const transcript = candidatesRef.current.find((candidate) => parseVoiceTransaction(candidate))
      ?? candidatesRef.current[0]
      ?? ''

    setMessage(null)
    setIsProcessing(true)
    processingTimerRef.current = window.setTimeout(() => {
      const parsed = parseVoiceTransaction(transcript)
      setIsProcessing(false)
      processingTimerRef.current = null
      if (!parsed) {
        setMessage(`Non ho riconosciuto l’importo. ${voiceCommandExamples}`)
        return
      }
      setDraft(parsed)
    }, 350)
  }

  function startRecognition(attempt: number) {
    if (!Recognition) return

    const recognition = new Recognition()
    recognition.lang = 'it-IT'
    recognition.continuous = false
    recognition.interimResults = true
    recognition.maxAlternatives = 5
    recognition.onresult = (event) => {
      candidatesRef.current = collectCandidates(event)
      setMessage('Voce rilevata… completa la frase.')
    }
    recognition.onerror = (event) => {
      recognitionErrorRef.current = event.error
    }
    recognition.onend = () => {
      clearListeningTimer()
      recognitionRef.current = null

      const recognitionError = recognitionErrorRef.current
      const hasCandidates = candidatesRef.current.length > 0
      const canRetry = !stoppedByUserRef.current
        && attempt === 0
        && (!hasCandidates || recognitionError === 'no-speech' || recognitionError === 'network')

      if (recognitionError === 'not-allowed' || recognitionError === 'service-not-allowed') {
        setIsListening(false)
        setMessage('Consenti l’uso del microfono nelle impostazioni del browser.')
        return
      }
      if (recognitionError === 'audio-capture') {
        setIsListening(false)
        setMessage('Il microfono non è disponibile. Controlla che non sia usato da un’altra app.')
        return
      }
      if (hasCandidates) {
        setIsListening(false)
        processCandidates()
        return
      }
      if (canRetry) {
        recognitionErrorRef.current = null
        setMessage('Non ho sentito bene. Riprova, ti ascolto ancora…')
        retryTimerRef.current = window.setTimeout(() => {
          retryTimerRef.current = null
          if (stoppedByUserRef.current) {
            setIsListening(false)
            return
          }
          startRecognition(1)
        }, 300)
        return
      }

      setIsListening(false)
      setMessage(stoppedByUserRef.current
        ? 'Registrazione interrotta.'
        : 'Non ho sentito una frase completa. Avvicinati al microfono e riprova.')
    }
    recognitionRef.current = recognition
    try {
      recognition.start()
      listeningTimerRef.current = window.setTimeout(() => recognition.stop(), 12_000)
    } catch {
      recognitionRef.current = null
      setIsListening(false)
      setMessage('Non sono riuscito ad avviare il microfono. Attendi un momento e riprova.')
    }
  }

  function startListening() {
    if (!Recognition) {
      setMessage('Il comando vocale non è supportato da questo browser.')
      return
    }
    if (isListening) {
      stoppedByUserRef.current = true
      if (retryTimerRef.current !== null) {
        window.clearTimeout(retryTimerRef.current)
        retryTimerRef.current = null
        setIsListening(false)
        setMessage('Registrazione interrotta.')
        return
      }
      recognitionRef.current?.stop()
      return
    }

    if (processingTimerRef.current !== null) window.clearTimeout(processingTimerRef.current)
    if (retryTimerRef.current !== null) window.clearTimeout(retryTimerRef.current)
    clearListeningTimer()
    candidatesRef.current = []
    recognitionErrorRef.current = null
    stoppedByUserRef.current = false
    setError(null)
    setMessage('Ti ascolto… puoi dire importo, categoria o tipo di movimento nell’ordine che preferisci.')
    setIsListening(true)
    startRecognition(0)
  }

  async function saveTransaction() {
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
      onSaved?.()
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
          : placement === 'transactions'
            ? isListening
              ? 'h-10 border-emerald-300 bg-emerald-400 px-4 text-emerald-950 hover:bg-emerald-300'
              : 'h-10 border-white/15 bg-white/[0.04] px-4 text-foreground hover:border-emerald-300/40 hover:bg-emerald-400/10 hover:text-emerald-200'
            : isListening ? 'bg-emerald-400 text-black hover:bg-emerald-300' : ''}
        variant={placement === 'camera' || placement === 'transactions' ? 'outline' : isListening ? 'default' : 'ghost'}
        size={placement === 'camera' ? 'icon' : 'default'}
        type="button"
        onClick={startListening}
        disabled={isProcessing}
        aria-label={isProcessing ? 'Elaborazione del movimento vocale' : isListening ? 'Interrompi registrazione vocale' : 'Registra movimento con la voce'}
        aria-pressed={isListening}
      >
        {isProcessing ? <LoaderCircle className={`${placement === 'camera' ? 'size-5' : ''} animate-spin`} aria-hidden="true" /> : isListening ? <MicOff className={placement === 'camera' ? 'size-5' : undefined} aria-hidden="true" /> : <Mic className={placement === 'camera' ? 'size-5' : undefined} aria-hidden="true" />}
        {placement === 'header' && <span className="hidden lg:inline">Registra con la voce</span>}
        {placement === 'transactions' && <span>Voce</span>}
      </Button>

      {createPortal(<>
      {isProcessing && <div className="fixed left-1/2 top-[calc(1rem+env(safe-area-inset-top))] z-[110] flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 items-center justify-center gap-3 rounded-2xl border border-emerald-300/25 bg-[#090c0a]/95 px-4 py-3 text-sm text-emerald-100 shadow-[0_18px_60px_rgba(16,185,129,0.18)] backdrop-blur-xl" role="status" aria-live="polite"><LoaderCircle className="size-4 animate-spin text-emerald-300" aria-hidden="true" /><span>Elaborazione del movimento…</span></div>}
      {message && <div className="fixed left-1/2 top-[calc(1rem+env(safe-area-inset-top))] z-[110] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 rounded-2xl border border-white/15 bg-[#090c0a]/95 px-4 py-3 text-center text-sm text-zinc-200 shadow-2xl backdrop-blur-xl" role="status"><span className="inline-flex items-center gap-2">{message.startsWith('Movimento') && <Check className="size-4 text-emerald-300" />}{message}</span><button className="ml-3 text-emerald-300" type="button" onClick={() => setMessage(null)}>Chiudi</button></div>}
      </>, document.body)}
      <TransactionConfirmationModal
        draft={draft}
        eyebrow="Movimento vocale"
        sourceText={draft ? `“${draft.transcript}”` : undefined}
        isSaving={isSaving}
        error={error}
        onChange={(next) => setDraft((current) => current ? { ...current, ...next } : current)}
        onCancel={() => { setDraft(null); setError(null) }}
        onConfirm={saveTransaction}
      />
    </>
  )
}
