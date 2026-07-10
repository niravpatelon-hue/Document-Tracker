/**
 * Fuzzy "same purchase logged twice from different photos" detection
 * (ARCHITECTURE.md §9, second bullet). Matches on normalized vendor name +
 * date proximity + amount proximity. Pure and deterministic.
 */
import type { Cents } from '../money';

/** Jaro similarity in [0, 1]. */
function jaro(s1: string, s2: string): number {
  if (s1 === s2) {
    return 1;
  }
  const len1 = s1.length;
  const len2 = s2.length;
  if (len1 === 0 || len2 === 0) {
    return 0;
  }

  const matchWindow = Math.max(0, Math.floor(Math.max(len1, len2) / 2) - 1);
  const s1Matches = new Array(len1).fill(false);
  const s2Matches = new Array(len2).fill(false);

  let matches = 0;
  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(i + matchWindow + 1, len2);
    for (let j = start; j < end; j++) {
      if (!s2Matches[j] && s1[i] === s2[j]) {
        s1Matches[i] = true;
        s2Matches[j] = true;
        matches += 1;
        break;
      }
    }
  }
  if (matches === 0) {
    return 0;
  }

  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < len1; i++) {
    if (s1Matches[i]) {
      while (!s2Matches[k]) {
        k++;
      }
      if (s1[i] !== s2[k]) {
        transpositions += 1;
      }
      k++;
    }
  }
  transpositions /= 2;

  return (matches / len1 + matches / len2 + (matches - transpositions) / matches) / 3;
}

/**
 * Jaro-Winkler similarity in [0, 1]: Jaro boosted for shared prefixes (up to 4
 * chars), which suits merchant names where the distinctive part comes first.
 */
export function jaroWinkler(a: string, b: string): number {
  const j = jaro(a, b);
  let prefix = 0;
  const maxPrefix = Math.min(4, a.length, b.length);
  for (let i = 0; i < maxPrefix; i++) {
    if (a[i] === b[i]) {
      prefix += 1;
    } else {
      break;
    }
  }
  const scalingFactor = 0.1;
  return j + prefix * scalingFactor * (1 - j);
}

const COMPANY_SUFFIXES = new Set([
  'inc',
  'llc',
  'ltd',
  'co',
  'corp',
  'company',
  'incorporated',
  'limited',
  'gmbh',
  'pvt',
  'pte',
]);

/**
 * Normalize a vendor/merchant string for comparison: lowercase, strip
 * punctuation, drop trailing legal-entity suffixes, collapse whitespace.
 * "Trader Joe's Inc." and "trader joes" both normalize to "trader joes".
 */
export function normalizeVendor(raw: string): string {
  const cleaned = raw
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned === '') {
    return '';
  }
  const tokens = cleaned.split(' ').filter((t) => !COMPANY_SUFFIXES.has(t));
  return (tokens.length > 0 ? tokens : cleaned.split(' ')).join(' ');
}

/**
 * A coarse key stored on Document (fuzzy_dup_key) for cheap candidate lookup:
 * normalized vendor + ISO date + amount in cents. Exact matches on this key are
 * near-certain duplicates; near matches are found via `isLikelyDuplicatePurchase`.
 */
export function buildFuzzyKey(vendor: string, dateISO: string, amount: Cents): string {
  return `${normalizeVendor(vendor)}|${dateISO}|${amount}`;
}

function daysBetweenISO(a: string, b: string): number {
  const da = Date.parse(`${a}T00:00:00Z`);
  const db = Date.parse(`${b}T00:00:00Z`);
  if (Number.isNaN(da) || Number.isNaN(db)) {
    throw new Error(`invalid ISO date: ${a} / ${b}`);
  }
  return Math.abs(da - db) / 86_400_000;
}

export interface PurchaseFingerprint {
  vendor: string;
  dateISO: string;
  amount: Cents;
}

export interface DuplicateMatchOptions {
  /** Minimum Jaro-Winkler similarity on normalized vendor. Default 0.85. */
  vendorSimilarity?: number;
  /** Max absolute date difference in days. Default 1. */
  maxDayDelta?: number;
  /** Max absolute amount difference in cents. Default 1 (a penny of rounding). */
  maxAmountDeltaCents?: number;
}

export interface DuplicateVerdict {
  isLikely: boolean;
  vendorSimilarity: number;
  dayDelta: number;
  amountDelta: Cents;
}

/**
 * Decide whether two purchases are likely the same transaction photographed
 * twice. All three signals must agree; the verdict is advisory (surfaced once at
 * review time), never a hard block.
 */
export function isLikelyDuplicatePurchase(
  a: PurchaseFingerprint,
  b: PurchaseFingerprint,
  opts: DuplicateMatchOptions = {},
): DuplicateVerdict {
  const vendorThreshold = opts.vendorSimilarity ?? 0.85;
  const maxDayDelta = opts.maxDayDelta ?? 1;
  const maxAmountDelta = opts.maxAmountDeltaCents ?? 1;

  const vendorSimilarity = jaroWinkler(normalizeVendor(a.vendor), normalizeVendor(b.vendor));
  const dayDelta = daysBetweenISO(a.dateISO, b.dateISO);
  const amountDelta = Math.abs(a.amount - b.amount);

  const isLikely =
    vendorSimilarity >= vendorThreshold &&
    dayDelta <= maxDayDelta &&
    amountDelta <= maxAmountDelta;

  return { isLikely, vendorSimilarity, dayDelta, amountDelta };
}
