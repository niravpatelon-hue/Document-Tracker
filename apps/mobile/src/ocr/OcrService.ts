/**
 * OCR orchestration (Feature 1). Decides between on-device (free) and cloud
 * (paid-accuracy) extraction and normalizes the result into an `OcrOutcome`.
 *
 * All side-effecting collaborators — native text recognition and the cloud proxy
 * call — are injected, so this decision logic is pure and unit-testable and the
 * module has no React Native import. The routing rule:
 *   - Always run cheap on-device text first (drives auto-categorization and the
 *     free-tier fallback).
 *   - Use the cloud receipt parser only for Bills & Receipts, only when the
 *     caller says cloud is enabled AND within quota (checked by the caller via
 *     metering.ts before setting `cloudEnabled`).
 *   - Warranty/Loyalty always use on-device text + our heuristic parsers, since
 *     no commercial parser covers those document types.
 */
import {
  detectImei,
  detectSerial,
  extractReceiptFields,
  findFirstDate,
  guessCategory,
  mapVeryfiReceipt,
  type VeryfiReceiptResponse,
} from '../domain/ocr/fieldparser';
import type { OcrOutcome } from './types';

export interface OcrRunDeps {
  /** Native on-device text recognition over a page image URI. */
  recognizeText: (imageUri: string) => Promise<{ text: string; confidence: number | null }>;
  /** Cloud receipt extraction via the proxy; pre-bound to the captured pages. */
  cloudExtract?: () => Promise<VeryfiReceiptResponse>;
  /** Whether cloud extraction is permitted right now (plan + quota already checked). */
  cloudEnabled: boolean;
}

export async function runOcr(imageUris: string[], deps: OcrRunDeps): Promise<OcrOutcome> {
  const firstPage = imageUris[0];
  if (!firstPage) {
    throw new Error('runOcr requires at least one page image');
  }

  const { text, confidence } = await deps.recognizeText(firstPage);
  const category = guessCategory(text);

  if (category === 'bills_receipts' && deps.cloudEnabled && deps.cloudExtract) {
    const veryfi = await deps.cloudExtract();
    return { category, rawText: text, confidence, mode: 'cloud', receipt: mapVeryfiReceipt(veryfi) };
  }

  const outcome: OcrOutcome = { category, rawText: text, confidence, mode: 'on_device' };
  if (category === 'bills_receipts') {
    const f = extractReceiptFields(text);
    outcome.receipt = {
      vendor: f.vendor,
      totalCents: f.totalCents,
      taxCents: f.taxCents,
      dateISO: f.dateISO,
      currency: null,
    };
    outcome.dateISO = f.dateISO;
  } else if (category === 'warranty') {
    outcome.imei = detectImei(text);
    outcome.serial = detectSerial(text);
    outcome.dateISO = findFirstDate(text);
  } else {
    outcome.dateISO = findFirstDate(text);
  }
  return outcome;
}
