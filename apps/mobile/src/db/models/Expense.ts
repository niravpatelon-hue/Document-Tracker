import { Model, type Query, type Relation } from '@nozbe/watermelondb';
import { children, date, field, immutableRelation, readonly, text } from '@nozbe/watermelondb/decorators';
import type { SplitType } from '../../domain/splitting';
import type Group from './Group';
import type ExpenseShare from './ExpenseShare';

/**
 * A group expense (Feature 3). `sourceDocumentId` is set when the expense was
 * split directly from a Bills & Receipts entry — it references the same document,
 * never a copy. Per-participant amounts live in the related expense_shares.
 */
export default class Expense extends Model {
  static table = 'expenses';
  static associations = {
    groups: { type: 'belongs_to', key: 'group_id' },
    expense_shares: { type: 'has_many', foreignKey: 'expense_id' },
  } as const;

  @text('group_id') groupId!: string;
  @text('source_document_id') sourceDocumentId?: string;
  @field('total_amount') totalAmount!: number; // cents
  @text('payer_id') payerId!: string;
  @text('split_type') splitType!: SplitType;
  @text('note') note?: string;
  @readonly @date('created_at') createdAt!: Date;

  @immutableRelation('groups', 'group_id') group!: Relation<Group>;
  @children('expense_shares') shares!: Query<ExpenseShare>;
}
