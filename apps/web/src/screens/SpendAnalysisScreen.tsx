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
import { Card, HeroCard, Icon, IconChip, SectionLabel, StatusPill, heroText } from '../components/ui';
import type { WebBudget, WebTransaction } from '../store';

interface Props {
  transactions: WebTransaction[];
  budgets: WebBudget[];
  onAddBudget: (b: Omit<WebBudget, 'id'>) => void;
  onDeleteBudget: (id: string) => void;
}

const CATEGORIES = ['Groceries', 'Dining', 'Fuel', 'Transport', 'Utilities', 'Shopping', 'Other'];
const STATE_TONE: Record<BudgetState, 'good' | 'warn' | 'danger'> = { ok: 'good', warn: 'warn', over: 'danger' };
const STATE_COLOR: Record<BudgetState, string> = { ok: COLORS.good, warn: COLORS.warnText, over: COLORS.danger };

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
    () => transactions.map((t) => ({ amount: t.amount, category: classifySpendCategory(t.vendor), dateISO: t.dateISO, vendor: t.vendor })),
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
    if (!Number.isFinite(n) || n <= 0) return;
    onAddBudget({ category: newCat, period: 'monthly', limitCents: toCents(n), alertThresholdPct: 80 });
    setLimit('');
    setShowAdd(false);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      <HeroCard>
        <Text style={heroText.cap}>Total documented spend</Text>
        <Text style={heroText.money}>${formatAmount(totalSpend(spendTxns))}</Text>
        <Text style={styles.heroLine}>
          {currentMonth}: <Text style={styles.heroStrong}>${formatAmount(mom.current)}</Text>
          {mom.deltaPct != null ? (mom.delta >= 0 ? `  ▲ ${Math.abs(Math.round(mom.deltaPct))}%` : `  ▼ ${Math.abs(Math.round(mom.deltaPct))}%`) : ''}
        </Text>
      </HeroCard>

      <SectionLabel>By category</SectionLabel>
      <Card>
        {byCat.length === 0 ? (
          <Text style={styles.empty}>No spending yet.</Text>
        ) : (
          byCat.map((c, i) => (
            <View key={c.category} style={[styles.barRow, i > 0 && { marginTop: 10 }]}>
              <Text style={styles.barLabel}>{c.category}</Text>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${(c.total / maxCat) * 100}%` }]} />
              </View>
              <Text style={styles.barValue}>${formatAmount(c.total)}</Text>
            </View>
          ))
        )}
      </Card>

      <SectionLabel>Monthly trend</SectionLabel>
      <Card>
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
      </Card>

      <View style={styles.sectionHead}>
        <SectionLabel>Budgets</SectionLabel>
        <Pressable onPress={() => setShowAdd((s) => !s)}>
          <Text style={styles.link}>{showAdd ? 'Close' : '+ Add'}</Text>
        </Pressable>
      </View>
      {showAdd && (
        <Card style={{ marginBottom: 10 }}>
          <View style={styles.chips}>
            {CATEGORIES.map((c) => (
              <Pressable key={c} style={[styles.chip, newCat === c && styles.chipActive]} onPress={() => setNewCat(c)}>
                <Text style={[styles.chipText, newCat === c && styles.chipTextActive]}>{c}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.addRow}>
            <TextInput style={styles.limitInput} value={limit} onChangeText={setLimit} placeholder="Monthly limit $" keyboardType="decimal-pad" />
            <Pressable style={styles.addBtn} onPress={addBudget}>
              <Text style={styles.addBtnText}>Set</Text>
            </Pressable>
          </View>
        </Card>
      )}
      {budgets.length === 0 ? (
        <Card><Text style={styles.empty}>No budgets set.</Text></Card>
      ) : (
        <Card>
          {budgets.map((b, i) => {
            const status = evaluateBudget(
              { category: b.category, period: b.period, limitCents: b.limitCents, alertThresholdPct: b.alertThresholdPct },
              spendTxns,
              refDate,
            );
            return (
              <View key={b.id} style={[styles.budgetRow, i > 0 && { marginTop: 14 }]}>
                <View style={styles.budgetHead}>
                  <Text style={styles.budgetCat}>{b.category}</Text>
                  <StatusPill text={`$${formatAmount(status.spentCents)} / $${formatAmount(status.limitCents)}`} tone={STATE_TONE[status.state]} />
                  <Pressable onPress={() => onDeleteBudget(b.id)} style={{ marginLeft: 8 }}>
                    <Icon name="close" color={COLORS.subtext} size={16} />
                  </Pressable>
                </View>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${Math.min(100, status.pct)}%`, backgroundColor: STATE_COLOR[status.state] }]} />
                </View>
              </View>
            );
          })}
        </Card>
      )}

      <Pressable style={styles.export} onPress={() => downloadCsv(transactions)}>
        <Icon name="download" color={COLORS.primary} size={18} />
        <Text style={styles.exportText}>Export CSV</Text>
      </Pressable>

      <SectionLabel>Transactions</SectionLabel>
      <Card>
        {transactions.map((t, i) => (
          <View key={t.id} style={[styles.txnRow, i > 0 && styles.txnDivider]}>
            <IconChip name="tag" bg={COLORS.chip} fg={COLORS.subtext} size={34} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.txnVendor}>{t.vendor}</Text>
              <Text style={styles.txnMeta}>{t.dateISO} · {classifySpendCategory(t.vendor)}</Text>
            </View>
            <Text style={styles.txnAmount}>${formatAmount(t.amount)}</Text>
          </View>
        ))}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.screenBg },
  scroll: { padding: 16, paddingBottom: 28 },
  heroLine: { color: '#c3cee2', fontSize: 13, marginTop: 8, fontWeight: '600' },
  heroStrong: { color: '#fff', fontWeight: '800' },
  empty: { color: COLORS.subtext },
  barRow: { flexDirection: 'row', alignItems: 'center' },
  barLabel: { width: 74, fontSize: 13, color: COLORS.text },
  barTrack: { flex: 1, height: 14, backgroundColor: '#eef1f5', borderRadius: 7, overflow: 'hidden' },
  barFill: { height: 14, backgroundColor: COLORS.primary, borderRadius: 7 },
  barValue: { width: 66, textAlign: 'right', fontSize: 13, fontWeight: '700', color: COLORS.text },
  trend: { flexDirection: 'row', gap: 10, alignItems: 'flex-end', height: 120 },
  trendCol: { flex: 1, alignItems: 'center' },
  trendBarTrack: { width: '66%', height: 84, justifyContent: 'flex-end', backgroundColor: '#f2f4f7', borderRadius: 6, overflow: 'hidden' },
  trendBar: { width: '100%', backgroundColor: COLORS.primary },
  trendLabel: { fontSize: 11, color: COLORS.subtext, marginTop: 4 },
  trendVal: { fontSize: 11, color: COLORS.text, fontWeight: '700' },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  link: { color: COLORS.primary, fontWeight: '700', fontSize: 14, marginTop: 20 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, backgroundColor: COLORS.chip },
  chipActive: { backgroundColor: COLORS.primary },
  chipText: { fontSize: 12, color: COLORS.text, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  addRow: { flexDirection: 'row', gap: 8 },
  limitInput: { flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 15 },
  addBtn: { backgroundColor: COLORS.primary, borderRadius: 8, paddingHorizontal: 18, justifyContent: 'center' },
  addBtnText: { color: '#fff', fontWeight: '700' },
  budgetRow: {},
  budgetHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  budgetCat: { flex: 1, fontSize: 14, fontWeight: '700', color: COLORS.text },
  export: { marginTop: 18, flexDirection: 'row', gap: 8, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: COLORS.primary, borderRadius: 10, paddingVertical: 12 },
  exportText: { color: COLORS.primary, fontWeight: '700', fontSize: 15 },
  txnRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  txnDivider: { borderTopWidth: 1, borderTopColor: COLORS.border },
  txnVendor: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  txnMeta: { fontSize: 12, color: COLORS.subtext, marginTop: 2 },
  txnAmount: { fontSize: 15, fontWeight: '700', color: COLORS.text },
});
