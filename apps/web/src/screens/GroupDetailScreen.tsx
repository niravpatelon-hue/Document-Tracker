import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { computeNetBalances, simplifyDebts } from '@domain/settleup/simplify';
import { buildSettleUpLink } from '@domain/settleup/deeplinks';
import { formatINR, toCents } from '@domain/money';
import { COLORS } from '../theme';
import {
  Avatar,
  BalanceAmount,
  Button,
  Card,
  CategoryAvatar,
  Field,
  Icon,
  ListRow,
  Pill,
  SectionLabel,
} from '../components/ui';
import { ME, myNetForExpense, type Expense, type Group, type Settlement } from '../store';

interface Props {
  group: Group;
  expenses: Expense[];
  settlements: Settlement[];
  onAddExpense: () => void;
  onEditExpense: (e: Expense) => void;
  onDeleteExpense: (id: string) => void;
  onRecordSettlement: (s: { groupId: string; fromUser: string; toUser: string; amountCents: number; note?: string }) => void;
  /** Toggle the cosmetic "settled/paid" flag on an expense. Display-only; never affects balance math. */
  onToggleSettled?: (id: string) => void;
}

export default function GroupDetailScreen({
  group,
  expenses,
  settlements,
  onAddExpense,
  onEditExpense,
  onDeleteExpense,
  onRecordSettlement,
  onToggleSettled,
}: Props) {
  const nameOf = (id: string) => group.members.find((m) => m.id === id)?.name ?? id;
  const memberOf = (id: string) => group.members.find((m) => m.id === id);

  const { balances, transfers } = useMemo(() => {
    const b = computeNetBalances(
      expenses.map((e) => ({ payers: e.paidBy, allocations: e.allocations })),
      settlements.map((s) => ({ fromUser: s.fromUser, toUser: s.toUser, amount: s.amountCents })),
    );
    let t: ReturnType<typeof simplifyDebts> = [];
    try {
      t = simplifyDebts(b);
    } catch {
      t = [];
    }
    return { balances: b, transfers: t };
  }, [expenses, settlements]);

  const myNet = balances.find((b) => b.userId === ME)?.net ?? 0;

  const [settleOpen, setSettleOpen] = useState(false);
  const [sFrom, setSFrom] = useState(ME);
  const [sTo, setSTo] = useState(group.members.find((m) => m.id !== ME)?.id ?? ME);
  const [sAmount, setSAmount] = useState('');

  const sorted = useMemo(() => [...expenses].sort((a, b) => b.createdAt - a.createdAt), [expenses]);

  const openLink = (url: string) => {
    try {
      window.open(url, '_blank');
    } catch {
      /* no-op */
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      <Card style={styles.hero}>
        <Text style={styles.heroCap}>Your balance in {group.name}</Text>
        <BalanceAmount cents={myNet} size={34} weight="800" />
        <Text style={styles.heroSub}>
          {myNet === 0 ? "You're all settled up" : myNet > 0 ? 'You are owed overall' : 'You owe overall'}
        </Text>
      </Card>

      <View style={styles.actionRow}>
        <Button label="Add expense" icon="plus" onPress={onAddExpense} style={{ flex: 1 }} />
        <Button
          label="Settle up"
          icon="split"
          variant="secondary"
          onPress={() => setSettleOpen((s) => !s)}
          style={{ flex: 1 }}
        />
      </View>

      <SectionLabel>Balances</SectionLabel>
      <Card>
        {balances.map((b, i) => (
          <View key={b.userId} style={[styles.balRow, i > 0 && styles.divider]}>
            <View style={styles.balLeft}>
              <Avatar name={nameOf(b.userId)} size={34} />
              <Text style={styles.balName}>{b.userId === ME ? 'You' : nameOf(b.userId)}</Text>
            </View>
            {b.net === 0 ? (
              <Text style={styles.settledText}>settled up</Text>
            ) : (
              <BalanceAmount cents={b.net} />
            )}
          </View>
        ))}
      </Card>

      {settleOpen && (
        <>
          <SectionLabel>Suggested transfers</SectionLabel>
          <Card>
            {transfers.length === 0 ? (
              <Text style={styles.empty}>Everyone is settled up.</Text>
            ) : (
              transfers.map((t, i) => {
                const payee = memberOf(t.to);
                const upiLink = payee?.upi
                  ? buildSettleUpLink(
                      { provider: 'upi', vpa: payee.upi, payeeName: payee.name },
                      { amount: t.amount, note: group.name },
                    )
                  : null;
                return (
                  <View key={i} style={[styles.transferRow, i > 0 && styles.divider]}>
                    <Text style={styles.transferText}>
                      {nameOf(t.from)} to {nameOf(t.to)}{' '}
                      <Text style={styles.transferAmt}>{formatINR(t.amount)}</Text>
                    </Text>
                    <View style={styles.transferBtns}>
                      {upiLink ? (
                        <Button label="Pay via UPI" variant="secondary" onPress={() => openLink(upiLink)} />
                      ) : null}
                      <Button
                        label="Mark settled"
                        onPress={() =>
                          onRecordSettlement({ groupId: group.id, fromUser: t.from, toUser: t.to, amountCents: t.amount })
                        }
                      />
                    </View>
                  </View>
                );
              })
            )}
          </Card>

          <SectionLabel>Record a payment</SectionLabel>
          <Card>
            <Text style={styles.smallLabel}>From</Text>
            <View style={styles.chipsRow}>
              {group.members.map((m) => (
                <Pill key={m.id} label={m.name} active={sFrom === m.id} onPress={() => setSFrom(m.id)} />
              ))}
            </View>
            <Text style={[styles.smallLabel, { marginTop: 12 }]}>To</Text>
            <View style={styles.chipsRow}>
              {group.members.map((m) => (
                <Pill key={m.id} label={m.name} active={sTo === m.id} onPress={() => setSTo(m.id)} />
              ))}
            </View>
            <Field
              label="Amount"
              value={sAmount}
              onChangeText={setSAmount}
              placeholder="0.00"
              keyboardType="decimal-pad"
              style={{ marginTop: 12 }}
            />
            <Button
              label="Record"
              icon="check"
              onPress={() => {
                const amt = toCents(Number(sAmount));
                if (sFrom !== sTo && amt > 0) {
                  onRecordSettlement({ groupId: group.id, fromUser: sFrom, toUser: sTo, amountCents: amt });
                  setSAmount('');
                }
              }}
              style={{ marginTop: 12 }}
            />
          </Card>
        </>
      )}

      <SectionLabel>Expenses</SectionLabel>
      <Text style={styles.settledHint}>
        Marking an expense as settled is just for your own tracking — it does not change balances.
      </Text>
      <Card>
        {sorted.length === 0 ? (
          <Text style={styles.empty}>No expenses yet in this group.</Text>
        ) : (
          sorted.map((e, i) => {
            const payerName = e.paidBy.length > 0 ? nameOf(e.paidBy[0]!.userId) : '';
            const extraPayers = e.paidBy.length > 1 ? ` +${e.paidBy.length - 1}` : '';
            const net = myNetForExpense(e);
            return (
              <View key={e.id} style={[i > 0 && styles.divider]}>
                <ListRow
                  avatar={<CategoryAvatar category={e.category} size={40} />}
                  title={e.description}
                  subtitle={`${payerName}${extraPayers} paid ${formatINR(e.amountCents)}`}
                  rightTop={<BalanceAmount cents={net} />}
                  rightBottom={
                    <View style={styles.rowActions}>
                      <Pressable onPress={() => onToggleSettled?.(e.id)} hitSlop={8}>
                        {e.settled ? (
                          <View style={styles.settledDotOn}>
                            <Icon name="check" color="#fff" size={10} strokeWidth={2.6} />
                          </View>
                        ) : (
                          <View style={styles.settledDotOff} />
                        )}
                      </Pressable>
                      <Pressable onPress={() => onDeleteExpense(e.id)} hitSlop={8}>
                        <Icon name="trash" color={COLORS.muted} size={15} />
                      </Pressable>
                    </View>
                  }
                  onPress={() => onEditExpense(e)}
                />
              </View>
            );
          })
        )}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.screenBg },
  scroll: { padding: 16, paddingBottom: 28 },
  hero: { alignItems: 'center', gap: 4, paddingVertical: 22 },
  heroCap: { color: COLORS.subtext, fontWeight: '700', fontSize: 12.5 },
  heroSub: { color: COLORS.subtext, fontSize: 13, marginTop: 2 },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 14, marginBottom: 4 },
  balRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
  balLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  balName: { fontSize: 15, color: COLORS.ink, fontWeight: '700' },
  settledText: { color: COLORS.subtext, fontSize: 13, fontWeight: '600' },
  divider: { borderTopWidth: 1, borderTopColor: COLORS.divider },
  empty: { color: COLORS.subtext, fontSize: 13.5 },
  transferRow: { paddingVertical: 12 },
  transferText: { fontSize: 14.5, color: COLORS.ink },
  transferAmt: { fontWeight: '800' },
  transferBtns: { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  smallLabel: { color: COLORS.subtext, fontWeight: '700', fontSize: 12.5, marginBottom: 6 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  settledHint: { color: COLORS.subtext, fontSize: 12, marginTop: -4, marginBottom: 10, lineHeight: 16 },
  rowActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  settledDotOn: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.owed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settledDotOff: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: COLORS.muted,
  },
});
