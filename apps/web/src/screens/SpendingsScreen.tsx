import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { formatINR, formatINRCompact, toCents } from '@domain/money';
import { classifySpendCategory, monthKeyOf, type SpendTxn } from '@domain/analytics/spend';
import { evaluateBudget, type BudgetState } from '@domain/analytics/budget';
import { transactionsToCsv, type CsvTxnRow } from '@domain/export/csv';
import { COLORS } from '../theme';
import { Card, Icon, SectionLabel, SegmentBar, ProgressBar, StatusPill } from '../components/ui';
import {
  businessCategoryIcon,
  type WebBudget,
  type WebBusinessExpense,
  type WebIncome,
  type WebTransaction,
} from '../store';

interface Props {
  mode: 'personal' | 'business';
  transactions: WebTransaction[]; // personal, paise
  incomes: WebIncome[];
  budgets: WebBudget[];
  businessExpenses: WebBusinessExpense[];
  onScan: () => void; // scan a receipt
  onAddExpense: () => void; // manual add (opens capture/review)
  onOpenMileage: () => void;
  onAddBudget: (b: { category: string; period: 'monthly' | 'yearly'; limitCents: number; alertThresholdPct: number }) => void;
  onDeleteBudget: (id: string) => void;
}

type Period = 'week' | 'month' | '30d';

const PERSONAL_EMOJI: Record<string, string> = {
  Fuel: '⛽',
  Dining: '🍽️',
  Groceries: '🛒',
  Transport: '🚗',
  Utilities: '💡',
  Shopping: '🛍️',
  Other: '🧾',
};

const CAT_PALETTE = [
  COLORS.primary,
  COLORS.expense,
  COLORS.savings,
  COLORS.sky,
  COLORS.income,
  COLORS.primaryDark,
  COLORS.danger,
  COLORS.info,
];

const STATE_TONE: Record<BudgetState, 'good' | 'warn' | 'danger'> = { ok: 'good', warn: 'warn', over: 'danger' };
const STATE_COLOR: Record<BudgetState, string> = { ok: COLORS.good, warn: COLORS.warnText, over: COLORS.danger };

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoISO(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function inPeriod(dateISO: string, period: Period): boolean {
  if (period === 'month') return monthKeyOf(dateISO) === monthKeyOf(todayISO());
  if (period === 'week') return dateISO >= daysAgoISO(6) && dateISO <= todayISO();
  return dateISO >= daysAgoISO(29) && dateISO <= todayISO();
}

function downloadCsv(rows: CsvTxnRow[], filename: string) {
  const blob = new Blob([transactionsToCsv(rows)], { type: 'text/csv' });
  if (typeof document !== 'undefined') {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}

interface Row {
  id: string;
  vendor: string;
  category: string;
  dateISO: string;
  amount: number; // paise, gross for business
  taxRatePct?: number;
  taxAmount?: number;
}

export default function SpendingsScreen({
  mode,
  transactions,
  budgets,
  businessExpenses,
  onScan,
  onAddExpense,
  onOpenMileage,
  onAddBudget,
  onDeleteBudget,
}: Props) {
  const [period, setPeriod] = useState<Period>('month');
  const [activeCat, setActiveCat] = useState<string>('All');
  const [query, setQuery] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newCat, setNewCat] = useState('');
  const [newLimit, setNewLimit] = useState('');

  const rows: Row[] = useMemo(() => {
    if (mode === 'business') {
      return businessExpenses.map((e) => ({
        id: e.id,
        vendor: e.vendor,
        category: e.category,
        dateISO: e.dateISO,
        amount: e.amountCents + e.gstCents,
        taxRatePct: e.taxRatePct,
        taxAmount: e.gstCents,
      }));
    }
    return transactions.map((t) => ({
      id: t.id,
      vendor: t.vendor,
      category: classifySpendCategory(t.vendor),
      dateISO: t.dateISO,
      amount: t.amount,
    }));
  }, [mode, transactions, businessExpenses]);

  const spendTxns: SpendTxn[] = useMemo(
    () => transactions.map((t) => ({ amount: t.amount, category: classifySpendCategory(t.vendor), dateISO: t.dateISO, vendor: t.vendor })),
    [transactions],
  );

  const periodRows = useMemo(() => rows.filter((r) => inPeriod(r.dateISO, period)), [rows, period]);
  const periodTotal = useMemo(() => periodRows.reduce((s, r) => s + r.amount, 0), [periodRows]);

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of periodRows) map.set(r.category, (map.get(r.category) ?? 0) + r.amount);
    return [...map.entries()]
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total);
  }, [periodRows]);

  const catTotal = Math.max(1, byCategory.reduce((s, c) => s + c.total, 0));
  const segments = byCategory.map((c, i) => ({ value: c.total, color: CAT_PALETTE[i % CAT_PALETTE.length] }));

  const categories = useMemo(() => ['All', ...new Set(rows.map((r) => r.category))], [rows]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return periodRows
      .filter((r) => activeCat === 'All' || r.category === activeCat)
      .filter((r) => !q || r.vendor.toLowerCase().includes(q))
      .sort((a, b) => (a.dateISO < b.dateISO ? 1 : -1));
  }, [periodRows, activeCat, query]);

  function iconFor(category: string): string {
    return mode === 'business' ? businessCategoryIcon(category) : PERSONAL_EMOJI[category] ?? '🧾';
  }

  function addBudget() {
    const n = Number(newLimit);
    const cat = newCat.trim();
    if (!cat || !Number.isFinite(n) || n <= 0) return;
    onAddBudget({ category: cat, period: 'monthly', limitCents: toCents(n), alertThresholdPct: 80 });
    setNewCat('');
    setNewLimit('');
    setShowAdd(false);
  }

  function exportCsv() {
    const csvRows: CsvTxnRow[] = filteredRows.map((r) => ({
      dateISO: r.dateISO,
      vendor: r.vendor,
      category: r.category,
      amount: r.amount,
      taxAmount: r.taxAmount ?? null,
    }));
    downloadCsv(csvRows, mode === 'business' ? 'business-expenses.csv' : 'spendings.csv');
  }

  const refDate = `${monthKeyOf(todayISO())}-15`;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      <Text style={styles.heading}>Spendings</Text>
      <Text style={styles.total}>{formatINRCompact(periodTotal)}</Text>

      <View style={styles.segment}>
        {(['week', 'month', '30d'] as Period[]).map((p) => (
          <Pressable key={p} style={[styles.segmentBtn, period === p && styles.segmentBtnActive]} onPress={() => setPeriod(p)}>
            <Text style={[styles.segmentText, period === p && styles.segmentTextActive]}>
              {p === 'week' ? 'This week' : p === 'month' ? 'This month' : '30 days'}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.ctaRow}>
        <Pressable style={styles.ctaBtn} onPress={onScan}>
          <Icon name="camera" color={COLORS.primary} size={18} />
          <Text style={styles.ctaText}>Scan receipt</Text>
        </Pressable>
        <Pressable style={[styles.ctaBtn, styles.ctaBtnPrimary]} onPress={onAddExpense}>
          <Icon name="plus" color="#fff" size={18} />
          <Text style={[styles.ctaText, styles.ctaTextPrimary]}>Add expense</Text>
        </Pressable>
      </View>

      <SectionLabel>Category breakdown</SectionLabel>
      <Card>
        {byCategory.length === 0 ? (
          <Text style={styles.empty}>No spending in this period.</Text>
        ) : (
          <>
            <SegmentBar segments={segments} />
            <View style={{ marginTop: 12 }}>
              {byCategory.map((c, i) => (
                <View key={c.category} style={[styles.catRow, i > 0 && styles.catRowDivider]}>
                  <View style={[styles.catDot, { backgroundColor: CAT_PALETTE[i % CAT_PALETTE.length] }]} />
                  <Text style={styles.catEmoji}>{iconFor(c.category)}</Text>
                  <Text style={styles.catName}>{c.category}</Text>
                  <Text style={styles.catPct}>{Math.round((c.total / catTotal) * 100)}%</Text>
                  <Text style={styles.catAmount}>{formatINR(c.total)}</Text>
                </View>
              ))}
            </View>
          </>
        )}
      </Card>

      {mode === 'personal' && (
        <>
          <View style={styles.sectionHead}>
            <SectionLabel>Budgets</SectionLabel>
            <Pressable onPress={() => setShowAdd((s) => !s)}>
              <Text style={styles.link}>{showAdd ? 'Close' : '+ Add'}</Text>
            </Pressable>
          </View>
          {showAdd && (
            <Card style={{ marginBottom: 10 }}>
              <View style={styles.addRow}>
                <TextInput
                  style={styles.catInput}
                  value={newCat}
                  onChangeText={setNewCat}
                  placeholder="Category"
                  placeholderTextColor={COLORS.subtext}
                />
                <TextInput
                  style={styles.limitInput}
                  value={newLimit}
                  onChangeText={setNewLimit}
                  placeholder="Monthly limit ₹"
                  placeholderTextColor={COLORS.subtext}
                  keyboardType="decimal-pad"
                />
                <Pressable style={styles.addBtn} onPress={addBudget}>
                  <Text style={styles.addBtnText}>Set</Text>
                </Pressable>
              </View>
            </Card>
          )}
          {budgets.length === 0 ? (
            <Card>
              <Text style={styles.empty}>No budgets set.</Text>
            </Card>
          ) : (
            <Card>
              {budgets.map((b, i) => {
                const status = evaluateBudget(
                  { category: b.category, period: b.period, limitCents: b.limitCents, alertThresholdPct: b.alertThresholdPct },
                  spendTxns,
                  refDate,
                );
                const remaining = status.limitCents - status.spentCents;
                return (
                  <View key={b.id} style={[styles.budgetRow, i > 0 && { marginTop: 14 }]}>
                    <View style={styles.budgetHead}>
                      <Text style={styles.budgetCat}>{b.category}</Text>
                      <StatusPill text={`${Math.round(status.pct)}%`} tone={STATE_TONE[status.state]} />
                      <Pressable onPress={() => onDeleteBudget(b.id)} style={{ marginLeft: 8 }}>
                        <Icon name="trash" color={COLORS.subtext} size={16} />
                      </Pressable>
                    </View>
                    <ProgressBar pct={status.pct} color={STATE_COLOR[status.state]} />
                    <Text style={styles.budgetNote}>
                      {formatINR(status.spentCents)} of {formatINR(status.limitCents)}
                      {'  ·  '}
                      {remaining >= 0 ? `${formatINR(remaining)} left` : `${formatINR(-remaining)} over`}
                    </Text>
                  </View>
                );
              })}
            </Card>
          )}
        </>
      )}

      <SectionLabel>Transactions</SectionLabel>
      <Card>
        <View style={styles.searchRow}>
          <Icon name="search" color={COLORS.subtext} size={16} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search vendor"
            placeholderTextColor={COLORS.subtext}
          />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
          <View style={styles.chips}>
            {categories.map((c) => (
              <Pressable key={c} style={[styles.chip, activeCat === c && styles.chipActive]} onPress={() => setActiveCat(c)}>
                <Text style={[styles.chipText, activeCat === c && styles.chipTextActive]}>{c}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
        {filteredRows.length === 0 ? (
          <Text style={styles.empty}>No transactions match.</Text>
        ) : (
          filteredRows.map((r, i) => (
            <View key={r.id} style={[styles.txnRow, i > 0 && styles.txnDivider]}>
              <Text style={styles.txnEmoji}>{iconFor(r.category)}</Text>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.txnVendor}>{r.vendor}</Text>
                <View style={styles.txnMetaRow}>
                  <Text style={styles.txnMeta}>{r.dateISO}</Text>
                  <View style={styles.catChip}>
                    <Text style={styles.catChipText}>{r.category}</Text>
                  </View>
                  {mode === 'business' && r.taxRatePct != null && (
                    <View style={styles.gstChip}>
                      <Text style={styles.gstChipText}>{r.taxRatePct}% GST</Text>
                    </View>
                  )}
                </View>
              </View>
              <Text style={styles.txnAmount}>− {formatINR(r.amount)}</Text>
            </View>
          ))
        )}
      </Card>

      <SectionLabel>Reports</SectionLabel>
      <Card>
        <Pressable style={styles.reportBtn} onPress={exportCsv}>
          <Icon name="download" color={COLORS.primary} size={18} />
          <Text style={styles.reportBtnText}>Export CSV</Text>
        </Pressable>
        <Pressable style={styles.mileageRow} onPress={onOpenMileage}>
          <Icon name="mapPin" color={COLORS.subtext} size={16} />
          <Text style={styles.mileageText}>Mileage log</Text>
          <Icon name="chevron" color={COLORS.subtext} size={16} />
        </Pressable>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.screenBg },
  scroll: { padding: 16, paddingBottom: 28 },
  heading: { fontSize: 13, fontWeight: '700', color: COLORS.subtext, textTransform: 'uppercase', letterSpacing: 0.6 },
  total: { fontSize: 32, fontWeight: '800', color: COLORS.text, marginTop: 4, letterSpacing: -0.5 },
  segment: { flexDirection: 'row', backgroundColor: COLORS.chip, borderRadius: 12, padding: 3, marginTop: 14 },
  segmentBtn: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center' },
  segmentBtnActive: { backgroundColor: '#fff' },
  segmentText: { fontSize: 12, fontWeight: '600', color: COLORS.subtext },
  segmentTextActive: { color: COLORS.text },
  ctaRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  ctaBtn: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 12,
  },
  ctaBtnPrimary: { backgroundColor: COLORS.primary },
  ctaText: { color: COLORS.primary, fontWeight: '700', fontSize: 13 },
  ctaTextPrimary: { color: '#fff' },
  empty: { color: COLORS.subtext, fontSize: 13 },
  catRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  catRowDivider: { borderTopWidth: 1, borderTopColor: COLORS.border },
  catDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  catEmoji: { fontSize: 14, marginRight: 6 },
  catName: { flex: 1, fontSize: 13, color: COLORS.text, fontWeight: '600' },
  catPct: { fontSize: 12, color: COLORS.subtext, marginRight: 10, width: 34, textAlign: 'right' },
  catAmount: { fontSize: 13, fontWeight: '700', color: COLORS.text, width: 96, textAlign: 'right' },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  link: { color: COLORS.primary, fontWeight: '700', fontSize: 14, marginTop: 20 },
  addRow: { flexDirection: 'row', gap: 8 },
  catInput: { flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14, color: COLORS.text },
  limitInput: { flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14, color: COLORS.text },
  addBtn: { backgroundColor: COLORS.primary, borderRadius: 8, paddingHorizontal: 16, justifyContent: 'center' },
  addBtnText: { color: '#fff', fontWeight: '700' },
  budgetRow: {},
  budgetHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 8 },
  budgetCat: { flex: 1, fontSize: 14, fontWeight: '700', color: COLORS.text },
  budgetNote: { fontSize: 11, color: COLORS.subtext, marginTop: 4 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 10,
  },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.text },
  chips: { flexDirection: 'row', gap: 6 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, backgroundColor: COLORS.chip },
  chipActive: { backgroundColor: COLORS.primary },
  chipText: { fontSize: 12, color: COLORS.text, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  txnRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  txnDivider: { borderTopWidth: 1, borderTopColor: COLORS.border },
  txnEmoji: { fontSize: 20 },
  txnVendor: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  txnMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  txnMeta: { fontSize: 11, color: COLORS.subtext },
  catChip: { backgroundColor: COLORS.chip, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  catChipText: { fontSize: 10, color: COLORS.subtext, fontWeight: '600' },
  gstChip: { backgroundColor: COLORS.accentSoft, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  gstChipText: { fontSize: 10, color: COLORS.primary, fontWeight: '700' },
  txnAmount: { fontSize: 14, fontWeight: '700', color: COLORS.expense },
  reportBtn: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: 12,
  },
  reportBtnText: { color: COLORS.primary, fontWeight: '700', fontSize: 14 },
  mileageRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, paddingVertical: 4 },
  mileageText: { flex: 1, fontSize: 13, color: COLORS.text, fontWeight: '600' },
});
