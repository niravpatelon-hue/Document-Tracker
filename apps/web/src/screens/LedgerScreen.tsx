import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { formatAmount } from '@domain/money';
import { COLORS } from '../theme';
import type { WebTransaction } from '../store';

interface Props {
  transactions: WebTransaction[];
}

export default function LedgerScreen({ transactions }: Props) {
  const total = useMemo(() => transactions.reduce((s, t) => s + t.amount, 0), [transactions]);

  return (
    <View style={styles.container}>
      <View style={styles.summary}>
        <Text style={styles.summaryLabel}>Total documented spend</Text>
        <Text style={styles.summaryValue}>${formatAmount(total)}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        {transactions.length === 0 ? (
          <Text style={styles.empty}>No transactions yet.</Text>
        ) : (
          transactions.map((t) => (
            <View key={t.id} style={styles.row}>
              <View style={styles.rowLeft}>
                <Text style={styles.vendor}>{t.vendor}</Text>
                <Text style={styles.date}>{t.dateISO}</Text>
              </View>
              <Text style={styles.amount}>${formatAmount(t.amount)}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  summary: { padding: 20, backgroundColor: COLORS.screenBg, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  summaryLabel: { color: COLORS.subtext, fontSize: 13 },
  summaryValue: { color: COLORS.text, fontSize: 30, fontWeight: '800', marginTop: 4 },
  scroll: { padding: 16 },
  empty: { color: COLORS.subtext, textAlign: 'center', marginTop: 30 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  rowLeft: { flex: 1 },
  vendor: { fontSize: 16, fontWeight: '600', color: COLORS.text },
  date: { fontSize: 13, color: COLORS.subtext, marginTop: 2 },
  amount: { fontSize: 16, fontWeight: '700', color: COLORS.text },
});
