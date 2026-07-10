import {
  computeInvoiceTotals,
  effectiveStatus,
  receivablesSummary,
} from './invoicing';

describe('computeInvoiceTotals', () => {
  it('sums a multi-line, multi-rate invoice with subtotal + tax === total', () => {
    const t = computeInvoiceTotals([
      { qty: 2, rateCents: 100000, taxRatePct: 18 }, // taxable 200000, tax 36000
      { qty: 1, rateCents: 50000, taxRatePct: 5 }, //  taxable  50000, tax  2500
      { qty: 3, rateCents: 10000, taxRatePct: 18 }, // taxable  30000, tax  5400
    ]);
    expect(t.subtotalCents).toBe(280000);
    expect(t.taxCents).toBe(43900);
    expect(t.totalCents).toBe(323900);
    expect(t.subtotalCents + t.taxCents).toBe(t.totalCents);
    expect(t.byRate).toEqual([
      { rate: 5, taxableCents: 50000, taxCents: 2500 },
      { rate: 18, taxableCents: 230000, taxCents: 41400 },
    ]);
  });

  it('handles an empty invoice', () => {
    expect(computeInvoiceTotals([])).toEqual({
      subtotalCents: 0,
      taxCents: 0,
      totalCents: 0,
      byRate: [],
    });
  });
});

describe('effectiveStatus', () => {
  const today = '2026-07-10';

  it('flips a past-due sent invoice to overdue', () => {
    expect(
      effectiveStatus({ status: 'sent', dueDateISO: '2026-07-01' }, today),
    ).toBe('overdue');
  });

  it('keeps a not-yet-due sent invoice as sent', () => {
    expect(
      effectiveStatus({ status: 'sent', dueDateISO: '2026-07-20' }, today),
    ).toBe('sent');
  });

  it('leaves paid and draft untouched even when past due', () => {
    expect(
      effectiveStatus({ status: 'paid', dueDateISO: '2026-01-01' }, today),
    ).toBe('paid');
    expect(
      effectiveStatus({ status: 'draft', dueDateISO: '2026-01-01' }, today),
    ).toBe('draft');
  });
});

describe('receivablesSummary', () => {
  it('buckets outstanding / overdue / paid / draft correctly', () => {
    const today = '2026-07-10';
    const line = (rate: number) => [{ qty: 1, rateCents: 100000, taxRatePct: rate }];
    // each 18% line totals 118000
    const r = receivablesSummary(
      [
        { status: 'sent', dueDateISO: '2026-07-20', items: line(18) }, // outstanding only
        { status: 'sent', dueDateISO: '2026-07-01', items: line(18) }, // outstanding + overdue
        { status: 'paid', dueDateISO: '2026-06-01', items: line(18) }, // paid
        { status: 'draft', dueDateISO: '2026-08-01', items: line(18) }, // draft
      ],
      today,
    );
    expect(r.outstandingCents).toBe(236000);
    expect(r.overdueCents).toBe(118000);
    expect(r.paidCents).toBe(118000);
    expect(r.draftCents).toBe(118000);
  });
});
