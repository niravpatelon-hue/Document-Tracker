/**
 * JS bridge to the native Android ML Kit Document Scanner (ARCHITECTURE.md §2).
 * The native module (android/.../DocumentScannerModule.kt) handles edge
 * detection, perspective correction, and multi-page capture, and returns
 * file:// URIs for the corrected page images (and an optional combined PDF).
 *
 * This is deliberately a thin, typed wrapper: nothing in the business/UI layers
 * imports the native module directly, so the capture layer stays swappable (e.g.
 * for a paid SDK on devices without Google Play Services — see ARCHITECTURE.md §14).
 */
import { NativeModules, Platform } from 'react-native';

export interface ScanResult {
  /** Perspective-corrected page images, in order, as file:// URIs. */
  pageImageUris: string[];
  /** Optional combined PDF of all pages, if the scanner produced one. */
  pdfUri?: string;
}

export interface ScanOptions {
  /** Max pages in one capture session. Default 10. */
  pageLimit?: number;
  /** Allow importing from the gallery within the scanner flow. Default true. */
  allowGalleryImport?: boolean;
}

interface NativeDocumentScanner {
  scan(options: { pageLimit: number; allowGalleryImport: boolean }): Promise<ScanResult>;
}

const native = NativeModules.DocumentScanner as NativeDocumentScanner | undefined;

export function isDocumentScannerAvailable(): boolean {
  return Platform.OS === 'android' && native != null;
}

export async function scanDocument(options: ScanOptions = {}): Promise<ScanResult> {
  if (!native) {
    throw new Error(
      'DocumentScanner native module unavailable. Requires Android with Google Play Services.',
    );
  }
  return native.scan({
    pageLimit: options.pageLimit ?? 10,
    allowGalleryImport: options.allowGalleryImport ?? true,
  });
}
