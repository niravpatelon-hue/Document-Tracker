import { Model, type Relation } from '@nozbe/watermelondb';
import { field, immutableRelation, text } from '@nozbe/watermelondb/decorators';
import type Document from './Document';

/**
 * 1:1 typed extension of a Document in the Bills & Receipts category. Amounts are
 * integer cents. `purchaseDate` is kept (ISO YYYY-MM-DD) because the Spend
 * Analysis dashboards depend on it.
 */
export default class BillReceipt extends Model {
  static table = 'bill_receipts';
  static associations = {
    documents: { type: 'belongs_to', key: 'document_id' },
  } as const;

  @text('vendor') vendor!: string;
  @field('tax_amount') taxAmount?: number;
  @field('total_amount') totalAmount!: number;
  @text('currency') currency!: string;
  @text('purchase_date') purchaseDate!: string;
  @text('budget_category_id') budgetCategoryId?: string;

  @immutableRelation('documents', 'document_id') document!: Relation<Document>;
}
