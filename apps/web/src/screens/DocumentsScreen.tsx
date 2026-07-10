import React, { useEffect, useState } from 'react';
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
import { Card, Icon, IconChip, SectionLabel, categoryVisual } from '../components/ui';
import type { WebDocument, WebGroup } from '../store';
import { SAMPLE_RECEIPT_TEXT } from '../seed';
import { extractTextFromFile } from '../extract';
import type { ReviewPrefill } from '../App';

interface Props {
  documents: WebDocument[];
  groups: WebGroup[];
  autoOpenScan?: boolean;
  onReview: (prefill: ReviewPrefill) => void;
  onOpenGroups: () => void;
  onSplitToGroup: (groupId: string, docId: string) => void;
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
function FileInput({ onPick, disabled }: { onPick: (file: File) => void; disabled?: boolean }) {
  return React.createElement('input', {
    type: 'file',
    accept: 'image/*,application/pdf,.pdf,.docx',
    disabled,
    style: { fontSize: 13, marginTop: 8 },
    onChange: (e: { target: { files: FileList | null } }) => {
      const file = e.target.files?.[0];
      if (file) {
        onPick(file);
      }
    },
  });
}

export default function DocumentsScreen({
  documents,
  groups,
  autoOpenScan,
  onReview,
  onOpenGroups,
  onSplitToGroup,
}: Props) {
  const [scanning, setScanning] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [pct, setPct] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [splitDoc, setSplitDoc] = useState<WebDocument | null>(null);

  // Opened via the tab-bar scan button.
  useEffect(() => {
    if (autoOpenScan) {
      setScanning(true);
    }
  }, [autoOpenScan]);

  function reset() {
    setScanning(false);
    setText('');
    setBusy(false);
    setStatus('');
    setPct(0);
    setError(null);
  }

  async function onPickFile(file: File) {
    setError(null);
    setBusy(true);
    setStatus('starting');
    setPct(0);
    try {
      const { text, imageDataUrl } = await extractTextFromFile(file, (s, p) => {
        setStatus(s);
        setPct(Math.round(p * 100));
      });
      onReview(buildPrefill(text, imageDataUrl, 'on_device'));
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
            Upload a photo, PDF, or Word (.docx) of a receipt, warranty card, or loyalty card — it's
            read, auto-categorized, and the fields are filled in for you to confirm. PDFs and Word
            docs with real text extract exactly; photos use in-browser OCR, so a clear, straight,
            well-lit image works best (you can always paste the text instead).
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
                <Text style={styles.label}>Upload a photo, PDF, or Word (.docx) document</Text>
                <FileInput onPick={onPickFile} disabled={busy} />

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
            <Icon name="camera" color="#fff" size={19} />
            <Text style={styles.primaryText}>Scan a document</Text>
          </Pressable>
        )}

        <SectionLabel>Your documents</SectionLabel>
        {documents.length === 0 ? (
          <Card><Text style={styles.empty}>No documents yet.</Text></Card>
        ) : (
          <Card>
            {documents.map((doc, i) => {
              const vis = categoryVisual(doc.category);
              return (
                <View key={doc.id} style={[styles.row, i > 0 && styles.divider]}>
                  <IconChip name={vis.icon} bg={vis.bg} fg={vis.fg} size={38} />
                  <View style={styles.rowLeft}>
                    <Text style={styles.rowTitle}>{doc.vendor ?? doc.label ?? CATEGORY_LABEL[doc.category]}</Text>
                    <Text style={styles.rowSub}>
                      {CATEGORY_LABEL[doc.category]}
                      {doc.dateISO ? ` · ${doc.dateISO}` : ''} ·{' '}
                      {doc.ocrMode === 'cloud' ? 'Cloud OCR' : doc.ocrMode === 'manual' ? 'Manual' : 'On-device OCR'}
                    </Text>
                  </View>
                  <View style={styles.rowRight}>
                    {doc.totalCents != null ? <Text style={styles.rowAmount}>${formatAmount(doc.totalCents)}</Text> : null}
                    {doc.category === 'bills_receipts' && doc.totalCents != null ? (
                      <Pressable onPress={() => setSplitDoc(doc)} style={styles.splitBtn}>
                        <Text style={styles.splitLink}>Split</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </Card>
        )}
      </ScrollView>

      {splitDoc ? (
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>
              Split {splitDoc.vendor}
              {splitDoc.totalCents != null ? ` · $${formatAmount(splitDoc.totalCents)}` : ''}
            </Text>
            <Text style={styles.sheetSub}>Add this expense to a group and split it there:</Text>
            {groups.length === 0 ? (
              <>
                <Text style={styles.sheetEmpty}>You don't have any groups yet.</Text>
                <Pressable
                  style={styles.sheetPrimary}
                  onPress={() => {
                    setSplitDoc(null);
                    onOpenGroups();
                  }}
                >
                  <Text style={styles.sheetPrimaryText}>Create a group first</Text>
                </Pressable>
              </>
            ) : (
              groups.map((g) => (
                <Pressable
                  key={g.id}
                  style={styles.groupPick}
                  onPress={() => {
                    const id = splitDoc.id;
                    setSplitDoc(null);
                    onSplitToGroup(g.id, id);
                  }}
                >
                  <Text style={styles.groupPickName}>{g.name}</Text>
                  <Text style={styles.groupPickMeta}>{g.members.length} members ›</Text>
                </Pressable>
              ))
            )}
            <Pressable onPress={() => setSplitDoc(null)}>
              <Text style={styles.sheetCancel}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.screenBg },
  scroll: { padding: 16, paddingBottom: 16 },
  banner: { backgroundColor: '#eef6ff', borderWidth: 1, borderColor: '#dbeafe', borderRadius: 12, padding: 12, marginBottom: 14 },
  bannerText: { color: '#1e40af', fontSize: 13, lineHeight: 18 },
  panel: { backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.border, borderRadius: 16, padding: 14, marginBottom: 8 },
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
  primary: { backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, marginTop: 10 },
  primaryDisabled: { opacity: 0.5 },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  empty: { color: COLORS.subtext },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  divider: { borderTopWidth: 1, borderTopColor: COLORS.border },
  rowLeft: { flex: 1, paddingHorizontal: 12 },
  rowTitle: { fontSize: 16, fontWeight: '600', color: COLORS.text },
  rowSub: { fontSize: 12, color: COLORS.subtext, marginTop: 2 },
  rowRight: { alignItems: 'flex-end' },
  rowAmount: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  splitBtn: { marginTop: 4 },
  splitLink: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(17,24,39,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  sheet: { width: '100%', backgroundColor: COLORS.bg, borderRadius: 16, padding: 18 },
  sheetTitle: { fontSize: 17, fontWeight: '800', color: COLORS.text },
  sheetSub: { fontSize: 13, color: COLORS.subtext, marginTop: 4, marginBottom: 10 },
  sheetEmpty: { color: COLORS.subtext, marginBottom: 10 },
  groupPick: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: COLORS.screenBg,
    marginBottom: 8,
  },
  groupPickName: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  groupPickMeta: { fontSize: 12, color: COLORS.subtext },
  sheetPrimary: { backgroundColor: COLORS.primary, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  sheetPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  sheetCancel: { color: COLORS.subtext, textAlign: 'center', marginTop: 10, fontSize: 15 },
  footer: { flexDirection: 'row', gap: 12, padding: 12, borderTopWidth: 1, borderTopColor: COLORS.border },
  secondary: { flex: 1, backgroundColor: COLORS.chip, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  secondaryText: { color: COLORS.text, fontWeight: '600', fontSize: 15 },
});
