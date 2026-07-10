/**
 * GST (Goods & Services Tax) computations for the India business layer.
 *
 * All monetary amounts are integer paise (minor units, ×100), identical to the
 * "cents" convention used elsewhere in the domain. Rounding is always via
 * Math.round so tax splits stay reproducible and float drift never enters the
 * ledger.
 */

/** Coerce a value to a finite, non-negative number (defaulting bad input to 0). */
function safeAmount(n: number): number {
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** GST payable on a taxable (net) amount at the given rate percentage. */
export function gstOnAmount(netPaise: number, ratePct: number): number {
  const net = safeAmount(netPaise);
  const rate = Number.isFinite(ratePct) && ratePct > 0 ? ratePct : 0;
  return Math.round((net * rate) / 100);
}

/** Gross (tax-inclusive) amount from a net amount at the given rate. */
export function grossFromNet(netPaise: number, ratePct: number): number {
  const net = safeAmount(netPaise);
  return net + gstOnAmount(net, ratePct);
}

/**
 * Decompose a gross (tax-inclusive) amount into its net and GST components.
 * net = round(gross / (1 + rate/100)); gst = gross - net so the parts always
 * re-add to the original gross exactly.
 */
export function netFromGross(
  grossPaise: number,
  ratePct: number,
): { netCents: number; gstCents: number } {
  const gross = safeAmount(grossPaise);
  const rate = Number.isFinite(ratePct) && ratePct > 0 ? ratePct : 0;
  const netCents = Math.round(gross / (1 + rate / 100));
  const gstCents = gross - netCents;
  return { netCents, gstCents };
}

export interface GstEntry {
  direction: 'input' | 'output';
  taxableCents: number;
  taxRatePct: number;
  /** Optional pre-computed GST; when omitted it is derived from taxable × rate. */
  gstCents?: number;
}

export interface GstSummary {
  outputGstCents: number;
  inputGstCents: number;
  /** output − input. Negative means net input-tax-credit (ITC) carried forward. */
  netPayableCents: number;
  byRate: { rate: number; taxableCents: number; gstCents: number }[];
}

/**
 * Aggregate a mixed set of input (purchases) and output (sales) GST entries.
 * netPayable = outputGst − inputGst (may be negative = ITC credit). byRate
 * groups the OUTPUT taxable/GST by rate (ascending), which is what invoice-style
 * summaries display.
 */
export function summarizeGst(entries: GstEntry[]): GstSummary {
  let outputGstCents = 0;
  let inputGstCents = 0;
  const byRateMap = new Map<number, { taxableCents: number; gstCents: number }>();

  for (const e of entries) {
    const taxable = safeAmount(e.taxableCents);
    const rate = Number.isFinite(e.taxRatePct) && e.taxRatePct > 0 ? e.taxRatePct : 0;
    const gst =
      e.gstCents !== undefined && Number.isFinite(e.gstCents)
        ? Math.round(e.gstCents)
        : gstOnAmount(taxable, rate);

    if (e.direction === 'output') {
      outputGstCents += gst;
      const bucket = byRateMap.get(rate) ?? { taxableCents: 0, gstCents: 0 };
      bucket.taxableCents += taxable;
      bucket.gstCents += gst;
      byRateMap.set(rate, bucket);
    } else {
      inputGstCents += gst;
    }
  }

  const byRate = [...byRateMap.entries()]
    .map(([rate, v]) => ({ rate, taxableCents: v.taxableCents, gstCents: v.gstCents }))
    .sort((a, b) => a.rate - b.rate);

  return {
    outputGstCents,
    inputGstCents,
    netPayableCents: outputGstCents - inputGstCents,
    byRate,
  };
}
