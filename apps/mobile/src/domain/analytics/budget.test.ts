import { evaluateBudget, type BudgetSpec } from './budget';
import type { SpendTxn } from './spend';

const txns: SpendTxn[] = [
  { amount: 4000, category: 'Groceries', dateISO: '2026-07-04' },
  { amount: 3000, category: 'Groceries', dateISO: '2026-07-20' },
  { amount: 9999, category: 'Groceries', dateISO: '2026-06-01' }, // different month
  { amount: 5000, category: 'Fuel', dateISO: '2026-07-08' },
];

const grocerySpec: BudgetSpec = {
  category: 'Groceries',
  period: 'monthly',
  limitCents: 10000,
  alertThresholdPct: 80,
};

describe('evaluateBudget', () => {
  it('sums only the category and period of the reference date', () => {
    const s = evaluateBudget(grocerySpec, txns, '2026-07-15');
    expect(s.spentCents).toBe(7000); // June excluded, Fuel excluded
    expect(s.pct).toBeCloseTo(70);
    expect(s.state).toBe('ok');
  });

  it('warns at/above the alert threshold', () => {
    const s = evaluateBudget({ ...grocerySpec, limitCents: 8000 }, txns, '2026-07-15');
    expect(s.pct).toBeCloseTo(87.5);
    expect(s.state).toBe('warn');
  });

  it('flags over budget', () => {
    const s = evaluateBudget({ ...grocerySpec, limitCents: 5000 }, txns, '2026-07-15');
    expect(s.state).toBe('over');
  });

  it('supports yearly budgets', () => {
    const s = evaluateBudget(
      { ...grocerySpec, period: 'yearly', limitCents: 100000 },
      txns,
      '2026-12-31',
    );
    expect(s.spentCents).toBe(16999); // all 2026 Groceries incl. June
  });
});
