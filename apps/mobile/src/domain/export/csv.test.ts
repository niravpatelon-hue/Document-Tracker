import { transactionsToCsv } from './csv';

describe('transactionsToCsv', () => {
  it('emits a header and formatted rows', () => {
    const csv = transactionsToCsv([
      { dateISO: '2026-07-04', vendor: 'Safeway', category: 'Groceries', amount: 2000, taxAmount: 150 },
      { dateISO: '2026-07-08', vendor: 'Shell', category: 'Fuel', amount: 5210, taxAmount: null },
    ]);
    const lines = csv.trimEnd().split('\r\n');
    expect(lines[0]).toBe('Date,Vendor,Category,Amount,Tax');
    expect(lines[1]).toBe('2026-07-04,Safeway,Groceries,20.00,1.50');
    expect(lines[2]).toBe('2026-07-08,Shell,Fuel,52.10,');
  });

  it('escapes commas and quotes in fields', () => {
    const csv = transactionsToCsv([
      { dateISO: '2026-07-04', vendor: 'Joe, "The" Grocer', category: 'Groceries', amount: 100 },
    ]);
    expect(csv).toContain('"Joe, ""The"" Grocer"');
  });
});
