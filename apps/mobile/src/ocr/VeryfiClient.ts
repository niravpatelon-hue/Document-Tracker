/**
 * Cloud receipt extraction, always via our own Edge Function proxy — never
 * calling Veryfi directly from the device (ARCHITECTURE.md §2, §7). The proxy
 * holds the vendor API key, meters the call server-side, and returns the
 * structured response. Keeping the key off-device is what makes the metering
 * trustworthy and the vendor swappable.
 */
import type { VeryfiReceiptResponse } from '../domain/ocr/fieldparser';

export interface OcrProxyConfig {
  /** Base URL of the Supabase Edge Functions deployment. */
  baseUrl: string;
  /** Returns a fresh Supabase auth token for the current user. */
  getAuthToken: () => Promise<string>;
}

export interface ProxyRequestPage {
  /** base64-encoded page image bytes. */
  base64: string;
  mimeType: string;
}

/**
 * Send captured page(s) to the OCR proxy for cloud extraction. Throws on a
 * non-2xx response so the caller can fall back to on-device extraction and
 * surface a clear error at the review step.
 */
export async function extractReceiptViaProxy(
  pages: ProxyRequestPage[],
  config: OcrProxyConfig,
): Promise<VeryfiReceiptResponse> {
  if (pages.length === 0) {
    throw new Error('extractReceiptViaProxy requires at least one page');
  }
  const token = await config.getAuthToken();
  const response = await fetch(`${config.baseUrl}/ocr-proxy`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ pages }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`OCR proxy failed (${response.status}): ${detail}`);
  }
  return (await response.json()) as VeryfiReceiptResponse;
}
