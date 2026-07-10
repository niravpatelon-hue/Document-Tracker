# Document-Tracker

Android app (built with React Native) for photographing or importing bills,
receipts, warranty cards, and loyalty/gift-card documents, then automatically
generating a categorized spend history, expiry-tracked warranties, tracked
loyalty/gift-card balances, and group expense splitting — all reading from the same
captured document, entered once. iOS is out of scope for this build.

## Status

**Phase 1 in progress** — capture engine, OCR pipeline, single-document data
model, and a minimal auto-populated ledger, under [`apps/mobile`](apps/mobile).
The correctness-critical core (split math, settle-up minimization, dedup, expiry
logic, OCR field parsing) is pure TypeScript with **89 passing unit tests**.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the system architecture,
tech-stack decisions, and phased build order, [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md)
for entity schemas, and [`apps/mobile/README.md`](apps/mobile/README.md) for what's
implemented, what's verified, and how to build.

## Repository layout

```
apps/mobile      React Native (Android) app
apps/backend     Supabase Edge Functions (OCR proxy, ...)
docs             Architecture + data model
```