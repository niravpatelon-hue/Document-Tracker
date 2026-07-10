/**
 * CardDetailScreen — premium dark single-card detail.
 *
 * Full-bleed dark screen with its own top bar (back chevron + delete). Shows
 * the card face, outstanding/limit/available stats, a utilization bar, the
 * due-date panel, a big Pay button, a spend breakdown by category, recent
 * transactions on this card, and payment history.
 */
import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { formatINR } from '@domain/money';
import { spendByCategory, type SpendTxn } from '@domain/analytics/spend';
import {
  daysUntil,
  minimumDueCents,
  utilization,
} from '@domain/analytics/cards';
import { DARK, CARD_GRADIENTS } from '../theme';
import { Icon, SegmentBar } from '../components/ui';
import { categoryIcon, type CardPayment, type CreditCard, type Expense } from '../store';

interface Props {
  card: CreditCard;
  payments: CardPayment[];
  expenses: Expense[];
  onPay: () => void;
  onDelete: () => void;
  onBack: () => void;
}

const TODAY = new Date().toISOString().slice(0, 10);

const CATEGORY_COLORS = [DARK.gold, DARK.green, DARK.blue, DARK.red, '#B48CE0', '#4FB8D6', '#E09B4F'];

export default function CardDetailScreen({ card, payments, expenses, onPay, onDelete, onBack }: Props) {
  const [g1, g2] = CARD_GRADIENTS[card.network] ?? CARD_GRADIENTS.default;
  const available = Math.max(0, card.limitCents - card.outstandingCents);
  const util = utilization(card.outstandingCents, card.limitCents);
  const utilPct = Math.round(util * 100);
  const utilColor = util >= 0.75 ? DARK.red : util >= 0.4 ? DARK.gold : DARK.green;

  const days = daysUntil(TODAY, card.dueDateISO);
  const overdue = days < 0;
  const totalDue = card.statementCents ?? card.outstandingCents;
  const minDue = card.minDueCents ?? minimumDueCents(card.outstandingCents);

  const sortedExpenses = useMemo(
    () => expenses.slice().sort((a, b) => (a.dateISO < b.dateISO ? 1 : -1)),
    [expenses],
  );
  const sortedPayments = useMemo(
    () => payments.slice().sort((a, b) => b.createdAt - a.createdAt),
    [payments],
  );

  const categoryTotals = useMemo(() => {
    const txns: SpendTxn[] = expenses.map((e) => ({
      amount: e.amountCents,
      category: e.category,
      dateISO: e.dateISO,
      vendor: e.description,
    }));
    return spendByCategory(txns);
  }, [expenses]);

  const totalSpend = categoryTotals.reduce((s, c) => s + c.total, 0);

  function handleDelete() {
    if (typeof window !== 'undefined' && !window.confirm(`Delete ${card.name}? This can't be undone.`)) {
      return;
    }
    onDelete();
  }

  return (
    <View style={styles.root}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <Pressable onPress={onBack} hitSlop={10} style={styles.topBarBtn}>
          <Icon name="chevron" color={DARK.text} size={20} strokeWidth={2.4} />
        </Pressable>
        <Text style={styles.topBarTitle} numberOfLines={1}>{card.name}</Text>
        <Pressable onPress={handleDelete} hitSlop={10} style={styles.topBarBtn}>
          <Icon name="trash" color={DARK.subtext} size={18} />
        </Pressable>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Card face */}
        <View
          style={[
            styles.cardFace,
            { backgroundImage: `linear-gradient(135deg, ${g1}, ${g2})` } as unknown as object,
          ]}
        >
          <View style={styles.cardFaceTopRow}>
            <View>
              <Text style={styles.cardFaceIssuer}>{card.issuer ?? 'BANK'}</Text>
              <Text style={styles.cardFaceName}>{card.name}</Text>
            </View>
            <Text style={styles.cardFaceNetwork}>{card.network.toUpperCase()}</Text>
          </View>
          <Text style={styles.cardFaceNumber}>•••• •••• •••• {card.last4}</Text>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statCell}>
            <Text style={styles.statLabel}>Outstanding</Text>
            <Text style={styles.statValue}>{formatINR(card.outstandingCents)}</Text>
          </View>
          <View style={styles.statCell}>
            <Text style={styles.statLabel}>Limit</Text>
            <Text style={styles.statValue}>{formatINR(card.limitCents)}</Text>
          </View>
          <View style={styles.statCell}>
            <Text style={styles.statLabel}>Available</Text>
            <Text style={[styles.statValue, { color: DARK.green }]}>{formatINR(available)}</Text>
          </View>
        </View>

        {/* Utilization */}
        <View style={styles.panel}>
          <View style={styles.panelHeadRow}>
            <Text style={styles.panelLabel}>UTILIZATION</Text>
            <Text style={[styles.utilPct, { color: utilColor }]}>{utilPct}%</Text>
          </View>
          <SegmentBar segments={[{ value: Math.max(1, utilPct), color: utilColor }]} height={8} />
        </View>

        {/* Due panel */}
        <View style={styles.panel}>
          <View style={styles.panelHeadRow}>
            <Text style={styles.panelLabel}>PAYMENT DUE</Text>
            <Text style={[styles.dueBadge, overdue && { color: DARK.red }]}>
              {overdue ? 'Overdue' : `Due in ${days} day${days === 1 ? '' : 's'}`}
            </Text>
          </View>
          <Text style={styles.dueDate}>{card.dueDateISO}</Text>
          <View style={styles.dueRow}>
            <View style={styles.dueCell}>
              <Text style={styles.statLabel}>Total due</Text>
              <Text style={styles.dueValue}>{formatINR(totalDue)}</Text>
            </View>
            <View style={styles.dueCell}>
              <Text style={styles.statLabel}>Min due</Text>
              <Text style={styles.dueValue}>{formatINR(minDue)}</Text>
            </View>
          </View>
          <Pressable onPress={onPay} style={({ pressed }) => [styles.payBtn, pressed && { opacity: 0.85 }]}>
            <Text style={styles.payBtnText}>Pay bill</Text>
          </Pressable>
        </View>

        {/* Spends on this card */}
        <Text style={styles.sectionLabel}>SPENDS ON THIS CARD</Text>
        {categoryTotals.length === 0 ? (
          <View style={styles.panel}>
            <Text style={styles.emptyText}>No spends recorded on this card yet.</Text>
          </View>
        ) : (
          <View style={styles.panel}>
            <SegmentBar
              segments={categoryTotals.map((c, i) => ({
                value: Math.max(1, c.total),
                color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
              }))}
              height={8}
            />
            <View style={{ marginTop: 12 }}>
              {categoryTotals.map((c, i) => {
                const pct = totalSpend > 0 ? Math.round((c.total / totalSpend) * 100) : 0;
                return (
                  <View key={c.category} style={[styles.spendRow, i > 0 && styles.rowBorder]}>
                    <Text style={styles.spendEmoji}>{categoryIcon(c.category)}</Text>
                    <Text style={styles.spendCategory} numberOfLines={1}>{c.category}</Text>
                    <Text style={styles.spendPct}>{pct}%</Text>
                    <Text style={styles.spendAmount}>{formatINR(c.total)}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Recent transactions */}
        <Text style={styles.sectionLabel}>RECENT TRANSACTIONS</Text>
        {sortedExpenses.length === 0 ? (
          <View style={styles.panel}>
            <Text style={styles.emptyText}>No transactions on this card yet.</Text>
          </View>
        ) : (
          <View style={styles.panel}>
            {sortedExpenses.slice(0, 20).map((e, i) => (
              <View key={e.id} style={[styles.txnRow, i > 0 && styles.rowBorder]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.txnDesc} numberOfLines={1}>{e.description}</Text>
                  <Text style={styles.txnDate}>{e.dateISO}</Text>
                </View>
                <Text style={styles.txnAmount}>-{formatINR(e.amountCents)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Payment history */}
        <Text style={styles.sectionLabel}>PAYMENT HISTORY</Text>
        {sortedPayments.length === 0 ? (
          <View style={styles.panel}>
            <Text style={styles.emptyText}>No payments recorded yet.</Text>
          </View>
        ) : (
          <View style={styles.panel}>
            {sortedPayments.map((p, i) => (
              <View key={p.id} style={[styles.txnRow, i > 0 && styles.rowBorder]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.txnDesc}>{p.note || 'Payment'}</Text>
                  <Text style={styles.txnDate}>{p.dateISO}</Text>
                </View>
                <Text style={[styles.txnAmount, { color: DARK.green }]}>+{formatINR(p.amountCents)}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: DARK.bg },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 10,
  },
  topBarBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: DARK.surface2,
  },
  topBarTitle: { color: DARK.text, fontWeight: '800', fontSize: 15, flex: 1, textAlign: 'center', marginHorizontal: 8 },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 16, alignItems: 'center' },

  cardFace: {
    width: '100%',
    maxWidth: 368,
    height: 176,
    borderRadius: 20,
    padding: 20,
    justifyContent: 'space-between',
  },
  cardFaceTopRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  cardFaceIssuer: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  cardFaceName: { color: '#fff', fontWeight: '800', fontSize: 17, marginTop: 4 },
  cardFaceNetwork: { color: 'rgba(255,255,255,0.85)', fontWeight: '800', fontSize: 13, letterSpacing: 1.5 },
  cardFaceNumber: { color: '#fff', fontWeight: '700', fontSize: 18, letterSpacing: 2.5 },

  statsRow: {
    flexDirection: 'row',
    width: '100%',
    maxWidth: 368,
    marginTop: 16,
    backgroundColor: DARK.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: DARK.border,
    paddingVertical: 14,
  },
  statCell: { flex: 1, alignItems: 'center' },
  statLabel: { color: DARK.subtext, fontSize: 11, fontWeight: '600' },
  statValue: { color: DARK.text, fontWeight: '800', fontSize: 14, marginTop: 4 },

  panel: {
    width: '100%',
    maxWidth: 368,
    marginTop: 14,
    backgroundColor: DARK.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: DARK.border,
    padding: 16,
  },
  panelHeadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  panelLabel: { color: DARK.muted, fontWeight: '700', fontSize: 11, letterSpacing: 0.8 },
  utilPct: { fontWeight: '900', fontSize: 14 },

  dueBadge: { color: DARK.subtext, fontWeight: '700', fontSize: 12 },
  dueDate: { color: DARK.text, fontWeight: '800', fontSize: 16, marginTop: -2 },
  dueRow: { flexDirection: 'row', marginTop: 14, gap: 20 },
  dueCell: { flex: 1 },
  dueValue: { color: DARK.text, fontWeight: '800', fontSize: 16, marginTop: 4 },

  payBtn: {
    marginTop: 16,
    backgroundColor: DARK.gold,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  payBtnText: { color: '#1B1406', fontWeight: '900', fontSize: 15 },

  sectionLabel: {
    width: '100%',
    maxWidth: 368,
    color: DARK.muted,
    fontWeight: '700',
    fontSize: 11.5,
    letterSpacing: 0.8,
    marginTop: 22,
    marginBottom: 4,
  },
  emptyText: { color: DARK.subtext, fontSize: 13 },

  spendRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9 },
  rowBorder: { borderTopWidth: 1, borderTopColor: DARK.border },
  spendEmoji: { fontSize: 16, marginRight: 8 },
  spendCategory: { flex: 1, color: DARK.text, fontWeight: '700', fontSize: 13 },
  spendPct: { color: DARK.subtext, fontWeight: '700', fontSize: 12, marginRight: 10 },
  spendAmount: { color: DARK.text, fontWeight: '800', fontSize: 13 },

  txnRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  txnDesc: { color: DARK.text, fontWeight: '700', fontSize: 13.5 },
  txnDate: { color: DARK.subtext, fontSize: 11.5, marginTop: 2 },
  txnAmount: { color: DARK.red, fontWeight: '800', fontSize: 13.5 },
});
