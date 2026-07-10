import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { computeStatus, dueReminders, resolveTriggerDate, type TrackedStatus } from '@domain/trackeditems/status';
import { COLORS } from '../theme';
import { Card, IconChip, SectionLabel, StatusPill, categoryVisual } from '../components/ui';
import type { WebDocument } from '../store';

interface Props {
  documents: WebDocument[];
}

type Bucket = TrackedStatus | 'none';

interface TrackedView {
  id: string;
  label: string;
  docCategory: 'warranty' | 'loyalty';
  kind: string;
  detail: string;
  expiryISO: string | null;
  bucket: Bucket;
  reminderNote: string | null;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
function str(v: unknown): string | null {
  return v == null || v === '' ? null : String(v);
}

function toView(doc: WebDocument, today: string): TrackedView {
  const d = doc.details ?? {};
  if (doc.category === 'warranty') {
    const anchor = str(d.purchaseDate);
    const months = d.warrantyMonths != null ? Number(d.warrantyMonths) : null;
    const expiry = anchor && months != null
      ? resolveTriggerDate({ triggerType: 'duration_from_purchase', anchorDate: anchor, durationMonths: months })
      : null;
    const detail = str(d.identifier) ? `SN/IMEI ${d.identifier}` : str(d.purchaseDate) ? `Purchased ${d.purchaseDate}` : 'No details';
    return build(doc.id, doc.label ?? doc.vendor ?? 'Warranty', 'warranty', 'Warranty', detail, expiry, today);
  }
  const expiry = str(d.expiryDate);
  const bal = d.balanceValue != null ? `Balance ${d.balanceValue}` : null;
  const prog = str(d.programType);
  const detail = [prog, bal].filter(Boolean).join(' · ') || 'Loyalty';
  return build(doc.id, doc.label ?? doc.vendor ?? 'Loyalty', 'loyalty', 'Loyalty', detail, expiry, today);
}

function build(id: string, label: string, docCategory: 'warranty' | 'loyalty', kind: string, detail: string, expiryISO: string | null, today: string): TrackedView {
  let bucket: Bucket = 'none';
  let reminderNote: string | null = null;
  if (expiryISO) {
    try {
      bucket = computeStatus(expiryISO, today);
      const due = dueReminders(expiryISO, today);
      if (due.length > 0) reminderNote = `${due[0]!.offsetDays}-day reminder active`;
    } catch {
      bucket = 'none';
    }
  }
  return { id, label, docCategory, kind, detail, expiryISO, bucket, reminderNote };
}

const BUCKET_LABEL: Record<Bucket, string> = {
  expiring_soon: 'Expiring soon',
  active: 'Active',
  expired: 'Expired',
  none: 'No expiry date',
};
const BUCKET_TONE: Record<Bucket, 'warn' | 'good' | 'danger' | 'neutral'> = {
  expiring_soon: 'warn',
  active: 'good',
  expired: 'danger',
  none: 'neutral',
};
const BUCKET_COLOR: Record<Bucket, string> = {
  expiring_soon: COLORS.warnText,
  active: COLORS.good,
  expired: COLORS.danger,
  none: COLORS.subtext,
};
const ORDER: Bucket[] = ['expiring_soon', 'active', 'expired', 'none'];

export default function TrackedItemsScreen({ documents }: Props) {
  const today = todayISO();
  const views = useMemo(
    () => documents.filter((d) => d.category === 'warranty' || d.category === 'loyalty').map((d) => toView(d, today)),
    [documents, today],
  );
  const grouped = ORDER.map((b) => ({ bucket: b, items: views.filter((v) => v.bucket === b) })).filter((g) => g.items.length > 0);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      <View style={styles.counts}>
        {(['expiring_soon', 'active', 'expired'] as Bucket[]).map((b) => (
          <View key={b} style={styles.countCard}>
            <Text style={[styles.countNum, { color: BUCKET_COLOR[b] }]}>{views.filter((v) => v.bucket === b).length}</Text>
            <Text style={styles.countLabel}>{BUCKET_LABEL[b]}</Text>
          </View>
        ))}
      </View>

      {views.length === 0 ? (
        <Card style={{ marginTop: 16 }}>
          <Text style={styles.empty}>
            No warranties or loyalty cards yet. Scan a warranty card or loyalty/gift card and it will be tracked here
            with expiry reminders.
          </Text>
        </Card>
      ) : (
        grouped.map((g) => (
          <View key={g.bucket}>
            <SectionLabel style={{ color: BUCKET_COLOR[g.bucket] } as object}>{BUCKET_LABEL[g.bucket]}</SectionLabel>
            <Card>
              {g.items.map((v, i) => {
                const vis = categoryVisual(v.docCategory);
                return (
                  <View key={v.id} style={[styles.row, i > 0 && styles.divider]}>
                    <IconChip name={vis.icon} bg={vis.bg} fg={vis.fg} size={38} />
                    <View style={styles.mid}>
                      <Text style={styles.label}>{v.label}</Text>
                      <Text style={styles.detail}>{v.kind} · {v.detail}</Text>
                      {v.reminderNote ? <Text style={styles.reminder}>🔔 {v.reminderNote}</Text> : null}
                    </View>
                    <View style={styles.right}>
                      <StatusPill text={BUCKET_LABEL[v.bucket]} tone={BUCKET_TONE[v.bucket]} />
                      {v.expiryISO ? <Text style={styles.expiry}>{v.expiryISO}</Text> : null}
                    </View>
                  </View>
                );
              })}
            </Card>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.screenBg },
  scroll: { padding: 16, paddingBottom: 28 },
  counts: { flexDirection: 'row', gap: 10 },
  countCard: { flex: 1, backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, paddingVertical: 14, alignItems: 'center' },
  countNum: { fontSize: 24, fontWeight: '800' },
  countLabel: { fontSize: 11, color: COLORS.subtext, marginTop: 2, textAlign: 'center' },
  empty: { color: COLORS.subtext, lineHeight: 20 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  divider: { borderTopWidth: 1, borderTopColor: COLORS.border },
  mid: { flex: 1, marginLeft: 12 },
  label: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  detail: { fontSize: 12, color: COLORS.subtext, marginTop: 2 },
  reminder: { fontSize: 12, color: COLORS.warnText, marginTop: 4, fontWeight: '600' },
  right: { alignItems: 'flex-end', gap: 4 },
  expiry: { fontSize: 12, color: COLORS.subtext },
});
