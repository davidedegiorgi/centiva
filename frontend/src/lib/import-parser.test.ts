import { describe, expect, it } from 'vitest'

import { parseOcrText } from '@/lib/import-parser'

describe('parseOcrText', () => {
  it('ignores a dot-separated time and reads the signed Postepay amount', () => {
    const rows = parseOcrText(`
      03 NOV 2026 12.30
      PAGAMENTO POS
      AMAZON EU
      - 19,99 €
    `)

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      amount: '19.99',
      type: 'expense',
      occurred_on: '2026-11-03',
      category: 'Acquisti',
    })
  })

  it('recognizes multiple transactions split across screenshot lines', () => {
    const rows = parseOcrText(`
      03 NOV 2026
      09:42
      PAGAMENTO POS CONAD
      - 34,80 EUR
      02 NOV 2026
      18.15
      RIMBORSO CARTA
      + 5,00 €
    `)

    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ amount: '34.80', type: 'expense', category: 'Spesa' })
    expect(rows[1]).toMatchObject({ amount: '5.00', type: 'income', category: 'Entrate' })
  })

  it('does not create a transaction when OCR sees only date and time', () => {
    const rows = parseOcrText(`
      03/11/2026 12.30
      PAGAMENTO POS
      DETTAGLIO NON DISPONIBILE
    `)

    expect(rows).toEqual([])
  })

  it('keeps a dot-decimal amount when currency makes it unambiguous', () => {
    const rows = parseOcrText(`
      03/11/2026 ore 12.30
      RISTORANTE ROMA
      ADDEBITO -12.30 EUR
    `)

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ amount: '12.30', type: 'expense', category: 'Ristorazione' })
  })

  it('prefers the receipt total over unrelated numbers', () => {
    const rows = parseOcrText(`
      RISTORANTE ROMA
      SCONTRINO 000184
      01/11/2026 19:45
      TOTALE € 42,50
    `)

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ amount: '42.50', occurred_on: '2026-11-01' })
  })

  it('extracts every movement grouped below an Oggi heading', () => {
    const today = new Date()
    const expectedDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    const rows = parseOcrText(`
      Oggi
      10:14
      PAGAMENTO POS AMAZON
      - 18,40 €
      08.32
      PAGAMENTO POS CONAD
      - 27,15 €
    `)

    expect(rows).toHaveLength(2)
    expect(rows.map((row) => row.amount)).toEqual(['18.40', '27.15'])
    expect(rows.every((row) => row.occurred_on === expectedDate)).toBe(true)
  })

  it('merges the same nearby amount repeated in summary and detail rows', () => {
    const rows = parseOcrText(`
      03 NOV 2026
      PAGAMENTO POS AMAZON
      - 19,99 €
      IMPORTO OPERAZIONE
      - 19,99 EUR
    `)

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ amount: '19.99', occurred_on: '2026-11-03' })
  })

  it('keeps equal amounts when they belong to movements far apart', () => {
    const rows = parseOcrText(`
      Oggi
      09:10
      PAGAMENTO BAR CENTRALE
      - 5,00 €
      OPERAZIONE COMPLETATA
      18:45
      PAGAMENTO CINEMA ROMA
      - 5,00 €
    `)

    expect(rows).toHaveLength(2)
    expect(rows.map((row) => row.amount)).toEqual(['5.00', '5.00'])
  })

  it('does not duplicate Postepay rows when the description continues with date and time', () => {
    const rows = parseOcrText(`
      Pagamento E-Commerce 29 ott 2026
      SHOP PRIME 29/10/2026 -4,99 €
      08.08 CITY Op. 6...
      Pagamento E-Commerce 28 ott 2026
      SERVICE.COM/BILL -2,99 €
      28/10/2026 16.30 CITY O...
      Pagamento E-Commerce 26 ott 2026
      SHOP* B26X55614 -30,42 €
      26/10/2026 22.08 CITY...
    `)

    expect(rows).toHaveLength(3)
    expect(rows.map((row) => row.amount)).toEqual(['4.99', '2.99', '30.42'])
    expect(rows.map((row) => row.occurred_on)).toEqual(['2026-10-29', '2026-10-28', '2026-10-26'])
  })
})
