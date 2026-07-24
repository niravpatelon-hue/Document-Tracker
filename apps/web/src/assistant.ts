/**
 * On-device spending assistant (query-answering engine).
 *
 * IMPORTANT — this is NOT a hosted/remote LLM and makes NO network calls.
 * `answerQuery` below is a synchronous, deterministic, on-device pattern
 * matcher: plain string/keyword checks over the user's typed question, paired
 * with real arithmetic over the user's OWN expenses/budgets/cards (already
 * held in memory from local storage). It reuses the same tested domain
 * functions the rest of the app uses (@domain/analytics/*, @domain/money) to
 * compute every number it reports. There is no API key, no prompt sent
 * anywhere, and no call out to Claude, GPT, or any other hosted model —
 * nothing about the user's spending ever leaves the device.
 */
import { formatINR } from '@domain/money';
import {
  monthKeyOf,
  previousMonth,
  spendByCategory,
  monthOverMonth,
  classifySpendCategory,
  type SpendTxn,
} from '@domain/analytics/spend';
import { evaluateBudget, type BudgetStatus } from '@domain/analytics/budget';
import { buildSuggestions, potentialSavingsCents, type OptimizeCard } from '@domain/analytics/optimize';
import { summarizeCards, utilization } from '@domain/analytics/cards';
import {
  expenseToSpendTxn,
  myShareCents,
  EXPENSE_CATEGORIES,
  type Budget,
  type CreditCard,
  type Expense,
} from './store';

/* ------------------------------------------------------------------ */
/* Public types                                                       */
/* ------------------------------------------------------------------ */

export interface AssistantContext {
  expenses: Expense[];
  budgets: Budget[];
  cards: CreditCard[];
  /** 'YYYY-MM-DD' — the reference "today" for month/week/due-date math. */
  todayISO: string;
}

/** Five short example questions to seed the chat UI. */
export const SUGGESTED_QUESTIONS: string[] = [
  'How much did I spend on Dining?',
  'What is my biggest expense category?',
  'Any high card utilization?',
  'How are my budgets doing?',
  'How can I save more?',
];

/* ------------------------------------------------------------------ */
/* Canned copy                                                        */
/* ------------------------------------------------------------------ */

const HELP_TEXT = [
  "Hi! I can answer questions about your spending, using only your own data. Try asking things like:",
  '- "How much did I spend on Dining?" (spend by category)',
  '- "How are my budgets doing?" (budgets)',
  '- "Any high card utilization?" (card dues & utilization)',
  '- "How can I save more?" (savings tips)',
].join('\n');

const FALLBACK_TEXT =
  "I couldn't quite figure out what you're asking. Try asking about a category (like Dining), your budgets, credit card dues, or ways to save.";

/* ------------------------------------------------------------------ */
/* Small helpers                                                      */
/* ------------------------------------------------------------------ */

/** Whole-word (optionally simple-plural) match, so "rent" doesn't fire inside "different". */
function hasWord(query: string, phrase: string): boolean {
  return new RegExp(`\\b${phrase}s?\\b`).test(query);
}

function daysFromToday(todayISO: string, dateISO: string): number {
  const a = Date.parse(`${todayISO}T00:00:00Z`);
  const b = Date.parse(`${dateISO}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

function dueDatePhrase(todayISO: string, dueDateISO: string): string {
  const days = daysFromToday(todayISO, dueDateISO);
  if (days < 0) {
    const overdue = Math.abs(days);
    return `overdue by ${overdue} day${overdue === 1 ? '' : 's'}`;
  }
  if (days === 0) return 'due today';
  return `due in ${days} day${days === 1 ? '' : 's'}`;
}

function isoDaysAgo(dateISO: string, days: number): string {
  const base = Date.parse(`${dateISO}T00:00:00Z`);
  if (!Number.isFinite(base)) return dateISO;
  return new Date(base - days * 86_400_000).toISOString().slice(0, 10);
}

function toCardInputs(cards: CreditCard[]): OptimizeCard[] {
  return cards.map((c) => ({
    name: c.name,
    outstandingCents: c.outstandingCents,
    limitCents: c.limitCents,
    dueDateISO: c.dueDateISO,
  }));
}

function stateLabel(state: BudgetStatus['state']): string {
  if (state === 'over') return 'over budget';
  if (state === 'warn') return 'close to the limit';
  return 'on track';
}

/* ------------------------------------------------------------------ */
/* Step 1 — category detection                                       */
/* ------------------------------------------------------------------ */

/** Extra keywords (beyond the category's own name) that imply a category. */
const CATEGORY_SYNONYMS: Record<string, string[]> = {
  Dining: ['food', 'eating out', 'restaurant'],
  Groceries: ['grocery'],
  Fuel: ['petrol', 'gas'],
  Transport: ['cab', 'uber', 'ola'],
  Utilities: ['electricity', 'water bill'],
  Entertainment: ['movie', 'movies'],
  Health: ['medical'],
};

/** First category whose key or synonym appears in the query (array order = priority). */
function detectCategory(query: string, expenses: Expense[]): string | null {
  for (const cat of EXPENSE_CATEGORIES) {
    const words = [cat.key.toLowerCase(), ...(CATEGORY_SYNONYMS[cat.key] ?? [])];
    if (words.some((w) => hasWord(query, w))) {
      return cat.key;
    }
  }
  // Fall back to a real merchant the user actually has expenses from (e.g. "how
  // much have I spent at Swiggy"). classifySpendCategory is a vendor-name
  // classifier, not a prose parser — ordinary English words routinely contain
  // its short keyword fragments as substrings (e.g. "different" contains
  // "rent", "smarter" contains "mart"), so it must never see the raw query.
  // Whole-word-matching a *known vendor name* first keeps its input exactly to
  // genuine merchant strings, which is what it's designed to classify safely.
  const vendors = new Set<string>();
  for (const e of expenses) {
    const v = (e.description ?? '').trim();
    if (v) vendors.add(v);
  }
  for (const vendor of vendors) {
    if (!hasWord(query, vendor.toLowerCase())) continue;
    try {
      const guessed = classifySpendCategory(vendor);
      if (guessed !== 'Other' && EXPENSE_CATEGORIES.some((c) => c.key === guessed)) {
        return guessed;
      }
    } catch {
      /* defensive: a classifier hiccup should never break category detection */
    }
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Step 2 — time-range detection (category / total questions only)    */
/* ------------------------------------------------------------------ */

const MONTH_NAMES = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];

interface RangeInfo {
  /** Human-friendly phrase, e.g. "this month" / "last month" / "in March". */
  label: string;
  inRange: (dateISO: string) => boolean;
}

function detectRange(query: string, todayISO: string, nowKey: string, prevKey: string): RangeInfo {
  if (hasWord(query, 'last month')) {
    return { label: 'last month', inRange: (dateISO) => monthKeyOf(dateISO) === prevKey };
  }

  for (let i = 0; i < MONTH_NAMES.length; i++) {
    const name = MONTH_NAMES[i]!;
    if (!hasWord(query, name)) continue;
    const [nowYear, nowMonth] = nowKey.split('-').map((n) => parseInt(n, 10));
    const monthNum = i + 1;
    const year = monthNum > (nowMonth ?? monthNum) ? (nowYear ?? 0) - 1 : (nowYear ?? 0);
    const key = `${String(year).padStart(4, '0')}-${String(monthNum).padStart(2, '0')}`;
    const label = `in ${name.charAt(0).toUpperCase()}${name.slice(1)}`;
    return { label, inRange: (dateISO) => monthKeyOf(dateISO) === key };
  }

  if (hasWord(query, 'this week')) {
    const sinceISO = isoDaysAgo(todayISO, 6);
    return { label: 'this week', inRange: (dateISO) => dateISO >= sinceISO && dateISO <= todayISO };
  }

  return { label: 'this month', inRange: (dateISO) => monthKeyOf(dateISO) === nowKey };
}

/* ------------------------------------------------------------------ */
/* Step 3 — intent handlers                                          */
/* ------------------------------------------------------------------ */

function cardsAnswer(ctx: AssistantContext): string {
  const cards = ctx.cards ?? [];
  if (cards.length === 0) {
    return "You don't have any credit cards added yet.";
  }
  const cardInputs = toCardInputs(cards);
  const summary = summarizeCards(cardInputs, ctx.todayISO);
  const overallPct = Math.round(summary.utilization * 100);
  const heading = `You owe ${formatINR(summary.totalOutstandingCents)} in total across ${cards.length} card${cards.length === 1 ? '' : 's'} (${overallPct}% utilization).`;
  const lines = cardInputs.map((c) => {
    const pct = Math.round(utilization(c.outstandingCents, c.limitCents) * 100);
    return `${c.name}: ${formatINR(c.outstandingCents)} outstanding, ${pct}% utilization, ${dueDatePhrase(ctx.todayISO, c.dueDateISO)}.`;
  });
  return [heading, ...lines].join('\n');
}

function budgetsAnswer(category: string | null, allTxns: SpendTxn[], ctx: AssistantContext): string {
  const budgets = ctx.budgets ?? [];

  if (category) {
    const spec = budgets.find((b) => b.category === category);
    if (!spec) {
      return `You don't have a budget set for ${category} yet.`;
    }
    const status: BudgetStatus = evaluateBudget(spec, allTxns, ctx.todayISO);
    return `Your ${category} budget: ${formatINR(status.spentCents)} of ${formatINR(status.limitCents)} (${Math.round(status.pct)}%) — you're ${stateLabel(status.state)}.`;
  }

  if (budgets.length === 0) {
    return "You haven't set up any budgets yet.";
  }
  const lines = budgets.map((b) => {
    const status: BudgetStatus = evaluateBudget(b, allTxns, ctx.todayISO);
    return `${b.category}: ${formatINR(status.spentCents)} of ${formatINR(status.limitCents)} — ${stateLabel(status.state)}.`;
  });
  return ["Here's how your budgets are doing:", ...lines].join('\n');
}

function optimizeAnswer(allTxns: SpendTxn[], ctx: AssistantContext, nowKey: string, prevKey: string): string {
  const txns = allTxns.filter((t) => monthKeyOf(t.dateISO) === nowKey);
  const prevTxns = allTxns.filter((t) => monthKeyOf(t.dateISO) === prevKey);
  const budgetInputs = (ctx.budgets ?? []).map((b) => ({ category: b.category, limitCents: b.limitCents }));
  const cardInputs = toCardInputs(ctx.cards ?? []);

  const suggestions = buildSuggestions({
    txns,
    prevTxns,
    budgets: budgetInputs,
    cards: cardInputs,
    todayISO: ctx.todayISO,
  });

  if (suggestions.length === 0) {
    return "You're in good shape — I don't have any savings tips for you right now.";
  }

  const savings = potentialSavingsCents(suggestions);
  const top = suggestions.slice(0, 2);
  const tips = top.map((s) => `${s.title} — ${s.detail}`).join(' ');
  return `You could save about ${formatINR(savings)} this month. ${tips}`;
}

function topAnswer(query: string, range: RangeInfo, allTxns: SpendTxn[], ctx: AssistantContext): string {
  const wantsMerchant = query.includes('merchant') || query.includes('vendor') || query.includes('store');

  if (wantsMerchant) {
    const totals = new Map<string, number>();
    for (const e of ctx.expenses ?? []) {
      if (!range.inRange(e.dateISO)) continue;
      const vendor = (e.description ?? '').trim();
      if (!vendor) continue;
      totals.set(vendor, (totals.get(vendor) ?? 0) + myShareCents(e));
    }
    if (totals.size === 0) {
      return `I couldn't find any vendor spending ${range.label}.`;
    }
    const [vendor, total] = [...totals.entries()].sort((a, b) => b[1] - a[1])[0]!;
    return `Your top merchant ${range.label} is ${vendor} — ${formatINR(total)}.`;
  }

  const rangeTxns = allTxns.filter((t) => range.inRange(t.dateISO));
  const byCat = spendByCategory(rangeTxns);
  if (byCat.length === 0) {
    return `You don't have any expenses ${range.label} yet.`;
  }
  const top = byCat[0]!;
  const total = byCat.reduce((s, c) => s + c.total, 0);
  const pct = total > 0 ? Math.round((top.total / total) * 100) : 0;
  return `Your biggest category ${range.label} is ${top.category} at ${formatINR(top.total)} (${pct}% of your spend).`;
}

function categoryAnswer(category: string, range: RangeInfo, allTxns: SpendTxn[], nowKey: string): string {
  const rangeTxns = allTxns.filter((t) => t.category === category && range.inRange(t.dateISO));
  const total = rangeTxns.reduce((s, t) => s + t.amount, 0);
  let out = `You spent ${formatINR(total)} on ${category} ${range.label}.`;

  if (range.label === 'this month') {
    const catTxns = allTxns.filter((t) => t.category === category);
    const mom = monthOverMonth(catTxns, nowKey);
    if (mom.previous > 0 && mom.deltaPct != null) {
      const dir = mom.delta >= 0 ? 'up' : 'down';
      out += ` That's ${dir} ${Math.round(Math.abs(mom.deltaPct))}% vs last month (${formatINR(mom.previous)}).`;
    } else if (mom.previous === 0 && mom.current > 0) {
      out += ` You had no ${category} spend last month.`;
    }
  }
  return out;
}

function totalAnswer(range: RangeInfo, allTxns: SpendTxn[]): string {
  const rangeTxns = allTxns.filter((t) => range.inRange(t.dateISO));
  if (rangeTxns.length === 0) {
    return `You don't have any expenses recorded ${range.label}.`;
  }
  const total = rangeTxns.reduce((s, t) => s + t.amount, 0);
  const topCats = spendByCategory(rangeTxns).slice(0, 3);
  const list = topCats.map((c) => `${c.category} ${formatINR(c.total)}`).join(', ');
  return `You spent ${formatINR(total)} ${range.label}. Top categories: ${list}.`;
}

/* ------------------------------------------------------------------ */
/* Entry point                                                        */
/* ------------------------------------------------------------------ */

/**
 * Answer a free-text question about the user's spending. Synchronous, pure,
 * and never throws — any unexpected failure falls back to a friendly message
 * rather than surfacing an error to the chat UI.
 */
export function answerQuery(rawQuery: string, ctx: AssistantContext): string {
  try {
    const query = (rawQuery ?? '').trim().toLowerCase();

    const isGreeting =
      query === '' ||
      query.includes('help') ||
      query.includes('what can you') ||
      /^(hi|hello|hey)\b/.test(query);
    if (isGreeting) {
      return HELP_TEXT;
    }

    const expenses = ctx.expenses ?? [];
    const allTxns: SpendTxn[] = expenses.map(expenseToSpendTxn);
    const nowKey = monthKeyOf(ctx.todayISO);
    const prevKey = previousMonth(nowKey);
    const category = detectCategory(query, expenses);
    const range = detectRange(query, ctx.todayISO, nowKey, prevKey);

    // (b) Card-related.
    if (
      query.includes('card') ||
      query.includes('utilization') ||
      query.includes('due') ||
      query.includes('credit score')
    ) {
      return cardsAnswer(ctx);
    }

    // (c) Budget-related.
    if (query.includes('budget') || query.includes('limit')) {
      return budgetsAnswer(category, allTxns, ctx);
    }

    // (d) Optimize / save.
    if (
      query.includes('save') ||
      query.includes('optimize') ||
      query.includes('tip') ||
      query.includes('suggestion')
    ) {
      return optimizeAnswer(allTxns, ctx, nowKey, prevKey);
    }

    // (e) Top / biggest.
    if (
      query.includes('top') ||
      query.includes('most') ||
      query.includes('biggest') ||
      query.includes('highest')
    ) {
      return topAnswer(query, range, allTxns, ctx);
    }

    // (f) Category detected, no other intent matched.
    if (category) {
      return categoryAnswer(category, range, allTxns, nowKey);
    }

    // (g) General total spend — also the catch-all for any other real question.
    const mentionsTotal = query.includes('how much did i spend') || query.includes('total spend');
    if (mentionsTotal || /[a-z]/.test(query)) {
      return totalAnswer(range, allTxns);
    }

    // (h) Fallback.
    return FALLBACK_TEXT;
  } catch {
    return FALLBACK_TEXT;
  }
}
