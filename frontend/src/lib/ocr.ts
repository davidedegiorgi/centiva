import { createWorker, OEM, PSM, type Worker } from 'tesseract.js'

import { OCR_VARIANT_SEPARATOR } from '@/lib/import-parser'

type ProgressListener = (progress: number) => void
type OcrImage = File | HTMLCanvasElement

const MAX_UPLOAD_SIDE = 2800
const MIN_RECEIPT_SIDE = 2400
const RECEIPT_DETECTION_SIDE = 800
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

export interface ImageBounds { x: number; y: number; width: number; height: number }

export function findReceiptBounds(pixels: Uint8ClampedArray, width: number, height: number): ImageBounds | null {
  const mask = new Uint8Array(width * height)
  const visited = new Uint8Array(width * height)

  for (let index = 0; index < width * height; index += 1) {
    const offset = index * 4
    const red = pixels[offset]
    const green = pixels[offset + 1]
    const blue = pixels[offset + 2]
    const luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722
    const saturation = Math.max(red, green, blue) - Math.min(red, green, blue)
    if (luminance >= 112 && saturation <= 84) mask[index] = 1
  }

  let best: { bounds: ImageBounds; score: number } | null = null
  const queue = new Int32Array(width * height)

  for (let seed = 0; seed < mask.length; seed += 1) {
    if (!mask[seed] || visited[seed]) continue
    let head = 0
    let tail = 0
    let count = 0
    let minX = width
    let minY = height
    let maxX = -1
    let maxY = -1
    queue[tail++] = seed
    visited[seed] = 1

    while (head < tail) {
      const index = queue[head++]
      const x = index % width
      const y = Math.floor(index / width)
      count += 1
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)

      const left = index - 1
      if (x > 0 && !visited[left] && mask[left]) {
        visited[left] = 1
        queue[tail++] = left
      }
      const right = index + 1
      if (x + 1 < width && !visited[right] && mask[right]) {
        visited[right] = 1
        queue[tail++] = right
      }
      const above = index - width
      if (y > 0 && !visited[above] && mask[above]) {
        visited[above] = 1
        queue[tail++] = above
      }
      const below = index + width
      if (y + 1 < height && !visited[below] && mask[below]) {
        visited[below] = 1
        queue[tail++] = below
      }
    }

    const boxWidth = maxX - minX + 1
    const boxHeight = maxY - minY + 1
    const boxArea = boxWidth * boxHeight
    const areaRatio = boxArea / (width * height)
    const density = count / boxArea
    const aspectRatio = boxWidth / boxHeight
    const centerX = (minX + maxX) / 2 / width
    const centerY = (minY + maxY) / 2 / height
    const centerDistance = Math.hypot(centerX - 0.5, centerY - 0.5)
    const isTinyCandidate = areaRatio < 0.008
    if (
      count < width * height * 0.0008
      || areaRatio < 0.002
      || areaRatio > 0.9
      || boxWidth < width * 0.025
      || boxHeight < height * 0.04
      || density < 0.28
      || aspectRatio < 0.14
      || aspectRatio > 4
      || (isTinyCandidate && (density < 0.65 || aspectRatio < 0.25 || aspectRatio > 1.4 || centerDistance > 0.4))
    ) continue

    const score = count * density * (1 - Math.min(0.55, centerDistance))
    if (!best || score > best.score) {
      best = { bounds: { x: minX, y: minY, width: boxWidth, height: boxHeight }, score }
    }
  }

  return best?.bounds ?? null
}

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
  const detected = findReceiptBounds(context.getImageData(0, 0, width, height).data, width, height)
  if (!detected) return null

  const marginX = Math.round(detected.width * 0.08)
  const marginY = Math.round(detected.height * 0.06)
  const scaleBack = 1 / detectionScale
  const sourceX = Math.max(0, detected.x - marginX)
  const sourceY = Math.max(0, detected.y - marginY)
  const sourceMaxX = Math.min(width, detected.x + detected.width + marginX)
  const sourceMaxY = Math.min(height, detected.y + detected.height + marginY)

  return {
    x: Math.round(sourceX * scaleBack),
    y: Math.round(sourceY * scaleBack),
    width: Math.round((sourceMaxX - sourceX) * scaleBack),
    height: Math.round((sourceMaxY - sourceY) * scaleBack),
  }
}

interface OptimizedImage { image: OcrImage; blockImage: OcrImage; receiptWasCropped: boolean }

async function optimizeImage(image: OcrImage): Promise<OptimizedImage> {
  if (typeof createImageBitmap !== 'function') return { image, blockImage: image, receiptWasCropped: false }

  const bitmap = await createImageBitmap(image)
  const detectedBounds = detectReceiptBounds(bitmap)
  const bounds = detectedBounds ?? { x: 0, y: 0, width: bitmap.width, height: bitmap.height }
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
    return { image, blockImage: image, receiptWasCropped: false }
  }

  const blockCanvas = document.createElement('canvas')
  blockCanvas.width = canvas.width
  blockCanvas.height = canvas.height
  const blockContext = blockCanvas.getContext('2d', { alpha: false })

  context.imageSmoothingEnabled = scale <= 1
  context.imageSmoothingQuality = 'high'
  context.filter = 'grayscale(1) contrast(1.45)'
  context.drawImage(bitmap, bounds.x, bounds.y, bounds.width, bounds.height, 0, 0, canvas.width, canvas.height)

  if (blockContext) {
    blockContext.imageSmoothingEnabled = scale <= 1
    blockContext.imageSmoothingQuality = 'high'
    blockContext.filter = 'grayscale(1) contrast(1.9) brightness(1.08)'
    blockContext.drawImage(bitmap, bounds.x, bounds.y, bounds.width, bounds.height, 0, 0, blockCanvas.width, blockCanvas.height)
  }

  bitmap.close()
  return { image: canvas, blockImage: blockContext ? blockCanvas : canvas, receiptWasCropped: detectedBounds !== null }
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
    const [worker, optimized] = await Promise.all([getWorker(), optimizeImage(imageSource)])
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT })
    const sparseResult = await worker.recognize(optimized.image, {}, { text: true })
    const sparseText = sparseResult.data.text
    const looksLikeReceipt = /documento|scontrino|ricevuta|\biva\b|prezzo|totale|pagamento\W*cont|importo\W*pag/i.test(sparseText)

    if (!looksLikeReceipt && !optimized.receiptWasCropped) {
      onProgress(100)
      return sparseText
    }

    progressRangeStart = 70
    progressRangeEnd = 100
    lastReportedProgress = 70
    onProgress(70)
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK })
    const blockResult = await worker.recognize(optimized.blockImage, {}, { text: true })
    onProgress(100)

    return `${sparseText}${OCR_VARIANT_SEPARATOR}${blockResult.data.text}`
  } finally {
    progressListener = null
    progressRangeStart = 0
    progressRangeEnd = 100
  }
}
