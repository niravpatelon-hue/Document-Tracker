import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { computeNetBalances } from '@domain/settleup/simplify';
import { formatINR, formatINRShort } from '@domain/money';
import {
  monthKeyOf,
  previousMonth,
  spendByCategory,
  type SpendTxn,
} from '@domain/analytics/spend';
import {
  buildSuggestions,
  potentialSavingsCents,
  type OptimizeCard,
} from '@domain/analytics/optimize';
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
  type IconName,
} from '../components/ui';
import {
  ME,
  expenseToSpendTxn,
  myNetForExpense,
  myShareCents,
  type Budget,
  type CreditCard,
  type Expense,
  type Group,
  type Settlement,
} from '../store';

interface Props {
  userName: string | null;
  expenses: Expense[];
  groups: Group[];
  settlements: Settlement[];
  cards: CreditCard[];
  budgets: Budget[];
  onScan: () => void;
  onAddExpense: () => void;
  onOpenPersonal: () => void;
  onOpenGroups: () => void;
  onOpenAnalysis: () => void;
  onOpenOptimize: () => void;
  onOpenCards: () => void;
  onOpenGroup: (groupId: string) => void;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const TODAY = new Date().toISOString().slice(0, 10);

/** Whole days from today to an ISO date (negative = past). */
function daysUntil(dueISO: string): number {
  const a = Date.parse(`${TODAY}T00:00:00Z`);
  const b = Date.parse(`${dueISO}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

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

/** A tappable feature tile for the hub grid. */
function FeatureTile({
  icon,
  iconColor,
  iconBg,
  title,
  stat,
  sub,
  badge,
  highlight,
  onPress,
}: {
  icon: IconName;
  iconColor: string;
  iconBg: string;
  title: string;
  stat: string;
  sub?: string;
  badge?: string;
  highlight?: boolean;
  onPress: () => void;
}) {
  return (
    <Card
      onPress={onPress}
      style={[styles.tile, highlight && styles.tileHighlight] as any}
    >
      <View style={styles.tileTop}>
        <IconChip name={icon} color={iconColor} bg={iconBg} size={40} />
        {badge != null && (
          <View style={styles.tileBadge}>
            <Text style={styles.tileBadgeText}>{badge}</Text>
          </View>
        )}
      </View>
      <Text style={styles.tileTitle}>{title}</Text>
      <Text style={styles.tileStat} numberOfLines={1}>{stat}</Text>
      {sub != null && <Text style={styles.tileSub} numberOfLines={1}>{sub}</Text>}
    </Card>
  );
}

export default function HomeScreen({
  userName,
  expenses,
  groups,
  settlements,
  cards,
  budgets,
  onScan,
  onAddExpense,
  onOpenPersonal,
  onOpenGroups,
  onOpenAnalysis,
  onOpenOptimize,
  onOpenCards,
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

  const nowKey = useMemo(() => monthKeyOf(TODAY), []);
  const prevKey = useMemo(() => previousMonth(nowKey), [nowKey]);

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

  const overallNet = useMemo(() => {
    let sum = 0;
    for (const g of groups) sum += groupNets.get(g.id) ?? 0;
    return sum;
  }, [groups, groupNets]);

  /** This-month personal spend (groupId === null, own share). */
  const personalThisMonth = useMemo(
    () =>
      expenses
        .filter((e) => e.groupId == null && monthKeyOf(e.dateISO) === nowKey)
        .reduce((s, e) => s + myShareCents(e), 0),
    [expenses, nowKey],
  );

  /** This-month spend across everything, as own-share spend txns. */
  const thisMonthTxns = useMemo<SpendTxn[]>(
    () =>
      expenses
        .filter((e) => monthKeyOf(e.dateISO) === nowKey)
        .map(expenseToSpendTxn),
    [expenses, nowKey],
  );

  const prevMonthTxns = useMemo<SpendTxn[]>(
    () =>
      expenses
        .filter((e) => monthKeyOf(e.dateISO) === prevKey)
        .map(expenseToSpendTxn),
    [expenses, prevKey],
  );

  const thisMonthTotal = useMemo(
    () => thisMonthTxns.reduce((s, t) => s + t.amount, 0),
    [thisMonthTxns],
  );

  const topCategory = useMemo(() => {
    const byCat = spendByCategory(thisMonthTxns).filter((c) => c.total > 0);
    return byCat[0] ?? null;
  }, [thisMonthTxns]);

  /** Optimize suggestions + potential savings for the current month. */
  const optimize = useMemo(() => {
    const optCards: OptimizeCard[] = cards.map((c) => ({
      name: c.name,
      outstandingCents: c.outstandingCents,
      limitCents: c.limitCents,
      dueDateISO: c.dueDateISO,
    }));
    const suggestions = buildSuggestions({
      txns: thisMonthTxns,
      prevTxns: prevMonthTxns,
      budgets: budgets.map((b) => ({ category: b.category, limitCents: b.limitCents })),
      cards: optCards,
      todayISO: TODAY,
    });
    return { count: suggestions.length, savings: potentialSavingsCents(suggestions) };
  }, [thisMonthTxns, prevMonthTxns, budgets, cards]);

  const cardStats = useMemo(() => {
    const outstanding = cards.reduce((s, c) => s + c.outstandingCents, 0);
    const dueSoon = cards.some((c) => {
      const d = daysUntil(c.dueDateISO);
      return d <= 7; // includes overdue and within a week
    });
    return { outstanding, dueSoon, count: cards.length };
  }, [cards]);

  const topGroups = useMemo(() => groups.slice(0, 3), [groups]);

  const recent = useMemo(
    () => expenses.slice().sort((a, b) => b.createdAt - a.createdAt).slice(0, 4),
    [expenses],
  );

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
        {overallNet === 0 ? (
          <Text style={[styles.heroMoney, { color: COLORS.primaryDark }]}>You&apos;re all settled up 🎉</Text>
        ) : (
          <Text style={styles.heroLine}>
            {overallNet > 0 ? 'You are owed ' : 'You owe '}
            <Text style={{ color: overallNet > 0 ? COLORS.owed : COLORS.owe, fontWeight: '900' }}>
              {formatINR(Math.abs(overallNet))}
            </Text>
            {' overall'}
          </Text>
        )}
        <View style={styles.heroBtns}>
          <Button label="Scan receipt" onPress={onScan} icon="scan" style={{ flex: 1 }} />
          <Button label="Add expense" onPress={onAddExpense} variant="secondary" icon="plus" style={{ flex: 1 }} />
        </View>
      </Card>

      {/* Feature grid */}
      <View style={styles.grid}>
        <View style={styles.gridRow}>
          <FeatureTile
            icon="wallet"
            iconColor={COLORS.primary}
            iconBg={COLORS.primarySoft}
            title="Personal"
            stat={formatINRShort(personalThisMonth)}
            sub="spent this month"
            onPress={onOpenPersonal}
          />
          <FeatureTile
            icon="users"
            iconColor={COLORS.info}
            iconBg={COLORS.chip}
            title="Groups"
            stat={overallNet === 0 ? 'Settled' : `${overallNet > 0 ? '+' : '−'}${formatINRShort(Math.abs(overallNet))}`}
            sub={`${groups.length} group${groups.length === 1 ? '' : 's'}`}
            onPress={onOpenGroups}
          />
        </View>
        <View style={styles.gridRow}>
          <FeatureTile
            icon="list"
            iconColor={COLORS.warn}
            iconBg={COLORS.warnSoft}
            title="Analysis"
            stat={formatINRShort(thisMonthTotal)}
            sub={topCategory ? `Top: ${topCategory.category}` : 'this month'}
            onPress={onOpenAnalysis}
          />
          <FeatureTile
            icon="sparkles"
            iconColor={COLORS.primaryDark}
            iconBg={COLORS.primarySoft}
            title="Optimize"
            stat={`${optimize.count} tip${optimize.count === 1 ? '' : 's'}`}
            sub={optimize.savings > 0 ? `save ~${formatINRShort(optimize.savings)}` : 'you’re on track'}
            highlight
            onPress={onOpenOptimize}
          />
        </View>
        <View style={styles.gridRow}>
          <FeatureTile
            icon="wallet"
            iconColor={COLORS.owe}
            iconBg={COLORS.oweSoft}
            title="Credit Cards"
            stat={formatINRShort(cardStats.outstanding)}
            sub={cardStats.count === 0 ? 'add a card' : 'outstanding'}
            badge={cardStats.dueSoon ? 'Due soon' : undefined}
            onPress={onOpenCards}
          />
          <View style={styles.tileSpacer} />
        </View>
      </View>

      {/* Your groups */}
      {topGroups.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <SectionLabel>Your groups</SectionLabel>
            <Text style={styles.seeAll} onPress={onOpenGroups}>See all</Text>
          </View>
          <Card style={{ paddingVertical: 4 }}>
            {topGroups.map((g, i) => {
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
          {recent.length > 0 && <Text style={styles.seeAll} onPress={onOpenAnalysis}>See all</Text>}
        </View>
        <Card style={{ paddingVertical: 4 }}>
          {recent.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>🧾</Text>
              <Text style={styles.emptyTitle}>No activity yet</Text>
              <Text style={styles.emptySub}>Scan a receipt or add an expense to get started.</Text>
            </View>
          ) : (
            recent.map((e, i) => {
              const isPersonal = e.groupId == null;
              const net = myNetForExpense(e);
              const share = myShareCents(e);
              return (
                <View key={e.id}>
                  {i > 0 && <View style={styles.rowDivider} />}
                  <ListRow
                    left={<CategoryAvatar category={e.category} />}
                    title={e.description}
                    subtitle={groupName(e.groupId)}
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
                    onPress={isPersonal ? onOpenPersonal : onOpenAnalysis}
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
  heroBtns: { flexDirection: 'row', gap: 10, marginTop: 16 },

  grid: { marginTop: 18, gap: 12 },
  gridRow: { flexDirection: 'row', gap: 12 },
  tile: { flex: 1, borderRadius: 20, padding: 14, minHeight: 118 },
  tileSpacer: { flex: 1 },
  tileHighlight: { backgroundColor: COLORS.primarySoft },
  tileTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tileBadge: {
    backgroundColor: COLORS.oweSoft,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tileBadgeText: { color: COLORS.owe, fontWeight: '800', fontSize: 10.5 },
  tileTitle: { color: COLORS.subtext, fontWeight: '700', fontSize: 12.5, marginTop: 12 },
  tileStat: { color: COLORS.ink, fontWeight: '900', fontSize: 19, marginTop: 3 },
  tileSub: { color: COLORS.subtext, fontSize: 11.5, marginTop: 2, fontWeight: '600' },

  section: { marginTop: 22 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  seeAll: { color: COLORS.primary, fontWeight: '800', fontSize: 13, paddingVertical: 2, paddingLeft: 12 },

  rowDivider: { height: 1, backgroundColor: COLORS.divider, marginLeft: 54 },

  empty: { alignItems: 'center', paddingVertical: 28, paddingHorizontal: 16 },
  emptyEmoji: { fontSize: 40, marginBottom: 10 },
  emptyTitle: { color: COLORS.ink, fontWeight: '800', fontSize: 16 },
  emptySub: { color: COLORS.subtext, fontSize: 13, textAlign: 'center', marginTop: 5, lineHeight: 19 },
});
