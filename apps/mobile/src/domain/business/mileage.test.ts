import { tripReimbursementCents, mileageSummary } from './mileage';

describe('tripReimbursementCents', () => {
  it('22 km at ₹12/km (1200 paise) = ₹264.00', () => {
    expect(tripReimbursementCents(22, 1200)).toBe(26400);
  });

  it('rounds fractional km to the nearest paise', () => {
    // 10.5 * 1200 = 12600
    expect(tripReimbursementCents(10.5, 1200)).toBe(12600);
    // 3.333 * 1200 = 3999.6 -> 4000
    expect(tripReimbursementCents(3.333, 1200)).toBe(4000);
  });

  it('guards negatives and NaN', () => {
    expect(tripReimbursementCents(-5, 1200)).toBe(0);
    expect(tripReimbursementCents(22, NaN)).toBe(0);
  });
});

describe('mileageSummary', () => {
  it('totals km, reimbursement, and trip count', () => {
    const s = mileageSummary([
      { km: 22, ratePaisePerKm: 1200, dateISO: '2026-07-01' }, // 26400
      { km: 10, ratePaisePerKm: 1200, dateISO: '2026-07-05' }, // 12000
      { km: 5, ratePaisePerKm: 1000, dateISO: '2026-07-09' }, //  5000
    ]);
    expect(s.totalKm).toBe(37);
    expect(s.totalCents).toBe(43400);
    expect(s.tripCount).toBe(3);
  });

  it('handles no trips', () => {
    expect(mileageSummary([])).toEqual({ totalKm: 0, totalCents: 0, tripCount: 0 });
  });
});
