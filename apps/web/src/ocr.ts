/**
 * In-browser OCR for the web preview, using Tesseract.js (WASM).
 *
 * On the real Android app this step is ML Kit on-device text recognition; the
 * browser has no ML Kit, so the preview uses Tesseract as the on-device stand-in.
 * The recognized text is then fed to the SAME domain field parser + categorizer
 * the app uses (@domain/ocr/fieldparser), so extraction/categorization behaviour
 * matches — only the raw text source differs.
 *
 * Assets (worker, WASM core, English model) are self-hosted under /public/tesseract
 * so this works with no CDN/CSP dependency, online or offline.
 */
import { createWorker, type Worker } from 'tesseract.js';

let workerPromise: Promise<Worker> | null = null;
let progressRef: ((status: string, pct: number) => void) | null = null;

function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = createWorker('eng', 1, {
      workerPath: '/tesseract/worker.min.js',
      corePath: '/tesseract/tesseract-core-simd-lstm.wasm.js',
      langPath: '/tesseract/',
      gzip: true,
      logger: (m: { status?: string; progress?: number }) => {
        if (progressRef && typeof m.progress === 'number') {
          progressRef(m.status ?? '', m.progress);
        }
      },
    });
  }
  return workerPromise;
}

/**
 * Recognize text in an image (data URL or object URL). `onProgress` reports a
 * 0..1 fraction with a status label ("recognizing text", "loading language
 * traineddata", …) so the UI can show a progress bar during the first run
 * (which also warms the ~11 MB language model).
 */
export async function ocrImage(
  imageUrl: string,
  onProgress?: (status: string, pct: number) => void,
): Promise<string> {
  progressRef = onProgress ?? null;
  const worker = await getWorker();
  const { data } = await worker.recognize(imageUrl);
  return data.text ?? '';
}
