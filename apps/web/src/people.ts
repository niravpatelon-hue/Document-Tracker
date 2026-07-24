/**
 * Cross-group "people" view — the same friend often appears in more than one
 * group (e.g. Rahul is in both "Goa Trip" and "Flatmates"). This merges a
 * person's memberships across all groups (by normalized name, since each group
 * mints its own local member id) and computes ONE bilateral balance against
 * them using the real per-expense split data (@domain/settleup/pairwise) —
 * not the group's aggregate net, which can't be attributed to one specific
 * other member once a group has 3+ people.
 */
import { pairwiseNet } from '@domain/settleup/pairwise';
import { ME, type Expense, type Group, type Settlement } from './store';

export interface PersonGroupRef {
  groupId: string;
  groupName: string;
  memberId: string;
  /** Positive => they owe you (in this group); negative => you owe them. */
  netCents: number;
}

export interface Person {
  /** Normalized (trimmed, lowercased) name — the merge key across groups. */
  key: string;
  name: string;
  upi?: string;
  /** Sum of this person's per-group nets. Positive => they owe you overall. */
  totalNetCents: number;
  groups: PersonGroupRef[];
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

/** Build the merged, cross-group people list with a real bilateral balance for each. */
export function buildPeople(groups: Group[], expenses: Expense[], settlements: Settlement[]): Person[] {
  const byKey = new Map<string, Person>();

  for (const g of groups) {
    const groupExpenses = expenses
      .filter((e) => e.groupId === g.id)
      .map((e) => ({ payers: e.paidBy, allocations: e.allocations }));
    const groupSettlements = settlements
      .filter((s) => s.groupId === g.id)
      .map((s) => ({ fromUser: s.fromUser, toUser: s.toUser, amount: s.amountCents }));

    for (const m of g.members) {
      if (m.id === ME) continue;
      const key = normalizeName(m.name);
      const netCents = pairwiseNet(ME, m.id, groupExpenses, groupSettlements);
      const ref: PersonGroupRef = { groupId: g.id, groupName: g.name, memberId: m.id, netCents };

      const existing = byKey.get(key);
      if (existing) {
        existing.groups.push(ref);
        existing.totalNetCents += netCents;
        if (!existing.upi && m.upi) existing.upi = m.upi;
      } else {
        byKey.set(key, { key, name: m.name, upi: m.upi, totalNetCents: netCents, groups: [ref] });
      }
    }
  }

  return [...byKey.values()]
    .filter((p) => p.groups.some((g) => g.netCents !== 0) || p.groups.length > 1)
    .sort((a, b) => Math.abs(b.totalNetCents) - Math.abs(a.totalNetCents));
}

export interface ApportionedSettlement {
  groupId: string;
  fromUser: string;
  toUser: string;
  amountCents: number;
}

/**
 * Settle every one of this person's non-zero group balances IN FULL. This is
 * deliberately not a proportional split of `totalNetCents` — if they owe you
 * ₹500 in one group and you owe them ₹200 in another, the real cash that needs
 * to move is ₹500 and ₹200 (two payments in opposite directions), not some
 * fraction of the ₹300 net; settling only the net would leave one of the two
 * groups incorrectly non-zero.
 */
export function apportionSettlement(person: Person): ApportionedSettlement[] {
  return person.groups
    .filter((g) => g.netCents !== 0)
    .map((g) => ({
      groupId: g.groupId,
      fromUser: g.netCents > 0 ? g.memberId : ME,
      toUser: g.netCents > 0 ? ME : g.memberId,
      amountCents: Math.abs(g.netCents),
    }));
}
