import { Model } from '@nozbe/watermelondb';
import { field, text } from '@nozbe/watermelondb/decorators';

/**
 * Per-user, per-month OCR metering (ARCHITECTURE.md §7). Written on every
 * extraction from day one — including while the app is fully free — so the
 * free/paid boundary later becomes a quota check, not new plumbing. The
 * authoritative counter is server-side; this row mirrors it for offline display.
 */
export default class OcrUsage extends Model {
  static table = 'ocr_usage';

  @text('owner_id') ownerId!: string;
  @text('month') month!: string; // "2026-07"
  @field('scans_on_device') scansOnDevice!: number;
  @field('scans_cloud') scansCloud!: number;
  @text('plan_tier') planTier!: 'free' | 'paid';
}
