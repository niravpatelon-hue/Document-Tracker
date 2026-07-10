import {
  computeNetBalances,
  simplifyDebts,
  type ExpenseForBalance,
  type NetBalance,
  type Transfer,
} from './simplify';

/** Re-derive each user's net position from a transfer set (debtors pay, creditors receive). */
function applyTransfers(balances: NetBalance[], transfers: Transfer[]): Map<string, number> {
  const net = new Map(balances.map((b) => [b.userId, b.net]));
  for (const t of transfers) {
    net.set(t.from, (net.get(t.from) ?? 0) + t.amount);
    net.set(t.to, (net.get(t.to) ?? 0) - t.amount);
  }
  return net;
}

describe('computeNetBalances', () => {
  it('credits the payer and debits each participant', () => {
    const expenses: ExpenseForBalance[] = [
      {
        payerId: 'a',
        allocations: [
          { userId: 'a', cents: 300 },
          { userId: 'b', cents: 300 },
          { userId: 'c', cents: 300 },
        ],
      },
    ];
    const balances = computeNetBalances(expenses);
    expect(balances).toEqual([
      { userId: 'a', net: 600 },
      { userId: 'b', net: -300 },
      { userId: 'c', net: -300 },
    ]);
    expect(balances.reduce((s, b) => s + b.net, 0)).toBe(0);
  });

  it('applies recorded settlements', () => {
    const expenses: ExpenseForBalance[] = [
      { payerId: 'a', allocations: [{ userId: 'b', cents: 500 }] },
    ];
    // b owes a 500; b pays a 500 -> everyone settled.
    const balances = computeNetBalances(expenses, [{ fromUser: 'b', toUser: 'a', amount: 500 }]);
    expect(balances).toEqual([
      { userId: 'a', net: 0 },
      { userId: 'b', net: 0 },
    ]);
  });
});

describe('simplifyDebts', () => {
  it('produces no transfers when settled', () => {
    expect(simplifyDebts([{ userId: 'a', net: 0 }, { userId: 'b', net: 0 }])).toEqual([]);
  });

  it('settles a simple two-party debt', () => {
    expect(
      simplifyDebts([
        { userId: 'a', net: 500 },
        { userId: 'b', net: -500 },
      ]),
    ).toEqual([{ from: 'b', to: 'a', amount: 500 }]);
  });

  it('reconciles balances and uses at most n-1 transfers', () => {
    const balances: NetBalance[] = [
      { userId: 'a', net: -40 },
      { userId: 'b', net: -30 },
      { userId: 'c', net: 20 },
      { userId: 'd', net: 50 },
    ];
    const transfers = simplifyDebts(balances);
    expect(transfers.length).toBeLessThanOrEqual(balances.length - 1);
    // Everyone ends at zero.
    const settled = applyTransfers(balances, transfers);
    for (const value of settled.values()) {
      expect(value).toBe(0);
    }
    // No transfer invents money.
    expect(transfers.every((t) => t.amount > 0)).toBe(true);
  });

  it('rejects balances that do not net to zero', () => {
    expect(() => simplifyDebts([{ userId: 'a', net: 100 }])).toThrow();
  });
});
