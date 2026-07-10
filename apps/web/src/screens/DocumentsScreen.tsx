import React, { useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  detectImei,
  detectSerial,
  extractLabeledValue,
  extractReceiptFields,
  findFirstDate,
  guessCategory,
} from '@domain/ocr/fieldparser';
import { formatAmount } from '@domain/money';
import { CATEGORY_LABEL, COLORS } from '../theme';
import type { WebDocument } from '../store';
import { SAMPLE_RECEIPT_TEXT } from '../seed';
import { ocrImage } from '../ocr';
import type { ReviewPrefill } from '../App';

interface Props {
  documents: WebDocument[];
  onReview: (prefill: ReviewPrefill) => void;
  onOpenLedger: () => void;
  onOpenSplit: () => void;
}

/** Build the Review pre-fill by running the real domain categorizer + parsers on OCR text. */
function buildPrefill(
  text: string,
  imageDataUrl: string | null,
  ocrMode: ReviewPrefill['ocrMode'],
): ReviewPrefill {
  const category = text.trim() ? guessCategory(text) : 'other';
  const receipt = extractReceiptFields(text);
  return {
    category,
    vendor: receipt.vendor ?? '',
    totalCents: receipt.totalCents,
    taxCents: receipt.taxCents,
    dateISO: receipt.dateISO ?? findFirstDate(text) ?? '',
    imei: detectImei(text),
    serial: detectSerial(text),
    productName: extractLabeledValue(text, ['product', 'model', 'item', 'device']),
    retailer: extractLabeledValue(text, ['retailer', 'store', 'seller', 'sold by', 'purchased at']),
    imageDataUrl,
    rawText: text,
    ocrMode,
  };
}

/** A real <input type=file> rendered inside the react-native-web tree. */
function FileInput({ onPick, disabled }: { onPick: (dataUrl: string) => void; disabled?: boolean }) {
  return React.createElement('input', {
    type: 'file',
    accept: 'image/*',
    disabled,
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
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [pct, setPct] = useState(0);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setScanning(false);
    setText('');
    setBusy(false);
    setStatus('');
    setPct(0);
    setError(null);
  }

  async function onPickImage(dataUrl: string) {
    setError(null);
    setBusy(true);
    setStatus('starting');
    setPct(0);
    try {
      const recognized = await ocrImage(dataUrl, (s, p) => {
        setStatus(s);
        setPct(Math.round(p * 100));
      });
      onReview(buildPrefill(recognized, dataUrl, 'on_device'));
      reset();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  function proceedWithText(source: string) {
    onReview(buildPrefill(source, null, 'on_device'));
    reset();
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.banner}>
          <Text style={styles.bannerText}>
            Upload a photo of a receipt, warranty card, or loyalty card — it's read on-device, then
            auto-categorized and the fields are filled in for you to confirm. (On a phone this is the
            ML Kit scanner; here it's Tesseract OCR in the browser.)
          </Text>
        </View>

        {scanning ? (
          <View style={styles.panel}>
            {busy ? (
              <View style={styles.busy}>
                <ActivityIndicator color={COLORS.primary} />
                <Text style={styles.busyText}>
                  Reading document… {pct}%{status ? ` (${status})` : ''}
                </Text>
                <Text style={styles.busyHint}>First run loads the OCR model (~once).</Text>
              </View>
            ) : (
              <>
                <Text style={styles.label}>Upload a photo / image of the document</Text>
                <FileInput onPick={onPickImage} disabled={busy} />

                <Text style={styles.or}>— or paste the text —</Text>
                <TextInput
                  style={styles.textarea}
                  multiline
                  numberOfLines={5}
                  value={text}
                  onChangeText={setText}
                  placeholder="Paste receipt / card text here…"
                />
                <Pressable onPress={() => setText(SAMPLE_RECEIPT_TEXT)}>
                  <Text style={styles.link}>Use a sample receipt</Text>
                </Pressable>
                {error ? <Text style={styles.error}>{error}</Text> : null}
                <Pressable
                  style={[styles.primary, !text.trim() && styles.primaryDisabled]}
                  onPress={() => text.trim() && proceedWithText(text)}
                >
                  <Text style={styles.primaryText}>Continue with text</Text>
                </Pressable>
                <Pressable onPress={reset}>
                  <Text style={[styles.link, styles.center]}>Cancel</Text>
                </Pressable>
              </>
            )}
          </View>
        ) : (
          <Pressable style={styles.primary} onPress={() => setScanning(true)}>
            <Text style={styles.primaryText}>+ Scan a document</Text>
          </Pressable>
        )}

        <Text style={styles.sectionTitle}>Your documents</Text>
        {documents.length === 0 ? (
          <Text style={styles.empty}>No documents yet.</Text>
        ) : (
          documents.map((doc) => (
            <View key={doc.id} style={styles.row}>
              <View style={styles.rowLeft}>
                <Text style={styles.rowTitle}>
                  {doc.vendor ?? doc.label ?? CATEGORY_LABEL[doc.category]}
                </Text>
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
  busy: { alignItems: 'center', paddingVertical: 18, gap: 8 },
  busyText: { color: COLORS.text, fontWeight: '600' },
  busyHint: { color: COLORS.subtext, fontSize: 12 },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.subtext, marginBottom: 4 },
  or: { color: COLORS.subtext, fontSize: 12, textAlign: 'center', marginVertical: 12 },
  textarea: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 10,
    minHeight: 96,
    textAlignVertical: 'top',
    fontSize: 14,
    color: COLORS.text,
  },
  link: { color: COLORS.primary, fontWeight: '600', marginTop: 8, fontSize: 14 },
  center: { textAlign: 'center' },
  error: { color: COLORS.danger, marginTop: 8, fontWeight: '600' },
  primary: { backgroundColor: COLORS.primary, borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 10 },
  primaryDisabled: { opacity: 0.5 },
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
  footer: { flexDirection: 'row', gap: 12, padding: 12, borderTopWidth: 1, borderTopColor: COLORS.border },
  secondary: { flex: 1, backgroundColor: COLORS.chip, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  secondaryText: { color: COLORS.text, fontWeight: '600', fontSize: 15 },
});
