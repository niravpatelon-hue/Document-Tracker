/**
 * Per-category budget evaluation with alerts (Feature 2). Pure and testable.
 */
import type { Cents } from '../money';
import { monthKeyOf, yearKeyOf, type SpendTxn } from './spend';

export interface BudgetSpec {
  category: string;
  period: 'monthly' | 'yearly';
  limitCents: Cents;
  /** Alert threshold as a percentage of the limit, e.g. 80. */
  alertThresholdPct: number;
}

export type BudgetState = 'ok' | 'warn' | 'over';

export interface BudgetStatus {
  category: string;
  period: 'monthly' | 'yearly';
  spentCents: Cents;
  limitCents: Cents;
  /** Spend as a percentage of the limit (can exceed 100). */
  pct: number;
  state: BudgetState;
}

/**
 * Evaluate a budget against transactions for the period containing `refDateISO`.
 * `state` is 'over' once spend exceeds the limit, 'warn' at/above the alert
 * threshold, otherwise 'ok'.
 */
export function evaluateBudget(
  spec: BudgetSpec,
  txns: SpendTxn[],
  refDateISO: string,
): BudgetStatus {
  const refKey = spec.period === 'monthly' ? monthKeyOf(refDateISO) : yearKeyOf(refDateISO);
  const keyOf = spec.period === 'monthly' ? monthKeyOf : yearKeyOf;

  const spentCents = txns
    .filter((t) => t.category === spec.category && keyOf(t.dateISO) === refKey)
    .reduce((s, t) => s + t.amount, 0);

  const pct = spec.limitCents > 0 ? (spentCents / spec.limitCents) * 100 : 0;
  const state: BudgetState =
    spentCents > spec.limitCents ? 'over' : pct >= spec.alertThresholdPct ? 'warn' : 'ok';

  return {
    category: spec.category,
    period: spec.period,
    spentCents,
    limitCents: spec.limitCents,
    pct,
    state,
  };
}
