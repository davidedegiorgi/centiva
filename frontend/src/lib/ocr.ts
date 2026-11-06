import { createWorker, OEM, PSM, type Worker } from 'tesseract.js'

import { OCR_VARIANT_SEPARATOR } from '@/lib/import-parser'

type ProgressListener = (progress: number) => void
type OcrImage = File | HTMLCanvasElement

const MAX_UPLOAD_SIDE = 2000
const MIN_RECEIPT_SIDE = 1600
const RECEIPT_DETECTION_SIDE = 640
const FAST_LANGUAGE_PATH = 'https://tessdata.projectnaptha.com/4.0.0_fast'

let workerPromise: Promise<Worker> | null = null
let progressListener: ProgressListener | null = null
let lastReportedProgress = 0
let progressRangeStart = 0
let progressRangeEnd = 100

function getWorker() {
  if (!workerPromise) {
    workerPromise = createWorker(
      'ita',
      OEM.LSTM_ONLY,
      {
        langPath: FAST_LANGUAGE_PATH,
        logger: (message) => {
          const nextProgress = Math.round(progressRangeStart + message.progress * (progressRangeEnd - progressRangeStart))
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

interface ImageBounds { x: number; y: number; width: number; height: number }

function detectReceiptBounds(bitmap: ImageBitmap): ImageBounds | null {
  const detectionScale = Math.min(1, RECEIPT_DETECTION_SIDE / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * detectionScale))
  const height = Math.max(1, Math.round(bitmap.height * detectionScale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d', { alpha: false, willReadFrequently: true })
  if (!context) return null

  context.drawImage(bitmap, 0, 0, width, height)
  const pixels = context.getImageData(0, 0, width, height).data
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1
  let paperPixels = 0

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4
      const red = pixels[offset]
      const green = pixels[offset + 1]
      const blue = pixels[offset + 2]
      const luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722
      const saturation = Math.max(red, green, blue) - Math.min(red, green, blue)
      if (luminance < 118 || saturation > 72) continue

      paperPixels += 1
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)
    }
  }

  if (maxX < minX || maxY < minY || paperPixels / (width * height) < 0.015) return null

  const boxWidth = maxX - minX + 1
  const boxHeight = maxY - minY + 1
  const areaRatio = (boxWidth * boxHeight) / (width * height)
  const aspectRatio = boxWidth / boxHeight
  if (areaRatio > 0.9 || boxWidth < width * 0.08 || boxHeight < height * 0.12 || aspectRatio < 0.18 || aspectRatio > 3) return null

  const marginX = Math.round(boxWidth * 0.06)
  const marginY = Math.round(boxHeight * 0.04)
  const scaleBack = 1 / detectionScale
  const sourceX = Math.max(0, minX - marginX)
  const sourceY = Math.max(0, minY - marginY)
  const sourceMaxX = Math.min(width, maxX + marginX + 1)
  const sourceMaxY = Math.min(height, maxY + marginY + 1)

  return {
    x: Math.round(sourceX * scaleBack),
    y: Math.round(sourceY * scaleBack),
    width: Math.round((sourceMaxX - sourceX) * scaleBack),
    height: Math.round((sourceMaxY - sourceY) * scaleBack),
  }
}

async function optimizeImage(image: OcrImage): Promise<OcrImage> {
  if (typeof createImageBitmap !== 'function') return image

  const bitmap = await createImageBitmap(image)
  const bounds = detectReceiptBounds(bitmap) ?? { x: 0, y: 0, width: bitmap.width, height: bitmap.height }
  const longestSide = Math.max(bounds.width, bounds.height)

  const minimumScale = bounds.width !== bitmap.width || bounds.height !== bitmap.height
    ? Math.max(1, MIN_RECEIPT_SIDE / longestSide)
    : 1
  const scale = Math.min(minimumScale, MAX_UPLOAD_SIDE / longestSide)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bounds.width * scale)
  canvas.height = Math.round(bounds.height * scale)

  const context = canvas.getContext('2d', { alpha: false })
  if (!context) {
    bitmap.close()
    return image
  }

  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.filter = 'grayscale(1) contrast(1.25)'
  context.drawImage(bitmap, bounds.x, bounds.y, bounds.width, bounds.height, 0, 0, canvas.width, canvas.height)
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
  progressRangeStart = 0
  progressRangeEnd = 70

  try {
    const [worker, image] = await Promise.all([getWorker(), optimizeImage(imageSource)])
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT })
    const sparseResult = await worker.recognize(image, {}, { text: true })
    const sparseText = sparseResult.data.text
    const looksLikeReceipt = /documento|scontrino|ricevuta|\biva\b|prezzo|totale|pagamento\W*cont|importo\W*pag/i.test(sparseText)

    if (!looksLikeReceipt) {
      onProgress(100)
      return sparseText
    }

    progressRangeStart = 70
    progressRangeEnd = 100
    lastReportedProgress = 70
    onProgress(70)
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK })
    const blockResult = await worker.recognize(image, {}, { text: true })
    onProgress(100)

    return `${sparseText}${OCR_VARIANT_SEPARATOR}${blockResult.data.text}`
  } finally {
    progressListener = null
    progressRangeStart = 0
    progressRangeEnd = 100
  }
}
