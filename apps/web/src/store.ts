/**
 * Web-preview data store. This is a lightweight in-browser stand-in for the
 * app's WatermelonDB layer (no SQLite in the browser), but the interesting logic
 * — the duplicate fuzzy key and duplicate detection — is imported straight from
 * the app's real, tested domain layer (@domain). So the preview isn't faking the
 * behaviour; it runs the same code.
 */
import { buildFuzzyKey, isLikelyDuplicatePurchase } from '@domain/dedup/fuzzy';
import type { DocumentCategory } from '@domain/ocr/fieldparser';
import type { SplitType } from '@domain/splitting';

export type OcrMode = 'on_device' | 'cloud' | 'manual';

export type DocDetails = Record<string, string | number | null>;

export interface WebDocument {
  id: string;
  createdAt: number;
  category: DocumentCategory;
  vendor: string | null;
  totalCents: number | null;
  taxCents: number | null;
  currency: string;
  dateISO: string | null;
  imageDataUrl: string | null;
  ocrMode: OcrMode;
  rawText: string;
  fuzzyDupKey: string | null;
  /** Display name for non-receipt categories (product / issuer). */
  label: string | null;
  /** Category-specific fields (warranty identifier/duration, loyalty balance…). */
  details: DocDetails;
}

export interface WebTransaction {
  id: string;
  documentId: string;
  amount: number;
  vendor: string;
  dateISO: string;
}

export interface CreateDocInput {
  category: DocumentCategory;
  vendor: string | null;
  totalCents: number | null;
  taxCents: number | null;
  currency: string;
  dateISO: string | null;
  imageDataUrl: string | null;
  ocrMode: OcrMode;
  rawText: string;
  label?: string | null;
  details?: DocDetails;
}

export interface WebBudget {
  id: string;
  category: string;
  period: 'monthly' | 'yearly';
  limitCents: number;
  alertThresholdPct: number;
}

export interface WebGroupMember {
  id: string;
  name: string;
  venmo?: string;
}

export interface ExpensePayer {
  userId: string;
  cents: number;
}

export interface WebExpense {
  id: string;
  groupId: string;
  description: string;
  category: string;
  dateISO: string;
  notes?: string;
  /** Who fronted the money (one or many payers). */
  payers: ExpensePayer[];
  /** Which members share this expense. */
  involvedIds: string[];
  totalCents: number;
  splitType: SplitType;
  allocations: { userId: string; cents: number }[];
  sourceDocumentId?: string | null;
  createdAt: number;
}

export interface WebGroup {
  id: string;
  name: string;
  type: 'trip' | 'household' | 'event' | 'other';
  members: WebGroupMember[];
}

export interface WebSettlement {
  id: string;
  groupId: string;
  fromUser: string;
  toUser: string;
  amount: number;
  note?: string;
  createdAt: number;
}

/** Expense categories, Splitwise-style, with a simple emoji per category. */
export const EXPENSE_CATEGORIES: { key: string; icon: string }[] = [
  { key: 'General', icon: '🧾' },
  { key: 'Food & drink', icon: '🍽️' },
  { key: 'Groceries', icon: '🛒' },
  { key: 'Travel', icon: '✈️' },
  { key: 'Lodging', icon: '🏠' },
  { key: 'Transport', icon: '🚗' },
  { key: 'Entertainment', icon: '🎉' },
  { key: 'Utilities', icon: '💡' },
  { key: 'Shopping', icon: '🛍️' },
];

export function categoryIcon(key: string): string {
  return EXPENSE_CATEGORIES.find((c) => c.key === key)?.icon ?? '🧾';
}

export interface PersistedState {
  documents: WebDocument[];
  transactions: WebTransaction[];
  budgets: WebBudget[];
  groups: WebGroup[];
  expenses: WebExpense[];
  settlements: WebSettlement[];
}

const STORAGE_KEY = 'document-tracker-preview-v1';

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

function isReceipt(input: { category: DocumentCategory }): boolean {
  return input.category === 'bills_receipts';
}

/** Build a document (+ ledger transaction when it's a completed receipt). */
export function buildDocument(input: CreateDocInput): {
  doc: WebDocument;
  txn: WebTransaction | null;
} {
  const id = newId();
  const receipt = isReceipt(input);
  const fuzzyDupKey =
    receipt && input.vendor && input.dateISO && input.totalCents != null
      ? buildFuzzyKey(input.vendor, input.dateISO, input.totalCents)
      : null;

  const doc: WebDocument = {
    id,
    createdAt: Date.now(),
    ...input,
    label: input.label ?? null,
    details: input.details ?? {},
    fuzzyDupKey,
  };

  let txn: WebTransaction | null = null;
  if (receipt && input.totalCents != null && input.vendor && input.dateISO) {
    txn = {
      id: newId(),
      documentId: id,
      amount: input.totalCents,
      vendor: input.vendor,
      dateISO: input.dateISO,
    };
  }
  return { doc, txn };
}

/** Advisory same-purchase duplicate check, using the real domain matcher. */
export function findDuplicates(input: CreateDocInput, docs: WebDocument[]): WebDocument[] {
  if (!(isReceipt(input) && input.vendor && input.dateISO && input.totalCents != null)) {
    return [];
  }
  const hits: WebDocument[] = [];
  for (const d of docs) {
    if (!d.fuzzyDupKey) {
      continue;
    }
    const [vendor, dateISO, amount] = d.fuzzyDupKey.split('|');
    const verdict = isLikelyDuplicatePurchase(
      { vendor: input.vendor, dateISO: input.dateISO, amount: input.totalCents },
      { vendor: vendor ?? '', dateISO: dateISO ?? '', amount: Number(amount ?? 0) },
    );
    if (verdict.isLikely) {
      hits.push(d);
    }
  }
  return hits;
}

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Coerce a persisted expense (possibly from an older app version) into the
 * current shape. Critically, older expenses stored a single `payerId` instead
 * of a `payers` array — reading `.payers` on those threw and blanked the page,
 * so we derive it here. Everything else is backfilled with safe defaults.
 */
function migrateExpense(e: any, i: number): WebExpense {
  const totalCents = Number(e?.totalCents) || 0;
  const allocations = Array.isArray(e?.allocations)
    ? e.allocations.map((a: any) => ({ userId: String(a?.userId), cents: Number(a?.cents) || 0 }))
    : [];
  const payers =
    Array.isArray(e?.payers) && e.payers.length > 0
      ? e.payers.map((p: any) => ({ userId: String(p?.userId), cents: Number(p?.cents) || 0 }))
      : e?.payerId
      ? [{ userId: String(e.payerId), cents: totalCents }]
      : [];
  const involvedIds =
    Array.isArray(e?.involvedIds) && e.involvedIds.length > 0
      ? e.involvedIds.map(String)
      : allocations.map((a: { userId: string }) => a.userId);
  return {
    id: String(e?.id ?? `mig-e-${i}`),
    groupId: String(e?.groupId ?? ''),
    description: String(e?.description ?? 'Expense'),
    category: String(e?.category ?? 'General'),
    dateISO: typeof e?.dateISO === 'string' ? e.dateISO : '',
    notes: e?.notes ? String(e.notes) : undefined,
    payers,
    involvedIds,
    totalCents,
    splitType: e?.splitType ?? 'equal',
    allocations,
    sourceDocumentId: e?.sourceDocumentId ?? null,
    createdAt: Number(e?.createdAt) || Date.now() - i * 1000,
  };
}

function migrateSettlement(s: any, i: number): WebSettlement {
  return {
    id: String(s?.id ?? `mig-s-${i}`),
    groupId: String(s?.groupId ?? ''),
    fromUser: String(s?.fromUser ?? ''),
    toUser: String(s?.toUser ?? ''),
    amount: Number(s?.amount) || 0,
    note: s?.note ? String(s.note) : undefined,
    createdAt: Number(s?.createdAt) || Date.now() - i * 1000,
  };
}

function migrateDocument(d: any): WebDocument {
  return {
    ...d,
    pageImageUris: Array.isArray(d?.pageImageUris) ? d.pageImageUris : [],
    pageCloudKeys: Array.isArray(d?.pageCloudKeys) ? d.pageCloudKeys : [],
    phashPerPage: Array.isArray(d?.phashPerPage) ? d.phashPerPage : [],
    label: d?.label ?? null,
    details: d?.details && typeof d.details === 'object' ? d.details : {},
    category: d?.category ?? 'other',
  };
}

/** Normalize a raw parsed blob into a valid PersistedState (backward-compatible). */
function normalizeState(raw: any): PersistedState {
  return {
    documents: Array.isArray(raw?.documents) ? raw.documents.map(migrateDocument) : [],
    transactions: Array.isArray(raw?.transactions) ? raw.transactions : [],
    budgets: Array.isArray(raw?.budgets) ? raw.budgets : [],
    groups: Array.isArray(raw?.groups) ? raw.groups : [],
    expenses: Array.isArray(raw?.expenses) ? raw.expenses.map(migrateExpense) : [],
    settlements: Array.isArray(raw?.settlements) ? raw.settlements.map(migrateSettlement) : [],
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
    // Non-fatal in a preview (e.g. storage disabled).
  }
}
