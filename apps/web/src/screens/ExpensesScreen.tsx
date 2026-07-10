import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { formatINR, formatINRShort } from '@domain/money';
import { monthKeyOf, monthOverMonth, spendByCategory } from '@domain/analytics/spend';
import { COLORS } from '../theme';
import {
  Button,
  Card,
  CategoryAvatar,
  EmptyState,
  Icon,
  ListRow,
  Pill,
  SectionLabel,
  SegmentBar,
} from '../components/ui';
import { categoryColor, expenseToSpendTxn, myShareCents, type Expense, type Group } from '../store';

interface Props {
  expenses: Expense[];
  groups: Group[];
  onScan: () => void;
  onAddExpense: () => void;
  onEditExpense: (e: Expense) => void;
  onOpenReports: () => void;
}

type FilterKind = 'all' | 'personal' | 'shared';

function formatDateLabel(dateISO: string): string {
  const d = new Date(`${dateISO}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateISO;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function ExpensesScreen({ expenses, groups, onScan, onAddExpense, onEditExpense, onOpenReports }: Props) {
  const [filter, setFilter] = useState<FilterKind>('all');
  const [query, setQuery] = useState('');

  const groupName = useMemo(() => {
    const map = new Map<string, string>();
    for (const g of groups) map.set(g.id, g.name);
    return (id: string | null): string => (id == null ? 'Personal' : map.get(id) ?? 'Group');
  }, [groups]);

  const nowKey = useMemo(() => monthKeyOf(new Date().toISOString().slice(0, 10)), []);

  const allTxns = useMemo(() => expenses.map(expenseToSpendTxn), [expenses]);

  const thisMonthTotal = useMemo(
    () =>
      expenses
        .filter((e) => monthKeyOf(e.dateISO) === nowKey)
        .reduce((sum, e) => sum + myShareCents(e), 0),
    [expenses, nowKey],
  );

  const momComparison = useMemo(() => monthOverMonth(allTxns, nowKey), [allTxns, nowKey]);

  const filtered = useMemo(() => {
    let list = expenses;
    if (filter === 'personal') list = list.filter((e) => e.groupId == null);
    else if (filter === 'shared') list = list.filter((e) => e.groupId != null);
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((e) => e.description.toLowerCase().includes(q));
    return [...list].sort((a, b) => b.createdAt - a.createdAt);
  }, [expenses, filter, query]);

  const categoryTotals = useMemo(() => {
    const txns = filtered.map(expenseToSpendTxn);
    return spendByCategory(txns).filter((c) => c.total > 0);
  }, [filtered]);

  const categoryGrandTotal = useMemo(
    () => categoryTotals.reduce((s, c) => s + c.total, 0),
    [categoryTotals],
  );

  const topCategories = categoryTotals.slice(0, 4);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.eyebrow}>This month</Text>
        <Text style={styles.total}>{formatINR(thisMonthTotal)}</Text>
        {momComparison.deltaPct != null && (
          <View
            style={[
              styles.deltaChip,
              { backgroundColor: momComparison.delta > 0 ? COLORS.oweSoft : COLORS.owedSoft },
            ]}
          >
            <Icon
              name={momComparison.delta > 0 ? 'arrowUp' : 'arrowDown'}
              color={momComparison.delta > 0 ? COLORS.owe : COLORS.owed}
              size={13}
            />
            <Text
              style={[
                styles.deltaText,
                { color: momComparison.delta > 0 ? COLORS.owe : COLORS.owed },
              ]}
            >
              {Math.abs(momComparison.deltaPct).toFixed(0)}% vs last month
            </Text>
          </View>
        )}
      </View>

      {/* Filters */}
      <View style={styles.filterRow}>
        <Pill label="All" active={filter === 'all'} onPress={() => setFilter('all')} />
        <Pill label="Personal" active={filter === 'personal'} onPress={() => setFilter('personal')} />
        <Pill label="Shared" active={filter === 'shared'} onPress={() => setFilter('shared')} />
      </View>
      <View style={styles.searchBox}>
        <Icon name="search" color={COLORS.subtext} size={17} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search expenses"
          placeholderTextColor={COLORS.muted}
          style={styles.searchInput}
        />
      </View>

      {/* Category breakdown */}
      {categoryTotals.length > 0 && (
        <Card style={{ marginTop: 16 }}>
          <SectionLabel>Category breakdown</SectionLabel>
          <SegmentBar
            segments={categoryTotals.map((c) => ({ value: c.total, color: categoryColor(c.category) }))}
          />
          <View style={{ marginTop: 12 }}>
            {topCategories.map((c, i) => {
              const pct = categoryGrandTotal > 0 ? Math.round((c.total / categoryGrandTotal) * 100) : 0;
              return (
                <View key={c.category} style={[styles.catRow, i > 0 && styles.catRowBorder]}>
                  <View style={[styles.catDot, { backgroundColor: categoryColor(c.category) }]} />
                  <Text style={styles.catName}>{c.category}</Text>
                  <Text style={styles.catPct}>{pct}%</Text>
                  <Text style={styles.catAmt}>{formatINRShort(c.total)}</Text>
                </View>
              );
            })}
          </View>
        </Card>
      )}

      {/* Expense list */}
      <View style={styles.section}>
        <View style={styles.sectionHead}>
          <SectionLabel>All expenses</SectionLabel>
          <Text style={styles.seeAll} onPress={onOpenReports}>Reports</Text>
        </View>
        {filtered.length === 0 ? (
          <Card>
            <EmptyState
              emoji="🧾"
              title="No expenses found"
              subtitle={query ? 'Try a different search.' : 'Scan a receipt or add an expense to get started.'}
              actionLabel="Add expense"
              onAction={onAddExpense}
            />
          </Card>
        ) : (
          <Card style={{ paddingVertical: 4 }}>
            {filtered.map((e, i) => (
              <View key={e.id}>
                {i > 0 && <View style={styles.rowDivider} />}
                <ListRow
                  left={<CategoryAvatar category={e.category} />}
                  title={e.description}
                  subtitle={`${groupName(e.groupId)} · ${formatDateLabel(e.dateISO)}`}
                  rightTop={<Text style={styles.rowAmt}>{formatINR(myShareCents(e))}</Text>}
                  rightBottom={e.groupId == null ? 'personal' : 'your share'}
                  onPress={() => onEditExpense(e)}
                />
              </View>
            ))}
          </Card>
        )}
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <Button label="Scan receipt" onPress={onScan} icon="scan" style={{ flex: 1 }} />
        <Button label="Add expense" onPress={onAddExpense} variant="secondary" icon="plus" style={{ flex: 1 }} />
      </View>
      <Text style={styles.reportsLink} onPress={onOpenReports}>View spending reports →</Text>

      <View style={{ height: 12 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.screenBg },
  scroll: { padding: 16, paddingBottom: 28 },

  header: { marginBottom: 16 },
  eyebrow: {
    color: COLORS.subtext,
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  total: { color: COLORS.ink, fontWeight: '900', fontSize: 30, marginTop: 4 },
  deltaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  deltaText: { fontWeight: '800', fontSize: 12 },

  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },

  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14.5,
    color: COLORS.ink,
    outlineStyle: 'none',
  } as any,

  catRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9 },
  catRowBorder: { borderTopWidth: 1, borderTopColor: COLORS.divider },
  catDot: { width: 9, height: 9, borderRadius: 5, marginRight: 10 },
  catName: { flex: 1, color: COLORS.ink, fontWeight: '600', fontSize: 13.5 },
  catPct: { color: COLORS.subtext, fontWeight: '700', fontSize: 12.5, marginRight: 10, width: 34, textAlign: 'right' },
  catAmt: { color: COLORS.ink, fontWeight: '800', fontSize: 13.5, minWidth: 68, textAlign: 'right' },

  section: { marginTop: 22 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  seeAll: { color: COLORS.primary, fontWeight: '800', fontSize: 13, paddingVertical: 2, paddingLeft: 12 },
  rowDivider: { height: 1, backgroundColor: COLORS.divider, marginLeft: 52 },
  rowAmt: { color: COLORS.ink, fontWeight: '800', fontSize: 15 },

  actions: { flexDirection: 'row', gap: 10, marginTop: 22 },
  reportsLink: {
    textAlign: 'center',
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: 13.5,
    marginTop: 14,
  },
});
