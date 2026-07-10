import { Model } from '@nozbe/watermelondb';
import { field, text } from '@nozbe/watermelondb/decorators';

/**
 * Spend-analysis ledger row (Feature 2). Auto-populated from a Bills & Receipts
 * scan (`documentId` set) or entered manually (`isManual`). Amounts are cents.
 */
export default class Transaction extends Model {
  static table = 'transactions';

  @text('owner_id') ownerId!: string;
  @text('document_id') documentId?: string;
  @field('amount') amount!: number;
  @field('tax_amount') taxAmount?: number;
  @text('category') category!: string;
  @text('vendor') vendor!: string;
  @text('date') date!: string;
  @field('is_manual') isManual!: boolean;
}
