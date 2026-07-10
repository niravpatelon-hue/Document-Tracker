/**
 * Web-preview data store. This is a lightweight in-browser stand-in for the
 * app's WatermelonDB layer (no SQLite in the browser), but the interesting logic
 * — the duplicate fuzzy key and duplicate detection — is imported straight from
 * the app's real, tested domain layer (@domain). So the preview isn't faking the
 * behaviour; it runs the same code.
 */
import { buildFuzzyKey, isLikelyDuplicatePurchase } from '@domain/dedup/fuzzy';
import type { DocumentCategory } from '@domain/ocr/fieldparser';

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

export interface PersistedState {
  documents: WebDocument[];
  transactions: WebTransaction[];
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

export function loadState(): PersistedState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PersistedState) : null;
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
