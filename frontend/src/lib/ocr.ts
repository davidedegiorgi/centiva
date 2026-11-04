import { createWorker, OEM, PSM, type Worker } from 'tesseract.js'

type ProgressListener = (progress: number) => void

const MAX_IMAGE_SIDE = 2000

let workerPromise: Promise<Worker> | null = null
let progressListener: ProgressListener | null = null

function getWorker() {
  if (!workerPromise) {
    workerPromise = createWorker(
      'ita',
      OEM.LSTM_ONLY,
      {
        logger: (message) => {
          progressListener?.(Math.round(message.progress * 100))
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

async function optimizeImage(file: File): Promise<File | HTMLCanvasElement> {
  if (typeof createImageBitmap !== 'function') return file

  const bitmap = await createImageBitmap(file)
  const longestSide = Math.max(bitmap.width, bitmap.height)

  if (longestSide <= MAX_IMAGE_SIDE) {
    bitmap.close()
    return file
  }

  const scale = MAX_IMAGE_SIDE / longestSide
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)

  const context = canvas.getContext('2d', { alpha: false })
  if (!context) {
    bitmap.close()
    return file
  }

  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return canvas
}

/** Avvia in anticipo il motore OCR e riusa lo stesso worker tra scansioni. */
export async function warmOcr() {
  await getWorker()
}

export async function recognizeImage(file: File, onProgress: ProgressListener) {
  progressListener = onProgress

  try {
    const [worker, image] = await Promise.all([getWorker(), optimizeImage(file)])
    const result = await worker.recognize(image, {}, { text: true })
    return result.data.text
  } finally {
    progressListener = null
  }
}
