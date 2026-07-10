/**
 * Money is represented as an integer number of minor units ("cents") throughout
 * the app. Floating-point dollars are only ever used at the display/parsing
 * boundary. This avoids the classic 0.1 + 0.2 !== 0.3 rounding drift that would
 * otherwise corrupt ledger totals and split balances.
 */
export type Cents = number;

export function assertIntegerCents(c: Cents, label = 'amount'): void {
  if (!Number.isInteger(c)) {
    throw new Error(`${label} must be an integer number of cents, got ${c}`);
  }
}

/** Parse a major-unit amount (e.g. dollars 12.34) into integer cents. */
export function toCents(amountMajor: number): Cents {
  if (!Number.isFinite(amountMajor)) {
    throw new Error(`cannot convert non-finite amount to cents: ${amountMajor}`);
  }
  return Math.round(amountMajor * 100);
}

/** Convert integer cents back to a major-unit number (for display only). */
export function fromCents(c: Cents): number {
  return c / 100;
}

/** Format cents as a fixed 2-decimal major-unit string, e.g. 1234 -> "12.34". */
export function formatAmount(c: Cents): string {
  const sign = c < 0 ? '-' : '';
  const abs = Math.abs(c);
  const whole = Math.floor(abs / 100);
  const frac = abs % 100;
  return `${sign}${whole}.${frac.toString().padStart(2, '0')}`;
}

/* -------------------------------------------------------------------------- */
/*  Indian Rupee (INR) formatting                                             */
/*                                                                            */
/*  Amounts are stored as integer paise (minor units, ×100), identical to the */
/*  "cents" convention above. Display uses the Indian numbering system:       */
/*  thousands, then lakhs and crores — 1,23,45,678 rather than 12,345,678.    */
/* -------------------------------------------------------------------------- */

/** Group an integer digit-string with Indian place separators: 1234567 -> "12,34,567". */
export function groupIndian(intDigits: string): string {
  const digits = intDigits.replace(/^0+(?=\d)/, '');
  if (digits.length <= 3) return digits;
  const last3 = digits.slice(-3);
  let rest = digits.slice(0, -3);
  const groups: string[] = [];
  while (rest.length > 2) {
    groups.unshift(rest.slice(-2));
    rest = rest.slice(0, -2);
  }
  if (rest.length > 0) groups.unshift(rest);
  return `${groups.join(',')},${last3}`;
}

/** Format paise as a full ₹ amount with 2 decimals: 123456789 -> "₹12,34,567.89". */
export function formatINR(c: Cents): string {
  const sign = c < 0 ? '-' : '';
  const abs = Math.abs(c);
  const whole = Math.floor(abs / 100);
  const frac = abs % 100;
  return `${sign}₹${groupIndian(String(whole))}.${frac.toString().padStart(2, '0')}`;
}

/** Format paise as a whole-rupee ₹ amount (no decimals): 123456789 -> "₹12,34,568". */
export function formatINRShort(c: Cents): string {
  const sign = c < 0 ? '-' : '';
  const whole = Math.round(Math.abs(c) / 100);
  return `${sign}₹${groupIndian(String(whole))}`;
}

function trimOneDecimal(n: number): string {
  const s = n.toFixed(1);
  return s.endsWith('.0') ? s.slice(0, -2) : s;
}

/**
 * Compact ₹ for dashboards / cards using Indian scale words:
 *   999 -> "₹999", 12345 -> "₹12,345", 150000 -> "₹1.5L", 53000000 -> "₹5.3Cr".
 */
export function formatINRCompact(c: Cents): string {
  const sign = c < 0 ? '-' : '';
  const rupees = Math.abs(c) / 100;
  if (rupees >= 1e7) return `${sign}₹${trimOneDecimal(rupees / 1e7)}Cr`;
  if (rupees >= 1e5) return `${sign}₹${trimOneDecimal(rupees / 1e5)}L`;
  const rounded = Math.round(rupees);
  return `${sign}₹${groupIndian(String(rounded))}`;
}

/**
 * Distribute `total` cents across buckets proportional to `weights`, using the
 * largest-remainder method. Guarantees the returned parts sum EXACTLY to
 * `total` — no cent is lost or invented — and hands any leftover cents to the
 * buckets with the largest fractional remainder (ties broken by index, so the
 * result is deterministic).
 *
 * Requires total >= 0, every weight >= 0, and at least one positive weight.
 */
export function distribute(total: Cents, weights: number[]): Cents[] {
  assertIntegerCents(total, 'total');
  if (total < 0) {
    throw new Error(`distribute requires a non-negative total, got ${total}`);
  }
  if (weights.length === 0) {
    return [];
  }
  if (weights.some((w) => w < 0 || !Number.isFinite(w))) {
    throw new Error('weights must be finite and non-negative');
  }
  const weightSum = weights.reduce((a, b) => a + b, 0);
  if (weightSum <= 0) {
    throw new Error('weights must include at least one positive value');
  }

  const exact = weights.map((w) => (total * w) / weightSum);
  const floors = exact.map((v) => Math.floor(v));
  const allocated = floors.reduce((a, b) => a + b, 0);
  let remainder = total - allocated; // integer in [0, weights.length)

  const byRemainderDesc = exact
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);

  const result = floors.slice();
  for (let k = 0; k < byRemainderDesc.length && remainder > 0; k++) {
    const entry = byRemainderDesc[k]!;
    result[entry.i] = result[entry.i]! + 1;
    remainder -= 1;
  }
  return result;
}

/** Split `total` into `n` as-equal-as-possible integer parts summing to total. */
export function allocateEqually(total: Cents, n: number): Cents[] {
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(`n must be a positive integer, got ${n}`);
  }
  return distribute(total, new Array(n).fill(1));
}
