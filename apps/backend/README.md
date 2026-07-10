# Backend — Supabase

Server-side pieces that must hold secrets or run trusted logic (ARCHITECTURE.md §2).
These deploy to Supabase; the mobile app talks to them, never to third parties
directly.

## Edge Functions

| Function | Purpose | Status |
|---|---|---|
| `functions/ocr-proxy` | Holds the Veryfi key, enforces the OCR quota (metering choke point), calls the vendor, records usage. | Implemented (Phase 1) |
| `functions/warranty-dell` | Dell Warranty Management API client (OAuth2). | Phase 2 |
| `functions/settle-suggestions` | Server-side settle-up minimization, pushed over Realtime. | Phase 4 |
| `functions/invites` | Group invite delivery (SMS/email/link). | Phase 4 |

## Postgres

The cloud mirror of the local WatermelonDB schema (`docs/DATA_MODEL.md`) lives as
SQL migrations under `migrations/` (added as the sync layer lands). `ocr_usage` is
the authoritative metering table the OCR proxy increments via an
`increment_ocr_cloud(p_owner_id, p_month)` RPC.

## Deploy

```bash
supabase functions deploy ocr-proxy
supabase secrets set VERYFI_CLIENT_ID=... VERYFI_API_KEY=... VERYFI_USERNAME=...
```
