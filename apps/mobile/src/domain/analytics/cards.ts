/**
 * Credit-card finance engine (pure TypeScript, no React Native).
 *
 * All money is integer paise. All functions are pure and deterministic — no
 * Date.now(); the caller always passes `todayISO` ('YYYY-MM-DD'). Date math
 * parses ISO dates as UTC so results don't drift with the host timezone.
 */
import type { Cents } from '../money';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Parse a 'YYYY-MM-DD' ISO date as a UTC epoch-ms value. */
function utcMillis(dateISO: string): number {
  const [y, m, d] = dateISO.slice(0, 10).split('-').map((n) => parseInt(n, 10));
  return Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

/** Fraction of the limit used, clamped to 0..1. Returns 0 when limit <= 0. */
export function utilization(outstandingCents: Cents, limitCents: Cents): number {
  if (limitCents <= 0) return 0;
  return clamp(outstandingCents / limitCents, 0, 1);
}

/**
 * Minimum amount due — `pct`% of the outstanding balance (default 5%), rounded
 * to the nearest paisa. Never exceeds the outstanding balance and never < 0.
 */
export function minimumDueCents(outstandingCents: Cents, pct = 5): Cents {
  const raw = Math.round((outstandingCents * pct) / 100);
  return clamp(raw, 0, Math.max(0, outstandingCents));
}

/**
 * Reward coins earned for paying `amountCents`: `rate` coins per ₹100 paid
 * (default 1). Floored to a whole coin, never negative.
 */
export function rewardCoinsFor(amountCents: Cents, ratePerHundred = 1): number {
  return Math.max(0, Math.floor((amountCents / 10000) * ratePerHundred));
}

/** Whole-day difference (dueDate - today) in UTC. Negative when overdue. */
export function daysUntil(todayISO: string, dueDateISO: string): number {
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  return Math.round((utcMillis(dueDateISO) - utcMillis(todayISO)) / MS_PER_DAY);
}

export interface ScoreInput {
  cards: { outstandingCents: Cents; limitCents: Cents }[];
  onTimePayments: number;
  latePayments: number;
}

/** CIBIL-like estimated credit score in the 300..900 range. */
export function estimateCreditScore(input: ScoreInput): number {
  const { cards, onTimePayments, latePayments } = input;
  if (cards.length === 0) return 750;

  const avgUtil =
    cards.reduce((sum, c) => sum + utilization(c.outstandingCents, c.limitCents), 0) /
    cards.length;

  const utilPenalty = Math.round(Math.min(1, avgUtil / 0.9) * 300);
  const latePenalty = Math.min(200, latePayments * 40);
  const onTimeBonus = Math.min(30, onTimePayments * 3);

  return Math.round(clamp(900 - utilPenalty - latePenalty + onTimeBonus, 300, 900));
}

export type ScoreBand = 'poor' | 'fair' | 'good' | 'excellent';

/** <650 poor, <700 fair, <750 good, else excellent. */
export function scoreBand(score: number): ScoreBand {
  if (score < 650) return 'poor';
  if (score < 700) return 'fair';
  if (score < 750) return 'good';
  return 'excellent';
}

/** Simple interest that would accrue if the balance goes unpaid for `days`. */
export function interestIfUnpaidCents(outstandingCents: Cents, apr: number, days = 30): Cents {
  const interest = Math.round(outstandingCents * (apr / 100) * (days / 365));
  return Number.isFinite(interest) ? interest : 0;
}

export interface CardSummary {
  totalOutstandingCents: Cents;
  totalLimitCents: Cents;
  utilization: number;
  nearestDueISO: string | null;
  nearestDueDays: number | null;
}

/**
 * Aggregate a set of cards: total outstanding/limit, blended utilization, and
 * the "nearest" due date. Preference is the soonest future-or-today due
 * (smallest daysUntil >= 0); if every card is overdue, the least-overdue one
 * (largest daysUntil, i.e. closest to zero). Returns nulls when there are no
 * cards.
 */
export function summarizeCards(
  cards: { outstandingCents: Cents; limitCents: Cents; dueDateISO: string }[],
  todayISO: string,
): CardSummary {
  const totalOutstandingCents = cards.reduce((s, c) => s + c.outstandingCents, 0);
  const totalLimitCents = cards.reduce((s, c) => s + c.limitCents, 0);
  const util = utilization(totalOutstandingCents, totalLimitCents);

  if (cards.length === 0) {
    return {
      totalOutstandingCents,
      totalLimitCents,
      utilization: util,
      nearestDueISO: null,
      nearestDueDays: null,
    };
  }

  const withDays = cards.map((c) => ({
    iso: c.dueDateISO,
    days: daysUntil(todayISO, c.dueDateISO),
  }));

  const upcoming = withDays.filter((c) => c.days >= 0);
  let chosen: { iso: string; days: number };
  if (upcoming.length > 0) {
    // Soonest future-or-today.
    chosen = upcoming.reduce((best, c) => (c.days < best.days ? c : best));
  } else {
    // All overdue — pick the least overdue (closest to today).
    chosen = withDays.reduce((best, c) => (c.days > best.days ? c : best));
  }

  return {
    totalOutstandingCents,
    totalLimitCents,
    utilization: util,
    nearestDueISO: chosen.iso,
    nearestDueDays: chosen.days,
  };
}
