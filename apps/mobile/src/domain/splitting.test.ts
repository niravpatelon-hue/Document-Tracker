import { computeSplit } from './splitting';

const sum = (allocs: { cents: number }[]) => allocs.reduce((a, b) => a + b.cents, 0);
const p = (userId: string, value?: number) => ({ userId, value });

describe('computeSplit — equal', () => {
  it('divides evenly and sums to total', () => {
    const result = computeSplit(1000, 'equal', [p('a'), p('b'), p('c')]);
    expect(result.map((r) => r.cents)).toEqual([334, 333, 333]);
    expect(sum(result)).toBe(1000);
  });
});

describe('computeSplit — percentage', () => {
  it('allocates by percent', () => {
    const result = computeSplit(1000, 'percentage', [p('a', 50), p('b', 30), p('c', 20)]);
    expect(result.map((r) => r.cents)).toEqual([500, 300, 200]);
  });

  it('stays exact with fractional percentages', () => {
    const result = computeSplit(1000, 'percentage', [
      p('a', 33.333),
      p('b', 33.333),
      p('c', 33.334),
    ]);
    expect(sum(result)).toBe(1000);
  });

  it('rejects percentages that do not sum to 100', () => {
    expect(() => computeSplit(1000, 'percentage', [p('a', 50), p('b', 40)])).toThrow();
  });
});

describe('computeSplit — exact', () => {
  it('uses exact cents when they sum to the total', () => {
    const result = computeSplit(1000, 'exact', [p('a', 600), p('b', 400)]);
    expect(result.map((r) => r.cents)).toEqual([600, 400]);
  });

  it('rejects exact shares that do not reconcile', () => {
    expect(() => computeSplit(1000, 'exact', [p('a', 600), p('b', 300)])).toThrow();
    expect(() => computeSplit(1000, 'exact', [p('a', 600.5), p('b', 399.5)])).toThrow();
  });
});

describe('computeSplit — share', () => {
  it('divides proportionally by integer shares', () => {
    const result = computeSplit(900, 'share', [p('a', 2), p('b', 1)]);
    expect(result.map((r) => r.cents)).toEqual([600, 300]);
  });

  it('rejects all-zero shares', () => {
    expect(() => computeSplit(900, 'share', [p('a', 0), p('b', 0)])).toThrow();
  });
});

describe('computeSplit — adjustment', () => {
  it('gives each an equal share of the remainder plus their adjustment', () => {
    // total 1000, adjustments a:+200 b:0 -> remainder 800 split equally (400/400)
    const result = computeSplit(1000, 'adjustment', [p('a', 200), p('b', 0)]);
    expect(result.map((r) => r.cents)).toEqual([600, 400]);
    expect(sum(result)).toBe(1000);
  });

  it('supports negative adjustments and stays exact', () => {
    const result = computeSplit(900, 'adjustment', [p('a', -300), p('b', 0), p('c', 0)]);
    expect(sum(result)).toBe(900);
    // remainder 1200 split 3 ways = 400 each; a gets -300 -> 100
    expect(result[0]!.cents).toBe(100);
  });

  it('rejects adjustments exceeding the total', () => {
    expect(() => computeSplit(500, 'adjustment', [p('a', 400), p('b', 400)])).toThrow();
  });
});

describe('computeSplit — guards', () => {
  it('rejects duplicate participants', () => {
    expect(() => computeSplit(100, 'equal', [p('a'), p('a')])).toThrow();
  });

  it('rejects an empty participant list', () => {
    expect(() => computeSplit(100, 'equal', [])).toThrow();
  });
});
