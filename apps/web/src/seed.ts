import { ME, type Budget, type CardPayment, type CreditCard, type Expense, type Group, type MileageTrip, type PersistedState, type RecurringExpense, type Settlement } from './store';

const DAY = 86_400_000;

/** Sample data (India, amounts in paise) so the app isn't empty on first run. */
export function seedState(): PersistedState {
  const now = Date.now();

  const groups: Group[] = [
    {
      id: 'g-goa',
      name: 'Goa Trip',
      emoji: '🏖️',
      type: 'trip',
      createdAt: now - DAY * 12,
      members: [
        { id: ME, name: 'You', upi: 'you@okicici' },
        { id: 'u-rahul', name: 'Rahul', upi: 'rahul@oksbi' },
        { id: 'u-priya', name: 'Priya', upi: 'priya@okhdfc' },
        { id: 'u-aditya', name: 'Aditya', upi: 'aditya@okaxis' },
      ],
    },
    {
      id: 'g-flat',
      name: 'Flatmates',
      emoji: '🏠',
      type: 'home',
      createdAt: now - DAY * 40,
      members: [
        { id: ME, name: 'You', upi: 'you@okicici' },
        { id: 'u-sara', name: 'Sara', upi: 'sara@okhdfc' },
        { id: 'u-karan', name: 'Karan', upi: 'karan@oksbi' },
      ],
    },
  ];

  const personal = (
    id: string,
    description: string,
    amountCents: number,
    category: string,
    dateISO: string,
    source: 'scan' | 'manual',
    taxCents: number | null = null,
    ageDays = 3,
  ): Expense => ({
    id,
    createdAt: now - DAY * ageDays,
    description,
    amountCents,
    currency: 'INR',
    dateISO,
    category,
    source,
    imageDataUrl: null,
    rawText: null,
    taxCents,
    groupId: null,
    paidBy: [{ userId: ME, cents: amountCents }],
    involvedIds: [ME],
    splitType: 'equal',
    allocations: [{ userId: ME, cents: amountCents }],
  });

  /** Equal-split group expense helper (amounts chosen to divide evenly). */
  const shared = (
    id: string,
    groupId: string,
    description: string,
    amountCents: number,
    category: string,
    dateISO: string,
    paidById: string,
    memberIds: string[],
    ageDays: number,
  ): Expense => {
    const each = Math.round(amountCents / memberIds.length);
    return {
      id,
      createdAt: now - DAY * ageDays,
      description,
      amountCents,
      currency: 'INR',
      dateISO,
      category,
      source: 'manual',
      imageDataUrl: null,
      rawText: null,
      taxCents: null,
      groupId,
      paidBy: [{ userId: paidById, cents: amountCents }],
      involvedIds: memberIds,
      splitType: 'equal',
      allocations: memberIds.map((uid) => ({ userId: uid, cents: each })),
    };
  };

  const goaMembers = ['me', 'u-rahul', 'u-priya', 'u-aditya'];
  const flatMembers = ['me', 'u-sara', 'u-karan'];

  const expenses: Expense[] = [
    // Personal ledger (easy-expense) — mostly scanned receipts
    personal('e-bb', 'BigBasket', 234000, 'Groceries', '2026-07-05', 'scan', 11150, 5),
    personal('e-swiggy', 'Swiggy', 64800, 'Dining', '2026-07-06', 'scan', 3086, 4),
    personal('e-iocl', 'Indian Oil', 320000, 'Fuel', '2026-07-07', 'manual', null, 3),
    personal('e-amz', 'Amazon.in', 149900, 'Shopping', '2026-07-08', 'scan', 22865, 2),
    personal('e-sbux', 'Starbucks', 54000, 'Dining', '2026-07-06', 'scan', 2571, 4),
    personal('e-bescom', 'BESCOM Electricity', 186000, 'Utilities', '2026-07-09', 'manual', null, 1),
    personal('e-uber', 'Uber', 28900, 'Transport', '2026-07-05', 'scan', null, 5),
    personal('e-blinkit', 'Blinkit', 61200, 'Groceries', '2026-07-10', 'scan', 2914, 0),
    // Goa Trip (Splitwise)
    shared('e-villa', 'g-goa', 'Beach villa booking', 3000000, 'Travel', '2026-07-02', 'me', goaMembers, 8),
    shared('e-dinner', 'g-goa', 'Seafood dinner', 480000, 'Dining', '2026-07-03', 'u-rahul', goaMembers, 7),
    shared('e-scooter', 'g-goa', 'Scooter rentals', 160000, 'Transport', '2026-07-04', 'u-priya', goaMembers, 6),
    // Flatmates (Splitwise)
    shared('e-rent', 'g-flat', 'July rent', 4500000, 'Rent', '2026-07-01', 'me', flatMembers, 9),
    shared('e-elec', 'g-flat', 'Electricity bill', 360000, 'Utilities', '2026-07-05', 'u-karan', flatMembers, 5),
    shared('e-groc', 'g-flat', 'House groceries', 189000, 'Groceries', '2026-07-08', 'u-sara', flatMembers, 2),
  ];

  const settlements: Settlement[] = [
    { id: 's-1', groupId: 'g-goa', fromUser: 'u-aditya', toUser: ME, amountCents: 300000, note: 'part share', createdAt: now - DAY * 2 },
  ];

  const mileage: MileageTrip[] = [
    { id: 'm1', dateISO: '2026-07-03', purpose: 'Client visit', route: 'Bandra → Andheri', km: 22, ratePaisePerKm: 1200, createdAt: now - DAY * 7 },
    { id: 'm2', dateISO: '2026-07-08', purpose: 'Airport drop', route: 'Andheri → T2', km: 15, ratePaisePerKm: 1200, createdAt: now - DAY * 2 },
  ];

  const budgets: Budget[] = [
    { id: 'b-dining', category: 'Dining', period: 'monthly', limitCents: 500000, alertThresholdPct: 80 },
    { id: 'b-groc', category: 'Groceries', period: 'monthly', limitCents: 800000, alertThresholdPct: 80 },
  ];

  const cards: CreditCard[] = [
    {
      id: 'card-hdfc', name: 'HDFC Regalia', issuer: 'HDFC Bank', network: 'visa', last4: '4291',
      limitCents: 50000000, outstandingCents: 8745000, statementCents: 8745000, minDueCents: 500000,
      dueDateISO: '2026-07-18', statementDateISO: '2026-07-03', apr: 42, rewardRate: 2, createdAt: now - DAY * 200,
    },
    {
      id: 'card-axis', name: 'Axis Ace', issuer: 'Axis Bank', network: 'rupay', last4: '7702',
      limitCents: 20000000, outstandingCents: 14230000, statementCents: 14230000, minDueCents: 712000,
      dueDateISO: '2026-07-14', statementDateISO: '2026-06-30', apr: 40, rewardRate: 1, createdAt: now - DAY * 120,
    },
  ];

  const cardPayments: CardPayment[] = [
    { id: 'cp-1', cardId: 'card-hdfc', amountCents: 5000000, dateISO: '2026-06-20', note: 'Statement payment', createdAt: now - DAY * 20 },
  ];

  // Attribute a few personal spends to cards so per-card analytics are real.
  const CARD_OF: Record<string, string> = {
    'e-amz': 'card-hdfc', 'e-bb': 'card-hdfc', 'e-blinkit': 'card-hdfc',
    'e-swiggy': 'card-axis', 'e-sbux': 'card-axis',
  };
  for (const e of expenses) {
    const c = CARD_OF[e.id];
    if (c) e.cardId = c;
  }

  const recurring: RecurringExpense[] = [
    {
      id: 'rec-netflix', description: 'Netflix', amountCents: 64900, category: 'Entertainment',
      frequency: 'monthly', interval: 1, startDateISO: '2026-06-28', nextDueISO: '2026-07-28',
      groupId: null, paidBy: ME, involvedIds: [ME], splitType: 'equal', participantValues: [],
      active: true, occurrenceCount: 1, createdAt: now - DAY * 26,
    },
    {
      id: 'rec-wifi', description: 'Wifi bill', amountCents: 120000, category: 'Utilities',
      frequency: 'monthly', interval: 1, startDateISO: '2026-07-01', nextDueISO: '2026-08-01',
      groupId: 'g-flat', paidBy: ME, involvedIds: flatMembers, splitType: 'equal', participantValues: [],
      active: true, occurrenceCount: 1, createdAt: now - DAY * 23,
    },
  ];

  return { expenses, groups, settlements, mileage, budgets, cards, cardPayments, rewardCoins: 24500, recurring };
}

/** A realistic receipt blob for the "use sample" scan button — parsed by the real field parser. */
export const SAMPLE_RECEIPT_TEXT = [
  'BigBasket',
  'HSR Layout, Bengaluru',
  'Toor Dal 1kg       180.00',
  'Amul Butter         58.00',
  'Basmati Rice 5kg   645.00',
  'Subtotal           883.00',
  'GST                 44.15',
  'Total             2340.00',
  '05/07/2026',
].join('\n');
