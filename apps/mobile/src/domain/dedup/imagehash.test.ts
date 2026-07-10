import { averageHash, hammingDistanceHex, isLikelyRescan } from './imagehash';

/** Build an 8x8 matrix: top `hotRows` rows are bright (255), the rest dark (0). */
function splitMatrix(hotRows: number): number[][] {
  return Array.from({ length: 8 }, (_, r) =>
    Array.from({ length: 8 }, () => (r < hotRows ? 255 : 0)),
  );
}

describe('averageHash', () => {
  it('produces a 64-bit (16 hex char) hash for an 8x8 matrix', () => {
    expect(averageHash(splitMatrix(4))).toHaveLength(16);
  });

  it('maps above/below-mean pixels to 1/0 bits', () => {
    // Top 4 rows (32 px) bright -> 1s, bottom 4 rows dark -> 0s.
    expect(averageHash(splitMatrix(4))).toBe('ffffffff00000000');
  });

  it('rejects a ragged matrix', () => {
    expect(() => averageHash([[1, 2], [3]])).toThrow();
  });
});

describe('hammingDistanceHex', () => {
  it('counts differing bits', () => {
    expect(hammingDistanceHex('ff', 'ff')).toBe(0);
    expect(hammingDistanceHex('ff', 'fe')).toBe(1);
    expect(hammingDistanceHex('ff', '00')).toBe(8);
    expect(hammingDistanceHex('f0', '0f')).toBe(8);
  });

  it('throws on length mismatch', () => {
    expect(() => hammingDistanceHex('ff', 'fff')).toThrow();
  });
});

describe('isLikelyRescan', () => {
  it('treats identical hashes as a rescan', () => {
    const h = averageHash(splitMatrix(4));
    expect(isLikelyRescan(h, h)).toBe(true);
  });

  it('honors the bit threshold', () => {
    expect(isLikelyRescan('ff', '00', 8)).toBe(true);
    expect(isLikelyRescan('ff', '00', 7)).toBe(false);
  });
});
