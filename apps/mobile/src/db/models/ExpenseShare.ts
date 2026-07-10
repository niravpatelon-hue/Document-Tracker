import { Model, type Relation } from '@nozbe/watermelondb';
import { field, immutableRelation, text } from '@nozbe/watermelondb/decorators';
import type Expense from './Expense';

/** One participant's resolved share of an expense (from domain/splitting). */
export default class ExpenseShare extends Model {
  static table = 'expense_shares';
  static associations = {
    expenses: { type: 'belongs_to', key: 'expense_id' },
  } as const;

  @text('expense_id') expenseId!: string;
  @text('user_id') userId!: string;
  @field('amount') amount!: number; // cents owed by this user

  @immutableRelation('expenses', 'expense_id') expense!: Relation<Expense>;
}
