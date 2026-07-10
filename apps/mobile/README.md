# Document Tracker — mobile (Android, React Native)

Phase 1 of the build: the capture engine, OCR pipeline, single-document data
model, and a minimal auto-populated spend ledger. See
[`../../docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md) for the full design.

## Layout

```
src/
  domain/          Pure TypeScript, zero RN imports — the correctness-critical core.
    money.ts         Integer-cent math + largest-remainder distribution.
    splitting.ts     Equal / percentage / exact / share split calculators.
    settleup/        Debt minimization + Venmo/PayPal/UPI deep-link builders.
    dedup/           Perceptual-hash (rescan) + fuzzy (same-purchase) detection.
    trackeditems/    Expiry status + reminder scheduling (warranty/loyalty/gift).
    warranty/        Editable warranty-duration lookup table.
    ocr/             Receipt/warranty/loyalty field parsing + Veryfi mapping.
  db/              WatermelonDB schema, models, migrations, field encryption.
  capture/         JS bridge to the native ML Kit Document Scanner.
  ocr/             OCR orchestration (on-device vs cloud), proxy client, metering.
  repositories/    DocumentRepository — one document, many features; ledger auto-fill.
  screens/         Documents list, capture review (editable fields), ledger.
  navigation/, hooks/, App.tsx
android/
  app/src/main/java/com/documenttracker/scanner/   Native ML Kit modules (Kotlin).
  README.md        How to generate the RN Android host project + wire these in.
```

## What's verified

The `src/domain/**` layer and the `src/ocr/OcrService` orchestration are pure and
covered by **89 passing Jest tests** (`npm test`). This is deliberate: the
split math, settle-up minimization, dedup thresholds, expiry-date arithmetic, and
OCR field parsing are where correctness bugs hurt, and they run without a device.

```bash
npm install
npm test          # domain + OCR orchestration unit tests
npm run typecheck # full-project TypeScript check
```

## What needs the Android toolchain

The React Native screens, WatermelonDB integration, and the Kotlin native modules
compile and run against the Android SDK / an emulator (Android Studio or
`react-native run-android`). Generate the Android host project first — see
[`android/README.md`](android/README.md) — then:

```bash
npm run android
```

## Not in this phase

Warranty/loyalty tracking UI (Phase 2), full spend-analysis dashboards and export
(Phase 3), and expense splitting (Phase 4) reuse this same data model and domain
logic — the calculators and models they need already live under `src/domain` and
`src/db`. iOS is out of scope entirely.
