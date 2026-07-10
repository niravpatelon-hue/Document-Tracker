/**
 * Balance computation + settle-up suggestion that minimizes the number of
 * transactions (Feature 3, "settle-up suggestions that minimize the number of
 * transactions needed").
 *
 * Finding the provably minimum number of transfers is NP-hard in general, so we
 * use the standard greedy heuristic (repeatedly settle the largest debtor
 * against the largest creditor). In practice this produces at most n-1 transfers
 * and is what Splitwise-class apps use; it is exact for the common cases and
 * near-optimal otherwise. All arithmetic is in integer cents.
 */
import type { Cents } from '../money';

export interface ExpenseForBalance {
  /** Who fronted the money. */
  payerId: string;
  /** What each participant owes for this expense (from computeSplit). */
  allocations: { userId: string; cents: Cents }[];
}

export interface DirectSettlement {
  fromUser: string;
  toUser: string;
  amount: Cents;
}

export interface NetBalance {
  userId: string;
  /** Positive => the group owes this user; negative => this user owes the group. */
  net: Cents;
}

export interface Transfer {
  from: string;
  to: string;
  amount: Cents;
}

/**
 * Net each member's position across all expenses and any settlements already
 * made. For each expense, the payer is credited the full total and every
 * participant (including the payer, if they share) is debited their allocation.
 * A recorded settlement moves `amount` from payer's debt to the recipient.
 */
export function computeNetBalances(
  expenses: ExpenseForBalance[],
  settlements: DirectSettlement[] = [],
): NetBalance[] {
  const net = new Map<string, Cents>();
  const bump = (userId: string, delta: Cents) => {
    net.set(userId, (net.get(userId) ?? 0) + delta);
  };

  for (const expense of expenses) {
    const total = expense.allocations.reduce((a, b) => a + b.cents, 0);
    bump(expense.payerId, total);
    for (const alloc of expense.allocations) {
      bump(alloc.userId, -alloc.cents);
    }
  }

  // A settlement: fromUser hands cash to toUser, reducing fromUser's debt
  // (raising their net toward 0) and reducing what toUser is owed.
  for (const s of settlements) {
    bump(s.fromUser, s.amount);
    bump(s.toUser, -s.amount);
  }

  return [...net.entries()]
    .map(([userId, value]) => ({ userId, net: value }))
    .sort((a, b) => (a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0));
}

/**
 * Reduce net balances to a minimal-ish set of transfers. Returns an empty list
 * when everyone is settled. Requires balances to net to zero (they always do
 * when derived from `computeNetBalances`).
 */
export function simplifyDebts(balances: NetBalance[]): Transfer[] {
  const sum = balances.reduce((a, b) => a + b.net, 0);
  if (sum !== 0) {
    throw new Error(`balances must net to zero to settle up, got ${sum}`);
  }

  // Creditors are owed money (net > 0); debtors owe (net < 0).
  const creditors = balances
    .filter((b) => b.net > 0)
    .map((b) => ({ id: b.userId, amt: b.net }));
  const debtors = balances
    .filter((b) => b.net < 0)
    .map((b) => ({ id: b.userId, amt: -b.net }));

  // Largest first; ties by id keep the output deterministic.
  const byAmtDesc = (a: { id: string; amt: Cents }, b: { id: string; amt: Cents }) =>
    b.amt - a.amt || (a.id < b.id ? -1 : 1);
  creditors.sort(byAmtDesc);
  debtors.sort(byAmtDesc);

  const transfers: Transfer[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i]!;
    const creditor = creditors[j]!;
    const pay = Math.min(debtor.amt, creditor.amt);
    if (pay > 0) {
      transfers.push({ from: debtor.id, to: creditor.id, amount: pay });
    }
    debtor.amt -= pay;
    creditor.amt -= pay;
    if (debtor.amt === 0) {
      i += 1;
    }
    if (creditor.amt === 0) {
      j += 1;
    }
  }
  return transfers;
}
