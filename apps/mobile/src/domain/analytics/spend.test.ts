import {
  classifySpendCategory,
  monthOverMonth,
  previousMonth,
  spendByCategory,
  spendByMonth,
  totalSpend,
  yearOverYear,
  type SpendTxn,
} from './spend';

const txns: SpendTxn[] = [
  { amount: 1000, category: 'Groceries', dateISO: '2026-06-03', vendor: 'Trader Joe' },
  { amount: 500, category: 'Dining', dateISO: '2026-06-20', vendor: 'Blue Bottle' },
  { amount: 2000, category: 'Groceries', dateISO: '2026-07-04', vendor: 'Safeway' },
  { amount: 1500, category: 'Fuel', dateISO: '2026-07-08', vendor: 'Shell' },
];

describe('aggregations', () => {
  it('totals all spend', () => {
    expect(totalSpend(txns)).toBe(5000);
  });

  it('groups by category, largest first', () => {
    expect(spendByCategory(txns)).toEqual([
      { category: 'Groceries', total: 3000 },
      { category: 'Fuel', total: 1500 },
      { category: 'Dining', total: 500 },
    ]);
  });

  it('groups by month chronologically', () => {
    expect(spendByMonth(txns)).toEqual([
      { month: '2026-06', total: 1500 },
      { month: '2026-07', total: 3500 },
    ]);
  });
});

describe('previousMonth', () => {
  it('handles year boundaries', () => {
    expect(previousMonth('2026-07')).toBe('2026-06');
    expect(previousMonth('2026-01')).toBe('2025-12');
  });
});

describe('period comparisons', () => {
  it('computes month-over-month delta and pct', () => {
    const mom = monthOverMonth(txns, '2026-07');
    expect(mom.current).toBe(3500);
    expect(mom.previous).toBe(1500);
    expect(mom.delta).toBe(2000);
    expect(mom.deltaPct).toBeCloseTo(133.33, 1);
  });

  it('returns null pct when there is no prior period', () => {
    expect(monthOverMonth(txns, '2026-06').deltaPct).toBeNull();
  });

  it('computes year-over-year', () => {
    const yoy = yearOverYear(txns, '2026');
    expect(yoy.current).toBe(5000);
    expect(yoy.previous).toBe(0);
    expect(yoy.deltaPct).toBeNull();
  });
});

describe('classifySpendCategory', () => {
  it('maps vendors to everyday buckets', () => {
    expect(classifySpendCategory('Trader Joe\'s')).toBe('Groceries');
    expect(classifySpendCategory('Shell')).toBe('Fuel');
    expect(classifySpendCategory('Blue Bottle Coffee')).toBe('Dining');
    expect(classifySpendCategory('Amazon')).toBe('Shopping');
    expect(classifySpendCategory('Some Random LLC')).toBe('Other');
    expect(classifySpendCategory('')).toBe('Other');
  });
});
