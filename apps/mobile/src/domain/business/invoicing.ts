/**
 * Invoice totalling and receivables logic for the India business layer.
 *
 * All monetary amounts are integer paise. Tax is computed per line via
 * Math.round so a multi-rate invoice's subtotal + tax always equals its total.
 * Dates are ISO 'YYYY-MM-DD' strings compared lexicographically (which is
 * chronologically correct for that fixed-width format).
 */

import { gstOnAmount } from './gst';

export interface InvoiceLine {
  qty: number;
  rateCents: number;
  taxRatePct: number;
}

export interface InvoiceTotals {
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  byRate: { rate: number; taxableCents: number; taxCents: number }[];
}

function safe(n: number): number {
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Sum invoice lines into a subtotal (pre-tax), tax, and total, plus a per-rate
 * breakdown (ascending by rate). Each line's taxable = round(qty × rate); tax is
 * computed on that taxable amount, so subtotal + tax === total exactly.
 */
export function computeInvoiceTotals(items: InvoiceLine[]): InvoiceTotals {
  let subtotalCents = 0;
  let taxCents = 0;
  const byRateMap = new Map<number, { taxableCents: number; taxCents: number }>();

  for (const it of items) {
    const qty = safe(it.qty);
    const rate = safe(it.rateCents);
    const taxRate =
      Number.isFinite(it.taxRatePct) && it.taxRatePct > 0 ? it.taxRatePct : 0;

    const lineTaxable = Math.round(qty * rate);
    const lineTax = gstOnAmount(lineTaxable, taxRate);

    subtotalCents += lineTaxable;
    taxCents += lineTax;

    const bucket = byRateMap.get(taxRate) ?? { taxableCents: 0, taxCents: 0 };
    bucket.taxableCents += lineTaxable;
    bucket.taxCents += lineTax;
    byRateMap.set(taxRate, bucket);
  }

  const byRate = [...byRateMap.entries()]
    .map(([rate, v]) => ({ rate, taxableCents: v.taxableCents, taxCents: v.taxCents }))
    .sort((a, b) => a.rate - b.rate);

  return {
    subtotalCents,
    taxCents,
    totalCents: subtotalCents + taxCents,
    byRate,
  };
}

/**
 * Resolve the effective status of an invoice as of todayISO. A 'sent' invoice
 * whose due date has passed (todayISO > dueDateISO) becomes 'overdue'. 'paid'
 * and 'draft' are always left untouched; anything unrecognised falls back to
 * 'draft'.
 */
export function effectiveStatus(
  inv: { status: string; dueDateISO: string },
  todayISO: string,
): 'draft' | 'sent' | 'paid' | 'overdue' {
  if (inv.status === 'paid') return 'paid';
  if (inv.status === 'draft') return 'draft';
  if (inv.status === 'sent') {
    return todayISO > inv.dueDateISO ? 'overdue' : 'sent';
  }
  if (inv.status === 'overdue') return 'overdue';
  return 'draft';
}

export interface Receivables {
  outstandingCents: number;
  overdueCents: number;
  paidCents: number;
  draftCents: number;
}

/**
 * Bucket a set of invoices into receivables totals as of todayISO.
 *   outstanding = totals of everything currently sent OR overdue
 *   overdue     = totals of sent invoices past their due date
 *   paid        = totals of paid invoices
 *   draft       = totals of draft invoices
 */
export function receivablesSummary(
  invoices: { status: string; dueDateISO: string; items: InvoiceLine[] }[],
  todayISO: string,
): Receivables {
  let outstandingCents = 0;
  let overdueCents = 0;
  let paidCents = 0;
  let draftCents = 0;

  for (const inv of invoices) {
    const total = computeInvoiceTotals(inv.items).totalCents;
    const eff = effectiveStatus(inv, todayISO);

    switch (eff) {
      case 'overdue':
        outstandingCents += total;
        overdueCents += total;
        break;
      case 'sent':
        outstandingCents += total;
        break;
      case 'paid':
        paidCents += total;
        break;
      case 'draft':
        draftCents += total;
        break;
    }
  }

  return { outstandingCents, overdueCents, paidCents, draftCents };
}
