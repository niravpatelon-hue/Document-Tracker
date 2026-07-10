import { Model } from '@nozbe/watermelondb';
import { date, field, json, readonly, text } from '@nozbe/watermelondb/decorators';
import type { TrackedStatus } from '../../domain/trackeditems/status';
import { numberArray, plainObject } from './sanitizers';

export type TrackedItemType = 'warranty_device' | 'loyalty_program' | 'gift_card';
export type IdentifierType = 'imei' | 'serial_number' | 'account_number' | 'card_number';

/**
 * The single generic model for both Warranty and Loyalty (ARCHITECTURE.md §5).
 * `type` discriminates; the handful of genuinely type-specific fields live in
 * the `typeSpecificData` JSON column. The sensitive identifier is stored only as
 * ciphertext in `identifierEncrypted` (decrypt via db/crypto.ts on read).
 */
export default class TrackedItem extends Model {
  static table = 'tracked_items';
  static associations = {
    documents: { type: 'belongs_to', key: 'document_id' },
  } as const;

  @text('owner_id') ownerId!: string;
  @text('document_id') documentId?: string;
  @text('type') type!: TrackedItemType;
  @text('label') label!: string;
  @text('vendor_or_issuer') vendorOrIssuer!: string;
  @text('identifier_encrypted') identifierEncrypted?: string; // 🔒 ciphertext only
  @text('identifier_type') identifierType?: IdentifierType;
  @text('trigger_type') triggerType!: 'fixed_date' | 'duration_from_purchase';
  @text('trigger_date') triggerDate?: string;
  @text('anchor_date') anchorDate?: string;
  @field('duration_months') durationMonths?: number;
  @json('reminder_offsets', numberArray) reminderOffsets!: number[];
  @field('reminder_enabled') reminderEnabled!: boolean;
  @text('status') status!: TrackedStatus;
  @json('type_specific_data', plainObject) typeSpecificData!: Record<string, unknown>;
  @readonly @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;
}
