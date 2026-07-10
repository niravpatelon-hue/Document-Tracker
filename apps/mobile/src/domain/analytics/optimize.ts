/**
 * Optimize engine (Feature 3). Pure functions that turn a month's spend,
 * budgets and credit-card state into a ranked list of actionable
 * money-saving / attention suggestions.
 *
 * Pure TypeScript, no React Native. Amounts are integer paise. Dates are ISO
 * 'YYYY-MM-DD'. Callers pass fixed `todayISO` so results are deterministic.
 */
import type { Cents } from '../money';
import { formatINR } from '../money';
import { spendByCategory, type SpendTxn } from './spend';

export type SuggestionSeverity = 'info' | 'warn' | 'high';
export type SuggestionKind =
  | 'budget_over'
  | 'spend_spike'
  | 'subscription'
  | 'card_due'
  | 'card_utilization'
  | 'category_high'
  | 'savings_tip';

export interface Suggestion {
  id: string;
  kind: SuggestionKind;
  severity: SuggestionSeverity;
  title: string;
  detail: string;
  amountCents?: Cents;
  category?: string;
}

export interface OptimizeCard {
  name: string;
  outstandingCents: Cents;
  limitCents: Cents;
  dueDateISO: string;
}

export interface OptimizeInput {
  txns: SpendTxn[];
  prevTxns?: SpendTxn[];
  budgets?: { category: string; limitCents: Cents }[];
  cards?: OptimizeCard[];
  todayISO: string;
}

/** Vendor keywords that indicate a recurring subscription. */
const SUBSCRIPTION_KEYWORDS = [
  'netflix',
  'spotify',
  'prime',
  'hotstar',
  'youtube',
  'jiocinema',
  'sonyliv',
  'zee5',
  'gym',
  'cult',
  'audible',
  'icloud',
  'google one',
  'adobe',
  'canva',
  'notion',
];

const SEVERITY_RANK: Record<SuggestionSeverity, number> = { high: 0, warn: 1, info: 2 };

/** Whole days from `todayISO` to `dueDateISO` (negative = already past). */
function daysBetween(todayISO: string, dueDateISO: string): number {
  const a = Date.parse(`${todayISO}T00:00:00Z`);
  const b = Date.parse(`${dueDateISO}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

export function buildSuggestions(input: OptimizeInput): Suggestion[] {
  const { txns, prevTxns = [], budgets = [], cards = [], todayISO } = input;
  const out: Suggestion[] = [];

  const byCat = spendByCategory(txns);
  const spentFor = (category: string): Cents =>
    byCat.find((c) => c.category === category)?.total ?? 0;
  const totalSpend = byCat.reduce((s, c) => s + c.total, 0);

  // budget_over
  for (const b of budgets) {
    const spent = spentFor(b.category);
    if (spent > b.limitCents) {
      out.push({
        id: `budget_over:${b.category}`,
        kind: 'budget_over',
        severity: 'high',
        title: `Over budget on ${b.category}`,
        detail: `You've spent ${formatINR(spent)} against a ${formatINR(b.limitCents)} budget.`,
        amountCents: spent - b.limitCents,
        category: b.category,
      });
    } else if (b.limitCents > 0 && spent >= 0.8 * b.limitCents) {
      out.push({
        id: `budget_warn:${b.category}`,
        kind: 'budget_over',
        severity: 'warn',
        title: `Close to ${b.category} budget`,
        detail: `You've spent ${formatINR(spent)} of your ${formatINR(b.limitCents)} budget.`,
        amountCents: 0,
        category: b.category,
      });
    }
  }

  // spend_spike
  const prevByCat = spendByCategory(prevTxns);
  const prevFor = (category: string): Cents =>
    prevByCat.find((c) => c.category === category)?.total ?? 0;
  for (const c of byCat) {
    const previous = prevFor(c.category);
    if (previous <= 0) {
      continue;
    }
    const delta = c.total - previous;
    if (c.total > previous * 1.25 && delta >= 50_000) {
      const pct = Math.round((delta / previous) * 100);
      out.push({
        id: `spend_spike:${c.category}`,
        kind: 'spend_spike',
        severity: 'warn',
        title: `Spending up on ${c.category}`,
        detail: `Up ${pct}% vs last month (${formatINR(previous)} → ${formatINR(c.total)}).`,
        amountCents: delta,
        category: c.category,
      });
    }
  }

  // category_high (single largest current category)
  if (byCat.length > 0) {
    const top = byCat[0]!;
    const trim = Math.round(top.total * 0.15);
    out.push({
      id: `category_high:${top.category}`,
      kind: 'category_high',
      severity: 'info',
      title: `Your top category is ${top.category}`,
      detail: `${formatINR(top.total)} this month. Trimming 15% would save about ${formatINR(trim)}.`,
      amountCents: trim,
      category: top.category,
    });
  }

  // subscription
  const subs = txns.filter((t) => {
    const v = (t.vendor ?? '').toLowerCase();
    return v.trim() !== '' && SUBSCRIPTION_KEYWORDS.some((k) => v.includes(k));
  });
  if (subs.length > 0) {
    const subTotal = subs.reduce((s, t) => s + t.amount, 0);
    out.push({
      id: 'subscription',
      kind: 'subscription',
      severity: 'info',
      title: 'Review your subscriptions',
      detail: `${subs.length} subscription${subs.length === 1 ? '' : 's'} totalling ${formatINR(subTotal)} this month.`,
      amountCents: subTotal,
    });
  }

  // card_due
  for (const card of cards) {
    if (card.dueDateISO < todayISO) {
      out.push({
        id: `card_due:${card.name}`,
        kind: 'card_due',
        severity: 'high',
        title: `${card.name} payment overdue`,
        detail: `Pay ${formatINR(card.outstandingCents)} by ${card.dueDateISO}.`,
        amountCents: card.outstandingCents,
      });
    } else {
      const days = daysBetween(todayISO, card.dueDateISO);
      if (days <= 7) {
        out.push({
          id: `card_due:${card.name}`,
          kind: 'card_due',
          severity: 'high',
          title: `${card.name} bill due in ${days} day${days === 1 ? '' : 's'}`,
          detail: `Pay ${formatINR(card.outstandingCents)} by ${card.dueDateISO}.`,
          amountCents: card.outstandingCents,
        });
      }
    }
  }

  // card_utilization
  for (const card of cards) {
    if (card.limitCents <= 0) {
      continue;
    }
    const util = card.outstandingCents / card.limitCents;
    if (util > 0.3) {
      const severity: SuggestionSeverity = util > 0.7 ? 'high' : 'warn';
      out.push({
        id: `card_utilization:${card.name}`,
        kind: 'card_utilization',
        severity,
        title: `High utilization on ${card.name}`,
        detail: `You're using ${Math.round(util * 100)}% of your limit.`,
        amountCents: Math.max(0, card.outstandingCents - Math.round(0.3 * card.limitCents)),
      });
    }
  }

  // savings_tip (always, when there are txns)
  if (txns.length > 0) {
    const save = Math.round(totalSpend * 0.1);
    out.push({
      id: 'savings_tip',
      kind: 'savings_tip',
      severity: 'info',
      title: 'Aim to save 10%',
      detail: `Trimming 10% across categories frees about ${formatINR(save)} this month.`,
      amountCents: save,
    });
  }

  // Stable sort high -> warn -> info (insertion order preserved within a tier).
  return out
    .map((s, i) => ({ s, i }))
    .sort((a, b) => SEVERITY_RANK[a.s.severity] - SEVERITY_RANK[b.s.severity] || a.i - b.i)
    .map(({ s }) => s);
}

const SAVINGS_KINDS: ReadonlySet<SuggestionKind> = new Set<SuggestionKind>([
  'budget_over',
  'spend_spike',
  'category_high',
  'subscription',
  'card_utilization',
  'savings_tip',
]);

/** Sum of savings-type suggestion amounts (excludes card_due, which is a bill). */
export function potentialSavingsCents(suggestions: Suggestion[]): Cents {
  return suggestions.reduce(
    (sum, s) => (SAVINGS_KINDS.has(s.kind) ? sum + (s.amountCents ?? 0) : sum),
    0,
  );
}
