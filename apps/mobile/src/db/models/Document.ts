import { Model, type Query } from '@nozbe/watermelondb';
import { children, date, field, json, readonly, text } from '@nozbe/watermelondb/decorators';
import type { DocumentCategory } from '../../domain/ocr/fieldparser';
import { stringArray } from './sanitizers';
import type BillReceipt from './BillReceipt';
import type TrackedItem from './TrackedItem';

export type OcrStatus = 'pending' | 'on_device_done' | 'cloud_done' | 'failed';

/**
 * The one row every feature reads from (ARCHITECTURE.md §5). Capture metadata,
 * image references, OCR text, and the dedup hashes live here; category-specific
 * detail lives in the related tables.
 */
export default class Document extends Model {
  static table = 'documents';
  static associations = {
    bill_receipts: { type: 'has_many', foreignKey: 'document_id' },
    tracked_items: { type: 'has_many', foreignKey: 'document_id' },
  } as const;

  @text('owner_id') ownerId!: string;
  @text('category') category!: DocumentCategory;
  @json('page_image_uris', stringArray) pageImageUris!: string[];
  @json('page_cloud_keys', stringArray) pageCloudKeys!: string[];
  @text('thumbnail_uri') thumbnailUri?: string;
  @text('ocr_status') ocrStatus!: OcrStatus;
  @field('ocr_confidence') ocrConfidence?: number;
  @text('ocr_raw_text') ocrRawText?: string;
  @text('phash_primary') phashPrimary?: string;
  @json('phash_per_page', stringArray) phashPerPage!: string[];
  @text('fuzzy_dup_key') fuzzyDupKey?: string;
  @field('is_manual_entry') isManualEntry!: boolean;
  @readonly @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;
  @date('deleted_at') deletedAt?: Date;

  @children('bill_receipts') billReceipts!: Query<BillReceipt>;
  @children('tracked_items') trackedItems!: Query<TrackedItem>;
}
