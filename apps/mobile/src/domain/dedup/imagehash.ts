/**
 * Perceptual image hashing for "same physical document rescanned" detection
 * (ARCHITECTURE.md §9, first bullet).
 *
 * This module is pure: it operates on an already-downscaled grayscale matrix of
 * pixel intensities (0..255). The native/RN layer is responsible for decoding a
 * captured page, downscaling it (typically to 8x8 for a 64-bit hash), and
 * converting to grayscale before calling `averageHash`. Keeping the algorithm
 * pixel-in/hash-out makes it deterministic and unit-testable without any image
 * decoding dependency.
 *
 * We use the average-hash (aHash) construction: bit i is 1 when pixel i is at or
 * above the mean intensity. Two hashes of the same document survive re-scanning,
 * minor lighting changes, and recompression with a small Hamming distance;
 * unrelated documents diverge quickly.
 */

const HEX = '0123456789abcdef';

/** Number of set bits in the 4-bit value of a single hex digit. */
function popcountHexDigit(ch: string): number {
  const v = parseInt(ch, 16);
  if (Number.isNaN(v)) {
    throw new Error(`invalid hex digit: ${ch}`);
  }
  return ((v >> 3) & 1) + ((v >> 2) & 1) + ((v >> 1) & 1) + (v & 1);
}

/**
 * Compute the average hash of a grayscale matrix as a hex string. The matrix
 * must be rectangular and non-empty. A standard 8x8 input yields a 16-char
 * (64-bit) hash.
 */
export function averageHash(grayscale: number[][]): string {
  const rows = grayscale.length;
  if (rows === 0 || grayscale[0]!.length === 0) {
    throw new Error('grayscale matrix must be non-empty');
  }
  const cols = grayscale[0]!.length;

  let sum = 0;
  let count = 0;
  for (const row of grayscale) {
    if (row.length !== cols) {
      throw new Error('grayscale matrix must be rectangular');
    }
    for (const px of row) {
      sum += px;
      count += 1;
    }
  }
  const mean = sum / count;

  // Build the bitstring row-major, then pack into hex (4 bits per digit).
  const bits: number[] = [];
  for (const row of grayscale) {
    for (const px of row) {
      bits.push(px >= mean ? 1 : 0);
    }
  }
  // Pad to a multiple of 4 bits so packing is clean.
  while (bits.length % 4 !== 0) {
    bits.push(0);
  }

  let hex = '';
  for (let i = 0; i < bits.length; i += 4) {
    const nibble = (bits[i]! << 3) | (bits[i + 1]! << 2) | (bits[i + 2]! << 1) | bits[i + 3]!;
    hex += HEX[nibble];
  }
  return hex;
}

/**
 * Hamming distance between two equal-length hex hash strings: the number of
 * differing bits. Throws if the lengths differ (comparing hashes of different
 * sizes is a programming error, not a "very different" result).
 */
export function hammingDistanceHex(a: string, b: string): number {
  if (a.length !== b.length) {
    throw new Error(`hash length mismatch: ${a.length} vs ${b.length}`);
  }
  let dist = 0;
  for (let i = 0; i < a.length; i++) {
    const x = parseInt(a[i]!, 16) ^ parseInt(b[i]!, 16);
    dist += popcountHexDigit(HEX[x]!);
  }
  return dist;
}

/**
 * Default Hamming-distance threshold (in bits) below which two 64-bit hashes are
 * treated as the same physical document. 8/64 bits is a common, conservative
 * aHash rescan threshold — low enough to avoid false merges, high enough to
 * survive recompression and lighting shifts.
 */
export const RESCAN_THRESHOLD_BITS = 8;

export function isLikelyRescan(
  hashA: string,
  hashB: string,
  threshold: number = RESCAN_THRESHOLD_BITS,
): boolean {
  return hammingDistanceHex(hashA, hashB) <= threshold;
}
