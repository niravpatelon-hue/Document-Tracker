/**
 * Spend-analysis aggregations (Feature 2). Pure functions over a minimal
 * transaction shape so they can be reused by the app and the web preview and
 * unit-tested without a database.
 *
 * Amounts are integer cents. Dates are ISO 'YYYY-MM-DD'.
 */
import type { Cents } from '../money';

export interface SpendTxn {
  amount: Cents;
  category: string;
  dateISO: string;
  vendor?: string;
}

/** 'YYYY-MM' bucket for a date. */
export function monthKeyOf(dateISO: string): string {
  return dateISO.slice(0, 7);
}

/** 'YYYY' bucket for a date. */
export function yearKeyOf(dateISO: string): string {
  return dateISO.slice(0, 4);
}

export function totalSpend(txns: SpendTxn[]): Cents {
  return txns.reduce((sum, t) => sum + t.amount, 0);
}

export interface CategoryTotal {
  category: string;
  total: Cents;
}

/** Total per category, largest first (ties broken alphabetically for stability). */
export function spendByCategory(txns: SpendTxn[]): CategoryTotal[] {
  const map = new Map<string, Cents>();
  for (const t of txns) {
    map.set(t.category, (map.get(t.category) ?? 0) + t.amount);
  }
  return [...map.entries()]
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total || (a.category < b.category ? -1 : 1));
}

export interface MonthTotal {
  month: string; // 'YYYY-MM'
  total: Cents;
}

/** Total per month, chronological. */
export function spendByMonth(txns: SpendTxn[]): MonthTotal[] {
  const map = new Map<string, Cents>();
  for (const t of txns) {
    const m = monthKeyOf(t.dateISO);
    map.set(m, (map.get(m) ?? 0) + t.amount);
  }
  return [...map.entries()]
    .map(([month, total]) => ({ month, total }))
    .sort((a, b) => (a.month < b.month ? -1 : a.month > b.month ? 1 : 0));
}

/** The 'YYYY-MM' immediately before the given one. */
export function previousMonth(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  const idx = y! * 12 + (m! - 1) - 1;
  const ny = Math.floor(idx / 12);
  const nm = (idx % 12) + 1;
  return `${ny.toString().padStart(4, '0')}-${nm.toString().padStart(2, '0')}`;
}

export interface PeriodComparison {
  current: Cents;
  previous: Cents;
  delta: Cents;
  /** Percentage change vs previous; null when previous is 0 (undefined change). */
  deltaPct: number | null;
}

/** Month-over-month comparison for a given 'YYYY-MM'. */
export function monthOverMonth(txns: SpendTxn[], monthKey: string): PeriodComparison {
  const inMonth = (m: string) =>
    txns.filter((t) => monthKeyOf(t.dateISO) === m).reduce((s, t) => s + t.amount, 0);
  const current = inMonth(monthKey);
  const previous = inMonth(previousMonth(monthKey));
  const delta = current - previous;
  return { current, previous, delta, deltaPct: previous > 0 ? (delta / previous) * 100 : null };
}

/** Year-over-year comparison for a given 'YYYY'. */
export function yearOverYear(txns: SpendTxn[], yearKey: string): PeriodComparison {
  const inYear = (y: string) =>
    txns.filter((t) => yearKeyOf(t.dateISO) === y).reduce((s, t) => s + t.amount, 0);
  const current = inYear(yearKey);
  const prevYear = (Number(yearKey) - 1).toString();
  const previous = inYear(prevYear);
  const delta = current - previous;
  return { current, previous, delta, deltaPct: previous > 0 ? (delta / previous) * 100 : null };
}

/**
 * Heuristic spend category from a vendor/merchant name. The ledger stores the
 * document category (all receipts share one), which isn't useful for a spend
 * breakdown — so we derive a everyday-spending bucket from the vendor. First
 * keyword match wins; order matters (more specific buckets first).
 */
const SPEND_CATEGORY_RULES: { category: string; keywords: string[] }[] = [
  { category: 'Fuel', keywords: ['shell', 'chevron', 'exxon', 'bp', 'texaco', 'gas', 'fuel', 'petrol'] },
  { category: 'Dining', keywords: ['coffee', 'cafe', 'caffe', 'restaurant', 'pizza', 'bottle', 'starbucks', 'mcdonald', 'grill', 'kitchen', 'diner', 'bar ', 'bakery', 'deli'] },
  { category: 'Groceries', keywords: ['trader joe', 'whole foods', 'safeway', 'kroger', 'aldi', 'costco', 'grocery', 'mart', 'market', 'foods'] },
  { category: 'Transport', keywords: ['uber', 'lyft', 'transit', 'parking', 'metro', 'toll', 'airline', 'airlines', 'flight'] },
  { category: 'Utilities', keywords: ['electric', 'water', 'internet', 'comcast', 'at&t', 'verizon', 'utility', 'power', 'energy'] },
  { category: 'Shopping', keywords: ['amazon', 'target', 'walmart', 'best buy', 'store', 'mall', 'shop', 'ikea'] },
];

export function classifySpendCategory(vendor: string | null | undefined): string {
  const v = (vendor ?? '').toLowerCase();
  if (!v.trim()) {
    return 'Other';
  }
  for (const rule of SPEND_CATEGORY_RULES) {
    if (rule.keywords.some((k) => v.includes(k))) {
      return rule.category;
    }
  }
  return 'Other';
}
