/**
 * Bilateral ("just the two of us") net balance between exactly two users,
 * derived from a shared multi-person expense group plus any settlements.
 *
 * This lets the UI show a private "you and Bob" summary without first
 * reducing the whole group's balances (see ./simplify.ts). Because each
 * expense's contribution algebraically cancels to zero whenever it doesn't
 * involve both users, callers can pass every expense in a group as-is --
 * there is no need to pre-filter to "expenses involving both A and B".
 *
 * Sign convention -- pairwiseNet(A, B, expenses, settlements) returns A's net
 * position considering ONLY the bilateral relationship between A and B, as if
 * you extracted a private 2-person ledger between just these two people from
 * a shared multi-person group:
 *   - Positive => B owes A.
 *   - Negative => A owes B.
 *   - Zero     => A and B are settled with each other.
 * This mirrors the sign convention of computeNetBalances' NetBalance.net in
 * ./simplify.ts (positive = the person is owed). It follows that
 * pairwiseNet(A, B, ...) === -pairwiseNet(B, A, ...).
 */
import { type Payment, type DirectSettlement } from './simplify';
import type { Cents } from '../money';

export interface PairwiseExpenseInput {
  /** Who fronted the money, and how much each paid (supports multiple payers). */
  payers: Payment[];
  /**
   * What each participant owes for this expense (from computeSplit). Reuses
   * the Payment shape (userId, cents) since it is structurally identical.
   */
  allocations: Payment[];
}

/**
 * Compute A's net bilateral position against B across `expenses` and
 * `settlements`, ignoring every other member of the group(s) they came from.
 *
 * For each expense, let:
 *   - allocA / allocB = cents allocated to A / B in that expense (0 if absent)
 *   - payA / payB     = cents A / B paid in that expense (0 if they didn't pay)
 *   - T               = the sum of ALL allocations in that expense (every
 *                        participant, not just A and B)
 *
 * The expense is skipped (contributes 0) when T <= 0 -- this guards against
 * divide-by-zero on a degenerate/zero-total expense. Otherwise its bilateral
 * contribution is:
 *
 *   (allocB * payA) / T   -   (allocA * payB) / T
 *
 * `allocB * payA / T` is the slice of B's allocation that was funded by A's
 * payment (B owes A that much for this expense); `allocA * payB / T` is the
 * slice of A's allocation funded by B's payment (A owes B that much). This
 * isolates the true A-vs-B cross terms even inside a 3+ person group. An
 * expense that doesn't involve both A and B naturally contributes exactly
 * zero, since one side's alloc or pay is always 0 -- so it is safe and
 * correct for callers to pass ALL of a group's expenses without pre-filtering
 * to whether the expense involves both A and B.
 *
 * Per-expense contributions are summed as a running (possibly fractional)
 * total across every expense first; settlements are folded in afterwards; and
 * the grand total is rounded exactly once at the very end -- rounding
 * per-expense would let small drifts compound.
 *
 * For each settlement: if it runs A -> B, A's debt to B shrinks, so its
 * amount is added; if it runs B -> A, it is subtracted. A settlement not
 * between exactly this (A, B) pair (in either direction) contributes
 * nothing.
 *
 * Never throws: every division is guarded, and empty inputs yield 0.
 */
export function pairwiseNet(
  userA: string,
  userB: string,
  expenses: PairwiseExpenseInput[],
  settlements: DirectSettlement[],
): Cents {
  let net = 0;

  for (const expense of expenses) {
    const total = expense.allocations.reduce((sum, alloc) => sum + alloc.cents, 0);
    if (total <= 0) continue; // degenerate/zero-total expense -- guard divide-by-zero

    let allocA = 0;
    let allocB = 0;
    for (const alloc of expense.allocations) {
      if (alloc.userId === userA) allocA += alloc.cents;
      if (alloc.userId === userB) allocB += alloc.cents;
    }

    let payA = 0;
    let payB = 0;
    for (const payer of expense.payers) {
      if (payer.userId === userA) payA += payer.cents;
      if (payer.userId === userB) payB += payer.cents;
    }

    net += (allocB * payA) / total - (allocA * payB) / total;
  }

  for (const s of settlements) {
    if (s.fromUser === userA && s.toUser === userB) {
      net += s.amount;
    } else if (s.fromUser === userB && s.toUser === userA) {
      net -= s.amount;
    }
    // Any settlement not involving exactly this (A, B) pair contributes 0.
  }

  return Math.round(net);
}
