import { Model } from '@nozbe/watermelondb';
import { field, text } from '@nozbe/watermelondb/decorators';

/**
 * Persisted warranty-duration lookup entry (Feature 4, tier 3). Seeded from
 * domain/warranty/lookup.ts and editable by the user; `source` records provenance.
 */
export default class WarrantyLookupRow extends Model {
  static table = 'warranty_lookup';

  @text('category') category!: string;
  @text('brand') brand?: string;
  @field('default_duration_months') defaultDurationMonths!: number;
  @text('source') source!: 'seed_data' | 'user_edited';
}
