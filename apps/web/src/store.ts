/**
 * Web-preview data store (v2) for the expense + splitting app.
 *
 * ONE unified `Expense` entity powers both the personal ledger (easy-expense)
 * and group splitting (Splitwise): a personal expense simply has groupId=null,
 * a single payer (ME) and a single allocation (ME owes the whole amount). A
 * shared expense has a groupId and a real multi-payer split. Scanned receipts
 * become Expenses directly (source='scan'), so the same object flows from the
 * AI scan straight into splitting.
 *
 * Money is integer paise. Split math / balances come from the tested domain
 * layer (@domain/splitting, @domain/settleup) — the preview runs the real code.
 */
import type { SplitType } from '@domain/splitting';
import type { SpendTxn } from '@domain/analytics/spend';
import { AVATAR_COLORS } from './theme';

export type { SplitType };

/** The signed-in user's own id inside every group's member list. */
export const ME = 'me';

export interface Member {
  id: string;
  name: string;
  /** UPI VPA (id@bank) for settle-up deep links. */
  upi?: string;
  color?: string;
}

export type GroupType = 'trip' | 'home' | 'couple' | 'friends' | 'other';

export interface Group {
  id: string;
  name: string;
  emoji?: string;
  type: GroupType;
  members: Member[];
  createdAt: number;
}

export interface Payment {
  userId: string;
  cents: number;
}

export interface Allocation {
  userId: string;
  cents: number;
}

export type ExpenseSource = 'scan' | 'manual';

export interface Expense {
  id: string;
  createdAt: number;
  /** Merchant / title. */
  description: string;
  amountCents: number;
  currency: string;
  dateISO: string;
  category: string;
  notes?: string;
  source: ExpenseSource;
  imageDataUrl?: string | null;
  rawText?: string | null;
  taxCents?: number | null;
  /** null => a personal expense; otherwise the group it is shared in. */
  groupId: string | null;
  /** Who paid, and how much (supports multiple payers). */
  paidBy: Payment[];
  /** Members who share this expense. */
  involvedIds: string[];
  splitType: SplitType;
  /** Who owes what — sums to amountCents (from @domain/splitting computeSplit). */
  allocations: Allocation[];
}

export interface Settlement {
  id: string;
  groupId: string;
  fromUser: string;
  toUser: string;
  amountCents: number;
  note?: string;
  createdAt: number;
}

export interface MileageTrip {
  id: string;
  dateISO: string;
  purpose: string;
  route: string;
  km: number;
  /** Reimbursement rate in paise per km (e.g. 1200 = ₹12/km). */
  ratePaisePerKm: number;
  createdAt: number;
}

export interface Budget {
  id: string;
  category: string;
  period: 'monthly' | 'yearly';
  limitCents: number;
  alertThresholdPct: number;
}

export interface WebUser {
  name: string;
  email: string;
}

/** Spend categories (aligned with @domain classifySpendCategory outputs) + tints. */
export const EXPENSE_CATEGORIES: { key: string; icon: string; color: string }[] = [
  { key: 'General', icon: '🧾', color: '#6B7C8F' },
  { key: 'Dining', icon: '🍽️', color: '#FF652F' },
  { key: 'Groceries', icon: '🛒', color: '#1CC29F' },
  { key: 'Transport', icon: '🚗', color: '#5B8DEF' },
  { key: 'Fuel', icon: '⛽', color: '#F5A623' },
  { key: 'Rent', icon: '🏠', color: '#9B59F6' },
  { key: 'Bills', icon: '💳', color: '#EF5DA8' },
  { key: 'Utilities', icon: '💡', color: '#F5A623' },
  { key: 'Entertainment', icon: '🎬', color: '#9B59F6' },
  { key: 'Shopping', icon: '🛍️', color: '#EF5DA8' },
  { key: 'Travel', icon: '✈️', color: '#5B8DEF' },
  { key: 'Health', icon: '🩺', color: '#2DBFA8' },
  { key: 'Other', icon: '📦', color: '#9AA8B4' },
];

export function categoryIcon(key: string): string {
  return EXPENSE_CATEGORIES.find((c) => c.key === key)?.icon ?? '🧾';
}

export function categoryColor(key: string): string {
  return EXPENSE_CATEGORIES.find((c) => c.key === key)?.color ?? '#6B7C8F';
}

/** Stable friendly color for a member/name. */
export function colorForId(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length]!;
}

/** The current user's own share of an expense (0 if not involved). */
export function myShareCents(e: Expense): number {
  return e.allocations.find((a) => a.userId === ME)?.cents ?? 0;
}

/** Net the current user is owed (+) or owes (−) for one expense. */
export function myNetForExpense(e: Expense): number {
  const paid = e.paidBy.filter((p) => p.userId === ME).reduce((s, p) => s + p.cents, 0);
  return paid - myShareCents(e);
}

/** Map an expense to a SpendTxn for analytics, using the current user's own share. */
export function expenseToSpendTxn(e: Expense): SpendTxn {
  return { amount: myShareCents(e), category: e.category, dateISO: e.dateISO, vendor: e.description };
}

export interface PersistedState {
  expenses: Expense[];
  groups: Group[];
  settlements: Settlement[];
  mileage: MileageTrip[];
  budgets: Budget[];
}

const STORAGE_KEY = 'expense-split-app-v2';
const USER_KEY = 'expense-split-user-v1';

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

export function emptyState(): PersistedState {
  return { expenses: [], groups: [], settlements: [], mileage: [], budgets: [] };
}

/* eslint-disable @typescript-eslint/no-explicit-any */

function migrateExpense(e: any, i: number): Expense {
  const amountCents = Number(e?.amountCents) || 0;
  const allocations: Allocation[] = Array.isArray(e?.allocations)
    ? e.allocations.map((a: any) => ({ userId: String(a?.userId), cents: Number(a?.cents) || 0 }))
    : [{ userId: ME, cents: amountCents }];
  const paidBy: Payment[] = Array.isArray(e?.paidBy) && e.paidBy.length > 0
    ? e.paidBy.map((p: any) => ({ userId: String(p?.userId), cents: Number(p?.cents) || 0 }))
    : [{ userId: ME, cents: amountCents }];
  const involvedIds: string[] = Array.isArray(e?.involvedIds) && e.involvedIds.length > 0
    ? e.involvedIds.map(String)
    : allocations.map((a) => a.userId);
  return {
    id: String(e?.id ?? `mig-${i}`),
    createdAt: Number(e?.createdAt) || Date.now() - i * 1000,
    description: String(e?.description ?? 'Expense'),
    amountCents,
    currency: String(e?.currency ?? 'INR'),
    dateISO: typeof e?.dateISO === 'string' ? e.dateISO : new Date().toISOString().slice(0, 10),
    category: String(e?.category ?? 'General'),
    notes: e?.notes ? String(e.notes) : undefined,
    source: e?.source === 'scan' ? 'scan' : 'manual',
    imageDataUrl: e?.imageDataUrl ?? null,
    rawText: e?.rawText ?? null,
    taxCents: e?.taxCents != null ? Number(e.taxCents) : null,
    groupId: e?.groupId ?? null,
    paidBy,
    involvedIds,
    splitType: e?.splitType ?? 'equal',
    allocations,
  };
}

function normalizeState(raw: any): PersistedState {
  return {
    expenses: Array.isArray(raw?.expenses) ? raw.expenses.map(migrateExpense) : [],
    groups: Array.isArray(raw?.groups) ? raw.groups : [],
    settlements: Array.isArray(raw?.settlements) ? raw.settlements : [],
    mileage: Array.isArray(raw?.mileage) ? raw.mileage : [],
    budgets: Array.isArray(raw?.budgets) ? raw.budgets : [],
  };
}

export function loadState(): PersistedState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? normalizeState(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function saveState(state: PersistedState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* non-fatal in preview */
  }
}

export function loadUser(): WebUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    const u = JSON.parse(raw);
    return u && typeof u.email === 'string' ? { name: String(u.name ?? ''), email: String(u.email) } : null;
  } catch {
    return null;
  }
}

export function saveUser(user: WebUser | null): void {
  try {
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_KEY);
  } catch {
    /* ignore */
  }
}
