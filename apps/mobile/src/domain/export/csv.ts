/**
 * CSV export of the transaction ledger (Feature 2). The real app additionally
 * bundles the original scanned images/PDFs alongside the CSV (ARCHITECTURE.md
 * Feature 2); this module produces the figures table. Pure + testable.
 */
import { formatAmount, type Cents } from '../money';

export interface CsvTxnRow {
  dateISO: string;
  vendor: string;
  category: string;
  amount: Cents;
  taxAmount?: Cents | null;
}

/** RFC-4180-style field escaping: quote when needed, double embedded quotes. */
function escapeCsv(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function transactionsToCsv(rows: CsvTxnRow[]): string {
  const header = ['Date', 'Vendor', 'Category', 'Amount', 'Tax'];
  const lines = [header.join(',')];
  for (const r of rows) {
    lines.push(
      [
        escapeCsv(r.dateISO),
        escapeCsv(r.vendor),
        escapeCsv(r.category),
        formatAmount(r.amount),
        r.taxAmount == null ? '' : formatAmount(r.taxAmount),
      ].join(','),
    );
  }
  // Trailing newline so the file ends cleanly.
  return lines.join('\r\n') + '\r\n';
}
