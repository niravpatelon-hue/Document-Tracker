/**
 * In-browser OCR for the web preview, using Tesseract.js (WASM).
 *
 * On the real Android app this step is ML Kit on-device text recognition + the
 * Veryfi cloud parser; the browser has neither, so this is the stand-in. To get
 * usable accuracy out of Tesseract on photos we preprocess the image first
 * (grayscale + contrast stretch + sensible resize) and use a page-segmentation
 * mode suited to receipts/cards. Recognized text is then fed to the SAME domain
 * parser + categorizer the app uses.
 *
 * Assets (worker, WASM core, English model) are self-hosted under /public/tesseract.
 */
import { createWorker, type Worker } from 'tesseract.js';

let workerPromise: Promise<Worker> | null = null;
let progressRef: ((status: string, pct: number) => void) | null = null;

function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const worker = await createWorker('eng', 1, {
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
      // PSM 6: assume a single uniform block of text — a good default for
      // receipts, warranty cards, and loyalty cards.
      await worker.setParameters({ tessedit_pageseg_mode: '6' as never });
      return worker;
    })();
  }
  return workerPromise;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('could not load image for preprocessing'));
    img.src = src;
  });
}

/**
 * Preprocess a photo for OCR: resize into Tesseract's sweet spot, convert to
 * grayscale, and stretch contrast so faint print separates from the background.
 * This is the single biggest lever for real-world photo accuracy. Falls back to
 * the original image if anything goes wrong.
 */
async function preprocess(dataUrl: string): Promise<string> {
  const img = await loadImage(dataUrl);
  const maxSide = Math.max(img.width, img.height) || 1;
  let scale = 1;
  if (maxSide > 2400) {
    scale = 2400 / maxSide; // huge phone photo -> shrink (faster, less noise)
  } else if (maxSide < 1200) {
    scale = Math.min(2.5, 1600 / maxSide); // small/low-res -> upscale
  }
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return dataUrl;
  }
  ctx.drawImage(img, 0, 0, w, h);

  const imageData = ctx.getImageData(0, 0, w, h);
  const d = imageData.data;
  const lum = new Float32Array(w * h);
  let min = 255;
  let max = 0;
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    const g = 0.299 * d[i]! + 0.587 * d[i + 1]! + 0.114 * d[i + 2]!;
    lum[p] = g;
    if (g < min) min = g;
    if (g > max) max = g;
  }
  const range = Math.max(1, max - min);
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    const v = Math.max(0, Math.min(255, ((lum[p]! - min) * 255) / range));
    d[i] = v;
    d[i + 1] = v;
    d[i + 2] = v;
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/png');
}

/**
 * Recognize text in an image (data URL). `onProgress` reports a 0..1 fraction
 * with a status label so the UI can show a progress bar (the first run also
 * warms the ~11 MB language model).
 */
export async function recognizeImage(
  imageUrl: string,
  onProgress?: (status: string, pct: number) => void,
): Promise<string> {
  const processed = await preprocess(imageUrl).catch(() => imageUrl);
  progressRef = onProgress ?? null;
  const worker = await getWorker();
  const { data } = await worker.recognize(processed);
  return data.text ?? '';
}
