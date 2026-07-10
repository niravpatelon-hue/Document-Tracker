import { Model, type Query } from '@nozbe/watermelondb';
import { children, date, readonly, text } from '@nozbe/watermelondb/decorators';
import type GroupMember from './GroupMember';
import type Expense from './Expense';

/** A splitting group: trip, household, event (Feature 3). */
export default class Group extends Model {
  static table = 'groups';
  static associations = {
    group_members: { type: 'has_many', foreignKey: 'group_id' },
    expenses: { type: 'has_many', foreignKey: 'group_id' },
  } as const;

  @text('name') name!: string;
  @text('type') type!: 'trip' | 'household' | 'event' | 'other';
  @text('created_by') createdBy!: string;
  @readonly @date('created_at') createdAt!: Date;

  @children('group_members') members!: Query<GroupMember>;
  @children('expenses') expenses!: Query<Expense>;
}
