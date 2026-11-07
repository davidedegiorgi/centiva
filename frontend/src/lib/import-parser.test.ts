import { describe, expect, it } from 'vitest'

import { OCR_VARIANT_SEPARATOR, parseOcrText, suggestCategory } from '@/lib/import-parser'

describe('suggestCategory', () => {
  it.each([
    ['OPENAI *CHATGPT SUBSCRIPTION', 'expense', 'Abbonamenti'],
    ['APPLE.COM/BILL ICLOUD', 'expense', 'Abbonamenti'],
    ['AMAZON PRIME MEMBERSHIP', 'expense', 'Abbonamenti'],
    ['AMAZON EU ORDINE 123', 'expense', 'Acquisti'],
    ['PAGAMENTO POS CONAD', 'expense', 'Spesa'],
    ['CASEIF1CIO LA GRAZIA', 'expense', 'Spesa'],
    ['SUPERMERCAT0 ALIMENTAR1', 'expense', 'Spesa'],
    ['P1ZZERIA CENTRALE', 'expense', 'Ristorazione'],
    ['FARMACIA CENTRALE', 'expense', 'Salute'],
    ['BONIFICO DA STRIPE', 'income', 'Bonifico ricevuto'],
    ['ACCREDITO STIPENDIO', 'income', 'Stipendio'],
  ] as const)('classifies %s as %s', (text, type, expected) => {
    expect(suggestCategory(text, type)).toBe(expected)
  })

  it('uses Altro instead of leaving an unknown expense uncategorized', () => {
    expect(suggestCategory('OPERAZIONE CARTA XYZ 4821')).toBe('Altro')
  })

  it('uses Acquisti as a safe category for an otherwise unknown receipt', () => {
    const rows = parseOcrText(`
      EMPORIO XYZ
      DOCUMENTO COMMERCIALE
      TOTALE DA PAGARE 12,40
      06/11/2026 18:20
    `)

    expect(rows[0]).toMatchObject({ amount: '12.40', category: 'Acquisti' })
  })
})

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
    expect(rows[1]).toMatchObject({ amount: '5.00', type: 'income', category: 'Rimborso' })
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
    expect(rows[0]).toMatchObject({ amount: '42.50', occurred_on: '2026-11-01', category: 'Ristorazione' })
  })

  it('uses the amount due instead of taxable amount and VAT on a grocery receipt', () => {
    const rows = parseOcrText(`
      SUPERMERCATO CONAD
      DOCUMENTO COMMERCIALE
      2 PASTA 3,80
      LATTE 1,70
      SUBTOTALE 5,50
      IMPONIBILE 5,00
      IVA 10% 0,50
      TOTALE DA PAGARE EUR 5,50
      06/11/2026 18:42
    `)

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      amount: '5.50',
      occurred_on: '2026-11-06',
      category: 'Spesa',
    })
  })

  it('chooses total when total and VAT are printed on the same line', () => {
    const rows = parseOcrText(`
      FARMACIA CENTRALE
      SCONTRINO FISCALE
      TOTALE 24,90 IVA 2,26
      CARTA 24,90
      05/11/2026 10:11
    `)

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ amount: '24.90', category: 'Salute' })
  })

  it('uses the labelled card payment when the total label is unreadable', () => {
    const rows = parseOcrText(`
      PENNY MARKET
      DOCUMENTO COMMERCIALE
      ARTICOLO 4,20
      ARTICOLO 7,40
      PAGAMENTO CARTA 18,60
      IVA 1,69
      04/11/2026 12:15
    `)

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ amount: '18.60', category: 'Spesa' })
  })

  it('recognizes a receipt from its structure when OCR misses fiscal labels', () => {
    const rows = parseOcrText(`
      ALIMENTARI DA MARIO
      PASTA 2,40
      LATTE 1,80
      BISCOTTI 3,20
      T0TALE 7,40
      06/11/2026 17:31
    `)

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ amount: '7.40', category: 'Spesa' })
  })

  it('does not select an invented large code before the payment amount', () => {
    const rows = parseOcrText(`
      PENNY MARKET
      DOCUMENTO COMMERCIALE
      CODICE TRANSAZIONE 9999,99
      ARTICOLO 4,20
      ARTICOLO 7,40
      PAGAMENTO CARTA 18,60
      IVA 1,69
      04/11/2026 12:15
    `)

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ amount: '18.60', category: 'Spesa' })
  })

  it('reads the attached Caseificio receipt when OCR changes monetary commas to dots', () => {
    const rows = parseOcrText(`
      CASEIFICIO LA GRAZIA
      CAVALERA MAILA SRLS
      DOCUMENTO COMMERCIALE DI VENDITA O PRESTAZIONE
      DESCRIZIONE IVA PREZZO
      REPARTO 1 4% 5.00
      TOTALE COMPLESSIVO 5.00
      DI CUI IVA 0,19
      PAGAMENTO CONTANTE 5.00
      IMPORTO PAGATO 5.00
      30-10-2026 10:20
      DOCUMENTO N. 0998-0017
    `)

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      amount: '5.00',
      occurred_on: '2026-10-30',
      category: 'Spesa',
    })
  })

  it('does not fall back to VAT when a receipt total is unreadable', () => {
    const rows = parseOcrText(`
      CASEIFICIO LA GRAZIA
      DOCUMENTO COMMERCIALE
      TOTALE COMPLESSIVO ILLEGGIBILE
      DI CUI IVA 0,19
      30-10-2026 10:20
    `)

    expect(rows).toEqual([])
  })

  it('does not invent a total from item prices or fiscal codes when payment labels are unreadable', () => {
    const rows = parseOcrText(`
      EMPORIO CENTRALE
      DOCUMENTO COMMERCIALE
      ARTICOLO 30,00
      ARTICOLO 9,00
      1VA 3,55
      CODICE TRANSAZIONE 999,99
      TOTALE ILLEGGIBILE
    `)

    expect(rows).toEqual([])
  })

  it('recognizes a corrupted total label printed above the amount', () => {
    const rows = parseOcrText(`
      SUPERMERCATO CENTRALE
      DOCUMENTO COMMERCIALE
      ARTICOLO 18,20
      T0TA1E DA PAGARE
      48,70 EUR
      1VA 4,43
    `)

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ amount: '48.70', category: 'Spesa' })
  })

  it('does not mistake a comma-corrupted receipt date for a price', () => {
    const rows = parseOcrText(`
      CASEIFICIO LA GRAZIA
      DOCUMENTO COMMERCIALE
      TOTALE COMPLESSIVO 5.00
      DI CUI IVA 0,19
      IMPORTO PAGATO 5.00
      30,10,2026 10:20
    `)

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ amount: '5.00', occurred_on: '2026-10-30' })
  })

  it('prefers the receipt-specific OCR pass when sparse OCR reads five as nine', () => {
    const sparseText = `
      CASEIFICIO LA GRAZIA
      DOCUMENTO COMMERCIALE
      REPARTO 1 9:00
      TOTALE COMPLESSIVO 9,0)
      DI CUI IVA 0,19
      PAGAMENTO CONTANTE 9:00
      IMPORTO PAGATO 9,00
      30510:20
    `
    const blockText = `
      CAVALERA MAILA SRLS
      DOCUMENTO COMMERCIALE
      REPARTO 1 4% 9:00
      PAGAMENTO CONTANIE 5,00
      DOCUMENTO N. 0998-0017
    `

    const rows = parseOcrText(`${sparseText}${OCR_VARIANT_SEPARATOR}${blockText}`)

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ amount: '5.00', category: 'Spesa' })
  })

  it('rejects an isolated VAT value returned by the receipt-specific pass', () => {
    const sparseText = `
      CASEIFICIO LA GRAZIA
      DOCUMENTO COMMERCIALE
      TOTALE COMPLESSIVO ILLEGGIBILE
      DI CUI IVA 0,19
    `
    const blockText = '0,19'

    const rows = parseOcrText(`${sparseText}${OCR_VARIANT_SEPARATOR}${blockText}`)

    expect(rows).toEqual([])
  })

  it('allows a small amount when another pass explicitly confirms it as the total', () => {
    const sparseText = `
      DOCUMENTO COMMERCIALE
      TOTALE COMPLESSIVO 0,19
      DI CUI IVA 0,02
    `
    const blockText = '0,19'

    const rows = parseOcrText(`${sparseText}${OCR_VARIANT_SEPARATOR}${blockText}`)

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ amount: '0.19' })
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
    expect(rows.every((row) => row.category.length > 0)).toBe(true)
  })
})
