import React, { useMemo } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Q } from '@nozbe/watermelondb';
import { useDatabase } from '@nozbe/watermelondb/react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import type { Transaction } from '../db/models';
import { useQuery } from '../hooks/useQuery';
import { formatAmount } from '../domain/money';
import { CURRENT_USER_ID } from '../config';

type Props = NativeStackScreenProps<RootStackParamList, 'Ledger'>;

export default function LedgerScreen(_props: Props) {
  const database = useDatabase();
  const transactions = useQuery<Transaction>(
    () =>
      database
        .get<Transaction>('transactions')
        .query(Q.where('owner_id', CURRENT_USER_ID), Q.sortBy('date', Q.desc)),
    [database],
  );

  const total = useMemo(
    () => transactions.reduce((sum, t) => sum + t.amount, 0),
    [transactions],
  );

  return (
    <View style={styles.container}>
      <View style={styles.summary}>
        <Text style={styles.summaryLabel}>Total documented spend</Text>
        <Text style={styles.summaryValue}>${formatAmount(total)}</Text>
      </View>
      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<Text style={styles.empty}>No transactions yet.</Text>}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Text style={styles.vendor}>{item.vendor}</Text>
              <Text style={styles.date}>{item.date}</Text>
            </View>
            <Text style={styles.amount}>${formatAmount(item.amount)}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  summary: { padding: 20, backgroundColor: '#f6f8fa', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e0e0e0' },
  summaryLabel: { color: '#666', fontSize: 13 },
  summaryValue: { color: '#111', fontSize: 28, fontWeight: '800', marginTop: 4 },
  empty: { textAlign: 'center', color: '#888', marginTop: 40 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#eee' },
  rowLeft: { flex: 1 },
  vendor: { fontSize: 16, fontWeight: '600', color: '#111' },
  date: { fontSize: 13, color: '#888', marginTop: 2 },
  amount: { fontSize: 16, fontWeight: '700', color: '#111' },
});
