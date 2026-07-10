import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { formatAmount, toCents } from '@domain/money';
import {
  classifySpendCategory,
  monthKeyOf,
  monthOverMonth,
  spendByCategory,
  spendByMonth,
  totalSpend,
  type SpendTxn,
} from '@domain/analytics/spend';
import { evaluateBudget, type BudgetState } from '@domain/analytics/budget';
import { transactionsToCsv } from '@domain/export/csv';
import { COLORS } from '../theme';
import type { WebBudget, WebTransaction } from '../store';

interface Props {
  transactions: WebTransaction[];
  budgets: WebBudget[];
  onAddBudget: (b: Omit<WebBudget, 'id'>) => void;
  onDeleteBudget: (id: string) => void;
}

const CATEGORIES = ['Groceries', 'Dining', 'Fuel', 'Transport', 'Utilities', 'Shopping', 'Other'];
const STATE_COLOR: Record<BudgetState, string> = { ok: COLORS.success, warn: '#b45309', over: COLORS.danger };

function downloadCsv(transactions: WebTransaction[]) {
  const rows = transactions.map((t) => ({
    dateISO: t.dateISO,
    vendor: t.vendor,
    category: classifySpendCategory(t.vendor),
    amount: t.amount,
  }));
  const blob = new Blob([transactionsToCsv(rows)], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'documenttracker-spending.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export default function SpendAnalysisScreen({ transactions, budgets, onAddBudget, onDeleteBudget }: Props) {
  const spendTxns: SpendTxn[] = useMemo(
    () =>
      transactions.map((t) => ({
        amount: t.amount,
        category: classifySpendCategory(t.vendor),
        dateISO: t.dateISO,
        vendor: t.vendor,
      })),
    [transactions],
  );

  const byMonth = useMemo(() => spendByMonth(spendTxns), [spendTxns]);
  const byCat = useMemo(() => spendByCategory(spendTxns), [spendTxns]);
  const currentMonth = byMonth.length ? byMonth[byMonth.length - 1]!.month : monthKeyOf('2026-07-01');
  const refDate = `${currentMonth}-15`;
  const mom = useMemo(() => monthOverMonth(spendTxns, currentMonth), [spendTxns, currentMonth]);

  const maxCat = Math.max(1, ...byCat.map((c) => c.total));
  const maxMonth = Math.max(1, ...byMonth.map((m) => m.total));

  const [newCat, setNewCat] = useState('Groceries');
  const [limit, setLimit] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  function addBudget() {
    const n = Number(limit);
    if (!Number.isFinite(n) || n <= 0) {
      return;
    }
    onAddBudget({ category: newCat, period: 'monthly', limitCents: toCents(n), alertThresholdPct: 80 });
    setLimit('');
    setShowAdd(false);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      <View style={styles.summary}>
        <Text style={styles.summaryLabel}>Total documented spend</Text>
        <Text style={styles.summaryValue}>${formatAmount(totalSpend(spendTxns))}</Text>
        <Text style={styles.momText}>
          {currentMonth}: ${formatAmount(mom.current)}
          {mom.deltaPct != null ? (
            <Text style={{ color: mom.delta > 0 ? COLORS.danger : COLORS.success }}>
              {'  '}
              {mom.delta >= 0 ? '▲' : '▼'} {Math.abs(Math.round(mom.deltaPct))}% vs prev
            </Text>
          ) : null}
        </Text>
      </View>

      <Text style={styles.section}>By category</Text>
      {byCat.length === 0 ? (
        <Text style={styles.empty}>No spending yet.</Text>
      ) : (
        byCat.map((c) => (
          <View key={c.category} style={styles.barRow}>
            <Text style={styles.barLabel}>{c.category}</Text>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: `${(c.total / maxCat) * 100}%` }]} />
            </View>
            <Text style={styles.barValue}>${formatAmount(c.total)}</Text>
          </View>
        ))
      )}

      <Text style={styles.section}>Monthly trend</Text>
      <View style={styles.trend}>
        {byMonth.map((m) => (
          <View key={m.month} style={styles.trendCol}>
            <View style={styles.trendBarTrack}>
              <View style={[styles.trendBar, { height: `${(m.total / maxMonth) * 100}%` }]} />
            </View>
            <Text style={styles.trendLabel}>{m.month.slice(5)}</Text>
            <Text style={styles.trendVal}>${formatAmount(m.total)}</Text>
          </View>
        ))}
      </View>

      <View style={styles.sectionHeaderRow}>
        <Text style={styles.section}>Budgets</Text>
        <Pressable onPress={() => setShowAdd((s) => !s)}>
          <Text style={styles.link}>{showAdd ? 'Close' : '+ Add'}</Text>
        </Pressable>
      </View>

      {showAdd && (
        <View style={styles.addBudget}>
          <View style={styles.chips}>
            {CATEGORIES.map((c) => (
              <Pressable key={c} style={[styles.chip, newCat === c && styles.chipActive]} onPress={() => setNewCat(c)}>
                <Text style={[styles.chipText, newCat === c && styles.chipTextActive]}>{c}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.addRow}>
            <TextInput
              style={styles.limitInput}
              value={limit}
              onChangeText={setLimit}
              placeholder="Monthly limit $"
              keyboardType="decimal-pad"
            />
            <Pressable style={styles.addBtn} onPress={addBudget}>
              <Text style={styles.addBtnText}>Set</Text>
            </Pressable>
          </View>
        </View>
      )}

      {budgets.length === 0 ? (
        <Text style={styles.empty}>No budgets set.</Text>
      ) : (
        budgets.map((b) => {
          const status = evaluateBudget(
            { category: b.category, period: b.period, limitCents: b.limitCents, alertThresholdPct: b.alertThresholdPct },
            spendTxns,
            refDate,
          );
          return (
            <View key={b.id} style={styles.budgetRow}>
              <View style={styles.budgetHead}>
                <Text style={styles.budgetCat}>{b.category}</Text>
                <Text style={[styles.budgetState, { color: STATE_COLOR[status.state] }]}>
                  ${formatAmount(status.spentCents)} / ${formatAmount(status.limitCents)}
                </Text>
                <Pressable onPress={() => onDeleteBudget(b.id)}>
                  <Text style={styles.remove}>✕</Text>
                </Pressable>
              </View>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    { width: `${Math.min(100, status.pct)}%`, backgroundColor: STATE_COLOR[status.state] },
                  ]}
                />
              </View>
            </View>
          );
        })
      )}

      <Pressable style={styles.export} onPress={() => downloadCsv(transactions)}>
        <Text style={styles.exportText}>Export CSV</Text>
      </Pressable>

      <Text style={styles.section}>Transactions</Text>
      {transactions.map((t) => (
        <View key={t.id} style={styles.txnRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.txnVendor}>{t.vendor}</Text>
            <Text style={styles.txnMeta}>
              {t.dateISO} · {classifySpendCategory(t.vendor)}
            </Text>
          </View>
          <Text style={styles.txnAmount}>${formatAmount(t.amount)}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { padding: 16, paddingBottom: 24 },
  summary: { backgroundColor: COLORS.screenBg, borderRadius: 12, padding: 16, marginBottom: 8 },
  summaryLabel: { color: COLORS.subtext, fontSize: 13 },
  summaryValue: { color: COLORS.text, fontSize: 28, fontWeight: '800', marginTop: 2 },
  momText: { color: COLORS.text, fontSize: 14, marginTop: 6, fontWeight: '600' },
  section: { fontSize: 13, fontWeight: '700', color: COLORS.subtext, marginTop: 20, marginBottom: 10, textTransform: 'uppercase' },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  empty: { color: COLORS.subtext },
  barRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  barLabel: { width: 78, fontSize: 13, color: COLORS.text },
  barTrack: { flex: 1, height: 14, backgroundColor: '#eef1f5', borderRadius: 7, overflow: 'hidden' },
  barFill: { height: 14, backgroundColor: COLORS.primary, borderRadius: 7 },
  barValue: { width: 68, textAlign: 'right', fontSize: 13, fontWeight: '600', color: COLORS.text },
  trend: { flexDirection: 'row', gap: 10, alignItems: 'flex-end', height: 130 },
  trendCol: { flex: 1, alignItems: 'center' },
  trendBarTrack: { width: '70%', height: 90, justifyContent: 'flex-end', backgroundColor: '#f2f4f7', borderRadius: 6, overflow: 'hidden' },
  trendBar: { width: '100%', backgroundColor: COLORS.primary },
  trendLabel: { fontSize: 11, color: COLORS.subtext, marginTop: 4 },
  trendVal: { fontSize: 11, color: COLORS.text, fontWeight: '600' },
  link: { color: COLORS.primary, fontWeight: '700', fontSize: 14, marginTop: 20 },
  addBudget: { backgroundColor: COLORS.screenBg, borderRadius: 10, padding: 12, marginBottom: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, backgroundColor: '#e6eaf0' },
  chipActive: { backgroundColor: COLORS.primary },
  chipText: { fontSize: 12, color: COLORS.text, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  addRow: { flexDirection: 'row', gap: 8 },
  limitInput: { flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 15 },
  addBtn: { backgroundColor: COLORS.primary, borderRadius: 8, paddingHorizontal: 18, justifyContent: 'center' },
  addBtnText: { color: '#fff', fontWeight: '700' },
  budgetRow: { marginBottom: 12 },
  budgetHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 5, gap: 8 },
  budgetCat: { flex: 1, fontSize: 14, fontWeight: '600', color: COLORS.text },
  budgetState: { fontSize: 13, fontWeight: '700' },
  remove: { color: COLORS.subtext, fontSize: 14, paddingHorizontal: 4 },
  export: { marginTop: 18, borderWidth: 1, borderColor: COLORS.primary, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  exportText: { color: COLORS.primary, fontWeight: '700', fontSize: 15 },
  txnRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  txnVendor: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  txnMeta: { fontSize: 12, color: COLORS.subtext, marginTop: 2 },
  txnAmount: { fontSize: 15, fontWeight: '700', color: COLORS.text },
});
