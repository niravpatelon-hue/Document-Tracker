# Document Tracker — SplitKar

A receipt-scanning + Splitwise-style expense-splitting app. Built with
**Vite + react-native-web**, this is now the actively developed, feature-complete
app — the original `../mobile` React Native scaffold only covers the earliest
capture/OCR/ledger slice and hasn't kept pace with the feature set here.

| Aspect | This app |
|---|---|
| Capture | Upload a photo/PDF/Word file, or the device camera (via a file input with `capture="environment"`) |
| OCR | Tesseract.js (on-device, in the browser/WebView) |
| Storage | **Google Drive** — see below |
| Split/settle math | `@domain` — the mobile app's tested domain layer, imported directly and run live |
| Auth | Sign in with Google |

What's genuinely real: everything under `@domain` — the OCR field parser
(vendor/total/tax/date extraction), the money math, the duplicate detection, the
split calculators, and the settle-up transfer minimization + deep-link builders —
is imported directly from the mobile app's tested domain code. This app is a real
UI shell around that shared logic, not a mockup.

## Storage: your own Google Drive, no backend to host

There is no server. Signing in with Google grants the app:

- A private, hidden **appDataFolder** space in your own Drive for personal
  expenses (`groupId = null`) — Google guarantees no other account or app can
  read it. That's the entire enforcement mechanism for "personal expenses are
  private": there's no custom access-control code to get wrong.
- The ability to create a regular Drive folder per group you create, tagged
  and **shared with that group's members by email** via Drive's own
  permissions API. Drive's sharing is what makes "group expenses are visible
  to common members" work — again, no custom rules, just Drive ACLs.

See `src/drive/driveClient.ts` and `src/drive/driveStore.ts` for the exact file
layout, and `docs/ARCHITECTURE.md` / `docs/DATA_MODEL.md` for the project's
original (Supabase-based) architecture plan — this app went a different route
for storage (Drive instead of a hosted Postgres backend) so that nothing needs
to be hosted, at the cost of Drive-shaped tradeoffs (whole-blob personal writes,
no true realtime push, group data physically lives in the creator's Drive).

### Google Cloud setup (required — only you can do this step)

1. Create a project at [console.cloud.google.com](https://console.cloud.google.com), enable the **Google Drive API**.
2. Configure the OAuth consent screen, publishing status **"Testing"** — this
   works instantly for up to 100 named test users, no Google review needed.
   Add every collaborator's Google email as a test user.
3. Create an OAuth **Web application** client ID. (Per the native Google
   Sign-In plugin's own docs, the *web* client ID is used on every platform,
   including the Android app below — no separate Android OAuth client or
   SHA-1 fingerprint registration needed.)
4. Copy `.env.example` to `.env` and set `VITE_GOOGLE_CLIENT_ID` to that client ID.

## Run locally

```bash
cd apps/web
npm install
cp .env.example .env   # then fill in VITE_GOOGLE_CLIENT_ID
npm run dev      # http://localhost:5173
npm run build    # -> dist/
npm run preview  # serve the production build
```

## Deploy to Vercel

Connect the GitHub repo in Vercel and set:

- **Root Directory:** `apps/web`
- **Framework Preset:** Vite (auto-detected)
- **Build Command:** `vite build` · **Output Directory:** `dist`
- **Environment Variable:** `VITE_GOOGLE_CLIENT_ID`

(These are also declared in `vercel.json`.) The build imports the shared domain
layer from `../mobile/src/domain`, which is present in the checkout, so no extra
configuration is needed.

## Android APK (Capacitor) — install without the Play Store

The same app is wrapped with [Capacitor](https://capacitorjs.com) into a real,
installable Android project under `android/`. A plain WebView can't complete
Google Sign-In (Google blocks it), so the native build goes through
[`@capawesome/capacitor-google-sign-in`](https://github.com/capawesome-team/capacitor-plugins)
instead of the in-page Google Identity Services flow the web app uses —
`src/auth/google.ts` picks whichever implementation matches the platform at
runtime (`Capacitor.isNativePlatform()`), so the rest of the app (Drive layer,
every screen) is unaware of the difference.

**Not verified end-to-end** — building this requires the Android SDK and
Google's Maven repo, both unreachable from the sandbox this was built in, so
this needs the first real build/test pass on a machine with normal internet
access (or a CI runner) before relying on it.

### Build it

Prerequisites: [Android Studio](https://developer.android.com/studio) (or the
command-line SDK tools) and a JDK — Android Studio bundles both.

```bash
cd apps/web
npm install
cp .env.example .env   # same VITE_GOOGLE_CLIENT_ID as the web app
npm run build
npx cap sync android
cd android
./gradlew assembleDebug
# -> android/app/build/outputs/apk/debug/app-debug.apk
```

That `.apk` is directly installable on any Android device with "Install from
unknown sources" enabled for the source you send it from (a file link, Drive,
email, etc.) — no Play Store listing, no app-store review. Everyone who
installs it does their own Google sign-in (their own account, their own Drive);
to collaborate on a group, invite them by email from inside the app once
they've signed in at least once — that's the same Drive-sharing invite flow
the web app uses, no separate "publish" step.

`assembleDebug` produces a debug-signed APK, which is all sideloading needs.
`assembleRelease` needs a real signing keystore (`android/app/build.gradle`'s
`signingConfigs`) if you want a release build instead.
