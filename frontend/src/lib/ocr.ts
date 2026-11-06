import { createWorker, OEM, PSM, type Worker } from 'tesseract.js'

type ProgressListener = (progress: number) => void
type OcrImage = File | HTMLCanvasElement

const MAX_UPLOAD_SIDE = 2000
const FAST_LANGUAGE_PATH = 'https://tessdata.projectnaptha.com/4.0.0_fast'

let workerPromise: Promise<Worker> | null = null
let progressListener: ProgressListener | null = null
let lastReportedProgress = 0

function getWorker() {
  if (!workerPromise) {
    workerPromise = createWorker(
      'ita',
      OEM.LSTM_ONLY,
      {
        langPath: FAST_LANGUAGE_PATH,
        logger: (message) => {
          const nextProgress = Math.round(message.progress * 100)
          if (nextProgress >= 100 || nextProgress >= lastReportedProgress + 5) {
            lastReportedProgress = nextProgress
            progressListener?.(nextProgress)
          }
        },
      },
      {
        // I dizionari non servono per importi, date e codici esercente e rallentano l'avvio.
        load_system_dawg: '0',
        load_freq_dawg: '0',
      },
    ).then(async (worker) => {
      await worker.setParameters({
        tessedit_pageseg_mode: PSM.SPARSE_TEXT,
        preserve_interword_spaces: '1',
      })
      return worker
    }).catch((error) => {
      workerPromise = null
      throw error
    })
  }

  return workerPromise
}

async function optimizeImage(image: OcrImage): Promise<OcrImage> {
  if (typeof createImageBitmap !== 'function') return image

  const bitmap = await createImageBitmap(image)
  const longestSide = Math.max(bitmap.width, bitmap.height)

  const scale = Math.min(1, MAX_UPLOAD_SIDE / longestSide)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)

  const context = canvas.getContext('2d', { alpha: false })
  if (!context) {
    bitmap.close()
    return image
  }

  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.filter = 'grayscale(1) contrast(1.25)'
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return canvas
}

/** Avvia in anticipo il motore OCR e riusa lo stesso worker tra scansioni. */
export async function warmOcr() {
  await getWorker()
}

export async function recognizeImage(imageSource: OcrImage, onProgress: ProgressListener) {
  progressListener = onProgress
  lastReportedProgress = 0

  try {
    const [worker, image] = await Promise.all([getWorker(), optimizeImage(imageSource)])
    const result = await worker.recognize(image, {}, { text: true })
    return result.data.text
  } finally {
    progressListener = null
  }
}
