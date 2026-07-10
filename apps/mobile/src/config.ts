/**
 * Phase 1 runs single-user and local-only. Real authentication (Supabase Auth)
 * and multi-user identity arrive with cloud sync and the splitting feature
 * (Feature 3); until then everything is owned by this local sentinel user.
 */
export const CURRENT_USER_ID = 'local-user';

/** Supabase / Edge Functions base URL — injected via env in a real build. */
export const OCR_PROXY_BASE_URL = '';

/** Phase 1 defaults cloud OCR off; it is gated by metering once billing lands. */
export const CLOUD_OCR_ENABLED = false;
