import { Model } from '@nozbe/watermelondb';
import { date, field, text } from '@nozbe/watermelondb/decorators';
import type { SettleUpProvider } from '../../domain/settleup/deeplinks';

/**
 * A recorded settle-up between two members (Feature 3). The app only records
 * that a settlement happened and deep-links out to the payment app — it never
 * moves money. `method` is a provider or 'manual' (cash / handled elsewhere).
 */
export default class Settlement extends Model {
  static table = 'settlements';

  @text('group_id') groupId!: string;
  @text('from_user') fromUser!: string;
  @text('to_user') toUser!: string;
  @field('amount') amount!: number; // cents
  @text('method') method!: SettleUpProvider | 'manual';
  @text('status') status!: 'suggested' | 'link_opened' | 'confirmed';
  @date('settled_at') settledAt?: Date;
}
