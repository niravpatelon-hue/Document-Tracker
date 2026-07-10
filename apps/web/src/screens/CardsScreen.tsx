import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { formatINR, formatINRShort, toCents } from '@domain/money';
import { COLORS } from '../theme';
import {
  Button,
  Card,
  Field,
  Icon,
  Pill,
  SectionLabel,
  SegmentBar,
} from '../components/ui';
import type { CardNetwork, CardPayment, CreditCard } from '../store';

interface Props {
  cards: CreditCard[];
  payments: CardPayment[];
  onAddCard: (c: {
    name: string;
    network: CardNetwork;
    last4: string;
    limitCents: number;
    outstandingCents: number;
    statementCents?: number;
    dueDateISO: string;
    apr?: number;
  }) => void;
  onDeleteCard: (id: string) => void;
  onRecordPayment: (p: { cardId: string; amountCents: number; dateISO: string; note?: string }) => void;
}

const TODAY = new Date().toISOString().slice(0, 10);

const NETWORKS: { key: CardNetwork; label: string }[] = [
  { key: 'visa', label: 'Visa' },
  { key: 'mastercard', label: 'Mastercard' },
  { key: 'rupay', label: 'RuPay' },
  { key: 'amex', label: 'Amex' },
];

const NETWORK_GRADIENT: Record<CardNetwork, [string, string]> = {
  visa: ['#2563EB', '#1E3A8A'],
  mastercard: ['#EB4B2A', '#B4341C'],
  rupay: ['#0B7A3B', '#0A5C2E'],
  amex: ['#2E7D8A', '#1B5560'],
};

function daysUntil(dateISO: string): number {
  const due = new Date(dateISO + 'T00:00:00');
  const today = new Date(TODAY + 'T00:00:00');
  return Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function CardVisual({ card }: { card: CreditCard }) {
  const [c1, c2] = NETWORK_GRADIENT[card.network];
  return (
    <View
      style={[
        styles.cardVisual,
        { backgroundImage: `linear-gradient(135deg, ${c1}, ${c2})` } as unknown as object,
      ]}
    >
      <View style={styles.cardVisualTopRow}>
        <Text style={styles.cardVisualName}>{card.name}</Text>
        <Text style={styles.cardVisualNetwork}>{card.network.toUpperCase()}</Text>
      </View>
      <Text style={styles.cardVisualNumber}>•••• •••• •••• {card.last4}</Text>
      <View style={styles.cardVisualBottomRow}>
        <View>
          <Text style={styles.cardVisualLabel}>Outstanding</Text>
          <Text style={styles.cardVisualAmount}>{formatINRShort(card.outstandingCents)}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.cardVisualLabel}>Limit</Text>
          <Text style={styles.cardVisualAmountSmall}>{formatINRShort(card.limitCents)}</Text>
        </View>
      </View>
    </View>
  );
}

export default function CardsScreen({ cards, payments, onAddCard, onDeleteCard, onRecordPayment }: Props) {
  const [addingCard, setAddingCard] = useState(false);
  const [name, setName] = useState('');
  const [network, setNetwork] = useState<CardNetwork>('visa');
  const [last4, setLast4] = useState('');
  const [limit, setLimit] = useState('');
  const [outstanding, setOutstanding] = useState('');
  const [dueDateISO, setDueDateISO] = useState(TODAY);
  const [apr, setApr] = useState('');

  const [payingCardId, setPayingCardId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payNote, setPayNote] = useState('');

  const totals = useMemo(() => {
    const totalOutstanding = cards.reduce((s, c) => s + c.outstandingCents, 0);
    const totalLimit = cards.reduce((s, c) => s + c.limitCents, 0);
    const utilPct = totalLimit > 0 ? Math.min(100, Math.round((totalOutstanding / totalLimit) * 100)) : 0;
    return { totalOutstanding, totalLimit, utilPct };
  }, [cards]);

  const recentPayments = useMemo(
    () =>
      payments
        .slice()
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 20),
    [payments],
  );

  function cardName(cardId: string): string {
    return cards.find((c) => c.id === cardId)?.name ?? 'Card';
  }

  function resetForm() {
    setName('');
    setNetwork('visa');
    setLast4('');
    setLimit('');
    setOutstanding('');
    setDueDateISO(TODAY);
    setApr('');
  }

  function startAddCard() {
    resetForm();
    setAddingCard(true);
  }

  const canSaveCard = name.trim().length > 0 && last4.trim().length === 4 && toCents(parseFloat(limit) || 0) > 0;

  function saveCard() {
    if (!canSaveCard) return;
    onAddCard({
      name: name.trim(),
      network,
      last4: last4.trim(),
      limitCents: toCents(parseFloat(limit) || 0),
      outstandingCents: toCents(parseFloat(outstanding) || 0),
      statementCents: undefined,
      dueDateISO: dueDateISO.trim() || TODAY,
      apr: apr.trim() ? parseFloat(apr) : undefined,
    });
    setAddingCard(false);
    resetForm();
  }

  function startPayment(cardId: string) {
    setPayingCardId(cardId);
    setPayAmount('');
    setPayNote('');
  }

  const canSavePayment = toCents(parseFloat(payAmount) || 0) > 0;

  function savePayment(cardId: string) {
    if (!canSavePayment) return;
    onRecordPayment({
      cardId,
      amountCents: toCents(parseFloat(payAmount) || 0),
      dateISO: TODAY,
      note: payNote.trim() || undefined,
    });
    setPayingCardId(null);
    setPayAmount('');
    setPayNote('');
  }

  function handleDelete(id: string) {
    if (typeof window !== 'undefined' && !window.confirm('Delete this card?')) return;
    onDeleteCard(id);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      <Text style={styles.screenTitle}>Cards</Text>

      {/* Summary hero */}
      <Card style={{ marginTop: 14 }}>
        <SectionLabel>Total outstanding</SectionLabel>
        <Text style={styles.bigTotal}>{formatINR(totals.totalOutstanding)}</Text>
        <Text style={styles.heroSub}>of {formatINR(totals.totalLimit)} total limit</Text>
        <View style={{ marginTop: 12 }}>
          <SegmentBar
            segments={[
              {
                value: Math.max(1, totals.utilPct),
                color: totals.utilPct > 70 ? COLORS.danger : totals.utilPct > 30 ? COLORS.warn : COLORS.owed,
              },
            ]}
            height={8}
          />
        </View>
        <Text style={styles.heroUtilPct}>{totals.utilPct}% utilized</Text>
      </Card>

      {/* Cards */}
      <View style={styles.sectionHead}>
        <SectionLabel>Your cards</SectionLabel>
        {!addingCard && (
          <Pressable onPress={startAddCard} hitSlop={8} style={styles.addBtn}>
            <Icon name="plus" color={COLORS.primary} size={15} strokeWidth={2.4} />
            <Text style={styles.addBtnText}>Add card</Text>
          </Pressable>
        )}
      </View>

      {cards.length === 0 && !addingCard && (
        <Card>
          <Text style={styles.empty}>No cards yet. Add one to start tracking payments.</Text>
        </Card>
      )}

      {cards.map((card) => {
        const utilPct = card.limitCents > 0 ? Math.round((card.outstandingCents / card.limitCents) * 100) : 0;
        const barColor = utilPct > 70 ? COLORS.danger : utilPct > 30 ? COLORS.warn : COLORS.owed;
        const days = daysUntil(card.dueDateISO);
        const overdue = days < 0;
        const isPaying = payingCardId === card.id;
        return (
          <Card key={card.id} style={{ marginBottom: 14 }}>
            <CardVisual card={card} />
            <View style={{ marginTop: 12 }}>
              <SegmentBar segments={[{ value: Math.max(1, Math.min(utilPct, 100)), color: barColor }]} height={8} />
            </View>
            <View style={styles.cardMetaRow}>
              <Text style={[styles.cardMetaPct, { color: barColor }]}>{utilPct}% used</Text>
              <Text style={[styles.cardMetaDue, overdue && { color: COLORS.danger }]}>
                {overdue ? 'Overdue' : `Due in ${days} day${days === 1 ? '' : 's'}`}
                {' · '}
                {card.dueDateISO}
              </Text>
            </View>
            {card.apr != null && <Text style={styles.cardApr}>APR {card.apr}%</Text>}

            <View style={styles.cardActionsRow}>
              <Button
                label={isPaying ? 'Cancel' : 'Pay'}
                variant={isPaying ? 'ghost' : 'secondary'}
                onPress={() => (isPaying ? setPayingCardId(null) : startPayment(card.id))}
                style={{ flex: 1 }}
              />
              <Pressable onPress={() => handleDelete(card.id)} hitSlop={8} style={styles.deleteBtn}>
                <Icon name="trash" color={COLORS.subtext} size={16} />
              </Pressable>
            </View>

            {isPaying && (
              <View style={styles.payForm}>
                <Field
                  label="Amount (Rs)"
                  value={payAmount}
                  onChangeText={setPayAmount}
                  placeholder="1000"
                  keyboardType="decimal-pad"
                />
                <Field
                  label="Note (optional)"
                  value={payNote}
                  onChangeText={setPayNote}
                  placeholder="e.g. Statement payment"
                  style={{ marginTop: 10 }}
                />
                <Button
                  label="Record payment"
                  onPress={() => savePayment(card.id)}
                  disabled={!canSavePayment}
                  style={{ marginTop: 12 }}
                />
              </View>
            )}
          </Card>
        );
      })}

      {addingCard && (
        <Card>
          <SectionLabel>New card</SectionLabel>
          <Field label="Card name" value={name} onChangeText={setName} placeholder="e.g. HDFC Regalia" />
          <View style={styles.networkPills}>
            {NETWORKS.map((n) => (
              <Pill key={n.key} label={n.label} active={network === n.key} onPress={() => setNetwork(n.key)} />
            ))}
          </View>
          <Field
            label="Last 4 digits"
            value={last4}
            onChangeText={(t) => setLast4(t.replace(/[^0-9]/g, '').slice(0, 4))}
            placeholder="1234"
            keyboardType="numeric"
            style={{ marginTop: 10 }}
          />
          <View style={styles.row2}>
            <Field
              label="Credit limit (Rs)"
              value={limit}
              onChangeText={setLimit}
              placeholder="100000"
              keyboardType="decimal-pad"
              style={{ flex: 1 }}
            />
            <Field
              label="Outstanding (Rs)"
              value={outstanding}
              onChangeText={setOutstanding}
              placeholder="0"
              keyboardType="decimal-pad"
              style={{ flex: 1 }}
            />
          </View>
          <View style={styles.row2}>
            <Field
              label="Due date (YYYY-MM-DD)"
              value={dueDateISO}
              onChangeText={setDueDateISO}
              placeholder={TODAY}
              style={{ flex: 1 }}
            />
            <Field
              label="APR % (optional)"
              value={apr}
              onChangeText={setApr}
              placeholder="3.5"
              keyboardType="decimal-pad"
              style={{ flex: 1 }}
            />
          </View>
          <View style={styles.formActions}>
            <Button label="Cancel" variant="ghost" onPress={() => setAddingCard(false)} style={{ flex: 1 }} />
            <Button label="Save card" onPress={saveCard} disabled={!canSaveCard} style={{ flex: 1 }} />
          </View>
        </Card>
      )}

      {/* Recent payments */}
      <SectionLabel>Recent payments</SectionLabel>
      {recentPayments.length === 0 ? (
        <Card>
          <Text style={styles.empty}>No payments recorded yet.</Text>
        </Card>
      ) : (
        <Card>
          {recentPayments.map((p: CardPayment, i: number) => (
            <View key={p.id} style={[styles.paymentRow, i > 0 && styles.paymentRowBorder]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.paymentCard}>{cardName(p.cardId)}</Text>
                {p.note && <Text style={styles.paymentNote}>{p.note}</Text>}
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.paymentAmount}>{formatINR(p.amountCents)}</Text>
                <Text style={styles.paymentDate}>{p.dateISO}</Text>
              </View>
            </View>
          ))}
        </Card>
      )}

      <View style={{ height: 12 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.screenBg },
  scroll: { padding: 16, paddingBottom: 28 },
  screenTitle: { color: COLORS.ink, fontWeight: '900', fontSize: 22 },
  bigTotal: { color: COLORS.ink, fontWeight: '900', fontSize: 28, marginTop: 6 },
  heroSub: { color: COLORS.subtext, fontSize: 12.5, marginTop: 2 },
  heroUtilPct: { color: COLORS.subtext, fontWeight: '700', fontSize: 12.5, marginTop: 6 },
  empty: { color: COLORS.subtext, fontSize: 13.5, marginTop: 8 },

  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 22,
    marginBottom: 8,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  addBtnText: { color: COLORS.primary, fontWeight: '800', fontSize: 12 },

  cardVisual: {
    height: 180,
    borderRadius: 18,
    padding: 18,
    justifyContent: 'space-between',
  },
  cardVisualTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardVisualName: { color: '#fff', fontWeight: '800', fontSize: 15 },
  cardVisualNetwork: { color: 'rgba(255,255,255,0.85)', fontWeight: '800', fontSize: 12, letterSpacing: 1 },
  cardVisualNumber: { color: '#fff', fontWeight: '700', fontSize: 16, letterSpacing: 2 },
  cardVisualBottomRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  cardVisualLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 10.5, fontWeight: '700', textTransform: 'uppercase' },
  cardVisualAmount: { color: '#fff', fontWeight: '900', fontSize: 20, marginTop: 2 },
  cardVisualAmountSmall: { color: '#fff', fontWeight: '800', fontSize: 15, marginTop: 2 },

  cardMetaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  cardMetaPct: { fontWeight: '900', fontSize: 13 },
  cardMetaDue: { color: COLORS.subtext, fontWeight: '600', fontSize: 12 },
  cardApr: { color: COLORS.subtext, fontSize: 12, marginTop: 4 },

  cardActionsRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
  deleteBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.chip,
  },

  payForm: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: COLORS.divider },

  networkPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  row2: { flexDirection: 'row', gap: 10, marginTop: 10 },
  formActions: { flexDirection: 'row', gap: 10, marginTop: 16 },

  paymentRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  paymentRowBorder: { borderTopWidth: 1, borderTopColor: COLORS.divider },
  paymentCard: { color: COLORS.ink, fontWeight: '700', fontSize: 14 },
  paymentNote: { color: COLORS.subtext, fontSize: 12, marginTop: 2 },
  paymentAmount: { color: COLORS.ink, fontWeight: '800', fontSize: 14 },
  paymentDate: { color: COLORS.subtext, fontSize: 11.5, marginTop: 2 },
});
