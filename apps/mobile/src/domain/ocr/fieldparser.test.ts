import {
  detectImei,
  detectSerial,
  extractLabeledValue,
  extractReceiptFields,
  findFirstDate,
  guessCategory,
  luhnValid,
  mapVeryfiReceipt,
  parseAmountToCents,
} from './fieldparser';

describe('parseAmountToCents', () => {
  it('handles US formatting', () => {
    expect(parseAmountToCents('$1,234.56')).toBe(123456);
    expect(parseAmountToCents('$0.05')).toBe(5);
    expect(parseAmountToCents('100')).toBe(10000);
    expect(parseAmountToCents('3.5')).toBe(350);
  });

  it('handles EU formatting', () => {
    expect(parseAmountToCents('1.234,56')).toBe(123456);
    expect(parseAmountToCents('12,34')).toBe(1234);
  });

  it('treats a lone comma with 3 trailing digits as thousands', () => {
    expect(parseAmountToCents('1,234')).toBe(123400);
  });

  it('returns null without a number', () => {
    expect(parseAmountToCents('abc')).toBeNull();
  });
});

describe('findFirstDate', () => {
  it('parses unambiguous formats', () => {
    expect(findFirstDate('Date: 2024-03-01')).toBe('2024-03-01');
    expect(findFirstDate('Jan 2, 2024')).toBe('2024-01-02');
    expect(findFirstDate('2 Jan 2024')).toBe('2024-01-02');
  });

  it('assumes month-first for ambiguous numeric dates', () => {
    expect(findFirstDate('03/01/2024')).toBe('2024-03-01');
    expect(findFirstDate('12/31/23')).toBe('2023-12-31');
  });

  it('detects day-first when the first field exceeds 12', () => {
    expect(findFirstDate('13/02/2024')).toBe('2024-02-13');
  });

  it('returns null for a non-date / impossible date', () => {
    expect(findFirstDate('no date here')).toBeNull();
    expect(findFirstDate('2024-13-40')).toBeNull();
  });
});

describe('extractReceiptFields', () => {
  const receipt = [
    'STARBUCKS STORE #123',
    '123 Main St',
    'Latte           4.50',
    'Muffin          3.25',
    'Subtotal        7.75',
    'Sales Tax       0.68',
    'Total           8.43',
    'Visa            8.43',
    '03/01/2024',
  ].join('\n');

  it('extracts vendor, total (not subtotal), tax, and date', () => {
    const fields = extractReceiptFields(receipt);
    expect(fields.vendor).toBe('STARBUCKS STORE #123');
    expect(fields.totalCents).toBe(843);
    expect(fields.taxCents).toBe(68);
    expect(fields.dateISO).toBe('2024-03-01');
  });

  it('prefers a "grand total" over a plain total', () => {
    const fields = extractReceiptFields('Total 10.00\nGrand Total 12.00');
    expect(fields.totalCents).toBe(1200);
  });
});

describe('IMEI / serial detection', () => {
  it('validates IMEIs with Luhn', () => {
    expect(luhnValid('490154203237518')).toBe(true);
    expect(luhnValid('490154203237519')).toBe(false);
  });

  it('finds a Luhn-valid IMEI even with spacing', () => {
    expect(detectImei('IMEI: 49 01 54 20 32 37 518')).toBe('490154203237518');
  });

  it('reads a labeled serial number', () => {
    expect(detectSerial('Serial No: ABC12345')).toBe('ABC12345');
    expect(detectSerial('S/N xyz98765')).toBe('XYZ98765');
  });
});

describe('extractLabeledValue', () => {
  const warranty = 'LIMITED WARRANTY\nProduct: Acme Phone X\nIMEI: 490154203237518';

  it('extracts a labeled field value', () => {
    expect(extractLabeledValue(warranty, ['product'])).toBe('Acme Phone X');
    expect(extractLabeledValue('Model - XPS 13', ['model'])).toBe('XPS 13');
    expect(extractLabeledValue('Sold by: Best Buy', ['retailer', 'sold by'])).toBe('Best Buy');
  });

  it('returns null when no label matches', () => {
    expect(extractLabeledValue(warranty, ['retailer', 'store'])).toBeNull();
  });
});

describe('guessCategory', () => {
  it('classifies by keyword', () => {
    expect(guessCategory('Limited Warranty Certificate — IMEI 490154203237518')).toBe('warranty');
    expect(guessCategory('Your rewards points balance: 1,240')).toBe('loyalty');
    expect(guessCategory('Sales Tax  Total  Amount Due')).toBe('bills_receipts');
    expect(guessCategory('Handwritten note')).toBe('other');
  });
});

describe('mapVeryfiReceipt', () => {
  it('maps a vendor structured response to our fields', () => {
    const mapped = mapVeryfiReceipt({
      vendor: { name: "Trader Joe's" },
      total: 42.5,
      tax: 3.15,
      date: '2024-03-01 14:22:00',
      currency_code: 'USD',
    });
    expect(mapped).toEqual({
      vendor: "Trader Joe's",
      totalCents: 4250,
      taxCents: 315,
      dateISO: '2024-03-01',
      currency: 'USD',
    });
  });

  it('tolerates missing fields', () => {
    expect(mapVeryfiReceipt({})).toEqual({
      vendor: null,
      totalCents: null,
      taxCents: null,
      dateISO: null,
      currency: null,
    });
  });
});
