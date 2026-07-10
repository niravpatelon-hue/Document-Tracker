import type {
  PersistedState,
  WebDocument,
  WebExpense,
  WebGroup,
  WebTransaction,
} from './store';

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
    {
      id: 'seed-w1',
      createdAt: Date.now() - 86_400_000 * 20,
      category: 'warranty',
      vendor: 'Best Buy',
      totalCents: null,
      taxCents: null,
      currency: 'USD',
      dateISO: null,
      imageDataUrl: null,
      ocrMode: 'manual',
      rawText: '',
      fuzzyDupKey: null,
      label: 'Contoso Laptop',
      details: {
        productName: 'Contoso Laptop',
        purchaseDate: '2025-08-01',
        identifier: 'SN-CL-88213',
        identifierType: 'serial_number',
        warrantyMonths: 12,
      },
    },
    {
      id: 'seed-w2',
      createdAt: Date.now() - 86_400_000 * 400,
      category: 'warranty',
      vendor: 'Costco',
      totalCents: null,
      taxCents: null,
      currency: 'USD',
      dateISO: null,
      imageDataUrl: null,
      ocrMode: 'manual',
      rawText: '',
      fuzzyDupKey: null,
      label: 'Acme 55" TV',
      details: { productName: 'Acme 55" TV', purchaseDate: '2024-06-01', warrantyMonths: 24 },
    },
    {
      id: 'seed-l1',
      createdAt: Date.now() - 86_400_000 * 5,
      category: 'loyalty',
      vendor: 'Starbucks',
      totalCents: null,
      taxCents: null,
      currency: 'USD',
      dateISO: null,
      imageDataUrl: null,
      ocrMode: 'manual',
      rawText: '',
      fuzzyDupKey: null,
      label: 'Starbucks Gift Card',
      details: { programType: 'gift_card', balanceValue: 25, expiryDate: '2027-03-01' },
    },
    {
      id: 'seed-l2',
      createdAt: Date.now() - 86_400_000 * 6,
      category: 'loyalty',
      vendor: 'Delta',
      totalCents: null,
      taxCents: null,
      currency: 'USD',
      dateISO: null,
      imageDataUrl: null,
      ocrMode: 'manual',
      rawText: '',
      fuzzyDupKey: null,
      label: 'Delta SkyMiles',
      details: { programType: 'airline', balanceValue: 41500 },
    },
  ];

  const transactions: WebTransaction[] = [
    { id: 'seed-t1', documentId: 'seed-1', amount: 4287, vendor: "Trader Joe's", dateISO: '2026-07-04' },
    { id: 'seed-t2', documentId: 'seed-2', amount: 5210, vendor: 'Shell', dateISO: '2026-07-08' },
  ];

  const groups: WebGroup[] = [
    {
      id: 'g-trip',
      name: 'Tahoe Trip',
      type: 'trip',
      members: [
        { id: 'u_you', name: 'You', venmo: 'you' },
        { id: 'u_alex', name: 'Alex', venmo: 'alex-rn' },
        { id: 'u_sam', name: 'Sam', venmo: 'sam-k' },
      ],
    },
  ];

  const expenses: WebExpense[] = [
    {
      id: 'e-cabin',
      groupId: 'g-trip',
      description: 'Cabin rental',
      payerId: 'u_you',
      totalCents: 30000,
      splitType: 'equal',
      allocations: [
        { userId: 'u_you', cents: 10000 },
        { userId: 'u_alex', cents: 10000 },
        { userId: 'u_sam', cents: 10000 },
      ],
    },
  ];

  return {
    documents,
    transactions,
    budgets: [
      { id: 'b-groceries', category: 'Groceries', period: 'monthly', limitCents: 40000, alertThresholdPct: 80 },
    ],
    groups,
    expenses,
    settlements: [],
  };
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
