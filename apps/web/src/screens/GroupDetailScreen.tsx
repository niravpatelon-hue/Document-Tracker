import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { computeSplit, type SplitParticipantInput, type SplitType } from '@domain/splitting';
import { computeNetBalances, simplifyDebts } from '@domain/settleup/simplify';
import { buildSettleUpLink } from '@domain/settleup/deeplinks';
import { formatAmount, fromCents, toCents } from '@domain/money';
import { COLORS } from '../theme';
import type { WebDocument, WebExpense, WebGroup, WebSettlement } from '../store';

interface Props {
  group: WebGroup;
  expenses: WebExpense[];
  settlements: WebSettlement[];
  receiptDocs: WebDocument[];
  onAddExpense: (e: Omit<WebExpense, 'id'>) => void;
  onRecordSettlement: (s: Omit<WebSettlement, 'id'>) => void;
}

const SPLIT_TYPES: SplitType[] = ['equal', 'percentage', 'exact', 'share'];

export default function GroupDetailScreen({
  group,
  expenses,
  settlements,
  receiptDocs,
  onAddExpense,
  onRecordSettlement,
}: Props) {
  const nameOf = (id: string) => group.members.find((m) => m.id === id)?.name ?? id;
  const venmoOf = (id: string) => {
    const m = group.members.find((x) => x.id === id);
    return m?.venmo ?? (m?.name ?? id).toLowerCase().replace(/\s+/g, '-');
  };

  const { balances, transfers } = useMemo(() => {
    const b = computeNetBalances(
      expenses.map((e) => ({ payerId: e.payerId, allocations: e.allocations })),
      settlements.map((s) => ({ fromUser: s.fromUser, toUser: s.toUser, amount: s.amount })),
    );
    let t: ReturnType<typeof simplifyDebts> = [];
    try {
      t = simplifyDebts(b);
    } catch {
      t = [];
    }
    return { balances: b, transfers: t };
  }, [expenses, settlements]);

  // Add-expense form state
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [payerId, setPayerId] = useState('u_you');
  const [totalStr, setTotalStr] = useState('');
  const [splitType, setSplitType] = useState<SplitType>('equal');
  const [values, setValues] = useState<Record<string, string>>({});
  const [sourceDocumentId, setSourceDocumentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function pickReceipt(doc: WebDocument) {
    setDescription(doc.vendor ?? 'Receipt');
    setTotalStr(doc.totalCents != null ? fromCents(doc.totalCents).toFixed(2) : '');
    setSourceDocumentId(doc.id);
  }

  function submit() {
    setError(null);
    const totalNum = Number(totalStr);
    if (!description.trim()) return setError('Enter a description.');
    if (!Number.isFinite(totalNum) || totalNum <= 0) return setError('Enter a valid amount.');
    const totalCents = toCents(totalNum);

    const participants: SplitParticipantInput[] = group.members.map((m) => {
      if (splitType === 'equal') return { userId: m.id };
      const raw = Number(values[m.id] ?? '');
      const val = Number.isFinite(raw) ? raw : 0;
      return { userId: m.id, value: splitType === 'exact' ? toCents(val) : val };
    });

    try {
      const allocations = computeSplit(totalCents, splitType, participants).map((a) => ({
        userId: a.userId,
        cents: a.cents,
      }));
      onAddExpense({
        groupId: group.id,
        description: description.trim(),
        payerId,
        totalCents,
        splitType,
        allocations,
        sourceDocumentId,
      });
      setOpen(false);
      setDescription('');
      setTotalStr('');
      setValues({});
      setSplitType('equal');
      setSourceDocumentId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      <Text style={styles.section}>Balances</Text>
      {balances.map((b) => (
        <View key={b.userId} style={styles.balRow}>
          <Text style={styles.balName}>{nameOf(b.userId)}</Text>
          <Text
            style={[
              styles.balNet,
              { color: b.net > 0 ? COLORS.success : b.net < 0 ? COLORS.danger : COLORS.subtext },
            ]}
          >
            {b.net === 0 ? 'settled' : b.net > 0 ? `gets back $${formatAmount(b.net)}` : `owes $${formatAmount(-b.net)}`}
          </Text>
        </View>
      ))}

      <Text style={styles.section}>Settle up · fewest transfers</Text>
      {transfers.length === 0 ? (
        <Text style={styles.empty}>Everyone is settled.</Text>
      ) : (
        transfers.map((t, i) => {
          const link = buildSettleUpLink(
            { provider: 'venmo', username: venmoOf(t.to) },
            { amount: t.amount, note: group.name },
          );
          return (
            <View key={i} style={styles.settle}>
              <Text style={styles.settleText}>
                {nameOf(t.from)} → {nameOf(t.to)}{' '}
                <Text style={styles.settleAmt}>${formatAmount(t.amount)}</Text>
              </Text>
              <View style={styles.settleBtns}>
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
                  <Text style={styles.venmoText}>Venmo</Text>
                </Pressable>
                <Pressable
                  style={styles.markBtn}
                  onPress={() => onRecordSettlement({ groupId: group.id, fromUser: t.from, toUser: t.to, amount: t.amount })}
                >
                  <Text style={styles.markText}>Mark settled</Text>
                </Pressable>
              </View>
            </View>
          );
        })
      )}

      <View style={styles.sectionHeaderRow}>
        <Text style={styles.section}>Expenses</Text>
        <Pressable onPress={() => setOpen((o) => !o)}>
          <Text style={styles.link}>{open ? 'Close' : '+ Add'}</Text>
        </Pressable>
      </View>

      {open && (
        <View style={styles.form}>
          {receiptDocs.length > 0 && (
            <>
              <Text style={styles.label}>Split from a receipt (optional)</Text>
              <View style={styles.chips}>
                {receiptDocs.slice(0, 6).map((d) => (
                  <Pressable
                    key={d.id}
                    style={[styles.chip, sourceDocumentId === d.id && styles.chipActive]}
                    onPress={() => pickReceipt(d)}
                  >
                    <Text style={[styles.chipText, sourceDocumentId === d.id && styles.chipTextActive]}>
                      {d.vendor} ${d.totalCents != null ? formatAmount(d.totalCents) : ''}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}
          <Text style={styles.label}>Description</Text>
          <TextInput style={styles.input} value={description} onChangeText={setDescription} placeholder="e.g. Dinner" />
          <Text style={styles.label}>Amount ($)</Text>
          <TextInput style={styles.input} value={totalStr} onChangeText={setTotalStr} placeholder="0.00" keyboardType="decimal-pad" />

          <Text style={styles.label}>Paid by</Text>
          <View style={styles.chips}>
            {group.members.map((m) => (
              <Pressable key={m.id} style={[styles.chip, payerId === m.id && styles.chipActive]} onPress={() => setPayerId(m.id)}>
                <Text style={[styles.chipText, payerId === m.id && styles.chipTextActive]}>{m.name}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Split</Text>
          <View style={styles.chips}>
            {SPLIT_TYPES.map((s) => (
              <Pressable key={s} style={[styles.chip, splitType === s && styles.chipActive]} onPress={() => setSplitType(s)}>
                <Text style={[styles.chipText, splitType === s && styles.chipTextActive]}>{s}</Text>
              </Pressable>
            ))}
          </View>

          {splitType !== 'equal' && (
            <View style={styles.valueGrid}>
              {group.members.map((m) => (
                <View key={m.id} style={styles.valueRow}>
                  <Text style={styles.valueName}>{m.name}</Text>
                  <TextInput
                    style={styles.valueInput}
                    value={values[m.id] ?? ''}
                    onChangeText={(v) => setValues((prev) => ({ ...prev, [m.id]: v }))}
                    placeholder={splitType === 'percentage' ? '%' : splitType === 'exact' ? '$' : 'shares'}
                    keyboardType="decimal-pad"
                  />
                </View>
              ))}
            </View>
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable style={styles.primary} onPress={submit}>
            <Text style={styles.primaryText}>Add expense</Text>
          </Pressable>
        </View>
      )}

      {expenses.length === 0 ? (
        <Text style={styles.empty}>No expenses yet.</Text>
      ) : (
        expenses.map((e) => (
          <View key={e.id} style={styles.expRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.expDesc}>
                {e.description}
                {e.sourceDocumentId ? '  📎' : ''}
              </Text>
              <Text style={styles.expMeta}>
                {nameOf(e.payerId)} paid · {e.splitType}
              </Text>
            </View>
            <Text style={styles.expAmt}>${formatAmount(e.totalCents)}</Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { padding: 16, paddingBottom: 24 },
  section: { fontSize: 13, fontWeight: '700', color: COLORS.subtext, marginTop: 18, marginBottom: 8, textTransform: 'uppercase' },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  link: { color: COLORS.primary, fontWeight: '700', fontSize: 14, marginTop: 18 },
  empty: { color: COLORS.subtext },
  balRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  balName: { fontSize: 15, color: COLORS.text, fontWeight: '600' },
  balNet: { fontSize: 14, fontWeight: '700' },
  settle: { backgroundColor: COLORS.screenBg, borderRadius: 10, padding: 12, marginBottom: 10 },
  settleText: { fontSize: 15, color: COLORS.text },
  settleAmt: { fontWeight: '800' },
  settleBtns: { flexDirection: 'row', gap: 8, marginTop: 8 },
  venmo: { backgroundColor: '#008CFF', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 16 },
  venmoText: { color: '#fff', fontWeight: '700' },
  markBtn: { backgroundColor: COLORS.chip, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 16 },
  markText: { color: COLORS.text, fontWeight: '700' },
  form: { backgroundColor: COLORS.screenBg, borderRadius: 12, padding: 12, marginBottom: 10 },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.subtext, marginTop: 10, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 9, fontSize: 15, color: COLORS.text, backgroundColor: '#fff' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, backgroundColor: '#e6eaf0' },
  chipActive: { backgroundColor: COLORS.primary },
  chipText: { fontSize: 12, color: COLORS.text, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  valueGrid: { marginTop: 8, gap: 6 },
  valueRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  valueName: { fontSize: 14, color: COLORS.text },
  valueInput: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, fontSize: 14, width: 110, backgroundColor: '#fff' },
  error: { color: COLORS.danger, fontWeight: '600', marginTop: 10 },
  primary: { backgroundColor: COLORS.primary, borderRadius: 10, paddingVertical: 13, alignItems: 'center', marginTop: 12 },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  expRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  expDesc: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  expMeta: { fontSize: 12, color: COLORS.subtext, marginTop: 2 },
  expAmt: { fontSize: 15, fontWeight: '700', color: COLORS.text },
});
