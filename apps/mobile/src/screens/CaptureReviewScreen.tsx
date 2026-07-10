import React, { useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useDatabase } from '@nozbe/watermelondb/react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import type { DocumentCategory } from '../domain/ocr/fieldparser';
import { fromCents, toCents } from '../domain/money';
import { CURRENT_USER_ID } from '../config';
import { DocumentRepository } from '../repositories/DocumentRepository';

type Props = NativeStackScreenProps<RootStackParamList, 'CaptureReview'>;

const CATEGORIES: { key: DocumentCategory; label: string }[] = [
  { key: 'bills_receipts', label: 'Bill / Receipt' },
  { key: 'warranty', label: 'Warranty' },
  { key: 'loyalty', label: 'Loyalty' },
  { key: 'other', label: 'Other' },
];

function centsToInput(cents: number | null | undefined): string {
  return cents == null ? '' : fromCents(cents).toFixed(2);
}

export default function CaptureReviewScreen({ route, navigation }: Props) {
  const database = useDatabase();
  const repo = useMemo(() => new DocumentRepository(database), [database]);
  const { ocr, pageImageUris, phashPerPage } = route.params;

  // Auto-categorization result is the starting point; the user can override it
  // and edit every field (Feature 1).
  const [category, setCategory] = useState<DocumentCategory>(ocr.category);
  const [vendor, setVendor] = useState(ocr.receipt?.vendor ?? '');
  const [total, setTotal] = useState(centsToInput(ocr.receipt?.totalCents));
  const [tax, setTax] = useState(centsToInput(ocr.receipt?.taxCents));
  const [date, setDate] = useState(ocr.receipt?.dateISO ?? ocr.dateISO ?? '');
  const [saving, setSaving] = useState(false);

  const isReceipt = category === 'bills_receipts';

  async function save() {
    if (saving) {
      return;
    }

    let receipt;
    if (isReceipt) {
      const totalNum = Number(total);
      if (!vendor.trim()) {
        Alert.alert('Missing vendor', 'Enter who this receipt is from.');
        return;
      }
      if (!Number.isFinite(totalNum) || totalNum <= 0) {
        Alert.alert('Invalid total', 'Enter a valid total amount.');
        return;
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        Alert.alert('Invalid date', 'Use the format YYYY-MM-DD.');
        return;
      }
      const taxNum = Number(tax);
      receipt = {
        vendor: vendor.trim(),
        totalCents: toCents(totalNum),
        taxCents: tax.trim() === '' || !Number.isFinite(taxNum) ? null : toCents(taxNum),
        currency: ocr.receipt?.currency ?? 'USD',
        purchaseDateISO: date,
      };
    }

    const input = {
      ownerId: CURRENT_USER_ID,
      category,
      pageImageUris,
      phashPerPage,
      ocr,
      receipt,
    };

    setSaving(true);
    try {
      const warnings = await repo.findDuplicateWarnings(input);
      if (warnings.length > 0) {
        const proceed = await confirmDuplicate(warnings[0]!.kind);
        if (!proceed) {
          setSaving(false);
          return;
        }
      }
      await repo.createFromCapture(input);
      navigation.navigate('Documents');
    } catch (error) {
      Alert.alert('Could not save', error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.label}>Category</Text>
      <View style={styles.categoryRow}>
        {CATEGORIES.map((c) => (
          <Pressable
            key={c.key}
            style={[styles.chip, category === c.key && styles.chipActive]}
            onPress={() => setCategory(c.key)}
          >
            <Text style={[styles.chipText, category === c.key && styles.chipTextActive]}>
              {c.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {isReceipt ? (
        <>
          <Field label="Vendor (from)" value={vendor} onChangeText={setVendor} placeholder="e.g. Trader Joe's" />
          <Field label="Total" value={total} onChangeText={setTotal} keyboardType="decimal-pad" placeholder="0.00" />
          <Field label="Tax (optional)" value={tax} onChangeText={setTax} keyboardType="decimal-pad" placeholder="0.00" />
          <Field label="Date (YYYY-MM-DD)" value={date} onChangeText={setDate} placeholder="2026-07-10" autoCapitalize="none" />
        </>
      ) : (
        <Text style={styles.note}>
          Detailed fields for this category are added in Phase 2 (Warranty / Loyalty tracking).
          Saving keeps the scan and its link to the original image.
        </Text>
      )}

      <Pressable style={[styles.saveButton, saving && styles.saveButtonDisabled]} onPress={save} disabled={saving}>
        <Text style={styles.saveButtonText}>{saving ? 'Saving…' : 'Save'}</Text>
      </Pressable>
    </ScrollView>
  );
}

function confirmDuplicate(kind: 'rescan' | 'same_purchase'): Promise<boolean> {
  const message =
    kind === 'rescan'
      ? 'This looks like a document you already scanned.'
      : 'This looks like a purchase you already logged.';
  return new Promise((resolve) => {
    Alert.alert('Possible duplicate', message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Save anyway', onPress: () => resolve(true) },
    ]);
  });
}

function Field(props: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  keyboardType?: 'decimal-pad' | 'default';
  autoCapitalize?: 'none' | 'sentences';
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{props.label}</Text>
      <TextInput
        style={styles.input}
        value={props.value}
        onChangeText={props.onChangeText}
        placeholder={props.placeholder}
        keyboardType={props.keyboardType ?? 'default'}
        autoCapitalize={props.autoCapitalize ?? 'sentences'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 6 },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#eef1f5' },
  chipActive: { backgroundColor: '#1f6feb' },
  chipText: { color: '#1f2937', fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  field: { marginBottom: 14 },
  input: { borderWidth: 1, borderColor: '#d0d7de', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, color: '#111' },
  note: { color: '#666', fontSize: 14, lineHeight: 20, marginBottom: 16 },
  saveButton: { backgroundColor: '#1f6feb', borderRadius: 10, paddingVertical: 15, alignItems: 'center', marginTop: 8 },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
