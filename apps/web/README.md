# Document Tracker — web preview

A browser-runnable preview of the Android app, for showing the UI and flow
without an emulator. Built with **Vite + react-native-web**.

**This is a preview, not the shipping app.** The shipping app is the React Native
Android build under [`../mobile`](../mobile). What differs here:

| Aspect | Android app | This web preview |
|---|---|---|
| Capture | ML Kit document scanner (camera) | Paste receipt text / attach an image |
| OCR | On-device ML Kit + cloud Veryfi | Paste text → **real** on-device field parser |
| Storage | WatermelonDB (SQLite) | In-browser state + `localStorage` |
| Split/settle math | domain layer | **same** domain layer |

What's genuinely real: everything under `@domain` — the OCR field parser
(vendor/total/tax/date extraction), the money math, the duplicate detection, the
split calculators, and the settle-up transfer minimization + deep-link builders —
is imported directly from the mobile app's tested domain code and runs live in the
browser. The preview is a thin shell around that shared logic.

## Run locally

```bash
cd apps/web
npm install
npm run dev      # http://localhost:5173
npm run build    # -> dist/
npm run preview  # serve the production build
```

## Deploy to Vercel

Connect the GitHub repo in Vercel and set:

- **Root Directory:** `apps/web`
- **Framework Preset:** Vite (auto-detected)
- **Build Command:** `vite build` · **Output Directory:** `dist`

(These are also declared in `vercel.json`.) The build imports the shared domain
layer from `../mobile/src/domain`, which is present in the checkout, so no extra
configuration is needed.
