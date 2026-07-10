# Data Model

Field-level reference for the entities described in [`ARCHITECTURE.md`](./ARCHITECTURE.md).
Written as TypeScript shapes for precision; actual storage is WatermelonDB (local,
SQLite) synced with Postgres (cloud) — column types follow directly from these
shapes. Fields marked `🔒` are field-level encrypted (see ARCHITECTURE.md §6).

## Document

The one row every feature reads from. Never duplicated per feature.

```ts
interface Document {
  id: string
  owner_id: string
  category: 'bills_receipts' | 'warranty' | 'loyalty' | 'other'
  page_image_uris: string[]        // local URIs, in page order (multi-page capture)
  page_cloud_keys: string[]        // Storage object keys, once backed up
  thumbnail_uri: string
  ocr_status: 'pending' | 'on_device_done' | 'cloud_done' | 'failed'
  ocr_confidence: number | null
  ocr_raw_text: string             // full OCR text, always kept even after field parsing
  phash_per_page: string[]         // perceptual hash, one per page
  fuzzy_dup_key: string | null     // normalized vendor|date|amount, set after field extraction
  is_manual_entry: boolean         // true when created without a scan
  created_at: string
  updated_at: string
  deleted_at: string | null        // soft delete — exports/history can still reference it
}
```

## BillReceipt

1:1 extension of a `Document` with `category = 'bills_receipts'`.

```ts
interface BillReceipt {
  id: string                       // == Document.id
  vendor: string                   // "from" — the company name
  tax_amount: number | null
  total_amount: number
  currency: string
  purchase_date: string            // kept for Spend Analysis dashboards
  budget_category_id: string | null
  // Per-line-item detail is deferred (Future Phase) — v1 stores only the totals above.
}
```

## TrackedItem (generic Warranty + Loyalty shape)

One model for both categories, per the architecture principle — `type` selects
which of `type_specific_data`'s shapes applies.

```ts
interface TrackedItem {
  id: string
  owner_id: string
  document_id: string | null       // optional link back to the originating scan
  type: 'warranty_device' | 'loyalty_program' | 'gift_card'

  // Shared across all types:
  label: string                    // product name / issuer+program display name
  vendor_or_issuer: string
  identifier: string | null        // 🔒 serial/IMEI/account/card number
  identifier_type: 'imei' | 'serial_number' | 'account_number' | 'card_number' | null

  expiry_or_renewal_trigger: {
    trigger_date: string | null             // resolved absolute date, if known
    trigger_type: 'fixed_date' | 'duration_from_purchase'
    duration_months: number | null          // used when trigger_type = duration_from_purchase
    anchor_date: string | null              // purchase date, when duration-based
  }

  reminder_rule: {
    offsets_days: number[]         // default [30, 15, 7, 1], user-editable
    enabled: boolean
  }

  status: 'active' | 'expiring_soon' | 'expired'   // derived from trigger_date vs. today

  type_specific_data:
    | WarrantyDeviceData
    | LoyaltyProgramData
    | GiftCardData

  created_at: string
  updated_at: string
}

interface WarrantyDeviceData {
  purchase_price: number | null
  purchase_date: string
  duration_source: 'extracted' | 'lookup_table' | 'manual'
  verification: {
    tier: 'manufacturer_api' | 'deep_link' | 'lookup_table' | 'manual' | 'unverified'
    verified_at: string | null
    result_summary: string | null   // e.g. "Covered until 2027-03-01" from Dell API
  }
}

interface LoyaltyProgramData {
  program_type: 'airline' | 'hotel' | 'retail' | 'credit_card_rewards'
  balance_value: number
  balance_unit: 'points' | 'miles'
}

interface GiftCardData {
  balance_value: number
  currency: string
}
```

## WarrantyLookupTable

Editable reference data backing the lookup-table fallback tier.

```ts
interface WarrantyLookupEntry {
  id: string
  category: string                 // e.g. "laptop", "smartphone", "kitchen_appliance"
  brand: string | null             // null = category-wide default
  default_duration_months: number
  source: 'seed_data' | 'user_edited'
  updated_by: string | null
  updated_at: string
}
```

## Transaction (Spend Analysis ledger row)

```ts
interface Transaction {
  id: string
  owner_id: string
  document_id: string | null       // null for a manual entry
  amount: number
  tax_amount: number | null
  category: string
  vendor: string
  date: string
  is_manual: boolean
}
```

## Budget

```ts
interface Budget {
  id: string
  owner_id: string
  category: string
  period: 'monthly' | 'yearly'
  limit_amount: number
  alert_threshold_pct: number       // e.g. 80 → alert at 80% of limit
}
```

## Group / splitting

```ts
interface Group {
  id: string
  name: string
  type: 'trip' | 'household' | 'event' | 'other'
  created_by: string
  member_ids: string[]
}

interface GroupInvite {
  id: string
  group_id: string
  channel: 'phone' | 'email' | 'link'
  target: string | null            // phone number or email; null for a bare link invite
  status: 'pending' | 'accepted' | 'expired'
}

interface Expense {
  id: string
  group_id: string
  source_document_id: string | null   // set when split from an existing Bills & Receipts entry
  total_amount: number
  payer_id: string
  split_type: 'equal' | 'percentage' | 'exact' | 'share'
  split_details: Array<{ user_id: string; value: number }>  // meaning depends on split_type
  created_at: string
}

interface SettleUp {
  id: string
  group_id: string
  from_user: string
  to_user: string
  amount: number
  method: 'venmo' | 'paypal' | 'upi' | 'manual'
  status: 'suggested' | 'link_opened' | 'confirmed'
  settled_at: string | null
}

// Derived, not stored as source of truth — recomputed by the settle-suggestions
// Edge Function whenever Expense/SettleUp rows change, pushed via Realtime.
interface Balance {
  group_id: string
  user_id: string
  net_balance: number               // positive = owed to this user, negative = this user owes
}
```

## OcrUsage (metering)

```ts
interface OcrUsage {
  owner_id: string
  month: string                     // "2026-07"
  scans_on_device: number
  scans_cloud: number
  plan_tier: 'free' | 'paid'
}
```
