import React, { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { DocumentCategory } from '@domain/ocr/fieldparser';
import { fromCents, toCents } from '@domain/money';
import { COLORS } from '../theme';
import type { CreateDocInput } from '../store';
import type { ReviewPrefill } from '../App';

interface Props {
  prefill: ReviewPrefill;
  onSave: (input: CreateDocInput) => void;
  onCancel: () => void;
}

const CATEGORIES: { key: DocumentCategory; label: string }[] = [
  { key: 'bills_receipts', label: 'Bill / Receipt' },
  { key: 'warranty', label: 'Warranty' },
  { key: 'loyalty', label: 'Loyalty' },
  { key: 'other', label: 'Other' },
];

function centsToInput(cents: number | null): string {
  return cents == null ? '' : fromCents(cents).toFixed(2);
}

export default function ReviewScreen({ prefill, onSave, onCancel }: Props) {
  const [category, setCategory] = useState<DocumentCategory>(prefill.category);
  const [vendor, setVendor] = useState(prefill.vendor);
  const [total, setTotal] = useState(centsToInput(prefill.totalCents));
  const [tax, setTax] = useState(centsToInput(prefill.taxCents));
  const [date, setDate] = useState(prefill.dateISO);
  const [error, setError] = useState<string | null>(null);

  const isReceipt = category === 'bills_receipts';

  function save() {
    setError(null);
    let totalCents: number | null = null;
    let taxCents: number | null = null;

    if (isReceipt) {
      const totalNum = Number(total);
      if (!vendor.trim()) {
        setError('Enter who this receipt is from.');
        return;
      }
      if (!Number.isFinite(totalNum) || totalNum <= 0) {
        setError('Enter a valid total amount.');
        return;
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        setError('Use the date format YYYY-MM-DD.');
        return;
      }
      totalCents = toCents(totalNum);
      const taxNum = Number(tax);
      taxCents = tax.trim() === '' || !Number.isFinite(taxNum) ? null : toCents(taxNum);
    }

    onSave({
      category,
      vendor: vendor.trim() || null,
      totalCents,
      taxCents,
      currency: 'USD',
      dateISO: isReceipt ? date : null,
      imageDataUrl: prefill.imageDataUrl,
      ocrMode: prefill.ocrMode,
      rawText: prefill.rawText,
    });
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      {prefill.imageDataUrl ? (
        <Image source={{ uri: prefill.imageDataUrl }} style={styles.image} />
      ) : null}

      <Text style={styles.label}>Category</Text>
      <View style={styles.chips}>
        {CATEGORIES.map((c) => {
          const active = category === c.key;
          return (
            <Pressable
              key={c.key}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setCategory(c.key)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{c.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {isReceipt ? (
        <>
          <LabeledInput label="Vendor (from)" value={vendor} onChangeText={setVendor} placeholder="e.g. Blue Bottle Coffee" />
          <LabeledInput label="Total ($)" value={total} onChangeText={setTotal} placeholder="0.00" />
          <LabeledInput label="Tax ($, optional)" value={tax} onChangeText={setTax} placeholder="0.00" />
          <LabeledInput label="Date (YYYY-MM-DD)" value={date} onChangeText={setDate} placeholder="2026-07-09" />
        </>
      ) : (
        <Text style={styles.note}>
          Detailed fields for this category are Phase 2 (Warranty / Loyalty tracking). Saving keeps
          the scan and its link back to the original image.
        </Text>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable style={styles.primary} onPress={save}>
        <Text style={styles.primaryText}>Save</Text>
      </Pressable>
      <Pressable onPress={onCancel}>
        <Text style={styles.cancel}>Cancel</Text>
      </Pressable>
    </ScrollView>
  );
}

function LabeledInput(props: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{props.label}</Text>
      <TextInput
        style={styles.input}
        value={props.value}
        onChangeText={props.onChangeText}
        placeholder={props.placeholder}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { padding: 16 },
  image: { width: '100%', height: 160, borderRadius: 10, marginBottom: 14, resizeMode: 'cover' },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.subtext, marginBottom: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: COLORS.chip },
  chipActive: { backgroundColor: COLORS.primary },
  chipText: { color: COLORS.text, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  field: { marginBottom: 14 },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, color: COLORS.text },
  note: { color: COLORS.subtext, fontSize: 14, lineHeight: 20, marginBottom: 16 },
  error: { color: COLORS.danger, marginBottom: 12, fontWeight: '600' },
  primary: { backgroundColor: COLORS.primary, borderRadius: 10, paddingVertical: 15, alignItems: 'center', marginTop: 6 },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  cancel: { color: COLORS.subtext, textAlign: 'center', marginTop: 14, fontSize: 15 },
});
