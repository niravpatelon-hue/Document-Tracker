import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { formatINR, formatINRShort, toCents } from '@domain/money';
import {
  monthKeyOf,
  spendByCategory,
  spendByMonth,
  type SpendTxn,
} from '@domain/analytics/spend';
import { evaluateBudget } from '@domain/analytics/budget';
import { mileageSummary } from '@domain/business/mileage';
import { transactionsToCsv } from '@domain/export/csv';
import { COLORS } from '../theme';
import {
  Button,
  Card,
  Field,
  Icon,
  MiniBars,
  Pill,
  SectionLabel,
  SegmentBar,
} from '../components/ui';
import {
  EXPENSE_CATEGORIES,
  categoryColor,
  expenseToSpendTxn,
  myShareCents,
  type Budget,
  type Expense,
  type MileageTrip,
} from '../store';

interface Props {
  expenses: Expense[];
  budgets: Budget[];
  mileage: MileageTrip[];
  onAddBudget: (b: {
    category: string;
    period: 'monthly' | 'yearly';
    limitCents: number;
    alertThresholdPct: number;
  }) => void;
  onDeleteBudget: (id: string) => void;
  onOpenMileage: () => void;
}

const TODAY = new Date().toISOString().slice(0, 10);

function monthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  const d = new Date(y!, (m ?? 1) - 1, 1);
  return d.toLocaleDateString('en-IN', { month: 'short' });
}

function downloadCsv(csv: string, filename: string) {
  if (typeof document === 'undefined') return;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function ReportsScreen({
  expenses,
  budgets,
  mileage,
  onAddBudget,
  onDeleteBudget,
  onOpenMileage,
}: Props) {
  const [addingBudget, setAddingBudget] = useState(false);
  const [budgetCategory, setBudgetCategory] = useState(EXPENSE_CATEGORIES[0]!.key);
  const [budgetLimit, setBudgetLimit] = useState('');
  const [budgetPeriod, setBudgetPeriod] = useState<'monthly' | 'yearly'>('monthly');

  const myTxns: SpendTxn[] = useMemo(() => expenses.map(expenseToSpendTxn), [expenses]);

  const nowKey = useMemo(() => monthKeyOf(TODAY), []);

  const thisMonthTotal = useMemo(
    () => myTxns.filter((t) => monthKeyOf(t.dateISO) === nowKey).reduce((s, t) => s + t.amount, 0),
    [myTxns, nowKey],
  );

  const monthTotals = useMemo(() => spendByMonth(myTxns), [myTxns]);
  const last6 = useMemo(() => monthTotals.slice(-6), [monthTotals]);
  const monthBarsData = last6.map((m) => m.total);
  const monthBarsLabels = last6.map((m) => monthLabel(m.month));

  const categoryTotals = useMemo(() => spendByCategory(myTxns).filter((c) => c.total > 0), [myTxns]);
  const categoryGrandTotal = useMemo(
    () => categoryTotals.reduce((s, c) => s + c.total, 0),
    [categoryTotals],
  );

  const mileageStats = useMemo(() => mileageSummary(mileage), [mileage]);

  const budgetStatuses = useMemo(
    () =>
      budgets.map((b) => ({
        budget: b,
        status: evaluateBudget(
          { category: b.category, period: b.period, limitCents: b.limitCents, alertThresholdPct: b.alertThresholdPct },
          myTxns,
          TODAY,
        ),
      })),
    [budgets, myTxns],
  );

  const canSaveBudget = toCents(parseFloat(budgetLimit) || 0) > 0;

  function startAddBudget() {
    setBudgetCategory(EXPENSE_CATEGORIES[0]!.key);
    setBudgetLimit('');
    setBudgetPeriod('monthly');
    setAddingBudget(true);
  }

  function saveBudget() {
    const limitCents = toCents(parseFloat(budgetLimit) || 0);
    if (limitCents <= 0) return;
    onAddBudget({ category: budgetCategory, period: budgetPeriod, limitCents, alertThresholdPct: 80 });
    setAddingBudget(false);
  }

  function exportCsv() {
    const rows = expenses
      .slice()
      .sort((a, b) => a.dateISO.localeCompare(b.dateISO))
      .map((e) => ({
        dateISO: e.dateISO,
        vendor: e.description,
        category: e.category,
        amount: myShareCents(e),
        taxAmount: e.taxCents ?? undefined,
      }));
    const csv = transactionsToCsv(rows);
    downloadCsv(csv, `expenses-${TODAY}.csv`);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      <Text style={styles.screenTitle}>Reports</Text>

      {/* This month + trend */}
      <Card style={{ marginTop: 14 }}>
        <SectionLabel>This month</SectionLabel>
        <Text style={styles.bigTotal}>{formatINR(thisMonthTotal)}</Text>
        {monthBarsData.length > 0 && (
          <View style={{ marginTop: 14 }}>
            <MiniBars data={monthBarsData} labels={monthBarsLabels} height={54} />
          </View>
        )}
      </Card>

      {/* Category breakdown */}
      <Card style={{ marginTop: 14 }}>
        <SectionLabel>Category breakdown</SectionLabel>
        {categoryTotals.length === 0 ? (
          <Text style={styles.empty}>No spending yet.</Text>
        ) : (
          <>
            <View style={{ marginTop: 10 }}>
              <SegmentBar
                segments={categoryTotals.map((c) => ({ value: c.total, color: categoryColor(c.category) }))}
              />
            </View>
            <View style={{ marginTop: 12 }}>
              {categoryTotals.map((c, i) => {
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
          </>
        )}
      </Card>

      {/* Budgets */}
      <View style={styles.sectionHead}>
        <SectionLabel>Budgets</SectionLabel>
        {!addingBudget && (
          <Pressable onPress={startAddBudget} hitSlop={8} style={styles.addBudgetBtn}>
            <Icon name="plus" color={COLORS.primary} size={15} strokeWidth={2.4} />
            <Text style={styles.addBudgetText}>Add</Text>
          </Pressable>
        )}
      </View>

      {budgetStatuses.length === 0 && !addingBudget && (
        <Card>
          <Text style={styles.empty}>No budgets set. Add one to track spending against a limit.</Text>
        </Card>
      )}

      {budgetStatuses.map(({ budget, status }) => {
        const over = status.state === 'over';
        const warn = status.state === 'warn';
        const barColor = over ? COLORS.danger : warn ? COLORS.warn : COLORS.primary;
        const remaining = budget.limitCents - status.spentCents;
        return (
          <Card key={budget.id} style={{ marginBottom: 10 }}>
            <View style={styles.budgetTopRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.budgetCategory}>{budget.category}</Text>
                <Text style={styles.budgetPeriod}>{budget.period === 'monthly' ? 'Monthly' : 'Yearly'} limit</Text>
              </View>
              <Pressable onPress={() => onDeleteBudget(budget.id)} hitSlop={8}>
                <Icon name="trash" color={COLORS.subtext} size={16} />
              </Pressable>
            </View>
            <View style={{ marginTop: 10 }}>
              <SegmentBar segments={[{ value: Math.max(1, Math.min(status.pct, 100)), color: barColor }]} height={8} />
            </View>
            <View style={styles.budgetBottomRow}>
              <Text style={[styles.budgetPct, { color: barColor }]}>{Math.round(status.pct)}%</Text>
              <Text style={styles.budgetRemaining}>
                {remaining >= 0
                  ? `${formatINRShort(remaining)} left`
                  : `${formatINRShort(Math.abs(remaining))} over`}
                {' · '}
                {formatINRShort(status.spentCents)} of {formatINRShort(budget.limitCents)}
              </Text>
            </View>
          </Card>
        );
      })}

      {addingBudget && (
        <Card>
          <SectionLabel>New budget</SectionLabel>
          <View style={styles.categoryPills}>
            {EXPENSE_CATEGORIES.map((c) => (
              <Pill
                key={c.key}
                label={`${c.icon} ${c.key}`}
                active={budgetCategory === c.key}
                onPress={() => setBudgetCategory(c.key)}
              />
            ))}
          </View>
          <View style={styles.row2}>
            <Field
              label="Limit (Rs)"
              value={budgetLimit}
              onChangeText={setBudgetLimit}
              placeholder="5000"
              keyboardType="decimal-pad"
              style={{ flex: 1 }}
            />
          </View>
          <View style={styles.periodRow}>
            <Pill label="Monthly" active={budgetPeriod === 'monthly'} onPress={() => setBudgetPeriod('monthly')} />
            <Pill label="Yearly" active={budgetPeriod === 'yearly'} onPress={() => setBudgetPeriod('yearly')} />
          </View>
          <View style={styles.budgetActions}>
            <Button label="Cancel" variant="ghost" onPress={() => setAddingBudget(false)} style={{ flex: 1 }} />
            <Button label="Save budget" onPress={saveBudget} disabled={!canSaveBudget} style={{ flex: 1 }} />
          </View>
        </Card>
      )}

      {/* Mileage summary */}
      <SectionLabel>Mileage</SectionLabel>
      <Card onPress={onOpenMileage}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={styles.mileageIconWrap}>
            <Icon name="mapPin" color={COLORS.primary} size={20} />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.mileageTitle}>{mileageStats.totalKm.toFixed(1)} km logged</Text>
            <Text style={styles.mileageSub}>
              {mileageStats.tripCount} trip{mileageStats.tripCount === 1 ? '' : 's'} · reimbursement{' '}
              {formatINR(mileageStats.totalCents)}
            </Text>
          </View>
          <Icon name="chevron" color={COLORS.muted} size={18} />
        </View>
      </Card>

      {/* Export */}
      <View style={{ marginTop: 22 }}>
        <Button label="Export CSV" onPress={exportCsv} icon="download" variant="secondary" />
      </View>

      <View style={{ height: 12 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.screenBg },
  scroll: { padding: 16, paddingBottom: 28 },
  screenTitle: { color: COLORS.ink, fontWeight: '900', fontSize: 22 },
  bigTotal: { color: COLORS.ink, fontWeight: '900', fontSize: 28, marginTop: 6 },
  empty: { color: COLORS.subtext, fontSize: 13.5, marginTop: 8 },

  catRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9 },
  catRowBorder: { borderTopWidth: 1, borderTopColor: COLORS.divider },
  catDot: { width: 9, height: 9, borderRadius: 5, marginRight: 10 },
  catName: { flex: 1, color: COLORS.ink, fontWeight: '600', fontSize: 13.5 },
  catPct: { color: COLORS.subtext, fontWeight: '700', fontSize: 12.5, marginRight: 10, width: 34, textAlign: 'right' },
  catAmt: { color: COLORS.ink, fontWeight: '800', fontSize: 13.5, minWidth: 68, textAlign: 'right' },

  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 22,
  },
  addBudgetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  addBudgetText: { color: COLORS.primary, fontWeight: '800', fontSize: 12 },

  budgetTopRow: { flexDirection: 'row', alignItems: 'flex-start' },
  budgetCategory: { color: COLORS.ink, fontWeight: '800', fontSize: 14.5 },
  budgetPeriod: { color: COLORS.subtext, fontSize: 12, marginTop: 2 },
  budgetBottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  budgetPct: { fontWeight: '900', fontSize: 13, marginRight: 8 },
  budgetRemaining: { color: COLORS.subtext, fontSize: 12, flex: 1, textAlign: 'right' },

  categoryPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  row2: { flexDirection: 'row', gap: 10, marginTop: 14 },
  periodRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  budgetActions: { flexDirection: 'row', gap: 10, marginTop: 16 },

  mileageIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mileageTitle: { color: COLORS.ink, fontWeight: '800', fontSize: 14.5 },
  mileageSub: { color: COLORS.subtext, fontSize: 12, marginTop: 2 },
});
