import type { DocumentCategory, MappedReceipt } from '../domain/ocr/fieldparser';

export type ExtractionMode = 'on_device' | 'cloud';

/**
 * Normalized result of running OCR over a captured document's pages. The review
 * screen pre-fills from this, and the user can edit every field before it is
 * committed (Feature 1: "every individual extracted field editable").
 */
export interface OcrOutcome {
  category: DocumentCategory;
  rawText: string;
  confidence: number | null;
  mode: ExtractionMode;
  /** Populated for the Bills & Receipts category. */
  receipt?: MappedReceipt;
  /** Populated for Warranty when found on the scan. */
  imei?: string | null;
  serial?: string | null;
  /** A date detected anywhere in the text (purchase date candidate). */
  dateISO?: string | null;
}
