import { Model, type Relation } from '@nozbe/watermelondb';
import { immutableRelation, text } from '@nozbe/watermelondb/decorators';
import type Group from './Group';

/** Membership of a user in a splitting group. */
export default class GroupMember extends Model {
  static table = 'group_members';
  static associations = {
    groups: { type: 'belongs_to', key: 'group_id' },
  } as const;

  @text('group_id') groupId!: string;
  @text('user_id') userId!: string;
  @text('display_name') displayName!: string;

  @immutableRelation('groups', 'group_id') group!: Relation<Group>;
}
