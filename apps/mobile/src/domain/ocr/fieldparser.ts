/**
 * OCR field parsing (Feature 1). Two responsibilities:
 *
 *  1. Map a commercial receipt-parser (Veryfi-class) structured response onto our
 *     Bills & Receipts fields — the "buy" side of buy-not-build.
 *  2. Heuristic extraction from raw OCR text for the categories no vendor sells a
 *     structured parser for (warranty cards, loyalty/gift cards) and as the
 *     on-device free-tier fallback for receipts.
 *
 * Everything here is pure and deterministic so the messy-but-critical parsing
 * rules can be pinned down with tests. Extraction is best-effort by nature; the
 * capture review screen lets the user correct every field regardless.
 */
import type { Cents } from '../money';

export type DocumentCategory = 'bills_receipts' | 'warranty' | 'loyalty' | 'other';

/**
 * Parse a currency amount string into integer cents, tolerating currency
 * symbols, thousands separators, and both US (1,234.56) and EU (1.234,56)
 * decimal conventions. Returns null when no numeric value is present.
 */
export function parseAmountToCents(raw: string): Cents | null {
  const cleaned = raw.replace(/[^\d.,-]/g, '');
  if (!/\d/.test(cleaned)) {
    return null;
  }

  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');
  let decimalSep: ',' | '.' | null = null;

  if (lastComma !== -1 && lastDot !== -1) {
    decimalSep = lastComma > lastDot ? ',' : '.';
  } else if (lastComma !== -1) {
    // Comma only: treat as decimal separator only when exactly two digits
    // follow it (e.g. "12,34"); otherwise it's a thousands separator ("1,234").
    decimalSep = cleaned.length - lastComma - 1 === 2 ? ',' : null;
  } else if (lastDot !== -1) {
    decimalSep = '.';
  }

  let normalized: string;
  if (decimalSep) {
    const thousandsSep = decimalSep === ',' ? '.' : ',';
    normalized = cleaned.split(thousandsSep).join('').replace(decimalSep, '.');
  } else {
    normalized = cleaned.replace(/[.,]/g, '');
  }

  const value = Number(normalized);
  if (!Number.isFinite(value)) {
    return null;
  }
  return Math.round(value * 100);
}

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9,
  september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};

function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function toISO(y: number, m: number, d: number): string | null {
  if (y < 1000 || m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) {
    return null;
  }
  return `${y.toString().padStart(4, '0')}-${m.toString().padStart(2, '0')}-${d
    .toString()
    .padStart(2, '0')}`;
}

function expandYear(y: number): number {
  return y < 100 ? 2000 + y : y;
}

/**
 * Find the first parseable date in free text and return it as ISO 'YYYY-MM-DD'.
 * Tries unambiguous formats first (ISO, month-name), then numeric formats. For
 * ambiguous numeric dates it assumes month-first (US) unless the first field is
 * clearly a day (> 12), matching the app's initial US-market focus.
 */
export function findFirstDate(text: string, monthFirst = true): string | null {
  const iso = /(\d{4})-(\d{1,2})-(\d{1,2})/.exec(text);
  if (iso) {
    const result = toISO(Number(iso[1]), Number(iso[2]), Number(iso[3]));
    if (result) {
      return result;
    }
  }

  // "Jan 2, 2024" / "January 2 2024"
  const mdy = /([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{2,4})/.exec(text);
  if (mdy) {
    const month = MONTHS[mdy[1]!.toLowerCase()];
    if (month) {
      const result = toISO(expandYear(Number(mdy[3])), month, Number(mdy[2]));
      if (result) {
        return result;
      }
    }
  }

  // "2 Jan 2024"
  const dmy = /(\d{1,2})\s+([A-Za-z]{3,9})\.?\s+(\d{2,4})/.exec(text);
  if (dmy) {
    const month = MONTHS[dmy[2]!.toLowerCase()];
    if (month) {
      const result = toISO(expandYear(Number(dmy[3])), month, Number(dmy[1]));
      if (result) {
        return result;
      }
    }
  }

  // Numeric with / or - separators.
  const numeric = /(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/.exec(text);
  if (numeric) {
    const a = Number(numeric[1]);
    const b = Number(numeric[2]);
    const year = expandYear(Number(numeric[3]));
    let month: number;
    let day: number;
    if (a > 12 && b <= 12) {
      day = a;
      month = b;
    } else if (monthFirst) {
      month = a;
      day = b;
    } else {
      day = a;
      month = b;
    }
    const result = toISO(year, month, day);
    if (result) {
      return result;
    }
  }

  return null;
}

function amountsInLine(line: string): Cents[] {
  const matches = line.match(/-?[$€£₹]?\s?\d[\d.,]*\d|\d/g) ?? [];
  const out: Cents[] = [];
  for (const m of matches) {
    const c = parseAmountToCents(m);
    if (c !== null) {
      out.push(c);
    }
  }
  return out;
}

export interface ReceiptFields {
  vendor: string | null;
  totalCents: Cents | null;
  taxCents: Cents | null;
  dateISO: string | null;
}

/**
 * Best-effort extraction of Bills & Receipts fields from raw OCR text (on-device
 * free-tier fallback). The total prefers an explicit "grand/amount/balance due"
 * or "total" line (never "subtotal"); tax prefers a "tax/GST/VAT" line; vendor
 * guesses the first meaningful line. Any field may be null.
 */
export function extractReceiptFields(text: string): ReceiptFields {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  let total: Cents | null = null;
  let totalPriority = -1;
  let tax: Cents | null = null;

  for (const line of lines) {
    const lower = line.toLowerCase();

    const isSubtotal = /sub[\s-]?total/.test(lower);
    if (/\btotal\b/.test(lower) && !isSubtotal) {
      const amounts = amountsInLine(line);
      if (amounts.length > 0) {
        const priority = /grand total|total due|balance due|amount due/.test(lower) ? 2 : 1;
        if (priority >= totalPriority) {
          total = amounts[amounts.length - 1]!;
          totalPriority = priority;
        }
      }
    }

    if (/\b(tax|gst|vat|hst)\b/.test(lower)) {
      const amounts = amountsInLine(line);
      if (amounts.length > 0) {
        tax = amounts[amounts.length - 1]!;
      }
    }
  }

  // Fallback: if no explicit total line, use the largest amount seen anywhere.
  if (total === null) {
    let max: Cents | null = null;
    for (const line of lines) {
      for (const amt of amountsInLine(line)) {
        if (max === null || amt > max) {
          max = amt;
        }
      }
    }
    total = max;
  }

  const vendor = guessVendor(lines);
  const dateISO = findFirstDate(text);

  return { vendor, totalCents: total, taxCents: tax, dateISO };
}

function guessVendor(lines: string[]): string | null {
  for (const line of lines) {
    const lower = line.toLowerCase();
    const looksLikeAmountOrDate =
      /^\s*[$€£₹]?\s?\d[\d.,]*\s*$/.test(line) || findFirstDate(line) !== null;
    const isKeyword = /\b(total|subtotal|tax|gst|vat|receipt|invoice|cash|change|card)\b/.test(
      lower,
    );
    const hasLetters = /[a-z]/i.test(line);
    if (hasLetters && !looksLikeAmountOrDate && !isKeyword) {
      return line;
    }
  }
  return null;
}

/** Luhn checksum validation (used to confirm a 15-digit IMEI). */
export function luhnValid(digits: string): boolean {
  if (!/^\d+$/.test(digits)) {
    return false;
  }
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (double) {
      d *= 2;
      if (d > 9) {
        d -= 9;
      }
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

/** Find the first Luhn-valid 15-digit IMEI in text, ignoring spaces/dashes. */
export function detectImei(text: string): string | null {
  const candidates = text.match(/\b(?:\d[\s-]?){15}\b/g) ?? [];
  for (const candidate of candidates) {
    const digits = candidate.replace(/[\s-]/g, '');
    if (digits.length === 15 && luhnValid(digits)) {
      return digits;
    }
  }
  return null;
}

/** Find a serial number following a labeled "S/N" / "Serial" marker. */
export function detectSerial(text: string): string | null {
  const m = /(?:serial(?:\s*(?:no|number|#))?|s\/n)\s*[:#]?\s*([A-Z0-9-]{5,20})/i.exec(text);
  return m ? m[1]!.toUpperCase() : null;
}

/** Coarse auto-categorization from raw text (Feature 1 auto-categorize). */
export function guessCategory(text: string): DocumentCategory {
  const lower = text.toLowerCase();
  if (/\b(gift\s*card|loyalty|reward(s)?|points|miles|frequent\s*flyer|membership\s*(no|number))\b/.test(lower)) {
    return 'loyalty';
  }
  if (/\b(warranty|guarantee|imei|serial\s*(no|number)?)\b/.test(lower)) {
    return 'warranty';
  }
  if (/\b(receipt|invoice|subtotal|total|amount due|sales tax|gst|vat)\b/.test(lower)) {
    return 'bills_receipts';
  }
  return 'other';
}

// --- Commercial vendor mapping (buy side) -------------------------------------

/** Minimal shape of a Veryfi-style receipt response we depend on. */
export interface VeryfiReceiptResponse {
  vendor?: { name?: string | null } | null;
  total?: number | null;
  tax?: number | null;
  date?: string | null; // e.g. "2024-03-01 14:22:00"
  currency_code?: string | null;
}

export interface MappedReceipt {
  vendor: string | null;
  totalCents: Cents | null;
  taxCents: Cents | null;
  dateISO: string | null;
  currency: string | null;
}

/** Map a Veryfi-class structured response to our Bills & Receipts fields. */
export function mapVeryfiReceipt(res: VeryfiReceiptResponse): MappedReceipt {
  const toCentsOrNull = (n: number | null | undefined): Cents | null =>
    n == null || !Number.isFinite(n) ? null : Math.round(n * 100);

  return {
    vendor: res.vendor?.name?.trim() || null,
    totalCents: toCentsOrNull(res.total),
    taxCents: toCentsOrNull(res.tax),
    dateISO: res.date ? findFirstDate(res.date) : null,
    currency: res.currency_code?.trim() || null,
  };
}
