/**
 * WatermelonDB schema — the local-first source of truth (ARCHITECTURE.md §2, §5).
 *
 * Column notes:
 *  - Money is stored as integer cents in `number` columns (see domain/money.ts).
 *  - Arrays/objects (image URIs, per-page hashes, reminder offsets, split
 *    details, type-specific data) are stored as JSON strings and parsed by the
 *    model getters.
 *  - `tracked_items.identifier_encrypted` holds ciphertext only — the sensitive
 *    serial/IMEI/account number is never written in plaintext (ARCHITECTURE.md §6).
 *  - Non-sensitive fields (vendor, dates, amounts, category) stay as plain
 *    indexed columns so search/filter stays fast.
 */
import { appSchema, tableSchema } from '@nozbe/watermelondb';

export const schema = appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: 'documents',
      columns: [
        { name: 'owner_id', type: 'string', isIndexed: true },
        { name: 'category', type: 'string', isIndexed: true },
        { name: 'page_image_uris', type: 'string' }, // JSON string[]
        { name: 'page_cloud_keys', type: 'string', isOptional: true }, // JSON string[]
        { name: 'thumbnail_uri', type: 'string', isOptional: true },
        { name: 'ocr_status', type: 'string' },
        { name: 'ocr_confidence', type: 'number', isOptional: true },
        { name: 'ocr_raw_text', type: 'string', isOptional: true },
        { name: 'phash_primary', type: 'string', isOptional: true, isIndexed: true },
        { name: 'phash_per_page', type: 'string', isOptional: true }, // JSON string[]
        { name: 'fuzzy_dup_key', type: 'string', isOptional: true, isIndexed: true },
        { name: 'is_manual_entry', type: 'boolean' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),
    tableSchema({
      name: 'bill_receipts',
      columns: [
        { name: 'document_id', type: 'string', isIndexed: true },
        { name: 'vendor', type: 'string', isIndexed: true },
        { name: 'tax_amount', type: 'number', isOptional: true },
        { name: 'total_amount', type: 'number' },
        { name: 'currency', type: 'string' },
        { name: 'purchase_date', type: 'string', isIndexed: true }, // ISO YYYY-MM-DD
        { name: 'budget_category_id', type: 'string', isOptional: true },
      ],
    }),
    tableSchema({
      name: 'tracked_items',
      columns: [
        { name: 'owner_id', type: 'string', isIndexed: true },
        { name: 'document_id', type: 'string', isOptional: true, isIndexed: true },
        { name: 'type', type: 'string', isIndexed: true },
        { name: 'label', type: 'string' },
        { name: 'vendor_or_issuer', type: 'string' },
        { name: 'identifier_encrypted', type: 'string', isOptional: true }, // 🔒 ciphertext
        { name: 'identifier_type', type: 'string', isOptional: true },
        { name: 'trigger_type', type: 'string' },
        { name: 'trigger_date', type: 'string', isOptional: true },
        { name: 'anchor_date', type: 'string', isOptional: true },
        { name: 'duration_months', type: 'number', isOptional: true },
        { name: 'reminder_offsets', type: 'string' }, // JSON number[]
        { name: 'reminder_enabled', type: 'boolean' },
        { name: 'status', type: 'string', isIndexed: true }, // cached derived status
        { name: 'type_specific_data', type: 'string' }, // JSON
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'transactions',
      columns: [
        { name: 'owner_id', type: 'string', isIndexed: true },
        { name: 'document_id', type: 'string', isOptional: true, isIndexed: true },
        { name: 'amount', type: 'number' },
        { name: 'tax_amount', type: 'number', isOptional: true },
        { name: 'category', type: 'string', isIndexed: true },
        { name: 'vendor', type: 'string' },
        { name: 'date', type: 'string', isIndexed: true },
        { name: 'is_manual', type: 'boolean' },
      ],
    }),
    tableSchema({
      name: 'budgets',
      columns: [
        { name: 'owner_id', type: 'string', isIndexed: true },
        { name: 'category', type: 'string', isIndexed: true },
        { name: 'period', type: 'string' },
        { name: 'limit_amount', type: 'number' },
        { name: 'alert_threshold_pct', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'groups',
      columns: [
        { name: 'name', type: 'string' },
        { name: 'type', type: 'string' },
        { name: 'created_by', type: 'string' },
        { name: 'created_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'group_members',
      columns: [
        { name: 'group_id', type: 'string', isIndexed: true },
        { name: 'user_id', type: 'string', isIndexed: true },
        { name: 'display_name', type: 'string' },
      ],
    }),
    tableSchema({
      name: 'expenses',
      columns: [
        { name: 'group_id', type: 'string', isIndexed: true },
        { name: 'source_document_id', type: 'string', isOptional: true, isIndexed: true },
        { name: 'total_amount', type: 'number' },
        { name: 'payer_id', type: 'string' },
        { name: 'split_type', type: 'string' },
        { name: 'note', type: 'string', isOptional: true },
        { name: 'created_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'expense_shares',
      columns: [
        { name: 'expense_id', type: 'string', isIndexed: true },
        { name: 'user_id', type: 'string', isIndexed: true },
        { name: 'amount', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'settlements',
      columns: [
        { name: 'group_id', type: 'string', isIndexed: true },
        { name: 'from_user', type: 'string' },
        { name: 'to_user', type: 'string' },
        { name: 'amount', type: 'number' },
        { name: 'method', type: 'string' },
        { name: 'status', type: 'string' },
        { name: 'settled_at', type: 'number', isOptional: true },
      ],
    }),
    tableSchema({
      name: 'ocr_usage',
      columns: [
        { name: 'owner_id', type: 'string', isIndexed: true },
        { name: 'month', type: 'string', isIndexed: true }, // "2026-07"
        { name: 'scans_on_device', type: 'number' },
        { name: 'scans_cloud', type: 'number' },
        { name: 'plan_tier', type: 'string' },
      ],
    }),
    tableSchema({
      name: 'warranty_lookup',
      columns: [
        { name: 'category', type: 'string', isIndexed: true },
        { name: 'brand', type: 'string', isOptional: true },
        { name: 'default_duration_months', type: 'number' },
        { name: 'source', type: 'string' },
      ],
    }),
  ],
});
