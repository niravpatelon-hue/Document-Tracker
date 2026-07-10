import { runOcr, type OcrRunDeps } from './OcrService';

const RECEIPT_TEXT = ['STARBUCKS', 'Total 8.43', 'Sales Tax 0.68', '03/01/2024'].join('\n');
const WARRANTY_TEXT = 'Limited Warranty\nIMEI: 490154203237518\nS/N ABC12345\nPurchased 01/15/2024';

function deps(overrides: Partial<OcrRunDeps> & { text: string }): OcrRunDeps {
  return {
    recognizeText: async () => ({ text: overrides.text, confidence: 0.9 }),
    cloudEnabled: overrides.cloudEnabled ?? false,
    cloudExtract: overrides.cloudExtract,
  };
}

describe('runOcr', () => {
  it('uses the cloud parser for receipts when enabled', async () => {
    let called = false;
    const outcome = await runOcr(['file://p1.jpg'], {
      recognizeText: async () => ({ text: RECEIPT_TEXT, confidence: 0.9 }),
      cloudEnabled: true,
      cloudExtract: async () => {
        called = true;
        return { vendor: { name: 'Starbucks' }, total: 8.43, tax: 0.68, date: '2024-03-01' };
      },
    });
    expect(called).toBe(true);
    expect(outcome.mode).toBe('cloud');
    expect(outcome.category).toBe('bills_receipts');
    expect(outcome.receipt?.totalCents).toBe(843);
    expect(outcome.receipt?.vendor).toBe('Starbucks');
  });

  it('falls back to on-device heuristics for receipts when cloud is disabled', async () => {
    const outcome = await runOcr(['file://p1.jpg'], deps({ text: RECEIPT_TEXT, cloudEnabled: false }));
    expect(outcome.mode).toBe('on_device');
    expect(outcome.receipt?.totalCents).toBe(843);
    expect(outcome.receipt?.taxCents).toBe(68);
    expect(outcome.dateISO).toBe('2024-03-01');
  });

  it('never calls the cloud parser for a warranty document', async () => {
    let called = false;
    const outcome = await runOcr(['file://p1.jpg'], {
      recognizeText: async () => ({ text: WARRANTY_TEXT, confidence: 0.8 }),
      cloudEnabled: true,
      cloudExtract: async () => {
        called = true;
        return {};
      },
    });
    expect(called).toBe(false);
    expect(outcome.category).toBe('warranty');
    expect(outcome.imei).toBe('490154203237518');
    expect(outcome.serial).toBe('ABC12345');
    expect(outcome.mode).toBe('on_device');
  });

  it('requires at least one page', async () => {
    await expect(runOcr([], deps({ text: '' }))).rejects.toThrow();
  });
});
