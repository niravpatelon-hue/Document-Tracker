import { gstOnAmount, grossFromNet, netFromGross, summarizeGst } from './gst';

describe('gstOnAmount', () => {
  it('computes 18% on ₹4,200.00 (420000 paise) = ₹756.00', () => {
    expect(gstOnAmount(420000, 18)).toBe(75600);
  });

  it('rounds to the nearest paise', () => {
    // 12345 * 5% = 617.25 -> 617
    expect(gstOnAmount(12345, 5)).toBe(617);
  });

  it('is zero for 0% and guards negatives/NaN', () => {
    expect(gstOnAmount(100000, 0)).toBe(0);
    expect(gstOnAmount(-100, 18)).toBe(0);
    expect(gstOnAmount(NaN, 18)).toBe(0);
  });
});

describe('grossFromNet / netFromGross', () => {
  it('gross = net + gst', () => {
    expect(grossFromNet(420000, 18)).toBe(495600);
  });

  it('netFromGross parts re-add to the original gross', () => {
    const { netCents, gstCents } = netFromGross(495600, 18);
    expect(netCents).toBe(420000);
    expect(gstCents).toBe(75600);
    expect(netCents + gstCents).toBe(495600);
  });
});

describe('summarizeGst', () => {
  it('netPayable = output − input across a mixed set', () => {
    const s = summarizeGst([
      { direction: 'output', taxableCents: 420000, taxRatePct: 18 }, // 75600
      { direction: 'output', taxableCents: 100000, taxRatePct: 5 }, //  5000
      { direction: 'input', taxableCents: 200000, taxRatePct: 18 }, //  36000
    ]);
    expect(s.outputGstCents).toBe(80600);
    expect(s.inputGstCents).toBe(36000);
    expect(s.netPayableCents).toBe(80600 - 36000);
  });

  it('goes negative when input credit exceeds output', () => {
    const s = summarizeGst([
      { direction: 'output', taxableCents: 100000, taxRatePct: 5 }, // 5000
      { direction: 'input', taxableCents: 100000, taxRatePct: 18 }, // 18000
    ]);
    expect(s.netPayableCents).toBe(5000 - 18000);
    expect(s.netPayableCents).toBeLessThan(0);
  });

  it('byRate groups output entries ascending and honours provided gstCents', () => {
    const s = summarizeGst([
      { direction: 'output', taxableCents: 100000, taxRatePct: 18, gstCents: 18000 },
      { direction: 'output', taxableCents: 50000, taxRatePct: 18 }, // 9000
      { direction: 'output', taxableCents: 100000, taxRatePct: 5 }, // 5000
    ]);
    expect(s.byRate).toEqual([
      { rate: 5, taxableCents: 100000, gstCents: 5000 },
      { rate: 18, taxableCents: 150000, gstCents: 27000 },
    ]);
  });
});
