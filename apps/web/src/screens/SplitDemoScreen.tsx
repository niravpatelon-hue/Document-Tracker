import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { computeSplit, type SplitType } from '@domain/splitting';
import { computeNetBalances, simplifyDebts } from '@domain/settleup/simplify';
import { buildSettleUpLink } from '@domain/settleup/deeplinks';
import { formatAmount } from '@domain/money';
import { COLORS } from '../theme';

const PEOPLE = [
  { id: 'u_you', name: 'You', venmo: 'you' },
  { id: 'u_alex', name: 'Alex', venmo: 'alex-rn' },
  { id: 'u_sam', name: 'Sam', venmo: 'sam-k' },
];
const TOTAL = 12000; // $120.00
const PAYER = 'u_you';

const SPLIT_TYPES: { key: SplitType; label: string }[] = [
  { key: 'equal', label: 'Equal' },
  { key: 'percentage', label: 'Percentage' },
  { key: 'exact', label: 'Exact' },
  { key: 'share', label: 'Shares' },
];

function participantsFor(type: SplitType) {
  switch (type) {
    case 'equal':
      return PEOPLE.map((p) => ({ userId: p.id }));
    case 'percentage':
      return [
        { userId: 'u_you', value: 50 },
        { userId: 'u_alex', value: 25 },
        { userId: 'u_sam', value: 25 },
      ];
    case 'exact':
      return [
        { userId: 'u_you', value: 6000 },
        { userId: 'u_alex', value: 3000 },
        { userId: 'u_sam', value: 3000 },
      ];
    case 'share':
      return [
        { userId: 'u_you', value: 2 },
        { userId: 'u_alex', value: 1 },
        { userId: 'u_sam', value: 1 },
      ];
    default:
      return [];
  }
}

const nameOf = (id: string) => PEOPLE.find((p) => p.id === id)?.name ?? id;
const venmoOf = (id: string) => PEOPLE.find((p) => p.id === id)?.venmo ?? id;

export default function SplitDemoScreen() {
  const [type, setType] = useState<SplitType>('equal');

  const { allocations, transfers, error } = useMemo(() => {
    try {
      const allocs = computeSplit(TOTAL, type, participantsFor(type));
      const balances = computeNetBalances([{ payerId: PAYER, allocations: allocs }]);
      return { allocations: allocs, transfers: simplifyDebts(balances), error: null as string | null };
    } catch (e) {
      return { allocations: [], transfers: [], error: e instanceof Error ? e.message : String(e) };
    }
  }, [type]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      <View style={styles.card}>
        <Text style={styles.expenseTitle}>Dinner</Text>
        <Text style={styles.expenseMeta}>${formatAmount(TOTAL)} · paid by You · 3 people</Text>
      </View>

      <Text style={styles.label}>Split type</Text>
      <View style={styles.chips}>
        {SPLIT_TYPES.map((s) => {
          const active = type === s.key;
          return (
            <Pressable key={s.key} style={[styles.chip, active && styles.chipActive]} onPress={() => setType(s.key)}>
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{s.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.section}>Each person owes</Text>
      {allocations.map((a) => (
        <View key={a.userId} style={styles.row}>
          <Text style={styles.rowName}>{nameOf(a.userId)}</Text>
          <Text style={styles.rowAmount}>${formatAmount(a.cents)}</Text>
        </View>
      ))}

      <Text style={styles.section}>Settle up · fewest transfers</Text>
      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : transfers.length === 0 ? (
        <Text style={styles.empty}>Everyone is settled.</Text>
      ) : (
        transfers.map((t, i) => {
          const link = buildSettleUpLink(
            { provider: 'venmo', username: venmoOf(t.to) },
            { amount: t.amount, note: 'Dinner' },
          );
          return (
            <View key={i} style={styles.transfer}>
              <Text style={styles.transferText}>
                {nameOf(t.from)} pays {nameOf(t.to)}{' '}
                <Text style={styles.transferAmount}>${formatAmount(t.amount)}</Text>
              </Text>
              <Pressable
                style={styles.venmo}
                onPress={() => {
                  try {
                    window.open(link, '_blank');
                  } catch {
                    /* deep link no-op on desktop */
                  }
                }}
              >
                <Text style={styles.venmoText}>Open in Venmo</Text>
              </Pressable>
              <Text style={styles.linkText}>{link}</Text>
            </View>
          );
        })
      )}

      <Text style={styles.footnote}>
        Allocations, balance-netting, transfer minimization, and the Venmo link above are all
        produced by the app's real domain code (the same functions covered by the unit tests).
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { padding: 16 },
  card: { backgroundColor: COLORS.screenBg, borderRadius: 12, padding: 16, marginBottom: 16 },
  expenseTitle: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  expenseMeta: { fontSize: 13, color: COLORS.subtext, marginTop: 4 },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.subtext, marginBottom: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: COLORS.chip },
  chipActive: { backgroundColor: COLORS.primary },
  chipText: { color: COLORS.text, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  section: { fontSize: 13, fontWeight: '700', color: COLORS.subtext, marginTop: 20, marginBottom: 8, textTransform: 'uppercase' },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  rowName: { fontSize: 16, color: COLORS.text },
  rowAmount: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  transfer: { backgroundColor: COLORS.screenBg, borderRadius: 10, padding: 12, marginBottom: 10 },
  transferText: { fontSize: 15, color: COLORS.text },
  transferAmount: { fontWeight: '800' },
  venmo: { backgroundColor: '#008CFF', borderRadius: 8, paddingVertical: 8, alignItems: 'center', marginTop: 8 },
  venmoText: { color: '#fff', fontWeight: '700' },
  linkText: { fontFamily: 'monospace', fontSize: 11, color: COLORS.subtext, marginTop: 6 },
  empty: { color: COLORS.subtext },
  error: { color: COLORS.danger, fontWeight: '600' },
  footnote: { fontSize: 12, color: COLORS.subtext, lineHeight: 18, marginTop: 20 },
});
