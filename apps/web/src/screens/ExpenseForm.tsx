import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { computeSplit, type SplitParticipantInput, type SplitType } from '@domain/splitting';
import { formatAmount, fromCents, toCents } from '@domain/money';
import { COLORS } from '../theme';
import { EXPENSE_CATEGORIES, type WebDocument, type WebExpense, type WebGroup } from '../store';

export type ExpenseFormData = Omit<WebExpense, 'id' | 'createdAt'>;

interface Props {
  group: WebGroup;
  receiptDocs: WebDocument[];
  initial?: WebExpense | null;
  /** When adding, seed the form from this Bills & Receipts document. */
  prefillReceipt?: WebDocument | null;
  onSubmit: (data: ExpenseFormData) => void;
  onCancel: () => void;
}

const SPLIT_TYPES: { key: SplitType; label: string }[] = [
  { key: 'equal', label: 'Equally' },
  { key: 'exact', label: 'Exact $' },
  { key: 'percentage', label: '%' },
  { key: 'share', label: 'Shares' },
  { key: 'adjustment', label: '+/− adj' },
];

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function ExpenseForm({ group, receiptDocs, initial, prefillReceipt, onSubmit, onCancel }: Props) {
  const [description, setDescription] = useState(initial?.description ?? prefillReceipt?.vendor ?? '');
  const [category, setCategory] = useState(initial?.category ?? (prefillReceipt ? 'Groceries' : 'General'));
  const [dateISO, setDateISO] = useState(initial?.dateISO ?? prefillReceipt?.dateISO ?? todayISO());
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [total, setTotal] = useState(
    initial
      ? fromCents(initial.totalCents).toFixed(2)
      : prefillReceipt?.totalCents != null
      ? fromCents(prefillReceipt.totalCents).toFixed(2)
      : '',
  );
  const [sourceDocumentId, setSourceDocumentId] = useState<string | null>(
    initial?.sourceDocumentId ?? prefillReceipt?.id ?? null,
  );

  const [involved, setInvolved] = useState<Set<string>>(
    new Set(initial?.involvedIds ?? group.members.map((m) => m.id)),
  );
  const [payersMode, setPayersMode] = useState<'single' | 'multiple'>(
    initial && initial.payers.length > 1 ? 'multiple' : 'single',
  );
  const [payerId, setPayerId] = useState(initial?.payers[0]?.userId ?? 'u_you');
  const [perPayer, setPerPayer] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    initial?.payers.forEach((p) => (m[p.userId] = fromCents(p.cents).toFixed(2)));
    return m;
  });

  const [splitType, setSplitType] = useState<SplitType>(initial?.splitType ?? 'equal');
  const [values, setValues] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    if (initial && initial.splitType === 'exact') {
      initial.allocations.forEach((a) => (m[a.userId] = fromCents(a.cents).toFixed(2)));
    }
    return m;
  });
  const [error, setError] = useState<string | null>(null);

  function toggleInvolved(id: string) {
    setInvolved((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function pickReceipt(doc: WebDocument) {
    setDescription(doc.vendor ?? 'Receipt');
    setCategory('Groceries');
    if (doc.totalCents != null) {
      setTotal(fromCents(doc.totalCents).toFixed(2));
    }
    if (doc.dateISO) {
      setDateISO(doc.dateISO);
    }
    setSourceDocumentId(doc.id);
  }

  function submit() {
    setError(null);
    const totalNum = Number(total);
    if (!description.trim()) return setError('Enter a description.');
    if (!Number.isFinite(totalNum) || totalNum <= 0) return setError('Enter a valid amount.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) return setError('Use date format YYYY-MM-DD.');
    const totalCents = toCents(totalNum);

    const involvedMembers = group.members.filter((m) => involved.has(m.id));
    if (involvedMembers.length === 0) return setError('Pick at least one person who is involved.');

    // Payers
    let payers;
    if (payersMode === 'single') {
      payers = [{ userId: payerId, cents: totalCents }];
    } else {
      payers = group.members
        .map((m) => ({ userId: m.id, cents: toCents(Number(perPayer[m.id] ?? '') || 0) }))
        .filter((p) => p.cents > 0);
      const sum = payers.reduce((s, p) => s + p.cents, 0);
      if (sum !== totalCents) {
        return setError(`Payers add up to $${formatAmount(sum)}, but the total is $${formatAmount(totalCents)}.`);
      }
    }

    // Allocations across involved members
    const participants: SplitParticipantInput[] = involvedMembers.map((m) => {
      if (splitType === 'equal') return { userId: m.id };
      const raw = Number(values[m.id] ?? '');
      const val = Number.isFinite(raw) ? raw : 0;
      if (splitType === 'exact' || splitType === 'adjustment') return { userId: m.id, value: toCents(val) };
      return { userId: m.id, value: val };
    });

    try {
      const allocations = computeSplit(totalCents, splitType, participants).map((a) => ({
        userId: a.userId,
        cents: a.cents,
      }));
      onSubmit({
        groupId: group.id,
        description: description.trim(),
        category,
        dateISO,
        notes: notes.trim() || undefined,
        payers,
        involvedIds: involvedMembers.map((m) => m.id),
        totalCents,
        splitType,
        allocations,
        sourceDocumentId,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  const needsValues = splitType !== 'equal';
  const valueHint = splitType === 'percentage' ? '%' : splitType === 'share' ? 'shares' : '$';

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={{ paddingBottom: 8 }}>
      {prefillReceipt && !initial && (
        <View style={styles.fromReceipt}>
          <Text style={styles.fromReceiptText}>
            📎 Splitting from receipt: {prefillReceipt.vendor}
            {prefillReceipt.totalCents != null ? ` · $${formatAmount(prefillReceipt.totalCents)}` : ''}
          </Text>
        </View>
      )}

      {receiptDocs.length > 0 && !initial && !prefillReceipt && (
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

      <View style={styles.rowTwo}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Amount ($)</Text>
          <TextInput style={styles.input} value={total} onChangeText={setTotal} placeholder="0.00" keyboardType="decimal-pad" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Date</Text>
          <TextInput style={styles.input} value={dateISO} onChangeText={setDateISO} placeholder="2026-07-10" />
        </View>
      </View>

      <Text style={styles.label}>Category</Text>
      <View style={styles.chips}>
        {EXPENSE_CATEGORIES.map((c) => (
          <Pressable key={c.key} style={[styles.chip, category === c.key && styles.chipActive]} onPress={() => setCategory(c.key)}>
            <Text style={[styles.chipText, category === c.key && styles.chipTextActive]}>
              {c.icon} {c.key}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Involved ({involved.size})</Text>
      <View style={styles.chips}>
        {group.members.map((m) => {
          const on = involved.has(m.id);
          return (
            <Pressable key={m.id} style={[styles.chip, on && styles.chipActive]} onPress={() => toggleInvolved(m.id)}>
              <Text style={[styles.chipText, on && styles.chipTextActive]}>
                {on ? '✓ ' : ''}
                {m.name}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.payerHead}>
        <Text style={styles.label}>Paid by</Text>
        <Pressable onPress={() => setPayersMode((p) => (p === 'single' ? 'multiple' : 'single'))}>
          <Text style={styles.toggle}>{payersMode === 'single' ? 'Multiple payers' : 'Single payer'}</Text>
        </Pressable>
      </View>
      {payersMode === 'single' ? (
        <View style={styles.chips}>
          {group.members.map((m) => (
            <Pressable key={m.id} style={[styles.chip, payerId === m.id && styles.chipActive]} onPress={() => setPayerId(m.id)}>
              <Text style={[styles.chipText, payerId === m.id && styles.chipTextActive]}>{m.name}</Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <View style={styles.valueGrid}>
          {group.members.map((m) => (
            <View key={m.id} style={styles.valueRow}>
              <Text style={styles.valueName}>{m.name}</Text>
              <TextInput
                style={styles.valueInput}
                value={perPayer[m.id] ?? ''}
                onChangeText={(v) => setPerPayer((prev) => ({ ...prev, [m.id]: v }))}
                placeholder="$ paid"
                keyboardType="decimal-pad"
              />
            </View>
          ))}
        </View>
      )}

      <Text style={styles.label}>Split</Text>
      <View style={styles.chips}>
        {SPLIT_TYPES.map((s) => (
          <Pressable key={s.key} style={[styles.chip, splitType === s.key && styles.chipActive]} onPress={() => setSplitType(s.key)}>
            <Text style={[styles.chipText, splitType === s.key && styles.chipTextActive]}>{s.label}</Text>
          </Pressable>
        ))}
      </View>
      {needsValues && (
        <View style={styles.valueGrid}>
          {group.members
            .filter((m) => involved.has(m.id))
            .map((m) => (
              <View key={m.id} style={styles.valueRow}>
                <Text style={styles.valueName}>{m.name}</Text>
                <TextInput
                  style={styles.valueInput}
                  value={values[m.id] ?? ''}
                  onChangeText={(v) => setValues((prev) => ({ ...prev, [m.id]: v }))}
                  placeholder={valueHint}
                  keyboardType="decimal-pad"
                />
              </View>
            ))}
        </View>
      )}

      <Text style={styles.label}>Notes (optional)</Text>
      <TextInput style={styles.input} value={notes} onChangeText={setNotes} placeholder="Add a note" />

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable style={styles.primary} onPress={submit}>
        <Text style={styles.primaryText}>{initial ? 'Save changes' : 'Add expense'}</Text>
      </Pressable>
      <Pressable onPress={onCancel}>
        <Text style={styles.cancel}>Cancel</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.border, borderRadius: 16, padding: 14, marginBottom: 12 },
  fromReceipt: { backgroundColor: '#eef6ff', borderRadius: 8, padding: 10, marginBottom: 4 },
  fromReceiptText: { color: '#1e40af', fontSize: 13, fontWeight: '600' },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.subtext, marginTop: 10, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 9, fontSize: 15, color: COLORS.text, backgroundColor: '#fff' },
  rowTwo: { flexDirection: 'row', gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, backgroundColor: '#e6eaf0' },
  chipActive: { backgroundColor: COLORS.primary },
  chipText: { fontSize: 12, color: COLORS.text, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  payerHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  toggle: { color: COLORS.primary, fontWeight: '700', fontSize: 12, marginBottom: 6 },
  valueGrid: { gap: 6, marginTop: 4 },
  valueRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  valueName: { fontSize: 14, color: COLORS.text },
  valueInput: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, fontSize: 14, width: 120, backgroundColor: '#fff' },
  error: { color: COLORS.danger, fontWeight: '600', marginTop: 10 },
  primary: { backgroundColor: COLORS.primary, borderRadius: 10, paddingVertical: 13, alignItems: 'center', marginTop: 14 },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  cancel: { color: COLORS.subtext, textAlign: 'center', marginTop: 12, fontSize: 15 },
});
