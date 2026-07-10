/**
 * Editable warranty-duration lookup table (Feature 4, tier 3 of the verification
 * strategy). When a receipt doesn't state a warranty length — the common case —
 * we suggest a typical duration by product category (optionally refined by
 * brand) and ask the user to confirm or adjust.
 *
 * The seed data below is intentionally conservative and small; the app persists
 * user edits and merges them over the seed via `resolveWarrantyMonths`.
 */

export interface WarrantyLookupEntry {
  category: string;
  /** null = the category-wide default; a value = a brand-specific override. */
  brand: string | null;
  defaultDurationMonths: number;
  source: 'seed_data' | 'user_edited';
}

/** Typical manufacturer warranty lengths. Editable at runtime. */
export const SEED_WARRANTY_TABLE: WarrantyLookupEntry[] = [
  { category: 'smartphone', brand: null, defaultDurationMonths: 12, source: 'seed_data' },
  { category: 'smartphone', brand: 'apple', defaultDurationMonths: 12, source: 'seed_data' },
  { category: 'laptop', brand: null, defaultDurationMonths: 12, source: 'seed_data' },
  { category: 'laptop', brand: 'dell', defaultDurationMonths: 12, source: 'seed_data' },
  { category: 'laptop', brand: 'apple', defaultDurationMonths: 12, source: 'seed_data' },
  { category: 'television', brand: null, defaultDurationMonths: 12, source: 'seed_data' },
  { category: 'large_appliance', brand: null, defaultDurationMonths: 24, source: 'seed_data' },
  { category: 'small_appliance', brand: null, defaultDurationMonths: 12, source: 'seed_data' },
  { category: 'power_tool', brand: null, defaultDurationMonths: 36, source: 'seed_data' },
  { category: 'furniture', brand: null, defaultDurationMonths: 12, source: 'seed_data' },
  { category: 'watch', brand: null, defaultDurationMonths: 24, source: 'seed_data' },
];

function norm(s: string): string {
  return s.trim().toLowerCase();
}

export interface WarrantyResolution {
  durationMonths: number;
  /** How specific the match was, for the confirm-prompt copy. */
  matchedOn: 'brand' | 'category';
  source: WarrantyLookupEntry['source'];
}

/**
 * Resolve a suggested warranty duration. A brand-specific entry wins over the
 * category default. User-edited entries win over seed entries at the same
 * specificity. Returns null when the category is unknown, so the caller can fall
 * back to pure manual entry.
 */
export function resolveWarrantyMonths(
  category: string,
  brand: string | null | undefined,
  table: WarrantyLookupEntry[] = SEED_WARRANTY_TABLE,
): WarrantyResolution | null {
  const c = norm(category);
  const b = brand != null ? norm(brand) : null;

  const preferUserEdited = (a: WarrantyLookupEntry, z: WarrantyLookupEntry) =>
    a.source === z.source ? 0 : a.source === 'user_edited' ? -1 : 1;

  if (b !== null) {
    const brandMatches = table
      .filter((e) => norm(e.category) === c && e.brand != null && norm(e.brand) === b)
      .sort(preferUserEdited);
    const brandMatch = brandMatches[0];
    if (brandMatch) {
      return {
        durationMonths: brandMatch.defaultDurationMonths,
        matchedOn: 'brand',
        source: brandMatch.source,
      };
    }
  }

  const categoryMatches = table
    .filter((e) => norm(e.category) === c && e.brand == null)
    .sort(preferUserEdited);
  const categoryMatch = categoryMatches[0];
  if (categoryMatch) {
    return {
      durationMonths: categoryMatch.defaultDurationMonths,
      matchedOn: 'category',
      source: categoryMatch.source,
    };
  }

  return null;
}

/**
 * Merge a user's edits over a base table. An edit replaces any existing entry
 * with the same (category, brand) key and is marked 'user_edited'.
 */
export function upsertLookupEntry(
  table: WarrantyLookupEntry[],
  edit: { category: string; brand: string | null; defaultDurationMonths: number },
): WarrantyLookupEntry[] {
  const key = (e: { category: string; brand: string | null }) =>
    `${norm(e.category)}|${e.brand == null ? '' : norm(e.brand)}`;
  const editKey = key(edit);
  const next = table.filter((e) => key(e) !== editKey);
  next.push({ ...edit, source: 'user_edited' });
  return next;
}
