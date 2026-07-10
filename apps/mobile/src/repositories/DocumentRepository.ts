/**
 * The glue that enforces the core product principle: every downstream feature
 * reads from ONE captured document; nothing is entered twice (ARCHITECTURE.md §5).
 *
 * Creating a Bills & Receipts document here also auto-populates the spend ledger
 * (Feature 2) in the same transaction — the ledger row references the document,
 * it is not a separate copy of the data.
 */
import { Database, Q } from '@nozbe/watermelondb';
import { buildFuzzyKey, isLikelyDuplicatePurchase } from '../domain/dedup/fuzzy';
import { isLikelyRescan } from '../domain/dedup/imagehash';
import type { DocumentCategory } from '../domain/ocr/fieldparser';
import type { OcrOutcome } from '../ocr/types';
import { BillReceipt, Document, Transaction } from '../db/models';

export interface ReviewedReceiptFields {
  vendor: string;
  totalCents: number;
  taxCents: number | null;
  currency: string;
  purchaseDateISO: string;
}

export interface CreateDocumentInput {
  ownerId: string;
  category: DocumentCategory;
  pageImageUris: string[];
  /** Per-page perceptual hashes (empty until the native downscale step lands). */
  phashPerPage: string[];
  ocr: OcrOutcome;
  /** Present when category === 'bills_receipts' (after user review). */
  receipt?: ReviewedReceiptFields;
}

export interface DuplicateWarning {
  kind: 'rescan' | 'same_purchase';
  existing: Document;
}

export class DocumentRepository {
  constructor(private readonly database: Database) {}

  private documents() {
    return this.database.get<Document>('documents');
  }

  /**
   * Advisory duplicate check, surfaced once at review time (never a hard block).
   * Combines perceptual-hash rescan detection and fuzzy vendor/date/amount
   * matching. Candidate set is scoped to the owner and filtered in memory, since
   * Hamming distance and fuzzy similarity can't be expressed as SQL predicates.
   */
  async findDuplicateWarnings(input: CreateDocumentInput): Promise<DuplicateWarning[]> {
    const warnings: DuplicateWarning[] = [];
    const primaryHash = input.phashPerPage[0];
    const candidates = await this.documents()
      .query(Q.where('owner_id', input.ownerId), Q.where('deleted_at', null))
      .fetch();

    for (const existing of candidates) {
      if (primaryHash && existing.phashPrimary && isLikelyRescan(existing.phashPrimary, primaryHash)) {
        warnings.push({ kind: 'rescan', existing });
        continue;
      }
      if (input.receipt && existing.fuzzyDupKey) {
        const [vendor, dateISO, amount] = existing.fuzzyDupKey.split('|');
        const verdict = isLikelyDuplicatePurchase(
          {
            vendor: input.receipt.vendor,
            dateISO: input.receipt.purchaseDateISO,
            amount: input.receipt.totalCents,
          },
          { vendor: vendor ?? '', dateISO: dateISO ?? '', amount: Number(amount ?? 0) },
        );
        if (verdict.isLikely) {
          warnings.push({ kind: 'same_purchase', existing });
        }
      }
    }
    return warnings;
  }

  /** Persist a reviewed capture as a Document (+ receipt + ledger row when applicable). */
  async createFromCapture(input: CreateDocumentInput): Promise<Document> {
    let created!: Document;
    await this.database.write(async () => {
      created = await this.documents().create((doc) => {
        doc.ownerId = input.ownerId;
        doc.category = input.category;
        doc.pageImageUris = input.pageImageUris;
        doc.pageCloudKeys = [];
        doc.thumbnailUri = input.pageImageUris[0];
        doc.ocrStatus = input.ocr.mode === 'cloud' ? 'cloud_done' : 'on_device_done';
        doc.ocrConfidence = input.ocr.confidence ?? undefined;
        doc.ocrRawText = input.ocr.rawText;
        doc.phashPerPage = input.phashPerPage;
        doc.phashPrimary = input.phashPerPage[0];
        doc.isManualEntry = false;
        if (input.receipt) {
          doc.fuzzyDupKey = buildFuzzyKey(
            input.receipt.vendor,
            input.receipt.purchaseDateISO,
            input.receipt.totalCents,
          );
        }
      });

      if (input.category === 'bills_receipts' && input.receipt) {
        const receipt = input.receipt;
        await this.database.get<BillReceipt>('bill_receipts').create((r) => {
          r.document.set(created);
          r.vendor = receipt.vendor;
          r.totalAmount = receipt.totalCents;
          r.taxAmount = receipt.taxCents ?? undefined;
          r.currency = receipt.currency;
          r.purchaseDate = receipt.purchaseDateISO;
        });

        // Feature 2: the ledger is auto-populated from the same document.
        await this.database.get<Transaction>('transactions').create((t) => {
          t.ownerId = input.ownerId;
          t.documentId = created.id;
          t.amount = receipt.totalCents;
          t.taxAmount = receipt.taxCents ?? undefined;
          t.category = 'bills_receipts';
          t.vendor = receipt.vendor;
          t.date = receipt.purchaseDateISO;
          t.isManual = false;
        });
      }
    });
    return created;
  }
}
