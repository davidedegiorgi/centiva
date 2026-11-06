import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertTriangle, ArrowRight, Camera, Check, Images, LoaderCircle } from 'lucide-react'

import { LiquidNumber } from '@/components/effects/liquid-number'
import { Button } from '@/components/ui/button'
import { dashboardApi, transactionApi } from '@/lib/api'
import { parseOcrText } from '@/lib/import-parser'
import { recognizeImage, warmOcr } from '@/lib/ocr'

const MAX_CAPTURE_SIDE = 2600
const CAMERA_RELEASE_DELAY = 1500

let sharedCameraStream: MediaStream | null = null
let pendingCameraStream: Promise<MediaStream> | null = null
let cameraReleaseTimer: number | null = null

function hasLiveVideo(stream: MediaStream | null): stream is MediaStream {
  return stream?.getVideoTracks().some((track) => track.readyState === 'live') ?? false
}

async function acquireCameraStream(): Promise<MediaStream> {
  if (cameraReleaseTimer !== null) {
    window.clearTimeout(cameraReleaseTimer)
    cameraReleaseTimer = null
  }
  if (hasLiveVideo(sharedCameraStream)) return sharedCameraStream
  if (pendingCameraStream) return pendingCameraStream

  pendingCameraStream = navigator.mediaDevices.getUserMedia({
    audio: false,
    video: { facingMode: { ideal: 'environment' }, width: { ideal: 3840 }, height: { ideal: 2160 } },
  }).then((stream) => {
    sharedCameraStream = stream
    return stream
  }).finally(() => { pendingCameraStream = null })

  return pendingCameraStream
}

function stopSharedCamera(): void {
  if (cameraReleaseTimer !== null) window.clearTimeout(cameraReleaseTimer)
  cameraReleaseTimer = null
  sharedCameraStream?.getTracks().forEach((track) => track.stop())
  sharedCameraStream = null
}

function scheduleCameraRelease(): void {
  if (cameraReleaseTimer !== null) window.clearTimeout(cameraReleaseTimer)
  cameraReleaseTimer = window.setTimeout(stopSharedCamera, CAMERA_RELEASE_DELAY)
}

interface MobileCapturePageProps {
  onEnterApp: () => void
  sessionReady?: boolean
}

export function MobileCapturePage({ onEnterApp, sessionReady = true }: MobileCapturePageProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const cameraRequest = useRef(0)
  const [cameraReady, setCameraReady] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [monthlySavings, setMonthlySavings] = useState(0)
  const [income, setIncome] = useState(0)
  const [expenses, setExpenses] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [savingsEffect, setSavingsEffect] = useState<{ delta: number; key: number } | null>(null)

  const startCamera = useCallback(async () => {
    const requestId = ++cameraRequest.current
    setCameraError(null)

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('La fotocamera non è disponibile in questo browser. Puoi comunque caricare una foto.')
      return
    }

    try {
      try {
        const permission = await navigator.permissions?.query({ name: 'camera' as PermissionName })
        if (permission?.state === 'denied') {
          setCameraError('Riattiva il permesso fotocamera nelle impostazioni del browser.')
          return
        }
      } catch {
        // Safari non espone sempre il permesso camera tramite Permissions API.
      }

      const stream = await acquireCameraStream()

      if (requestId !== cameraRequest.current) {
        return
      }

      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setCameraReady(true)
    } catch {
      setCameraError('Consenti l’accesso alla fotocamera oppure carica una foto dalla galleria.')
    }
  }, [])

  useEffect(() => {
    const cameraFrame = window.requestAnimationFrame(() => void startCamera())
    void warmOcr().catch(() => undefined)

    return () => {
      window.cancelAnimationFrame(cameraFrame)
      cameraRequest.current += 1
      streamRef.current = null
      scheduleCameraRelease()
    }
  }, [startCamera])

  useEffect(() => {
    if (!sessionReady) return

    void dashboardApi.show().then(({ data }) => {
      setMonthlySavings(Number(data.summary.net_savings))
      setIncome(Number(data.summary.income))
      setExpenses(Number(data.summary.expenses))
    }).catch(() => setError('Non è stato possibile caricare il riepilogo mensile.'))
  }, [sessionReady])

  async function analyzeImage(image: File | HTMLCanvasElement) {
    if (!sessionReady) return
    setError(null)
    setIsScanning(true)
    setProgress(0)

    try {
      const text = await recognizeImage(image, setProgress)
      const rows = parseOcrText(text)
      if (rows.length === 0) throw new Error('Non ho trovato importi leggibili. Avvicina il documento e riprova.')

      await transactionApi.bulk({
        transactions: rows.map((draft) => ({
          type: draft.type,
          amount: Number(draft.amount),
          currency: draft.currency,
          occurred_on: draft.occurred_on,
          description: draft.description.trim() || 'Movimento importato',
          merchant: draft.merchant.trim() || null,
          category: draft.category.trim() || 'Altro',
          notes: draft.notes.trim() || null,
          source: 'ocr',
        })),
      })

      const delta = rows.reduce((total, draft) => {
        const amount = Number(draft.amount)
        return total + (draft.type === 'income' ? amount : -amount)
      }, 0)
      const scannedIncome = rows
        .filter((draft) => draft.type === 'income')
        .reduce((total, draft) => total + Number(draft.amount), 0)
      const scannedExpenses = rows
        .filter((draft) => draft.type === 'expense')
        .reduce((total, draft) => total + Number(draft.amount), 0)

      setMonthlySavings((current) => current + delta)
      setIncome((current) => current + scannedIncome)
      setExpenses((current) => current + scannedExpenses)
      setSavingsEffect({ delta, key: Date.now() })
      window.setTimeout(() => setSavingsEffect(null), 1800)

      void dashboardApi.show().then(({ data }) => {
        setMonthlySavings(Number(data.summary.net_savings))
        setIncome(Number(data.summary.income))
        setExpenses(Number(data.summary.expenses))
      })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'La scansione o il salvataggio non sono riusciti.')
    } finally {
      setIsScanning(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function capturePhoto() {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || video.videoWidth === 0) {
      setError('La fotocamera non è ancora pronta.')
      return
    }

    const track = streamRef.current?.getVideoTracks()[0]
    if (track && 'ImageCapture' in window) {
      try {
        const imageCapture = new ImageCapture(track)
        const blob = await imageCapture.takePhoto()
        const fullResolutionPhoto = new File([blob], 'centiva-scan.jpg', { type: blob.type || 'image/jpeg' })
        await analyzeImage(fullResolutionPhoto)
        return
      } catch {
        // Safari e alcuni browser usano il fotogramma video come fallback.
      }
    }

    const scale = Math.min(1, MAX_CAPTURE_SIDE / Math.max(video.videoWidth, video.videoHeight))
    canvas.width = Math.round(video.videoWidth * scale)
    canvas.height = Math.round(video.videoHeight * scale)
    const context = canvas.getContext('2d')
    if (!context) return
    context.drawImage(video, 0, 0, canvas.width, canvas.height)

    await analyzeImage(canvas)
  }

  return (
    <main className="relative min-h-[100svh] overflow-hidden bg-black text-white">
      <video ref={videoRef} className="absolute inset-0 size-full object-cover" muted playsInline aria-label="Anteprima fotocamera" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.72),transparent_34%,transparent_55%,rgba(0,0,0,0.9))]" />
      <div className="pointer-events-none absolute inset-0 border border-emerald-200/15 shadow-[inset_0_0_90px_rgba(16,185,129,0.08)]">
        {isScanning && <span className="camera-scan-line absolute inset-x-0 h-px bg-emerald-200 shadow-[0_0_18px_3px_rgba(52,211,153,0.65)]" />}
      </div>

      <header className="relative z-10 flex items-start justify-between gap-4 p-5 pt-[calc(1.25rem+env(safe-area-inset-top))]">
        <div className={`rounded-2xl border border-white/15 bg-black/45 px-4 py-3 backdrop-blur-xl transition-transform duration-700 ${savingsEffect ? 'scale-105 border-emerald-300/50' : ''}`}>
          <p className="font-data text-[0.6rem] uppercase tracking-[0.2em] text-white/55">Risultato del mese</p>
          <LiquidNumber value={monthlySavings} currency="EUR" className="mt-1 block text-2xl font-bold tracking-tighter" />
          <div className="mt-2 flex gap-3 font-data text-[0.58rem] text-white/55">
            <span className="text-emerald-300">+{income.toFixed(2)} €</span>
            <span className="text-rose-300">−{expenses.toFixed(2)} €</span>
          </div>
        </div>
        <Button className="h-10 border-white/15 bg-black/45 text-white backdrop-blur-xl hover:bg-white/15 hover:text-white" variant="outline" disabled={!sessionReady} onClick={onEnterApp}>
          {sessionReady ? 'Entra nell’app' : 'Connessione…'} <ArrowRight />
        </Button>
      </header>

      <div className="absolute inset-x-5 bottom-[calc(1.5rem+env(safe-area-inset-bottom))] z-10 flex flex-col items-center gap-4">
        {(cameraError || error) && (
          <div className="flex w-full max-w-md items-start gap-2 rounded-xl border border-amber-300/25 bg-black/70 p-3 text-sm text-amber-100 backdrop-blur-xl">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>{error ?? cameraError}</span>
          </div>
        )}

        {isScanning && (
          <div className="w-full max-w-xs rounded-full border border-emerald-300/20 bg-black/65 p-1.5 backdrop-blur-xl">
            <div className="h-1.5 rounded-full bg-emerald-400 transition-[width] duration-300" style={{ width: `${Math.max(progress, 4)}%` }} />
            <p className="mt-2 text-center font-data text-[0.6rem] tracking-[0.18em] text-emerald-200">ANALISI E SALVATAGGIO {progress}%</p>
          </div>
        )}

        <div className="grid grid-cols-[3rem_5rem_3rem] items-center gap-4">
          <button className="grid size-12 place-items-center rounded-full border border-white/20 bg-black/50 text-white backdrop-blur-xl" type="button" aria-label="Apri foto o file" disabled={!sessionReady || isScanning} onClick={() => fileInputRef.current?.click()}>
            <Images className="size-5" />
          </button>
          <button className="grid size-20 place-items-center rounded-full border-[5px] border-white bg-white/20 shadow-[0_0_40px_rgba(255,255,255,0.2)] transition-transform active:scale-90 disabled:opacity-50" type="button" aria-label="Scatta e analizza" disabled={!sessionReady || !cameraReady || isScanning} onClick={() => void capturePhoto()}>
            {isScanning ? <LoaderCircle className="size-7 animate-spin" /> : <Camera className="size-7" />}
          </button>
          <span className="size-12" aria-hidden="true" />
        </div>
        <p className="text-center text-xs text-white/55">{sessionReady ? 'Scatta: il movimento viene salvato e il riepilogo mensile si aggiorna subito' : 'Fotocamera pronta · verifica sicura della sessione in corso'}</p>
      </div>

      <canvas ref={canvasRef} className="hidden" />
      <input ref={fileInputRef} className="hidden" type="file" accept="image/*" onChange={(event) => event.target.files?.[0] && void analyzeImage(event.target.files[0])} />

      {savingsEffect && (
        <div key={savingsEffect.key} className={`capture-balance-burst pointer-events-none fixed inset-0 z-[70] grid place-items-center ${savingsEffect.delta >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
          <div className="rounded-full border border-current/30 bg-black/75 px-8 py-5 text-center shadow-[0_0_80px_currentColor] backdrop-blur-xl">
            <Check className="mx-auto mb-2 size-7" />
            <p className="font-data text-3xl font-bold">{savingsEffect.delta >= 0 ? '+' : '−'}{Math.abs(savingsEffect.delta).toFixed(2)} €</p>
            <p className="mt-1 text-xs uppercase tracking-[0.2em] text-white/55">Risultato mensile aggiornato</p>
          </div>
        </div>
      )}

    </main>
  )
}
