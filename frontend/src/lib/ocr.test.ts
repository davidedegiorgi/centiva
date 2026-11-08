import { describe, expect, it } from 'vitest'

import { findReceiptBounds } from '@/lib/ocr'

function distantReceipt(width: number, height: number, receipt: { x: number; y: number; width: number; height: number }) {
  const pixels = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4
      const isPaper = x >= receipt.x && x < receipt.x + receipt.width && y >= receipt.y && y < receipt.y + receipt.height
      pixels[offset] = isPaper ? 238 : 72
      pixels[offset + 1] = isPaper ? 235 : 48
      pixels[offset + 2] = isPaper ? 225 : 34
      pixels[offset + 3] = 255
    }
  }
  return pixels
}

describe('findReceiptBounds', () => {
  it('detects a receipt occupying only a small central part of a distant photo', () => {
    const expected = { x: 150, y: 90, width: 20, height: 40 }
    const bounds = findReceiptBounds(distantReceipt(320, 240, expected), 320, 240)

    expect(bounds).toEqual(expected)
  })

  it('detects a very distant paper receipt without mistaking small bright objects near the edges', () => {
    const expected = { x: 194, y: 136, width: 12, height: 28 }
    const pixels = distantReceipt(400, 300, expected)

    for (let y = 10; y < 22; y += 1) {
      for (let x = 8; x < 20; x += 1) {
        const offset = (y * 400 + x) * 4
        pixels[offset] = 245
        pixels[offset + 1] = 245
        pixels[offset + 2] = 245
      }
    }

    expect(findReceiptBounds(pixels, 400, 300)).toEqual(expected)
  })

  it('does not crop an image without a paper-shaped region', () => {
    const pixels = new Uint8ClampedArray(320 * 240 * 4).fill(35)
    expect(findReceiptBounds(pixels, 320, 240)).toBeNull()
  })

  it('does not mistake a small square interface icon for a distant receipt', () => {
    const pixels = new Uint8ClampedArray(320 * 240 * 4).fill(35)
    for (let y = 104; y < 136; y += 1) {
      for (let x = 144; x < 176; x += 1) {
        const offset = (y * 320 + x) * 4
        pixels[offset] = 245
        pixels[offset + 1] = 245
        pixels[offset + 2] = 245
        pixels[offset + 3] = 255
      }
    }

    expect(findReceiptBounds(pixels, 320, 240)).toBeNull()
  })
})
