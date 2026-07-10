/**
 * Mileage / travel reimbursement for the India business layer.
 *
 * Distance is in kilometres; rate is integer paise per km. Reimbursement is
 * Math.round(km × ratePaisePerKm) so the result stays in whole paise.
 */

function safe(n: number): number {
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Reimbursement (paise) for a trip of `km` at `ratePaisePerKm`. */
export function tripReimbursementCents(km: number, ratePaisePerKm: number): number {
  return Math.round(safe(km) * safe(ratePaisePerKm));
}

/** Aggregate totals across a set of trips. */
export function mileageSummary(
  trips: { km: number; ratePaisePerKm: number; dateISO: string }[],
): { totalKm: number; totalCents: number; tripCount: number } {
  let totalKm = 0;
  let totalCents = 0;

  for (const t of trips) {
    const km = safe(t.km);
    totalKm += km;
    totalCents += tripReimbursementCents(km, t.ratePaisePerKm);
  }

  return { totalKm, totalCents, tripCount: trips.length };
}
