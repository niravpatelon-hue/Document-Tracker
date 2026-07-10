import {
  allocateEqually,
  distribute,
  formatAmount,
  formatINR,
  formatINRCompact,
  formatINRShort,
  fromCents,
  groupIndian,
  toCents,
} from './money';

describe('money conversion', () => {
  it('round-trips major units and cents', () => {
    expect(toCents(12.34)).toBe(1234);
    expect(toCents(0.1)).toBe(10);
    expect(fromCents(1234)).toBeCloseTo(12.34);
  });

  it('avoids float drift on typical sums', () => {
    expect(toCents(0.1) + toCents(0.2)).toBe(toCents(0.3));
  });

  it('formats cents as fixed 2dp strings', () => {
    expect(formatAmount(1250)).toBe('12.50');
    expect(formatAmount(5)).toBe('0.05');
    expect(formatAmount(10000)).toBe('100.00');
    expect(formatAmount(-1)).toBe('-0.01');
  });
});

describe('Indian rupee formatting', () => {
  it('groups digits in the Indian system (thousand, lakh, crore)', () => {
    expect(groupIndian('100')).toBe('100');
    expect(groupIndian('1000')).toBe('1,000');
    expect(groupIndian('12345')).toBe('12,345');
    expect(groupIndian('123456')).toBe('1,23,456');
    expect(groupIndian('1234567')).toBe('12,34,567');
    expect(groupIndian('12345678')).toBe('1,23,45,678');
  });

  it('formats paise with ₹, Indian grouping and 2 decimals', () => {
    expect(formatINR(0)).toBe('₹0.00');
    expect(formatINR(1250)).toBe('₹12.50');
    expect(formatINR(100000)).toBe('₹1,000.00');
    expect(formatINR(12345678)).toBe('₹1,23,456.78');
    expect(formatINR(-99)).toBe('-₹0.99');
  });

  it('formats whole-rupee short amounts', () => {
    expect(formatINRShort(150050)).toBe('₹1,501');
    expect(formatINRShort(12345678)).toBe('₹1,23,457');
  });

  it('compacts large amounts with lakh / crore', () => {
    expect(formatINRCompact(50000)).toBe('₹500');
    expect(formatINRCompact(1234500)).toBe('₹12,345');
    expect(formatINRCompact(15000000)).toBe('₹1.5L');
    expect(formatINRCompact(12345600)).toBe('₹1.2L');
    expect(formatINRCompact(5300000000)).toBe('₹5.3Cr');
    expect(formatINRCompact(-15000000)).toBe('-₹1.5L');
  });
});

describe('distribute (largest remainder)', () => {
  it('sums exactly to the total with equal weights', () => {
    const parts = distribute(100, [1, 1, 1]);
    expect(parts).toEqual([34, 33, 33]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(100);
  });

  it('hands leftover cents to earliest buckets deterministically', () => {
    expect(distribute(1000, [1, 1, 1])).toEqual([334, 333, 333]);
    expect(distribute(101, [1, 1])).toEqual([51, 50]);
  });

  it('respects proportional weights', () => {
    expect(distribute(1000, [3, 1])).toEqual([750, 250]);
    expect(distribute(900, [2, 1])).toEqual([600, 300]);
  });

  it('never loses or invents a cent across many weightings', () => {
    for (const total of [0, 1, 7, 99, 100, 1234, 99999]) {
      for (const weights of [[1, 1, 1], [2, 1], [5, 3, 2], [1, 1, 1, 1, 1, 1, 1]]) {
        const parts = distribute(total, weights);
        expect(parts.reduce((a, b) => a + b, 0)).toBe(total);
      }
    }
  });

  it('rejects invalid inputs', () => {
    expect(() => distribute(-1, [1])).toThrow();
    expect(() => distribute(100, [0, 0])).toThrow();
    expect(() => distribute(100, [-1, 2])).toThrow();
    expect(() => distribute(1.5, [1])).toThrow();
  });
});

describe('allocateEqually', () => {
  it('splits as evenly as possible', () => {
    expect(allocateEqually(100, 3)).toEqual([34, 33, 33]);
    expect(allocateEqually(1000, 4)).toEqual([250, 250, 250, 250]);
  });

  it('rejects a non-positive count', () => {
    expect(() => allocateEqually(100, 0)).toThrow();
  });
});
