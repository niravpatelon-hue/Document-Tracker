/**
 * ScanScreen — AI receipt capture.
 *
 * Reached two ways: (1) the app's Scan action opens the device camera
 * directly and hands the captured photo here as `capturedFile`, which starts
 * extraction immediately with no extra tap; (2) a secondary "upload a file"
 * entry point lands here with no capturedFile, showing the classic
 * tap-to-upload zone for an existing photo, PDF, or Word file. Both paths
 * converge on the same extractTextFromFile -> parseReceiptText -> preview
 * pipeline. A "sample receipt" shortcut lets a reviewer see the flow with no
 * file at all.
 */
import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { formatINR } from '@domain/money';
import { COLORS } from '../theme';
import { Button, CategoryAvatar, Icon, SectionLabel } from '../components/ui';
import { extractTextFromFile } from '../extract';
import { parseReceiptText, type ParsedReceipt } from '../parse';
import { SAMPLE_RECEIPT_TEXT } from '../seed';

interface Props {
  /** A photo already captured by the device camera — starts extraction immediately. */
  capturedFile?: File | null;
  onParsed: (prefill: {
    description: string | null;
    amountCents: number | null;
    taxCents: number | null;
    dateISO: string | null;
    category: string;
    imageDataUrl: string | null;
    rawText: string;
    source: 'scan';
  }) => void;
  onCancel: () => void;
}

type Status = 'idle' | 'working' | 'done' | 'error';

export default function ScanScreen({ capturedFile = null, onParsed, onCancel }: Props) {
  // Seed straight into 'working' when a camera photo is already in hand, so
  // the upload drop-zone never flashes for even one frame on this path.
  const [status, setStatus] = useState<Status>(capturedFile ? 'working' : 'idle');
  const [progressLabel, setProgressLabel] = useState('');
  const [progressPct, setProgressPct] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [parsed, setParsed] = useState<ParsedReceipt | null>(null);
  const [rawText, setRawText] = useState('');
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  function openPicker() {
    inputRef.current?.click();
  }

  async function handleFile(file: File) {
    setStatus('working');
    setErrorMsg('');
    setProgressLabel('Reading file');
    setProgressPct(0.05);
    try {
      const result = await extractTextFromFile(file, (label, pct) => {
        setProgressLabel(label);
        setProgressPct(pct);
      });
      const fields = parseReceiptText(result.text);
      setParsed(fields);
      setRawText(result.text);
      setImageDataUrl(result.imageDataUrl);
      setStatus('done');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not read that file');
      setStatus('error');
    }
  }

  function onFileInputChange(e: any) {
    const file: File | undefined = e?.target?.files?.[0];
    if (file) {
      void handleFile(file);
    }
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  }

  // A camera photo captured before this screen even mounted — start extracting
  // right away so the user never sees the upload zone for this path.
  useEffect(() => {
    if (capturedFile) {
      void handleFile(capturedFile);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function trySample() {
    const fields = parseReceiptText(SAMPLE_RECEIPT_TEXT);
    setParsed(fields);
    setRawText(SAMPLE_RECEIPT_TEXT);
    setImageDataUrl(null);
    setErrorMsg('');
    setStatus('done');
  }

  function reset() {
    setStatus('idle');
    setParsed(null);
    setRawText('');
    setImageDataUrl(null);
    setErrorMsg('');
    setProgressPct(0);
    setProgressLabel('');
  }

  function confirm() {
    if (!parsed) return;
    onParsed({
      description: parsed.merchant,
      amountCents: parsed.amountCents,
      taxCents: parsed.taxCents,
      dateISO: parsed.dateISO,
      category: parsed.category,
      imageDataUrl,
      rawText,
      source: 'scan',
    });
  }

  const confidencePct = parsed ? Math.round(parsed.confidence * 100) : 0;
  const confidenceColor =
    confidencePct >= 70 ? COLORS.owed : confidencePct >= 40 ? COLORS.warn : COLORS.owe;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {React.createElement('input', {
        ref: inputRef,
        type: 'file',
        accept: 'image/*,application/pdf,.docx',
        onChange: onFileInputChange,
        style: { display: 'none' },
      })}

      <View style={styles.headerRow}>
        <Text style={styles.title}>Scan a receipt</Text>
        <Text style={styles.headerLink} onPress={onCancel}>
          Cancel
        </Text>
      </View>
      <Text style={styles.subtitle}>
        {capturedFile
          ? "We'll pull out the vendor, amount, tax, date and category automatically."
          : "Upload a photo, PDF, or Word file — we'll pull out the vendor, amount, tax, date and category automatically."}
      </Text>

      {status !== 'done' && (
        <View style={styles.card}>
          {(status === 'idle' || status === 'error') && (
            <>
              <View onTouchEnd={openPicker} onClick={openPicker as any} style={styles.dropZone}>
                <View style={styles.dropIconWrap}>
                  <Icon name="camera" color={COLORS.primary} size={26} />
                </View>
                <Text style={styles.dropTitle}>Tap to upload receipt</Text>
                <Text style={styles.dropSubtitle}>JPG, PNG, PDF or DOCX</Text>
              </View>
            </>
          )}

          {status === 'working' && (
            <View style={styles.progressWrap}>
              <Text style={styles.progressLabel}>{progressLabel || 'Working…'}</Text>
              <View style={styles.progressTrack}>
                <View
                  style={[styles.progressFill, { width: `${Math.round(progressPct * 100)}%` }]}
                />
              </View>
            </View>
          )}

          {status === 'error' && (
            <View style={styles.errorBox}>
              <Icon name="x" color={COLORS.danger} size={16} />
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          )}

          {(status === 'idle' || status === 'error') && (
            <View style={styles.sampleRow}>
              <Button label="Try a sample receipt" variant="ghost" icon="sparkles" onPress={trySample} />
            </View>
          )}
        </View>
      )}

      {status === 'done' && parsed && (
        <>
          <View style={styles.card}>
            <View style={styles.extractedHeader}>
              <CategoryAvatar category={parsed.category} size={44} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.merchant} numberOfLines={1}>
                  {parsed.merchant ?? 'Unknown merchant'}
                </Text>
                <Text style={styles.dateText}>{parsed.dateISO ?? 'Date not detected'}</Text>
              </View>
              <View style={styles.categoryChip}>
                <Text style={styles.categoryChipText}>{parsed.category}</Text>
              </View>
            </View>

            <View style={styles.amountRow}>
              <View>
                <Text style={styles.amountLabel}>Total</Text>
                <Text style={styles.amountValue}>
                  {parsed.amountCents != null ? formatINR(parsed.amountCents) : '—'}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.amountLabel}>Tax / GST</Text>
                <Text style={styles.taxValue}>
                  {parsed.taxCents != null ? formatINR(parsed.taxCents) : '—'}
                </Text>
              </View>
            </View>

            <View style={styles.confidenceWrap}>
              <View style={styles.confidenceLabelRow}>
                <Text style={styles.confidenceLabel}>Confidence</Text>
                <Text style={[styles.confidenceLabel, { color: confidenceColor, fontWeight: '800' }]}>
                  {confidencePct}%
                </Text>
              </View>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${confidencePct}%`, backgroundColor: confidenceColor },
                  ]}
                />
              </View>
            </View>
          </View>

          {parsed.lineItems.length > 0 && (
            <View style={styles.card}>
              <SectionLabel>Detected items</SectionLabel>
              {parsed.lineItems.map((item, i) => (
                <View
                  key={`${item.name}-${i}`}
                  style={[styles.lineItemRow, i === parsed.lineItems.length - 1 && { borderBottomWidth: 0 }]}
                >
                  <Text style={styles.lineItemName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.lineItemAmount}>{formatINR(item.amountCents)}</Text>
                </View>
              ))}
            </View>
          )}

          <Button label="Review & add" icon="check" onPress={confirm} style={{ marginTop: 4 }} />
          <View style={styles.secondaryRow}>
            <Button label="Scan another" variant="secondary" icon="scan" onPress={reset} />
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.screenBg,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.ink,
  },
  headerLink: {
    color: COLORS.subtext,
    fontWeight: '600',
    fontSize: 14,
  },
  subtitle: {
    color: COLORS.subtext,
    fontSize: 13.5,
    lineHeight: 19,
    marginBottom: 16,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    boxShadow: '0 2px 10px rgba(20,40,60,0.05)',
  } as any,
  dropZone: {
    borderWidth: 2,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    borderRadius: 18,
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  } as any,
  dropIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  dropTitle: {
    fontSize: 15.5,
    fontWeight: '700',
    color: COLORS.ink,
  },
  dropSubtitle: {
    fontSize: 12.5,
    color: COLORS.subtext,
    marginTop: 4,
  },
  progressWrap: {
    marginTop: 16,
  },
  progressLabel: {
    color: COLORS.subtext,
    fontSize: 12.5,
    fontWeight: '600',
    marginBottom: 6,
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: COLORS.chip,
    overflow: 'hidden',
  },
  progressFill: {
    height: 8,
    borderRadius: 999,
    backgroundColor: COLORS.primary,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    backgroundColor: COLORS.oweSoft,
    borderRadius: 12,
    padding: 10,
  },
  errorText: {
    color: COLORS.owe,
    fontSize: 12.5,
    fontWeight: '600',
    flexShrink: 1,
  },
  sampleRow: {
    marginTop: 14,
    alignItems: 'center',
  },
  extractedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  merchant: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.ink,
  },
  dateText: {
    fontSize: 12.5,
    color: COLORS.subtext,
    marginTop: 2,
  },
  categoryChip: {
    backgroundColor: COLORS.chip,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  categoryChipText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: COLORS.subtext,
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },
  amountLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: COLORS.subtext,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  amountValue: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.ink,
  },
  taxValue: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.ink,
  },
  confidenceWrap: {
    marginTop: 16,
  },
  confidenceLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  confidenceLabel: {
    fontSize: 12,
    color: COLORS.subtext,
    fontWeight: '600',
  },
  lineItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  lineItemName: {
    fontSize: 13.5,
    color: COLORS.ink,
    flex: 1,
    marginRight: 10,
  },
  lineItemAmount: {
    fontSize: 13.5,
    fontWeight: '700',
    color: COLORS.ink,
  },
  secondaryRow: {
    marginTop: 10,
  },
});
