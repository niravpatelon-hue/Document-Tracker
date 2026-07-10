import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { computeNetBalances } from '@domain/settleup/simplify';
import { formatINR } from '@domain/money';
import { COLORS } from '../theme';
import {
  Avatar,
  BalanceAmount,
  Button,
  Card,
  CategoryAvatar,
  Icon,
  IconChip,
  ListRow,
  SectionLabel,
} from '../components/ui';
import {
  ME,
  colorForId,
  myNetForExpense,
  myShareCents,
  type Expense,
  type Group,
  type Settlement,
} from '../store';

interface Props {
  userName: string | null;
  expenses: Expense[];
  groups: Group[];
  settlements: Settlement[];
  onScan: () => void;
  onAddExpense: () => void;
  onOpenExpenses: () => void;
  onOpenGroups: () => void;
  onOpenGroup: (groupId: string) => void;
  onOpenReports: () => void;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

type ActivityItem =
  | { kind: 'expense'; at: number; expense: Expense }
  | { kind: 'settlement'; at: number; settlement: Settlement };

/** A small circular avatar showing the group's emoji (fallback: initials). */
function EmojiAvatar({ emoji, name, size = 42 }: { emoji?: string; name: string; size?: number }) {
  if (!emoji) return <Avatar name={name} size={size} />;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: COLORS.primarySoft,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontSize: Math.round(size * 0.5) }}>{emoji}</Text>
    </View>
  );
}

export default function ActivityScreen({
  userName,
  expenses,
  groups,
  settlements,
  onScan,
  onAddExpense,
  onOpenExpenses,
  onOpenGroups,
  onOpenGroup,
}: Props) {
  const firstName = useMemo(() => {
    const n = (userName ?? '').trim();
    if (!n) return 'there';
    return n.split(/\s+/)[0]!;
  }, [userName]);

  const monthLabel = useMemo(() => {
    const now = new Date();
    return `${MONTHS[now.getMonth()]} ${now.getFullYear()}`;
  }, []);

  /** Resolve a member id to a display name across all groups. */
  const memberName = useMemo(() => {
    const map = new Map<string, string>();
    for (const g of groups) {
      for (const m of g.members) map.set(m.id, m.name);
    }
    return (id: string): string => {
      if (id === ME) return 'You';
      return map.get(id) ?? 'Someone';
    };
  }, [groups]);

  const groupName = useMemo(() => {
    const map = new Map<string, string>();
    for (const g of groups) map.set(g.id, g.name);
    return (id: string | null): string => (id == null ? 'Personal' : map.get(id) ?? 'Group');
  }, [groups]);

  /** ME net per group via the tested balance engine. */
  const groupNets = useMemo(() => {
    const out = new Map<string, number>();
    for (const g of groups) {
      const ge = expenses.filter((e) => e.groupId === g.id);
      const gs = settlements.filter((s) => s.groupId === g.id);
      const balances = computeNetBalances(
        ge.map((e) => ({ payers: e.paidBy, allocations: e.allocations })),
        gs.map((s) => ({ fromUser: s.fromUser, toUser: s.toUser, amount: s.amountCents })),
      );
      out.set(g.id, balances.find((b) => b.userId === ME)?.net ?? 0);
    }
    return out;
  }, [groups, expenses, settlements]);

  const { overall, totalOwed, totalOwe } = useMemo(() => {
    let overallNet = 0;
    let owed = 0;
    let owe = 0;
    for (const g of groups) {
      const net = groupNets.get(g.id) ?? 0;
      overallNet += net;
      if (net > 0) owed += net;
      else if (net < 0) owe += -net;
    }
    return { overall: overallNet, totalOwed: owed, totalOwe: owe };
  }, [groups, groupNets]);

  const recent = useMemo<ActivityItem[]>(() => {
    const items: ActivityItem[] = [
      ...expenses.map((e) => ({ kind: 'expense' as const, at: e.createdAt, expense: e })),
      ...settlements.map((s) => ({ kind: 'settlement' as const, at: s.createdAt, settlement: s })),
    ];
    items.sort((a, b) => b.at - a.at);
    return items.slice(0, 8);
  }, [expenses, settlements]);

  const payerLabel = (e: Expense): string => {
    if (e.paidBy.length === 0) return '';
    if (e.paidBy.length > 1) return 'multiple paid';
    const p = e.paidBy[0]!;
    return p.userId === ME ? 'you paid' : `${memberName(p.userId)} paid`;
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.hi}>Hi {firstName} 👋</Text>
          <Text style={styles.month}>{monthLabel}</Text>
        </View>
        <IconChip name="bell" color={COLORS.subtext} bg={COLORS.chip} size={42} />
      </View>

      {/* Overall balance hero */}
      <Card style={styles.hero}>
        <Text style={styles.heroCap}>Overall balance</Text>
        {overall === 0 ? (
          <Text style={[styles.heroMoney, { color: COLORS.primaryDark }]}>You&apos;re all settled up 🎉</Text>
        ) : (
          <Text style={styles.heroLine}>
            {overall > 0 ? 'You are owed ' : 'You owe '}
            <Text style={{ color: overall > 0 ? COLORS.owed : COLORS.owe, fontWeight: '900' }}>
              {formatINR(Math.abs(overall))}
            </Text>
            {' overall'}
          </Text>
        )}

        <View style={styles.statRow}>
          <View style={styles.stat}>
            <Text style={styles.statCap}>Owed to you</Text>
            <BalanceAmount cents={totalOwed} kind="owed" size={17} />
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statCap}>You owe</Text>
            <BalanceAmount cents={totalOwe === 0 ? 0 : -totalOwe} kind={totalOwe === 0 ? 'neutral' : 'owe'} size={17} />
          </View>
        </View>

        <View style={styles.heroBtns}>
          <Button label="Scan receipt" onPress={onScan} icon="scan" style={{ flex: 1 }} />
          <Button label="Add expense" onPress={onAddExpense} variant="secondary" icon="plus" style={{ flex: 1 }} />
        </View>
      </Card>

      {/* Your groups */}
      {groups.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <SectionLabel>Your groups</SectionLabel>
            <Text style={styles.seeAll} onPress={onOpenGroups}>See all</Text>
          </View>
          <Card style={{ paddingVertical: 4 }}>
            {groups.slice(0, 5).map((g, i) => {
              const net = groupNets.get(g.id) ?? 0;
              return (
                <View key={g.id}>
                  {i > 0 && <View style={styles.rowDivider} />}
                  <ListRow
                    avatar={<EmojiAvatar emoji={g.emoji} name={g.name} />}
                    title={g.name}
                    subtitle={`${g.members.length} ${g.members.length === 1 ? 'member' : 'members'}`}
                    rightTop={<BalanceAmount cents={net} showSign size={15} />}
                    rightBottom={net === 0 ? 'settled up' : net > 0 ? 'you are owed' : 'you owe'}
                    onPress={() => onOpenGroup(g.id)}
                  />
                </View>
              );
            })}
          </Card>
        </View>
      )}

      {/* Recent activity */}
      <View style={styles.section}>
        <View style={styles.sectionHead}>
          <SectionLabel>Recent activity</SectionLabel>
          {recent.length > 0 && <Text style={styles.seeAll} onPress={onOpenExpenses}>See all</Text>}
        </View>
        <Card style={{ paddingVertical: 4 }}>
          {recent.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>🧾</Text>
              <Text style={styles.emptyTitle}>No activity yet</Text>
              <Text style={styles.emptySub}>Scan a receipt or add an expense to get started.</Text>
            </View>
          ) : (
            recent.map((item, i) => {
              if (item.kind === 'expense') {
                const e = item.expense;
                const isPersonal = e.groupId == null;
                const net = myNetForExpense(e);
                const share = myShareCents(e);
                return (
                  <View key={`e-${e.id}`}>
                    {i > 0 && <View style={styles.rowDivider} />}
                    <ListRow
                      left={<CategoryAvatar category={e.category} />}
                      title={e.description}
                      subtitle={`${groupName(e.groupId)} · ${payerLabel(e)}`}
                      rightTop={
                        isPersonal ? (
                          <BalanceAmount cents={-share} kind="owe" size={15} />
                        ) : (
                          <BalanceAmount cents={net} showSign size={15} />
                        )
                      }
                      rightBottom={
                        isPersonal
                          ? 'your share'
                          : net > 0
                            ? 'you lent'
                            : net < 0
                              ? 'you borrowed'
                              : 'not involved'
                      }
                      onPress={onOpenExpenses}
                    />
                  </View>
                );
              }
              const s = item.settlement;
              const from = memberName(s.fromUser);
              const to = memberName(s.toUser);
              return (
                <View key={`s-${s.id}`}>
                  {i > 0 && <View style={styles.rowDivider} />}
                  <ListRow
                    left={
                      <View style={styles.settleIcon}>
                        <Icon name="wallet" color={COLORS.primary} size={20} />
                      </View>
                    }
                    title={`${from} paid ${to}`}
                    subtitle={`${groupName(s.groupId)}${s.note ? ` · ${s.note}` : ''}`}
                    rightTop={<Text style={styles.settleAmt}>{formatINR(s.amountCents)}</Text>}
                    rightBottom="payment"
                    onPress={onOpenExpenses}
                  />
                </View>
              );
            })
          )}
        </Card>
      </View>

      <View style={{ height: 12 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.screenBg },
  scroll: { padding: 16, paddingBottom: 28 },

  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  hi: { color: COLORS.ink, fontWeight: '900', fontSize: 24, letterSpacing: 0.2 },
  month: { color: COLORS.subtext, fontSize: 13.5, marginTop: 2, fontWeight: '600' },

  hero: { backgroundColor: COLORS.primarySoft, borderRadius: 22, padding: 18 },
  heroCap: {
    color: COLORS.primaryDark,
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  heroMoney: { fontSize: 22, fontWeight: '900' },
  heroLine: { color: COLORS.ink, fontSize: 20, fontWeight: '700' },

  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  stat: { flex: 1 },
  statCap: { color: COLORS.subtext, fontSize: 11.5, fontWeight: '700', marginBottom: 4 },
  statDivider: { width: 1, alignSelf: 'stretch', backgroundColor: COLORS.border, marginHorizontal: 12 },

  heroBtns: { flexDirection: 'row', gap: 10, marginTop: 16 },

  section: { marginTop: 22 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  seeAll: { color: COLORS.primary, fontWeight: '800', fontSize: 13, paddingVertical: 2, paddingLeft: 12 },

  rowDivider: { height: 1, backgroundColor: COLORS.divider, marginLeft: 54 },

  settleIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settleAmt: { color: COLORS.ink, fontWeight: '800', fontSize: 15 },

  empty: { alignItems: 'center', paddingVertical: 28, paddingHorizontal: 16 },
  emptyEmoji: { fontSize: 40, marginBottom: 10 },
  emptyTitle: { color: COLORS.ink, fontWeight: '800', fontSize: 16 },
  emptySub: { color: COLORS.subtext, fontSize: 13, textAlign: 'center', marginTop: 5, lineHeight: 19 },
});
