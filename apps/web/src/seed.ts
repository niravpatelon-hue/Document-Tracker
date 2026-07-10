import type {
  BusinessProfile,
  PersistedState,
  WebBusinessExpense,
  WebClient,
  WebDocument,
  WebExpense,
  WebGroup,
  WebIncome,
  WebInvoice,
  WebMileageTrip,
  WebTransaction,
} from './store';

const DAY = 86_400_000;

/** Sample data (Indian market, amounts in paise) so the app isn't empty on first load. */
export function seedState(): PersistedState {
  const now = Date.now();

  const documents: WebDocument[] = [
    {
      id: 'seed-1',
      createdAt: now - DAY * 3,
      category: 'bills_receipts',
      vendor: 'BigBasket',
      totalCents: 234000,
      taxCents: 0,
      currency: 'INR',
      dateISO: '2026-07-05',
      imageDataUrl: null,
      ocrMode: 'cloud',
      rawText: 'BIGBASKET\nTotal 2340.00',
      fuzzyDupKey: 'bigbasket|2026-07-05|234000',
      label: null,
      details: {},
    },
    {
      id: 'seed-2',
      createdAt: now - DAY,
      category: 'bills_receipts',
      vendor: 'Indian Oil',
      totalCents: 320000,
      taxCents: 0,
      currency: 'INR',
      dateISO: '2026-07-07',
      imageDataUrl: null,
      ocrMode: 'on_device',
      rawText: 'INDIAN OIL\nTotal 3200.00',
      fuzzyDupKey: 'indian oil|2026-07-07|320000',
      label: null,
      details: {},
    },
    {
      id: 'seed-3',
      createdAt: now - DAY * 2,
      category: 'bills_receipts',
      vendor: 'Amazon.in',
      totalCents: 149900,
      taxCents: 22865,
      currency: 'INR',
      dateISO: '2026-07-08',
      imageDataUrl: null,
      ocrMode: 'cloud',
      rawText: 'AMAZON.IN\nTotal 1499.00',
      fuzzyDupKey: 'amazon in|2026-07-08|149900',
      label: null,
      details: {},
    },
    {
      id: 'seed-w1',
      createdAt: now - DAY * 20,
      category: 'warranty',
      vendor: 'Croma',
      totalCents: null,
      taxCents: null,
      currency: 'INR',
      dateISO: null,
      imageDataUrl: null,
      ocrMode: 'manual',
      rawText: '',
      fuzzyDupKey: null,
      label: 'iPhone 15',
      details: {
        productName: 'iPhone 15',
        purchaseDate: '2026-05-20',
        identifier: '3548 8210 9911 023',
        identifierType: 'imei',
        purchasePriceCents: 7999900,
        warrantyMonths: 12,
      },
    },
    {
      id: 'seed-w2',
      createdAt: now - DAY * 400,
      category: 'warranty',
      vendor: 'Reliance Digital',
      totalCents: null,
      taxCents: null,
      currency: 'INR',
      dateISO: null,
      imageDataUrl: null,
      ocrMode: 'manual',
      rawText: '',
      fuzzyDupKey: null,
      label: 'Samsung 55" QLED TV',
      details: { productName: 'Samsung 55" QLED TV', purchaseDate: '2024-06-01', warrantyMonths: 24 },
    },
    {
      id: 'seed-l1',
      createdAt: now - DAY * 5,
      category: 'loyalty',
      vendor: 'Tata Neu',
      totalCents: null,
      taxCents: null,
      currency: 'INR',
      dateISO: null,
      imageDataUrl: null,
      ocrMode: 'manual',
      rawText: '',
      fuzzyDupKey: null,
      label: 'Tata Neu NeuCoins',
      details: { programType: 'retail', balanceValue: 3250, expiryDate: '2027-03-01' },
    },
    {
      id: 'seed-l2',
      createdAt: now - DAY * 6,
      category: 'loyalty',
      vendor: 'IndiGo',
      totalCents: null,
      taxCents: null,
      currency: 'INR',
      dateISO: null,
      imageDataUrl: null,
      ocrMode: 'manual',
      rawText: '',
      fuzzyDupKey: null,
      label: 'IndiGo 6E Rewards',
      details: { programType: 'airline', balanceValue: 18400 },
    },
  ];

  // Ledger transactions across the current week (paise) — feeds analytics + dashboard.
  const transactions: WebTransaction[] = [
    { id: 't1', documentId: 'seed-rent', amount: 3500000, vendor: 'Nestaway Rent', dateISO: '2026-07-02' },
    { id: 't2', documentId: 'seed-cc', amount: 1800000, vendor: 'HDFC Credit Card', dateISO: '2026-07-04' },
    { id: 't3', documentId: 'seed-1', amount: 234000, vendor: 'BigBasket', dateISO: '2026-07-05' },
    { id: 't4', documentId: 'seed-uber', amount: 28900, vendor: 'Uber', dateISO: '2026-07-05' },
    { id: 't5', documentId: 'seed-swiggy', amount: 64800, vendor: 'Swiggy', dateISO: '2026-07-06' },
    { id: 't6', documentId: 'seed-sbux', amount: 54000, vendor: 'Starbucks', dateISO: '2026-07-06' },
    { id: 't7', documentId: 'seed-2', amount: 320000, vendor: 'Indian Oil', dateISO: '2026-07-07' },
    { id: 't8', documentId: 'seed-dmart', amount: 124000, vendor: 'DMart', dateISO: '2026-07-07' },
    { id: 't9', documentId: 'seed-3', amount: 149900, vendor: 'Amazon.in', dateISO: '2026-07-08' },
    { id: 't10', documentId: 'seed-bescom', amount: 186000, vendor: 'BESCOM Electricity', dateISO: '2026-07-09' },
    { id: 't11', documentId: 'seed-zomato', amount: 72000, vendor: 'Zomato', dateISO: '2026-07-09' },
    { id: 't12', documentId: 'seed-blinkit', amount: 61200, vendor: 'Blinkit', dateISO: '2026-07-10' },
  ];

  const incomes: WebIncome[] = [
    { id: 'in1', source: 'Acme Corp — Salary', amountCents: 12000000, dateISO: '2026-07-01', savedCents: 3000000 },
    { id: 'in2', source: 'Design freelance', amountCents: 3500000, dateISO: '2026-07-07', savedCents: 1000000 },
  ];

  const groups: WebGroup[] = [
    {
      id: 'g-goa',
      name: 'Goa Trip',
      type: 'trip',
      members: [
        { id: 'u_you', name: 'You', venmo: 'you', upi: 'you@okicici' },
        { id: 'u_rahul', name: 'Rahul', venmo: 'rahul', upi: 'rahul@oksbi' },
        { id: 'u_priya', name: 'Priya', venmo: 'priya', upi: 'priya@okhdfc' },
      ],
    },
  ];

  const expenses: WebExpense[] = [
    {
      id: 'e-villa',
      groupId: 'g-goa',
      description: 'Villa booking',
      category: 'Lodging',
      dateISO: '2026-07-02',
      payers: [{ userId: 'u_you', cents: 3000000 }],
      involvedIds: ['u_you', 'u_rahul', 'u_priya'],
      totalCents: 3000000,
      splitType: 'equal',
      allocations: [
        { userId: 'u_you', cents: 1000000 },
        { userId: 'u_rahul', cents: 1000000 },
        { userId: 'u_priya', cents: 1000000 },
      ],
      createdAt: now - DAY * 2,
    },
  ];

  /* ----------------------------- business mode ---------------------------- */

  const businessProfile: BusinessProfile = {
    name: 'Faysal Design Studio',
    gstin: '27ABCDE1234F1Z5',
    stateName: 'Maharashtra',
  };

  const clients: WebClient[] = [
    { id: 'c-nimbus', name: 'Nimbus Technologies', gstin: '29AABCN1234M1Z7', email: 'accounts@nimbus.co', phone: '+91 98450 11223', stateName: 'Karnataka', createdAt: now - DAY * 90 },
    { id: 'c-orchid', name: 'Orchid Retail Pvt Ltd', gstin: '27AAACO5678Q1Z3', email: 'finance@orchid.in', phone: '+91 99200 44556', stateName: 'Maharashtra', createdAt: now - DAY * 60 },
    { id: 'c-meadow', name: 'Meadow Foods', gstin: '24AAECM9012P1Z9', email: 'pay@meadowfoods.in', phone: '+91 79000 77889', stateName: 'Gujarat', createdAt: now - DAY * 45 },
  ];

  const invoices: WebInvoice[] = [
    {
      id: 'inv-7', number: 'INV-0007', clientId: 'c-nimbus', dateISO: '2026-07-07', dueDateISO: '2026-07-22',
      items: [{ description: 'UI/UX design retainer — July', qty: 1, rateCents: 15000000, taxRatePct: 18, hsn: '998314' }],
      status: 'paid', createdAt: now - DAY * 4,
    },
    {
      id: 'inv-8', number: 'INV-0008', clientId: 'c-orchid', dateISO: '2026-07-01', dueDateISO: '2026-07-16',
      items: [
        { description: 'Brand identity system', qty: 1, rateCents: 8000000, taxRatePct: 18, hsn: '998311' },
        { description: 'Print collateral pack', qty: 1, rateCents: 2500000, taxRatePct: 18, hsn: '998386' },
      ],
      status: 'sent', createdAt: now - DAY * 9,
    },
    {
      id: 'inv-9', number: 'INV-0009', clientId: 'c-meadow', dateISO: '2026-05-25', dueDateISO: '2026-06-10',
      items: [{ description: 'Website revamp', qty: 1, rateCents: 22000000, taxRatePct: 18, hsn: '998314' }],
      status: 'overdue', createdAt: now - DAY * 46,
    },
    {
      id: 'inv-10', number: 'INV-0010', clientId: 'c-nimbus', dateISO: '2026-07-09', dueDateISO: '2026-07-24',
      items: [{ description: 'Mobile app design — Phase 1', qty: 1, rateCents: 18000000, taxRatePct: 18, hsn: '998314' }],
      status: 'draft', createdAt: now - DAY,
    },
  ];

  const mileage: WebMileageTrip[] = [
    { id: 'm1', dateISO: '2026-07-03', purpose: 'Client meeting — Nimbus', route: 'Bandra → Andheri', km: 22, ratePaisePerKm: 1200, createdAt: now - DAY * 7 },
    { id: 'm2', dateISO: '2026-07-08', purpose: 'Print vendor pickup', route: 'Andheri → Lower Parel', km: 15, ratePaisePerKm: 1200, createdAt: now - DAY * 2 },
  ];

  const businessExpenses: WebBusinessExpense[] = [
    { id: 'be1', vendor: 'Adobe', category: 'Software & SaaS', dateISO: '2026-07-02', amountCents: 420000, taxRatePct: 18, gstCents: 75600, direction: 'input', gstin: '29AACCA1234F1Z5', paymentMethod: 'Credit card', createdAt: now - DAY * 8 },
    { id: 'be2', vendor: 'WeWork', category: 'Rent & utilities', dateISO: '2026-07-01', amountCents: 1800000, taxRatePct: 18, gstCents: 324000, direction: 'input', gstin: '27AABCW5678K1Z2', paymentMethod: 'UPI', createdAt: now - DAY * 9 },
    { id: 'be3', vendor: 'Taj Restaurant', category: 'Meals & entertainment', dateISO: '2026-07-04', amountCents: 240000, taxRatePct: 5, gstCents: 12000, direction: 'input', paymentMethod: 'UPI', createdAt: now - DAY * 6 },
    { id: 'be4', vendor: 'Croma Business', category: 'Equipment', dateISO: '2026-06-28', amountCents: 8500000, taxRatePct: 18, gstCents: 1530000, direction: 'input', gstin: '27AAACC9855Q1Z8', paymentMethod: 'Bank transfer', createdAt: now - DAY * 12 },
    { id: 'be5', vendor: 'Meta Ads', category: 'Marketing', dateISO: '2026-07-06', amountCents: 1200000, taxRatePct: 18, gstCents: 216000, direction: 'input', paymentMethod: 'Credit card', createdAt: now - DAY * 4 },
    { id: 'be6', vendor: 'Airtel', category: 'Telecom & internet', dateISO: '2026-07-05', amountCents: 149900, taxRatePct: 18, gstCents: 26982, direction: 'input', gstin: '07AAACB2894G1ZM', paymentMethod: 'Auto-debit', createdAt: now - DAY * 5 },
  ];

  return {
    documents,
    transactions,
    incomes,
    budgets: [
      { id: 'b-groceries', category: 'Groceries', period: 'monthly', limitCents: 800000, alertThresholdPct: 80 },
      { id: 'b-food', category: 'Food & drink', period: 'monthly', limitCents: 500000, alertThresholdPct: 80 },
    ],
    groups,
    expenses,
    settlements: [],
    businessProfile,
    clients,
    invoices,
    mileage,
    businessExpenses,
  };
}

/** A realistic receipt blob for the "use sample" button — parsed by the real OCR field parser. */
export const SAMPLE_RECEIPT_TEXT = [
  'BIGBASKET',
  'HSR Layout, Bengaluru',
  'Toor Dal 1kg       180.00',
  'Amul Butter        58.00',
  'Basmati Rice 5kg   645.00',
  'Subtotal          883.00',
  'GST                44.15',
  'Total            2340.00',
  'UPI ****@okicici',
  '05/07/2026',
].join('\n');
