/**
 * Google Sign-In + Drive OAuth.
 *
 * Two implementations behind one API, chosen by platform:
 *  - Web (Vercel-hosted preview): Google Identity Services token client,
 *    loaded directly in-page. Verified working, including graceful timeouts
 *    when Google can't be reached.
 *  - Native (Capacitor Android APK): a plain WebView can't complete Google
 *    OAuth (Google blocks it), so the native path goes through
 *    @capawesome/capacitor-google-sign-in, which wraps Android's real
 *    Credential Manager / Google Sign-In SDK. NOT verified end-to-end in this
 *    codebase — building/running the native Android app requires the Android
 *    SDK and Google's Maven repo, neither reachable from this environment.
 *
 * Either way, one consent grants both identity (email/name/picture) and
 * Drive API access, in a single access token — one auth flow, not a separate
 * "sign in" plus a separate "connect Drive". Requires VITE_GOOGLE_CLIENT_ID
 * (see .env.example) from a Google Cloud OAuth client; the app cannot create
 * that client for you.
 */
import { Capacitor } from '@capacitor/core';
import { GoogleSignIn } from '@capawesome/capacitor-google-sign-in';

export interface GoogleProfile {
  email: string;
  name: string;
  picture?: string;
  accessToken: string;
  /** Epoch ms when accessToken expires — used to decide when to silently refresh. */
  expiresAt: number;
}

function clientId(): string {
  const id = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
  if (!id) {
    throw new Error(
      'VITE_GOOGLE_CLIENT_ID is not set. Create a Google Cloud OAuth client and add it to apps/web/.env (see .env.example).',
    );
  }
  return id;
}

// ---------------------------------------------------------------------------
// Web: Google Identity Services token client.
// ---------------------------------------------------------------------------

const WEB_SCOPES = ['openid', 'email', 'profile', 'https://www.googleapis.com/auth/drive'].join(' ');
const GIS_SRC = 'https://accounts.google.com/gsi/client';
const GIS_LOAD_TIMEOUT_MS = 8000;

let gisLoadPromise: Promise<void> | null = null;

function loadGisScript(): Promise<void> {
  if (gisLoadPromise) return gisLoadPromise;
  const attempt: Promise<void> = new Promise((resolve, reject) => {
    if (typeof document === 'undefined') return reject(new Error('No document — not a browser.'));
    const existing = document.querySelector(`script[src="${GIS_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Failed to load Google Identity Services.')));
      if ((window as any).google?.accounts?.oauth2) resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = GIS_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Identity Services.'));
    document.head.appendChild(script);
  });
  // A failed attempt must not be cached forever — clear it so a later retry
  // (e.g. after the user's connection recovers) tries fresh instead of
  // replaying the same rejection indefinitely.
  gisLoadPromise = Promise.race([
    attempt,
    new Promise<void>((_, reject) => setTimeout(() => reject(new Error('Timed out reaching Google — check your connection.')), GIS_LOAD_TIMEOUT_MS)),
  ]).catch((err) => {
    gisLoadPromise = null;
    throw err;
  });
  return gisLoadPromise;
}

async function fetchProfile(accessToken: string): Promise<{ email: string; name: string; picture?: string }> {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error('Could not read your Google profile.');
  const info = await res.json();
  if (!info.email) throw new Error('Google account has no email to sign in with.');
  return { email: String(info.email), name: String(info.name ?? info.email), picture: info.picture ? String(info.picture) : undefined };
}

function requestToken(promptMode: '' | 'consent'): Promise<{ accessToken: string; expiresAt: number }> {
  return new Promise((resolve, reject) => {
    const google = (window as any).google;
    const tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: clientId(),
      scope: WEB_SCOPES,
      prompt: promptMode,
      callback: (resp: any) => {
        if (resp.error) return reject(new Error(resp.error));
        resolve({ accessToken: resp.access_token, expiresAt: Date.now() + Number(resp.expires_in ?? 3600) * 1000 });
      },
      error_callback: (err: any) => reject(new Error(err?.type ?? 'Google sign-in failed.')),
    });
    tokenClient.requestAccessToken();
  });
}

const SILENT_TIMEOUT_MS = 6000;
// Generous — must never cut off a real person filling in credentials/2FA on
// the consent screen, but still eventually recovers if the popup was
// silently blocked and neither callback was ever going to fire.
const INTERACTIVE_TIMEOUT_MS = 120_000;

function withTimeout<T>(p: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new Error(message)), ms))]);
}

async function signInWeb(): Promise<GoogleProfile> {
  await withTimeout(loadGisScript(), SILENT_TIMEOUT_MS, 'Could not reach Google — check your connection.');
  const { accessToken, expiresAt } = await withTimeout(
    requestToken('consent'),
    INTERACTIVE_TIMEOUT_MS,
    'Sign-in window timed out — try again (check that popups are allowed for this site).',
  );
  const profile = await fetchProfile(accessToken);
  return { ...profile, accessToken, expiresAt };
}

async function trySilentSignInWeb(): Promise<GoogleProfile | null> {
  try {
    await withTimeout(loadGisScript(), SILENT_TIMEOUT_MS, 'timed out');
    const { accessToken, expiresAt } = await withTimeout(requestToken(''), SILENT_TIMEOUT_MS, 'timed out');
    const profile = await fetchProfile(accessToken);
    return { ...profile, accessToken, expiresAt };
  } catch {
    return null;
  }
}

async function refreshAccessTokenWeb(): Promise<{ accessToken: string; expiresAt: number } | null> {
  try {
    await withTimeout(loadGisScript(), SILENT_TIMEOUT_MS, 'timed out');
    return await withTimeout(requestToken(''), SILENT_TIMEOUT_MS, 'timed out');
  } catch {
    return null;
  }
}

function signOutWeb(accessToken: string | null): void {
  const google = (window as any).google;
  if (accessToken && google?.accounts?.oauth2?.revoke) {
    google.accounts.oauth2.revoke(accessToken, () => {});
  }
}

// ---------------------------------------------------------------------------
// Native (Capacitor Android): @capawesome/capacitor-google-sign-in.
// ---------------------------------------------------------------------------

const NATIVE_DRIVE_SCOPES = ['https://www.googleapis.com/auth/drive'];
// Google access tokens are conventionally ~1hr; this plugin's SignInResult
// doesn't report an expiry, so we assume the usual lifetime — DriveSession's
// reactive 401-retry (re-running signIn()) covers the case where it's wrong.
const NATIVE_ASSUMED_TOKEN_LIFETIME_MS = 55 * 60_000;

let nativeInitPromise: Promise<void> | null = null;

function ensureNativeInit(): Promise<void> {
  if (!nativeInitPromise) {
    nativeInitPromise = GoogleSignIn.initialize({ clientId: clientId(), scopes: NATIVE_DRIVE_SCOPES }).catch((err) => {
      nativeInitPromise = null;
      throw err;
    });
  }
  return nativeInitPromise;
}

function nativeResultToProfile(result: Awaited<ReturnType<typeof GoogleSignIn.signIn>>): GoogleProfile {
  if (!result.accessToken) throw new Error('Drive access was not granted — please allow access and try again.');
  if (!result.email) throw new Error('Google account has no email to sign in with.');
  return {
    email: result.email,
    name: result.displayName ?? result.email,
    picture: result.imageUrl ?? undefined,
    accessToken: result.accessToken,
    expiresAt: Date.now() + NATIVE_ASSUMED_TOKEN_LIFETIME_MS,
  };
}

async function signInNative(): Promise<GoogleProfile> {
  await ensureNativeInit();
  const result = await GoogleSignIn.signIn();
  return nativeResultToProfile(result);
}

/**
 * The plugin has no separate silent/reauth method — Android's Credential
 * Manager may still complete this without showing UI for a returning user
 * who already granted consent, but unlike the web path this isn't guaranteed.
 */
async function trySilentSignInNative(): Promise<GoogleProfile | null> {
  try {
    return await signInNative();
  } catch {
    return null;
  }
}

async function refreshAccessTokenNative(): Promise<{ accessToken: string; expiresAt: number } | null> {
  try {
    const profile = await signInNative();
    return { accessToken: profile.accessToken, expiresAt: profile.expiresAt };
  } catch {
    return null;
  }
}

function signOutNative(): void {
  void GoogleSignIn.signOut().catch(() => {});
}

// ---------------------------------------------------------------------------
// Public API — dispatches by platform.
// ---------------------------------------------------------------------------

const isNative = () => Capacitor.isNativePlatform();

/** Interactive sign-in — always shows the Google consent/account picker. */
export function signIn(): Promise<GoogleProfile> {
  return isNative() ? signInNative() : signInWeb();
}

/**
 * Silent re-auth attempt for returning users — no UI if the browser/OS still
 * has an active Google session and prior consent. Resolves null (never
 * throws) on any failure, so callers just fall back to showing the sign-in
 * button.
 */
export function trySilentSignIn(): Promise<GoogleProfile | null> {
  return isNative() ? trySilentSignInNative() : trySilentSignInWeb();
}

/** Silently mint a fresh access token for the already-signed-in Google account (used on 401 from Drive). */
export function refreshAccessToken(): Promise<{ accessToken: string; expiresAt: number } | null> {
  return isNative() ? refreshAccessTokenNative() : refreshAccessTokenWeb();
}

export function signOutGoogle(accessToken: string | null): void {
  if (isNative()) signOutNative();
  else signOutWeb(accessToken);
}
