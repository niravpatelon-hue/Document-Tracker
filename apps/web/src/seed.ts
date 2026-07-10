import type { PersistedState, WebDocument, WebTransaction } from './store';

/** A couple of sample entries so the ledger isn't empty on first load. */
export function seedState(): PersistedState {
  const documents: WebDocument[] = [
    {
      id: 'seed-1',
      createdAt: Date.now() - 86_400_000 * 3,
      category: 'bills_receipts',
      vendor: "Trader Joe's",
      totalCents: 4287,
      taxCents: 0,
      currency: 'USD',
      dateISO: '2026-07-04',
      imageDataUrl: null,
      ocrMode: 'cloud',
      rawText: "TRADER JOE'S\nTotal 42.87",
      fuzzyDupKey: "trader joe s|2026-07-04|4287",
      label: null,
      details: {},
    },
    {
      id: 'seed-2',
      createdAt: Date.now() - 86_400_000,
      category: 'bills_receipts',
      vendor: 'Shell',
      totalCents: 5210,
      taxCents: 0,
      currency: 'USD',
      dateISO: '2026-07-08',
      imageDataUrl: null,
      ocrMode: 'on_device',
      rawText: 'SHELL\nTotal 52.10',
      fuzzyDupKey: 'shell|2026-07-08|5210',
      label: null,
      details: {},
    },
  ];

  const transactions: WebTransaction[] = [
    { id: 'seed-t1', documentId: 'seed-1', amount: 4287, vendor: "Trader Joe's", dateISO: '2026-07-04' },
    { id: 'seed-t2', documentId: 'seed-2', amount: 5210, vendor: 'Shell', dateISO: '2026-07-08' },
  ];

  return { documents, transactions };
}

/** A realistic receipt blob for the "use sample" button — parsed by the real OCR field parser. */
export const SAMPLE_RECEIPT_TEXT = [
  'BLUE BOTTLE COFFEE',
  '66 Mint St, San Francisco',
  'Cappuccino        5.25',
  'Croissant         4.50',
  'Subtotal          9.75',
  'Sales Tax         0.85',
  'Total            10.60',
  'VISA ****1234',
  '07/09/2026',
].join('\n');
