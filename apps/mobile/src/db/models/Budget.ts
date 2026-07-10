import { Model } from '@nozbe/watermelondb';
import { field, text } from '@nozbe/watermelondb/decorators';

/** Optional per-category budget with an alert threshold (Feature 2). */
export default class Budget extends Model {
  static table = 'budgets';

  @text('owner_id') ownerId!: string;
  @text('category') category!: string;
  @text('period') period!: 'monthly' | 'yearly';
  @field('limit_amount') limitAmount!: number; // cents
  @field('alert_threshold_pct') alertThresholdPct!: number;
}
