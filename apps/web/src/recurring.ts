/**
 * Recurring expenses — a template that periodically materializes into a real
 * Expense (personal or auto-split to a group) without a server-side scheduler.
 * On each app load, any rule whose next due date has already arrived is
 * "caught up": one Expense is generated per elapsed period (capped) and the
 * rule's next due date advances past today. Editing a rule only changes
 * future occurrences — already-generated Expenses are independent records.
 */
import { computeSplit, type SplitParticipantInput } from '@domain/splitting';
import { ME, newId, type Allocation, type Expense, type Payment, type RecurringExpense } from './store';

function addPeriod(dateISO: string, frequency: RecurringExpense['frequency'], interval: number): string {
  const d = new Date(`${dateISO}T00:00:00`);
  const n = Math.max(1, Math.round(interval) || 1);
  if (frequency === 'weekly') d.setDate(d.getDate() + 7 * n);
  else if (frequency === 'monthly') d.setMonth(d.getMonth() + n);
  else d.setFullYear(d.getFullYear() + n);
  return d.toISOString().slice(0, 10);
}

/** Friendly cadence text, e.g. "Every month" / "Every 2 weeks". */
export function frequencyLabel(frequency: RecurringExpense['frequency'], interval: number): string {
  const unit = frequency === 'weekly' ? 'week' : frequency === 'monthly' ? 'month' : 'year';
  const n = Math.max(1, Math.round(interval) || 1);
  return n <= 1 ? `Every ${unit}` : `Every ${n} ${unit}s`;
}

const MAX_CATCHUP = 24;

function buildOccurrenceExpense(rule: RecurringExpense, dateISO: string, id: string): Expense {
  const participants: SplitParticipantInput[] = rule.groupId
    ? rule.involvedIds.map((id) => ({
        userId: id,
        value: rule.participantValues.find((p) => p.userId === id)?.value,
      }))
    : [{ userId: ME }];

  let allocations: Allocation[];
  if (rule.groupId) {
    try {
      allocations = computeSplit(rule.amountCents, rule.splitType, participants);
    } catch {
      allocations = [{ userId: ME, cents: rule.amountCents }];
    }
  } else {
    allocations = [{ userId: ME, cents: rule.amountCents }];
  }

  const paidBy: Payment[] = [{ userId: rule.groupId ? rule.paidBy : ME, cents: rule.amountCents }];

  return {
    id,
    createdAt: Date.now(),
    description: rule.description,
    amountCents: rule.amountCents,
    currency: 'INR',
    dateISO,
    category: rule.category,
    notes: rule.notes,
    source: 'manual',
    imageDataUrl: null,
    rawText: null,
    taxCents: null,
    groupId: rule.groupId,
    cardId: null,
    settled: false,
    paidBy,
    involvedIds: rule.groupId ? rule.involvedIds : [ME],
    splitType: rule.groupId ? rule.splitType : 'equal',
    allocations,
  };
}

export interface MaterializeResult {
  newExpenses: Expense[];
  updatedRules: RecurringExpense[];
}

/**
 * Catch up every active rule whose nextDueISO is on/before todayISO. Pure —
 * the caller persists the result. `makeId` defaults to a random id (personal
 * rules, single writer); group rules pass a deterministic id derived from the
 * rule + occurrence date, so two members' clients racing to catch up the same
 * overdue occurrence can be de-duplicated by the caller before persisting.
 */
export function materializeDueRecurring(
  rules: RecurringExpense[],
  todayISO: string,
  makeId: (rule: RecurringExpense, dateISO: string) => string = () => newId(),
): MaterializeResult {
  const newExpenses: Expense[] = [];
  const updatedRules = rules.map((r) => ({ ...r }));

  for (const rule of updatedRules) {
    if (!rule.active) continue;
    let guard = 0;
    while (rule.nextDueISO <= todayISO && guard < MAX_CATCHUP) {
      newExpenses.push(buildOccurrenceExpense(rule, rule.nextDueISO, makeId(rule, rule.nextDueISO)));
      rule.occurrenceCount += 1;
      rule.nextDueISO = addPeriod(rule.nextDueISO, rule.frequency, rule.interval);
      guard += 1;
    }
  }

  return { newExpenses, updatedRules };
}
