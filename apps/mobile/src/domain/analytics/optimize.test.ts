import {
  buildSuggestions,
  potentialSavingsCents,
  type OptimizeCard,
  type Suggestion,
} from './optimize';
import type { SpendTxn } from './spend';

const TODAY = '2026-07-10';

const txns: SpendTxn[] = [
  { amount: 120_00, category: 'Dining', dateISO: '2026-07-02', vendor: 'Swiggy' },
  { amount: 80_00, category: 'Dining', dateISO: '2026-07-05', vendor: 'Zomato' },
  { amount: 60_00, category: 'Groceries', dateISO: '2026-07-06', vendor: 'BigBasket' },
  { amount: 20_00, category: 'Bills', dateISO: '2026-07-01', vendor: 'Netflix' },
];

const find = (s: Suggestion[], id: string) => s.find((x) => x.id === id);

describe('buildSuggestions - budget_over', () => {
  it('triggers high with the correct overage amount', () => {
    const s = buildSuggestions({
      txns,
      budgets: [{ category: 'Dining', limitCents: 150_00 }],
      todayISO: TODAY,
    });
    const over = find(s, 'budget_over:Dining');
    expect(over).toBeDefined();
    expect(over!.severity).toBe('high');
    // Dining spend = 200_00, limit 150_00 -> overage 50_00
    expect(over!.amountCents).toBe(50_00);
  });

  it('warns when spend is within 80% of the limit', () => {
    const s = buildSuggestions({
      txns,
      budgets: [{ category: 'Dining', limitCents: 240_00 }], // 200_00 >= 0.8*240_00 (192_00)
      todayISO: TODAY,
    });
    const warn = find(s, 'budget_warn:Dining');
    expect(warn).toBeDefined();
    expect(warn!.severity).toBe('warn');
    expect(warn!.amountCents).toBe(0);
  });
});

describe('buildSuggestions - card_due', () => {
  it('flags a bill due within 7 days as high', () => {
    const card: OptimizeCard = {
      name: 'HDFC',
      outstandingCents: 5_000_00,
      limitCents: 100_000_00,
      dueDateISO: '2026-07-15', // 5 days out
    };
    const s = buildSuggestions({ txns, cards: [card], todayISO: TODAY });
    const due = find(s, 'card_due:HDFC');
    expect(due).toBeDefined();
    expect(due!.severity).toBe('high');
    expect(due!.title).toContain('5 days');
    expect(due!.amountCents).toBe(5_000_00);
  });

  it('flags a past-due bill as overdue', () => {
    const card: OptimizeCard = {
      name: 'ICICI',
      outstandingCents: 1_000_00,
      limitCents: 100_000_00,
      dueDateISO: '2026-07-01',
    };
    const s = buildSuggestions({ txns, cards: [card], todayISO: TODAY });
    const due = find(s, 'card_due:ICICI');
    expect(due!.severity).toBe('high');
    expect(due!.title).toContain('overdue');
  });

  it('does not flag a bill far in the future', () => {
    const card: OptimizeCard = {
      name: 'Axis',
      outstandingCents: 1_000_00,
      limitCents: 100_000_00,
      dueDateISO: '2026-08-20',
    };
    const s = buildSuggestions({ txns, cards: [card], todayISO: TODAY });
    expect(find(s, 'card_due:Axis')).toBeUndefined();
  });
});

describe('buildSuggestions - card_utilization', () => {
  it('marks utilization above 70% as high and computes get-under-30% amount', () => {
    const card: OptimizeCard = {
      name: 'HDFC',
      outstandingCents: 80_00,
      limitCents: 100_00, // 80% util
      dueDateISO: '2026-09-01',
    };
    const s = buildSuggestions({ txns, cards: [card], todayISO: TODAY });
    const util = find(s, 'card_utilization:HDFC');
    expect(util).toBeDefined();
    expect(util!.severity).toBe('high');
    // 80_00 - round(0.3*100_00=30_00) = 50_00
    expect(util!.amountCents).toBe(50_00);
  });

  it('marks utilization between 30% and 70% as warn', () => {
    const card: OptimizeCard = {
      name: 'SBI',
      outstandingCents: 50_00,
      limitCents: 100_00, // 50%
      dueDateISO: '2026-09-01',
    };
    const s = buildSuggestions({ txns, cards: [card], todayISO: TODAY });
    expect(find(s, 'card_utilization:SBI')!.severity).toBe('warn');
  });
});

describe('buildSuggestions - subscription & spike', () => {
  it('detects a subscription vendor', () => {
    const s = buildSuggestions({ txns, todayISO: TODAY });
    const sub = find(s, 'subscription');
    expect(sub).toBeDefined();
    expect(sub!.amountCents).toBe(20_00); // Netflix
    expect(sub!.detail).toContain('1 subscription');
  });

  it('flags a spend spike vs previous month', () => {
    const cur: SpendTxn[] = [{ amount: 900_00, category: 'Dining', dateISO: '2026-07-05' }];
    const prevTxns: SpendTxn[] = [{ amount: 200_00, category: 'Dining', dateISO: '2026-06-05' }];
    const s = buildSuggestions({ txns: cur, prevTxns, todayISO: TODAY });
    // current 900_00 > 200_00*1.25 (250_00) and delta 700_00 (>= ₹500 = 50000 paise)
    const spike = find(s, 'spend_spike:Dining');
    expect(spike).toBeDefined();
    expect(spike!.severity).toBe('warn');
    expect(spike!.amountCents).toBe(700_00);
  });

  it('ignores a small increase below the ₹500 delta floor', () => {
    const cur: SpendTxn[] = [{ amount: 200_00, category: 'Dining', dateISO: '2026-07-05' }];
    const prevTxns: SpendTxn[] = [{ amount: 100_00, category: 'Dining', dateISO: '2026-06-05' }];
    const s = buildSuggestions({ txns: cur, prevTxns, todayISO: TODAY });
    expect(find(s, 'spend_spike:Dining')).toBeUndefined();
  });
});

describe('buildSuggestions - category_high & savings_tip', () => {
  it('adds a top-category suggestion with a 15% trim', () => {
    const s = buildSuggestions({ txns, todayISO: TODAY });
    const top = find(s, 'category_high:Dining');
    expect(top).toBeDefined();
    expect(top!.severity).toBe('info');
    expect(top!.amountCents).toBe(Math.round(200_00 * 0.15)); // 30_00
  });

  it('always adds a savings_tip when there are txns', () => {
    const s = buildSuggestions({ txns, todayISO: TODAY });
    const tip = find(s, 'savings_tip');
    expect(tip).toBeDefined();
    // total = 280_00 -> 10% = 28_00
    expect(tip!.amountCents).toBe(28_00);
  });

  it('produces nothing spend-derived when there are no txns', () => {
    const s = buildSuggestions({ txns: [], todayISO: TODAY });
    expect(find(s, 'savings_tip')).toBeUndefined();
    expect(s.every((x) => x.kind !== 'category_high')).toBe(true);
  });
});

describe('ordering & potentialSavingsCents', () => {
  it('sorts high before warn before info', () => {
    const s = buildSuggestions({
      txns,
      budgets: [{ category: 'Dining', limitCents: 150_00 }], // high
      cards: [{ name: 'SBI', outstandingCents: 50_00, limitCents: 100_00, dueDateISO: '2026-09-01' }], // warn
      todayISO: TODAY,
    });
    const ranks = s.map((x) => ({ high: 0, warn: 1, info: 2 }[x.severity]));
    const sorted = [...ranks].sort((a, b) => a - b);
    expect(ranks).toEqual(sorted);
  });

  it('sums savings amounts and excludes card_due', () => {
    const suggestions: Suggestion[] = [
      { id: 'a', kind: 'budget_over', severity: 'high', title: '', detail: '', amountCents: 50_00 },
      { id: 'b', kind: 'card_due', severity: 'high', title: '', detail: '', amountCents: 9_999_00 },
      { id: 'c', kind: 'savings_tip', severity: 'info', title: '', detail: '', amountCents: 28_00 },
      { id: 'd', kind: 'subscription', severity: 'info', title: '', detail: '', amountCents: 20_00 },
    ];
    // 50_00 + 28_00 + 20_00 = 98_00 (card_due excluded)
    expect(potentialSavingsCents(suggestions)).toBe(98_00);
  });
});
