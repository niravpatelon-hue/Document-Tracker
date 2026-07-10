import { resolveWarrantyMonths, upsertLookupEntry, SEED_WARRANTY_TABLE } from './lookup';

describe('resolveWarrantyMonths', () => {
  it('prefers a brand-specific entry', () => {
    const r = resolveWarrantyMonths('laptop', 'Dell');
    expect(r).toEqual({ durationMonths: 12, matchedOn: 'brand', source: 'seed_data' });
  });

  it('falls back to the category default when the brand is unknown', () => {
    const r = resolveWarrantyMonths('television', 'Sony');
    expect(r?.matchedOn).toBe('category');
    expect(r?.durationMonths).toBe(12);
  });

  it('uses the category default when no brand is given', () => {
    expect(resolveWarrantyMonths('power_tool', null)?.durationMonths).toBe(36);
  });

  it('returns null for an unknown category', () => {
    expect(resolveWarrantyMonths('spaceship', null)).toBeNull();
  });
});

describe('upsertLookupEntry', () => {
  it('lets a user edit override the seed at brand specificity', () => {
    const table = upsertLookupEntry(SEED_WARRANTY_TABLE, {
      category: 'laptop',
      brand: 'dell',
      defaultDurationMonths: 36,
    });
    const r = resolveWarrantyMonths('laptop', 'dell', table);
    expect(r).toEqual({ durationMonths: 36, matchedOn: 'brand', source: 'user_edited' });
  });

  it('replaces rather than duplicates an existing key', () => {
    const table = upsertLookupEntry(SEED_WARRANTY_TABLE, {
      category: 'laptop',
      brand: null,
      defaultDurationMonths: 18,
    });
    const matches = table.filter((e) => e.category === 'laptop' && e.brand === null);
    expect(matches).toHaveLength(1);
    expect(matches[0]!.defaultDurationMonths).toBe(18);
  });
});
