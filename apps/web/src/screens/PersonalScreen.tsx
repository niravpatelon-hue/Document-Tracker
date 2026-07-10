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
  SectionLabel,
  SegmentBar,
} from '../components/ui';
import { categoryColor, expenseToSpendTxn, myShareCents, type Expense } from '../store';

interface Props {
  expenses: Expense[];
  onScan: () => void;
  onAddExpense: () => void;
  onEditExpense: (e: Expense) => void;
  onOpenAnalysis: () => void;
}

function formatDateLabel(dateISO: string): string {
  const d = new Date(`${dateISO}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateISO;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function PersonalScreen({ expenses, onScan, onAddExpense, onEditExpense, onOpenAnalysis }: Props) {
  const [query, setQuery] = useState('');

  const personal = useMemo(() => expenses.filter((e) => e.groupId == null), [expenses]);

  const nowKey = useMemo(() => monthKeyOf(new Date().toISOString().slice(0, 10)), []);

  const personalTxns = useMemo(() => personal.map(expenseToSpendTxn), [personal]);

  const thisMonthTotal = useMemo(
    () =>
      personal
        .filter((e) => monthKeyOf(e.dateISO) === nowKey)
        .reduce((sum, e) => sum + myShareCents(e), 0),
    [personal, nowKey],
  );

  const momComparison = useMemo(() => monthOverMonth(personalTxns, nowKey), [personalTxns, nowKey]);

  const filtered = useMemo(() => {
    let list = personal;
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((e) => e.description.toLowerCase().includes(q));
    return [...list].sort((a, b) => b.createdAt - a.createdAt);
  }, [personal, query]);

  const categoryTotals = useMemo(() => {
    const txns = personal.map(expenseToSpendTxn);
    return spendByCategory(txns).filter((c) => c.total > 0);
  }, [personal]);

  const categoryGrandTotal = useMemo(
    () => categoryTotals.reduce((s, c) => s + c.total, 0),
    [categoryTotals],
  );

  const topCategories = categoryTotals.slice(0, 4);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Personal · This month</Text>
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

      {/* Actions */}
      <View style={styles.actions}>
        <Button label="Scan receipt" onPress={onScan} icon="scan" style={{ flex: 1 }} />
        <Button label="Add expense" onPress={onAddExpense} variant="secondary" icon="plus" style={{ flex: 1 }} />
      </View>

      {/* Category breakdown */}
      {categoryTotals.length > 0 && (
        <Card style={{ marginTop: 18 }}>
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

      {/* Search */}
      <View style={styles.searchBox}>
        <Icon name="search" color={COLORS.subtext} size={17} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search personal expenses"
          placeholderTextColor={COLORS.muted}
          style={styles.searchInput}
        />
      </View>

      {/* Expense list */}
      <View style={styles.section}>
        <SectionLabel>Personal expenses</SectionLabel>
        {filtered.length === 0 ? (
          <Card>
            <EmptyState
              emoji="🧾"
              title="No personal expenses found"
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
                  subtitle={`${formatDateLabel(e.dateISO)} · ${e.source === 'scan' ? 'Scanned' : 'Manual'}`}
                  rightTop={<Text style={styles.rowAmt}>{formatINR(myShareCents(e))}</Text>}
                  onPress={() => onEditExpense(e)}
                />
              </View>
            ))}
          </Card>
        )}
      </View>

      <Text style={styles.analysisLink} onPress={onOpenAnalysis}>View full analysis →</Text>

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

  actions: { flexDirection: 'row', gap: 10 },

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
    marginTop: 18,
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
  rowDivider: { height: 1, backgroundColor: COLORS.divider, marginLeft: 52 },
  rowAmt: { color: COLORS.ink, fontWeight: '800', fontSize: 15 },

  analysisLink: {
    textAlign: 'center',
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: 13.5,
    marginTop: 14,
  },
});
