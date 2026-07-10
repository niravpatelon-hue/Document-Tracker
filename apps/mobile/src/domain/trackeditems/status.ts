/**
 * Tracked-item expiry status + reminder scheduling (Feature 4). Works uniformly
 * for warranties, loyalty programs, and gift cards because they all share the
 * generic trigger/reminder shape (ARCHITECTURE.md §5, DATA_MODEL.md TrackedItem).
 *
 * All dates are 'YYYY-MM-DD' strings interpreted at UTC midnight, so results are
 * independent of device timezone and DST.
 */

export type TrackedStatus = 'active' | 'expiring_soon' | 'expired';

export interface ExpiryTrigger {
  triggerType: 'fixed_date' | 'duration_from_purchase';
  /** Absolute expiry/renewal date, when triggerType is 'fixed_date'. */
  triggerDate?: string | null;
  /** Purchase/start date, when triggerType is 'duration_from_purchase'. */
  anchorDate?: string | null;
  /** Warranty/validity length in months, when duration-based. */
  durationMonths?: number | null;
}

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

interface Ymd {
  y: number;
  m: number; // 1..12
  d: number; // 1..31
}

export function parseISODate(iso: string): Ymd {
  const match = ISO_RE.exec(iso);
  if (!match) {
    throw new Error(`expected YYYY-MM-DD, got "${iso}"`);
  }
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) {
    throw new Error(`not a real calendar date: "${iso}"`);
  }
  return { y, m, d };
}

function formatISO({ y, m, d }: Ymd): string {
  return `${y.toString().padStart(4, '0')}-${m.toString().padStart(2, '0')}-${d
    .toString()
    .padStart(2, '0')}`;
}

/** Number of days in a 1-indexed month of a given year (leap-year aware). */
export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Add (or subtract, if negative) whole months, clamping the day to month end. */
export function addMonths(iso: string, months: number): string {
  if (!Number.isInteger(months)) {
    throw new Error(`months must be an integer, got ${months}`);
  }
  const { y, m, d } = parseISODate(iso);
  const monthIndex = m - 1 + months;
  const ny = y + Math.floor(monthIndex / 12);
  const nm = (((monthIndex % 12) + 12) % 12) + 1;
  const nd = Math.min(d, daysInMonth(ny, nm));
  return formatISO({ y: ny, m: nm, d: nd });
}

/** Add (or subtract) whole days. */
export function addDays(iso: string, days: number): string {
  const { y, m, d } = parseISODate(iso);
  const ms = Date.UTC(y, m - 1, d) + days * 86_400_000;
  const dt = new Date(ms);
  return formatISO({ y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() });
}

/** Signed whole-day difference b - a. */
export function daysBetween(aISO: string, bISO: string): number {
  const a = parseISODate(aISO);
  const b = parseISODate(bISO);
  const ams = Date.UTC(a.y, a.m - 1, a.d);
  const bms = Date.UTC(b.y, b.m - 1, b.d);
  return Math.round((bms - ams) / 86_400_000);
}

/**
 * Resolve a trigger to an absolute expiry date, or null if the inputs needed for
 * that trigger type are missing (e.g. a duration-based item with no purchase
 * date yet — the UI treats null as "needs input", not "never expires").
 */
export function resolveTriggerDate(trigger: ExpiryTrigger): string | null {
  if (trigger.triggerType === 'fixed_date') {
    return trigger.triggerDate ?? null;
  }
  if (
    trigger.anchorDate != null &&
    trigger.durationMonths != null &&
    Number.isFinite(trigger.durationMonths)
  ) {
    return addMonths(trigger.anchorDate, trigger.durationMonths);
  }
  return null;
}

export const DEFAULT_EXPIRING_WINDOW_DAYS = 30;
export const DEFAULT_REMINDER_OFFSETS_DAYS = [30, 15, 7, 1];

/**
 * Classify an item's status relative to `today`. The trigger day itself is still
 * "expiring soon" (active through end of that day); an item is only "expired"
 * once today is strictly past the trigger date.
 */
export function computeStatus(
  triggerDateISO: string,
  todayISO: string,
  expiringWindowDays: number = DEFAULT_EXPIRING_WINDOW_DAYS,
): TrackedStatus {
  const daysUntil = daysBetween(todayISO, triggerDateISO);
  if (daysUntil < 0) {
    return 'expired';
  }
  if (daysUntil <= expiringWindowDays) {
    return 'expiring_soon';
  }
  return 'active';
}

export interface ReminderOccurrence {
  offsetDays: number;
  dateISO: string;
}

/**
 * The concrete calendar dates on which reminders should fire: each is the
 * trigger date minus the offset. Sorted earliest-first. Offsets are
 * de-duplicated and sorted descending on input so the schedule is stable.
 */
export function reminderSchedule(
  triggerDateISO: string,
  offsetsDays: number[] = DEFAULT_REMINDER_OFFSETS_DAYS,
): ReminderOccurrence[] {
  const unique = [...new Set(offsetsDays)].filter((o) => Number.isInteger(o) && o >= 0);
  return unique
    .map((offsetDays) => ({ offsetDays, dateISO: addDays(triggerDateISO, -offsetDays) }))
    .sort((a, b) => daysBetween(b.dateISO, a.dateISO));
}

/**
 * The reminders that are "due" as of `today`: their fire date has arrived and
 * the item has not yet passed its trigger date. Useful for surfacing a badge
 * without a background scheduler. Returned earliest-first.
 */
export function dueReminders(
  triggerDateISO: string,
  todayISO: string,
  offsetsDays: number[] = DEFAULT_REMINDER_OFFSETS_DAYS,
): ReminderOccurrence[] {
  if (daysBetween(todayISO, triggerDateISO) < 0) {
    return []; // already expired — expiry handling takes over from reminders
  }
  return reminderSchedule(triggerDateISO, offsetsDays).filter(
    (occ) => daysBetween(occ.dateISO, todayISO) >= 0,
  );
}
