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

const PROGRAM_TYPES = ['airline', 'hotel', 'retail', 'credit_card_rewards', 'gift_card'];

function centsToInput(cents: number | null): string {
  return cents == null ? '' : fromCents(cents).toFixed(2);
}

export default function ReviewScreen({ prefill, onSave, onCancel }: Props) {
  const [category, setCategory] = useState<DocumentCategory>(prefill.category);

  // Shared / receipt.
  const [vendor, setVendor] = useState(prefill.vendor);
  const [total, setTotal] = useState(centsToInput(prefill.totalCents));
  const [tax, setTax] = useState(centsToInput(prefill.taxCents));
  const [receiptDate, setReceiptDate] = useState(prefill.dateISO);

  // Warranty. (Retailer is kept separate from the receipt "vendor" guess so a
  // warranty card's title line can't leak into it; price is NOT prefilled from
  // the receipt amount heuristic, which would otherwise grab an IMEI/serial.)
  const [productName, setProductName] = useState(prefill.productName ?? '');
  const [retailer, setRetailer] = useState(prefill.retailer ?? '');
  const [purchaseDate, setPurchaseDate] = useState(prefill.dateISO);
  const [identifier, setIdentifier] = useState(prefill.imei ?? prefill.serial ?? '');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [warrantyMonths, setWarrantyMonths] = useState('12');

  // Loyalty.
  const [programType, setProgramType] = useState('retail');
  const [balance, setBalance] = useState('');
  const [expiryDate, setExpiryDate] = useState('');

  const [error, setError] = useState<string | null>(null);

  const identifierType = prefill.imei ? 'imei' : prefill.serial ? 'serial_number' : 'serial_number';

  function fail(msg: string) {
    setError(msg);
  }

  function save() {
    setError(null);
    const base = {
      vendor: vendor.trim() || null,
      currency: 'USD',
      imageDataUrl: prefill.imageDataUrl,
      ocrMode: prefill.ocrMode,
      rawText: prefill.rawText,
    };

    if (category === 'bills_receipts') {
      const totalNum = Number(total);
      if (!vendor.trim()) return fail('Enter who this receipt is from.');
      if (!Number.isFinite(totalNum) || totalNum <= 0) return fail('Enter a valid total amount.');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(receiptDate)) return fail('Use the date format YYYY-MM-DD.');
      const taxNum = Number(tax);
      onSave({
        ...base,
        category,
        totalCents: toCents(totalNum),
        taxCents: tax.trim() === '' || !Number.isFinite(taxNum) ? null : toCents(taxNum),
        dateISO: receiptDate,
      });
      return;
    }

    if (category === 'warranty') {
      if (!productName.trim() && !retailer.trim()) return fail('Enter a product name or retailer.');
      const priceNum = Number(purchasePrice);
      const months = Number(warrantyMonths);
      onSave({
        ...base,
        vendor: retailer.trim() || null,
        category,
        totalCents: null,
        taxCents: null,
        dateISO: null,
        label: productName.trim() || retailer.trim() || 'Warranty',
        details: {
          productName: productName.trim() || null,
          purchaseDate: purchaseDate || null,
          identifier: identifier.trim() || null,
          identifierType: identifier.trim() ? identifierType : null,
          purchasePriceCents: Number.isFinite(priceNum) && purchasePrice.trim() ? toCents(priceNum) : null,
          warrantyMonths: Number.isFinite(months) ? months : null,
        },
      });
      return;
    }

    if (category === 'loyalty') {
      if (!vendor.trim()) return fail('Enter the issuer / brand.');
      const bal = Number(balance);
      onSave({
        ...base,
        category,
        totalCents: null,
        taxCents: null,
        dateISO: null,
        label: vendor.trim(),
        details: {
          programType,
          balanceValue: balance.trim() && Number.isFinite(bal) ? bal : null,
          expiryDate: expiryDate || null,
        },
      });
      return;
    }

    // other
    onSave({
      ...base,
      category,
      totalCents: null,
      taxCents: null,
      dateISO: null,
      label: vendor.trim() || null,
    });
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      {prefill.imageDataUrl ? (
        <Image source={{ uri: prefill.imageDataUrl }} style={styles.image} />
      ) : null}

      <View style={styles.autofillNote}>
        <Text style={styles.autofillText}>
          Auto-categorized as <Text style={styles.bold}>{CATEGORIES.find((c) => c.key === prefill.category)?.label}</Text> and pre-filled from the scan. Fix anything below.
        </Text>
      </View>

      <Text style={styles.label}>Category</Text>
      <View style={styles.chips}>
        {CATEGORIES.map((c) => {
          const active = category === c.key;
          return (
            <Pressable key={c.key} style={[styles.chip, active && styles.chipActive]} onPress={() => setCategory(c.key)}>
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{c.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {category === 'bills_receipts' && (
        <>
          <Field label="Vendor (from)" value={vendor} onChangeText={setVendor} placeholder="e.g. Blue Bottle Coffee" />
          <Field label="Total ($)" value={total} onChangeText={setTotal} placeholder="0.00" />
          <Field label="Tax ($, optional)" value={tax} onChangeText={setTax} placeholder="0.00" />
          <Field label="Date (YYYY-MM-DD)" value={receiptDate} onChangeText={setReceiptDate} placeholder="2026-07-09" />
        </>
      )}

      {category === 'warranty' && (
        <>
          <Field label="Product / item" value={productName} onChangeText={setProductName} placeholder="e.g. iPhone 15" />
          <Field label="Retailer / brand" value={retailer} onChangeText={setRetailer} placeholder="e.g. Best Buy" />
          <Field label="Purchase date (YYYY-MM-DD)" value={purchaseDate} onChangeText={setPurchaseDate} placeholder="2026-07-09" />
          <Field
            label={`Serial / IMEI${prefill.imei ? ' (IMEI detected)' : prefill.serial ? ' (serial detected)' : ''}`}
            value={identifier}
            onChangeText={setIdentifier}
            placeholder="serial number or IMEI"
          />
          <Field label="Purchase price ($)" value={purchasePrice} onChangeText={setPurchasePrice} placeholder="0.00" />
          <Field label="Warranty length (months)" value={warrantyMonths} onChangeText={setWarrantyMonths} placeholder="12" />
        </>
      )}

      {category === 'loyalty' && (
        <>
          <Field label="Issuer / brand" value={vendor} onChangeText={setVendor} placeholder="e.g. Delta SkyMiles" />
          <Text style={styles.label}>Program type</Text>
          <View style={styles.chips}>
            {PROGRAM_TYPES.map((t) => {
              const active = programType === t;
              return (
                <Pressable key={t} style={[styles.chipSm, active && styles.chipActive]} onPress={() => setProgramType(t)}>
                  <Text style={[styles.chipTextSm, active && styles.chipTextActive]}>{t.replace(/_/g, ' ')}</Text>
                </Pressable>
              );
            })}
          </View>
          <Field label="Balance / points" value={balance} onChangeText={setBalance} placeholder="e.g. 12400" />
          <Field label="Expiry date (YYYY-MM-DD, optional)" value={expiryDate} onChangeText={setExpiryDate} placeholder="2027-01-01" />
        </>
      )}

      {category === 'other' && (
        <Field label="Name / note" value={vendor} onChangeText={setVendor} placeholder="What is this?" />
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

function Field(props: { label: string; value: string; onChangeText: (t: string) => void; placeholder?: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{props.label}</Text>
      <TextInput style={styles.input} value={props.value} onChangeText={props.onChangeText} placeholder={props.placeholder} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { padding: 16 },
  image: { width: '100%', height: 150, borderRadius: 10, marginBottom: 12, resizeMode: 'cover' },
  autofillNote: { backgroundColor: '#eef6ff', borderRadius: 8, padding: 10, marginBottom: 14 },
  autofillText: { color: '#1e40af', fontSize: 13, lineHeight: 18 },
  bold: { fontWeight: '800' },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.subtext, marginBottom: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: COLORS.chip },
  chipSm: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, backgroundColor: COLORS.chip },
  chipActive: { backgroundColor: COLORS.primary },
  chipText: { color: COLORS.text, fontWeight: '600' },
  chipTextSm: { color: COLORS.text, fontWeight: '600', fontSize: 12 },
  chipTextActive: { color: '#fff' },
  field: { marginBottom: 14 },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, color: COLORS.text },
  error: { color: COLORS.danger, marginBottom: 12, fontWeight: '600' },
  primary: { backgroundColor: COLORS.primary, borderRadius: 10, paddingVertical: 15, alignItems: 'center', marginTop: 6 },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  cancel: { color: COLORS.subtext, textAlign: 'center', marginTop: 14, fontSize: 15 },
});
