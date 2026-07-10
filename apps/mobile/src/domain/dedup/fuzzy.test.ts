import {
  buildFuzzyKey,
  isLikelyDuplicatePurchase,
  jaroWinkler,
  normalizeVendor,
} from './fuzzy';

describe('jaroWinkler', () => {
  it('is 1 for identical strings', () => {
    expect(jaroWinkler('starbucks', 'starbucks')).toBe(1);
  });

  it('scores near-identical strings highly', () => {
    expect(jaroWinkler('martha', 'marhta')).toBeGreaterThan(0.9);
    expect(jaroWinkler('trader joes', 'trader joe')).toBeGreaterThan(0.9);
  });

  it('scores unrelated strings low', () => {
    expect(jaroWinkler('walmart', 'costco')).toBeLessThan(0.6);
  });
});

describe('normalizeVendor', () => {
  it('lowercases, strips punctuation and legal suffixes', () => {
    expect(normalizeVendor('WALMART')).toBe('walmart');
    expect(normalizeVendor("Trader Joe's Inc.")).toBe('trader joe s');
    expect(normalizeVendor('Acme, LLC')).toBe('acme');
  });
});

describe('buildFuzzyKey', () => {
  it('is stable and normalizes the vendor', () => {
    expect(buildFuzzyKey('WALMART', '2024-03-01', 1299)).toBe('walmart|2024-03-01|1299');
  });
});

describe('isLikelyDuplicatePurchase', () => {
  const base = { vendor: 'Starbucks', dateISO: '2024-03-01', amount: 843 };

  it('flags the same purchase from a slightly different photo/spelling', () => {
    const other = { vendor: 'STARBUCKS #123', dateISO: '2024-03-01', amount: 843 };
    expect(isLikelyDuplicatePurchase(base, other).isLikely).toBe(true);
  });

  it('accepts a one-day and one-cent tolerance', () => {
    const other = { vendor: 'Starbucks', dateISO: '2024-03-02', amount: 844 };
    expect(isLikelyDuplicatePurchase(base, other).isLikely).toBe(true);
  });

  it('does not flag a different amount', () => {
    const other = { vendor: 'Starbucks', dateISO: '2024-03-01', amount: 999 };
    expect(isLikelyDuplicatePurchase(base, other).isLikely).toBe(false);
  });

  it('does not flag a different vendor', () => {
    const other = { vendor: 'Peets Coffee', dateISO: '2024-03-01', amount: 843 };
    expect(isLikelyDuplicatePurchase(base, other).isLikely).toBe(false);
  });

  it('does not flag dates outside the window', () => {
    const other = { vendor: 'Starbucks', dateISO: '2024-03-05', amount: 843 };
    expect(isLikelyDuplicatePurchase(base, other).isLikely).toBe(false);
  });
});
