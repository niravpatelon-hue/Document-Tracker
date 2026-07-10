/**
 * Unified text extraction from an uploaded file, for the web preview.
 *
 *   image/*          -> preprocess + Tesseract OCR
 *   application/pdf  -> use the embedded text layer if present (exact); else
 *                       render page 1 and OCR it (scanned PDF)
 *   .docx            -> mammoth raw-text extraction (exact)
 *   .doc (legacy)    -> unsupported in the browser; ask for PDF/DOCX
 *
 * Digital PDFs and Word docs carry a real text layer, so extraction is exact —
 * a meaningful accuracy win over OCR-ing a photo. The recognized/extracted text
 * is handed to the same domain categorizer + field parsers used everywhere else.
 */
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import mammoth from 'mammoth/mammoth.browser';
import { recognizeImage } from './ocr';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export type ExtractSource = 'image' | 'pdf-text' | 'pdf-ocr' | 'docx';

export interface ExtractResult {
  text: string;
  imageDataUrl: string | null;
  source: ExtractSource;
}

type ProgressFn = (status: string, pct: number) => void;

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('could not read file'));
    reader.readAsDataURL(file);
  });
}

/** Reconstruct line structure from a PDF text layer using item Y positions. */
function pdfItemsToText(items: Array<{ str: string; transform: number[] }>): string {
  const rows = new Map<number, { x: number; str: string }[]>();
  for (const it of items) {
    if (!it.str) {
      continue;
    }
    const y = Math.round(it.transform[5]! / 2) * 2; // group near-equal baselines
    const x = it.transform[4]!;
    if (!rows.has(y)) {
      rows.set(y, []);
    }
    rows.get(y)!.push({ x, str: it.str });
  }
  return [...rows.keys()]
    .sort((a, b) => b - a) // PDF Y grows upward -> descending = top-to-bottom
    .map((y) =>
      rows
        .get(y)!
        .sort((a, b) => a.x - b.x)
        .map((s) => s.str)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter((line) => line.length > 0)
    .join('\n');
}

async function extractFromPdf(file: File, onProgress?: ProgressFn): Promise<ExtractResult> {
  onProgress?.('reading pdf', 0.1);
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const page = await pdf.getPage(1);
  const content = await page.getTextContent();
  const items = content.items as Array<{ str: string; transform: number[] }>;
  const text = pdfItemsToText(items);

  // A real text layer -> use it directly (exact, no OCR).
  if (text.replace(/\s/g, '').length >= 20) {
    onProgress?.('done', 1);
    return { text, imageDataUrl: null, source: 'pdf-text' };
  }

  // Scanned PDF (no text layer) -> render page 1 and OCR it.
  const viewport = page.getViewport({ scale: 2 });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('could not render PDF page');
  }
  await page.render({ canvasContext: ctx, viewport }).promise;
  const dataUrl = canvas.toDataURL('image/png');
  const ocrText = await recognizeImage(dataUrl, onProgress);
  return { text: ocrText, imageDataUrl: dataUrl, source: 'pdf-ocr' };
}

export async function extractTextFromFile(file: File, onProgress?: ProgressFn): Promise<ExtractResult> {
  const name = file.name.toLowerCase();
  const type = file.type;

  if (type.startsWith('image/')) {
    const dataUrl = await readAsDataURL(file);
    const text = await recognizeImage(dataUrl, onProgress);
    return { text, imageDataUrl: dataUrl, source: 'image' };
  }

  if (type === 'application/pdf' || name.endsWith('.pdf')) {
    return extractFromPdf(file, onProgress);
  }

  if (name.endsWith('.docx') || type.includes('wordprocessingml')) {
    onProgress?.('reading document', 0.4);
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    onProgress?.('done', 1);
    return { text: (result?.value ?? '') as string, imageDataUrl: null, source: 'docx' };
  }

  if (name.endsWith('.doc')) {
    throw new Error(
      'Legacy .doc files can’t be read in the browser. Please upload a PDF or .docx instead.',
    );
  }

  throw new Error('Unsupported file type. Upload an image, PDF, or .docx.');
}
