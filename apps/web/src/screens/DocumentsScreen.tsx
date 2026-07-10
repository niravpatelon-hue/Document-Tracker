import React, { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { extractReceiptFields, guessCategory } from '@domain/ocr/fieldparser';
import { formatAmount } from '@domain/money';
import { CATEGORY_LABEL, COLORS } from '../theme';
import type { WebDocument } from '../store';
import { SAMPLE_RECEIPT_TEXT } from '../seed';
import type { ReviewPrefill } from '../App';

interface Props {
  documents: WebDocument[];
  onReview: (prefill: ReviewPrefill) => void;
  onOpenLedger: () => void;
  onOpenSplit: () => void;
}

/** A real <input type=file> rendered inside the react-native-web tree. */
function FileInput({ onPick }: { onPick: (dataUrl: string) => void }) {
  return React.createElement('input', {
    type: 'file',
    accept: 'image/*',
    style: { fontSize: 13, marginTop: 8 },
    onChange: (e: { target: { files: FileList | null } }) => {
      const file = e.target.files?.[0];
      if (!file) {
        return;
      }
      const reader = new FileReader();
      reader.onload = () => onPick(String(reader.result));
      reader.readAsDataURL(file);
    },
  });
}

export default function DocumentsScreen({ documents, onReview, onOpenLedger, onOpenSplit }: Props) {
  const [scanning, setScanning] = useState(false);
  const [text, setText] = useState('');
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);

  function continueToReview() {
    const category = text.trim() ? guessCategory(text) : 'bills_receipts';
    const fields = extractReceiptFields(text);
    onReview({
      category,
      vendor: fields.vendor ?? '',
      totalCents: fields.totalCents,
      taxCents: fields.taxCents,
      dateISO: fields.dateISO ?? '',
      imageDataUrl,
      rawText: text,
      ocrMode: 'on_device',
    });
    setScanning(false);
    setText('');
    setImageDataUrl(null);
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.banner}>
          <Text style={styles.bannerText}>
            On a phone this opens the ML Kit document scanner. In this web preview, paste receipt
            text (or use the sample) and the real on-device field parser extracts the fields.
          </Text>
        </View>

        {scanning ? (
          <View style={styles.panel}>
            <Text style={styles.label}>Receipt text</Text>
            <TextInput
              style={styles.textarea}
              multiline
              numberOfLines={6}
              value={text}
              onChangeText={setText}
              placeholder="Paste OCR / receipt text here…"
            />
            <Pressable onPress={() => setText(SAMPLE_RECEIPT_TEXT)}>
              <Text style={styles.link}>Use a sample receipt</Text>
            </Pressable>
            <Text style={styles.label}>Optional: attach the original image</Text>
            <FileInput onPick={setImageDataUrl} />
            {imageDataUrl ? <Image source={{ uri: imageDataUrl }} style={styles.preview} /> : null}
            <Pressable style={styles.primary} onPress={continueToReview}>
              <Text style={styles.primaryText}>Continue to review</Text>
            </Pressable>
            <Pressable onPress={() => setScanning(false)}>
              <Text style={[styles.link, styles.center]}>Cancel</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable style={styles.primary} onPress={() => setScanning(true)}>
            <Text style={styles.primaryText}>+ Scan a receipt</Text>
          </Pressable>
        )}

        <Text style={styles.sectionTitle}>Your documents</Text>
        {documents.length === 0 ? (
          <Text style={styles.empty}>No documents yet.</Text>
        ) : (
          documents.map((doc) => (
            <View key={doc.id} style={styles.row}>
              <View style={styles.rowLeft}>
                <Text style={styles.rowTitle}>{doc.vendor ?? CATEGORY_LABEL[doc.category]}</Text>
                <Text style={styles.rowSub}>
                  {CATEGORY_LABEL[doc.category]}
                  {doc.dateISO ? ` · ${doc.dateISO}` : ''} ·{' '}
                  {doc.ocrMode === 'cloud' ? 'Cloud OCR' : doc.ocrMode === 'manual' ? 'Manual' : 'On-device OCR'}
                </Text>
              </View>
              {doc.totalCents != null ? (
                <Text style={styles.rowAmount}>${formatAmount(doc.totalCents)}</Text>
              ) : null}
            </View>
          ))
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable style={styles.secondary} onPress={onOpenLedger}>
          <Text style={styles.secondaryText}>Spending</Text>
        </Pressable>
        <Pressable style={styles.secondary} onPress={onOpenSplit}>
          <Text style={styles.secondaryText}>Split demo</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { padding: 16, paddingBottom: 8 },
  banner: { backgroundColor: COLORS.warnBg, borderRadius: 10, padding: 12, marginBottom: 14 },
  bannerText: { color: COLORS.warnText, fontSize: 13, lineHeight: 18 },
  panel: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, padding: 12, marginBottom: 8 },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.subtext, marginTop: 8, marginBottom: 4 },
  textarea: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 10,
    minHeight: 110,
    textAlignVertical: 'top',
    fontSize: 14,
    color: COLORS.text,
  },
  preview: { width: '100%', height: 160, borderRadius: 8, marginTop: 8, resizeMode: 'cover' },
  link: { color: COLORS.primary, fontWeight: '600', marginTop: 8, fontSize: 14 },
  center: { textAlign: 'center' },
  primary: { backgroundColor: COLORS.primary, borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 10 },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: COLORS.subtext, marginTop: 20, marginBottom: 8, textTransform: 'uppercase' },
  empty: { color: COLORS.subtext },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  rowLeft: { flex: 1, paddingRight: 8 },
  rowTitle: { fontSize: 16, fontWeight: '600', color: COLORS.text },
  rowSub: { fontSize: 12, color: COLORS.subtext, marginTop: 2 },
  rowAmount: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  footer: {
    flexDirection: 'row',
    gap: 12,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  secondary: { flex: 1, backgroundColor: COLORS.chip, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  secondaryText: { color: COLORS.text, fontWeight: '600', fontSize: 15 },
});
