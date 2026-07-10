/**
 * Expense split calculators (Feature 3). Every split type resolves to an exact
 * per-participant integer-cent allocation that sums to the expense total — no
 * cent lost or invented — using the largest-remainder distribution from money.ts
 * for the proportional types.
 */
import type { Cents } from './money';
import { assertIntegerCents, distribute } from './money';

export type SplitType = 'equal' | 'percentage' | 'exact' | 'share';

export interface SplitParticipantInput {
  userId: string;
  /**
   * Meaning depends on split type:
   *  - equal:      ignored
   *  - percentage: percent of total (0..100); the set must sum to 100
   *  - exact:      exact cents this participant owes; the set must sum to total
   *  - share:      non-negative share weight (e.g. 2 rooms vs 1); need one > 0
   */
  value?: number;
}

export interface SplitAllocation {
  userId: string;
  cents: Cents;
}

const PERCENT_TOLERANCE = 1e-6;

function requireParticipants(participants: SplitParticipantInput[]): void {
  if (participants.length === 0) {
    throw new Error('a split needs at least one participant');
  }
  const seen = new Set<string>();
  for (const p of participants) {
    if (seen.has(p.userId)) {
      throw new Error(`duplicate participant in split: ${p.userId}`);
    }
    seen.add(p.userId);
  }
}

function zip(participants: SplitParticipantInput[], cents: Cents[]): SplitAllocation[] {
  return participants.map((p, i) => ({ userId: p.userId, cents: cents[i]! }));
}

/**
 * Compute the per-participant allocation for an expense.
 * Throws on inputs that cannot form a valid split (bad percentages, exact
 * amounts that don't sum to the total, all-zero shares, etc.).
 */
export function computeSplit(
  totalCents: Cents,
  type: SplitType,
  participants: SplitParticipantInput[],
): SplitAllocation[] {
  assertIntegerCents(totalCents, 'total');
  if (totalCents < 0) {
    throw new Error(`split total must be non-negative, got ${totalCents}`);
  }
  requireParticipants(participants);

  switch (type) {
    case 'equal': {
      return zip(participants, distribute(totalCents, participants.map(() => 1)));
    }

    case 'percentage': {
      const percents = participants.map((p) => {
        const v = p.value ?? 0;
        if (!Number.isFinite(v) || v < 0) {
          throw new Error(`percentage must be finite and non-negative, got ${v}`);
        }
        return v;
      });
      const sum = percents.reduce((a, b) => a + b, 0);
      if (Math.abs(sum - 100) > PERCENT_TOLERANCE) {
        throw new Error(`percentages must sum to 100, got ${sum}`);
      }
      return zip(participants, distribute(totalCents, percents));
    }

    case 'exact': {
      const exact = participants.map((p) => {
        const v = p.value ?? 0;
        assertIntegerCents(v, 'exact share');
        if (v < 0) {
          throw new Error(`exact share must be non-negative, got ${v}`);
        }
        return v;
      });
      const sum = exact.reduce((a, b) => a + b, 0);
      if (sum !== totalCents) {
        throw new Error(`exact shares must sum to total ${totalCents}, got ${sum}`);
      }
      return zip(participants, exact);
    }

    case 'share': {
      const shares = participants.map((p) => {
        const v = p.value ?? 0;
        if (!Number.isInteger(v) || v < 0) {
          throw new Error(`share weight must be a non-negative integer, got ${v}`);
        }
        return v;
      });
      return zip(participants, distribute(totalCents, shares));
    }

    default: {
      const _never: never = type;
      throw new Error(`unknown split type: ${String(_never)}`);
    }
  }
}
