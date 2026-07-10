/**
 * "AI receipt parse" layer for the web preview.
 *
 * Turns raw scanned/extracted OCR text into a structured expense prefill with a
 * confidence score, by composing the tested on-device domain engine:
 *   - extractReceiptFields  -> vendor / total / tax / date heuristics
 *   - classifySpendCategory -> everyday-spending bucket from the merchant name
 *   - parseAmountToCents    -> tolerant currency-string -> paise
 *
 * Everything here is pure and defensive: it never throws and returns nulls for
 * anything it can't confidently read. The capture-review screen lets the user
 * correct every field afterwards.
 */
import {
  extractReceiptFields,
  parseAmountToCents,
  findFirstDate,
} from '@domain/ocr/fieldparser';
import { classifySpendCategory } from '@domain/analytics/spend';
import { EXPENSE_CATEGORIES } from './store';

export interface ParsedReceipt {
  merchant: string | null;
  amountCents: number | null;
  taxCents: number | null;
  dateISO: string | null;
  category: string;
  confidence: number;
  lineItems: { name: string; amountCents: number }[];
}

const CATEGORY_KEYS = new Set(EXPENSE_CATEGORIES.map((c) => c.key));

/**
 * Map a free-form spend category (as returned by classifySpendCategory) onto a
 * concrete EXPENSE_CATEGORIES key, falling back to 'General' when there is no
 * exact match.
 */
function toExpenseCategory(raw: string | null | undefined): string {
  if (raw && CATEGORY_KEYS.has(raw)) {
    return raw;
  }
  return 'General';
}

/** Lines that describe a running/summary total rather than a purchased item. */
const SUMMARY_LINE = /\b(sub[\s-]?total|total|tax|gst|vat|hst|amount due|balance due|change|cash|card|tip|round\s*off|discount|savings)\b/i;

/**
 * Best-effort line-item extraction: a line qualifies when it has some
 * letters (a name) and ends with a parseable amount, and is not a
 * total/subtotal/tax/gst-style summary line.
 */
function extractLineItems(lines: string[]): { name: string; amountCents: number }[] {
  const items: { name: string; amountCents: number }[] = [];

  for (const line of lines) {
    if (SUMMARY_LINE.test(line)) {
      continue;
    }

    // Trailing amount token: optional currency sign, digits with , . separators.
    const match = /([-]?[$€£₹]?\s?\d[\d.,]*\d|\d)\s*$/.exec(line);
    if (!match) {
      continue;
    }

    const amountCents = parseAmountToCents(match[1]!);
    if (amountCents === null) {
      continue;
    }

    const name = line.slice(0, match.index).replace(/[.\s:·•\-]+$/, '').trim();
    // Require an actual name with letters (skip bare numbers / date rows).
    if (!/[a-z]/i.test(name)) {
      continue;
    }

    items.push({ name, amountCents });
  }

  return items;
}

/**
 * Parse raw OCR text into a structured receipt prefill. Pure and defensive:
 * any unreadable field comes back null, and the function never throws.
 */
export function parseReceiptText(text: string): ParsedReceipt {
  const empty: ParsedReceipt = {
    merchant: null,
    amountCents: null,
    taxCents: null,
    dateISO: null,
    category: 'General',
    confidence: 0,
    lineItems: [],
  };

  if (typeof text !== 'string' || text.trim().length === 0) {
    return empty;
  }

  let fields;
  try {
    fields = extractReceiptFields(text);
  } catch {
    return empty;
  }

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const firstLine = lines.length > 0 ? lines[0]! : null;
  const merchant = fields.vendor ?? null;

  let category = 'General';
  try {
    category = toExpenseCategory(classifySpendCategory(merchant ?? firstLine));
  } catch {
    category = 'General';
  }

  let lineItems: { name: string; amountCents: number }[] = [];
  try {
    lineItems = extractLineItems(lines);
  } catch {
    lineItems = [];
  }

  // Prefer the extracted date; fall back to a direct scan of the raw text.
  let dateISO = fields.dateISO ?? null;
  if (dateISO === null) {
    try {
      dateISO = findFirstDate(text);
    } catch {
      dateISO = null;
    }
  }

  // Confidence weighted by presence of the key fields.
  let confidence = 0;
  if (fields.totalCents !== null) confidence += 0.5;
  if (dateISO !== null) confidence += 0.3;
  if (merchant !== null) confidence += 0.2;
  confidence = Math.max(0, Math.min(1, confidence));

  return {
    merchant,
    amountCents: fields.totalCents ?? null,
    taxCents: fields.taxCents ?? null,
    dateISO,
    category,
    confidence,
    lineItems,
  };
}
