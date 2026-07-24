import { pairwiseNet, type PairwiseExpenseInput } from './pairwise';
import type { DirectSettlement } from './simplify';

describe('pairwiseNet', () => {
  it('nets a simple two-person equal split (B owes A)', () => {
    const expenses: PairwiseExpenseInput[] = [
      {
        payers: [{ userId: 'a', cents: 1000 }],
        allocations: [
          { userId: 'a', cents: 500 },
          { userId: 'b', cents: 500 },
        ],
      },
    ];
    expect(pairwiseNet('a', 'b', expenses, [])).toBe(500);
  });

  it('is antisymmetric: pairwiseNet(A,B) === -pairwiseNet(B,A)', () => {
    const expenses: PairwiseExpenseInput[] = [
      {
        payers: [{ userId: 'a', cents: 1000 }],
        allocations: [
          { userId: 'a', cents: 500 },
          { userId: 'b', cents: 500 },
        ],
      },
    ];
    expect(pairwiseNet('a', 'b', expenses, [])).toBe(500);
    expect(pairwiseNet('b', 'a', expenses, [])).toBe(-500);
  });

  it('ignores a third person sharing the same expense', () => {
    const expenses: PairwiseExpenseInput[] = [
      {
        payers: [{ userId: 'a', cents: 900 }],
        allocations: [
          { userId: 'a', cents: 300 },
          { userId: 'b', cents: 300 },
          { userId: 'c', cents: 300 },
        ],
      },
    ];
    // c's presence must not change the a-vs-b figure at all.
    expect(pairwiseNet('a', 'b', expenses, [])).toBe(300);
  });

  it('isolates the A-vs-B cross terms when there are multiple payers', () => {
    const expenses: PairwiseExpenseInput[] = [
      {
        payers: [
          { userId: 'a', cents: 600 },
          { userId: 'b', cents: 400 },
        ],
        allocations: [
          { userId: 'a', cents: 300 },
          { userId: 'b', cents: 300 },
          { userId: 'c', cents: 400 },
        ],
      },
    ];
    // 300*600/1000 - 300*400/1000 = 180 - 120 = 60
    expect(pairwiseNet('a', 'b', expenses, [])).toBe(60);
  });

  it('accounts for a settlement even with no expenses', () => {
    const settlements: DirectSettlement[] = [{ fromUser: 'a', toUser: 'b', amount: 200 }];
    expect(pairwiseNet('a', 'b', [], settlements)).toBe(200);
  });

  it('subtracts a settlement running the other way (B -> A)', () => {
    const settlements: DirectSettlement[] = [{ fromUser: 'b', toUser: 'a', amount: 200 }];
    expect(pairwiseNet('a', 'b', [], settlements)).toBe(-200);
  });

  it('an expense that does not involve B at all contributes 0', () => {
    const expenses: PairwiseExpenseInput[] = [
      {
        payers: [{ userId: 'a', cents: 1000 }],
        allocations: [
          { userId: 'a', cents: 500 },
          { userId: 'b', cents: 500 },
        ],
      },
      {
        // Only a and d participate here -- b is entirely absent, so this
        // expense must not move the a-vs-b result away from 500.
        payers: [{ userId: 'a', cents: 200 }],
        allocations: [
          { userId: 'a', cents: 100 },
          { userId: 'd', cents: 100 },
        ],
      },
    ];
    expect(pairwiseNet('a', 'b', expenses, [])).toBe(500);
  });

  it('a zero-allocation-total expense does not throw and contributes 0', () => {
    const expenses: PairwiseExpenseInput[] = [{ payers: [], allocations: [] }];
    expect(() => pairwiseNet('a', 'b', expenses, [])).not.toThrow();
    expect(pairwiseNet('a', 'b', expenses, [])).toBe(0);
  });

  it('returns 0 for completely empty inputs', () => {
    expect(pairwiseNet('a', 'b', [], [])).toBe(0);
  });

  it('skips settlements that do not involve exactly this pair', () => {
    const settlements: DirectSettlement[] = [
      { fromUser: 'a', toUser: 'c', amount: 999 },
      { fromUser: 'c', toUser: 'b', amount: 999 },
      { fromUser: 'a', toUser: 'b', amount: 200 },
    ];
    expect(pairwiseNet('a', 'b', [], settlements)).toBe(200);
  });
});
