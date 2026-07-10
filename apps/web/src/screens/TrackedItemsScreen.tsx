import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  computeStatus,
  dueReminders,
  resolveTriggerDate,
  type TrackedStatus,
} from '@domain/trackeditems/status';
import { COLORS } from '../theme';
import type { WebDocument } from '../store';

interface Props {
  documents: WebDocument[];
}

type Bucket = TrackedStatus | 'none';

interface TrackedView {
  id: string;
  label: string;
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
    return buildView(doc.id, doc.label ?? doc.vendor ?? 'Warranty', 'Warranty', str(d.identifier) ? `SN/IMEI ${d.identifier}` : (str(d.purchaseDate) ? `Purchased ${d.purchaseDate}` : 'No details'), expiry, today);
  }
  // loyalty / gift card
  const expiry = str(d.expiryDate);
  const bal = d.balanceValue != null ? `Balance ${d.balanceValue}` : null;
  const prog = str(d.programType);
  const detail = [prog, bal].filter(Boolean).join(' · ') || 'Loyalty';
  return buildView(doc.id, doc.label ?? doc.vendor ?? 'Loyalty', 'Loyalty', detail, expiry, today);
}

function buildView(id: string, label: string, kind: string, detail: string, expiryISO: string | null, today: string): TrackedView {
  let bucket: Bucket = 'none';
  let reminderNote: string | null = null;
  if (expiryISO) {
    try {
      bucket = computeStatus(expiryISO, today);
      const due = dueReminders(expiryISO, today);
      if (due.length > 0) {
        reminderNote = `Reminder: ${due[0]!.offsetDays}-day notice active`;
      }
    } catch {
      bucket = 'none';
    }
  }
  return { id, label, kind, detail, expiryISO, bucket, reminderNote };
}

const BUCKET_LABEL: Record<Bucket, string> = {
  expiring_soon: 'Expiring soon',
  active: 'Active',
  expired: 'Expired',
  none: 'No expiry date',
};
const BUCKET_COLOR: Record<Bucket, string> = {
  expiring_soon: '#b45309',
  active: COLORS.success,
  expired: COLORS.danger,
  none: COLORS.subtext,
};
const ORDER: Bucket[] = ['expiring_soon', 'active', 'expired', 'none'];

export default function TrackedItemsScreen({ documents }: Props) {
  const today = todayISO();
  const views = useMemo(
    () =>
      documents
        .filter((d) => d.category === 'warranty' || d.category === 'loyalty')
        .map((d) => toView(d, today)),
    [documents, today],
  );

  const grouped = ORDER.map((b) => ({ bucket: b, items: views.filter((v) => v.bucket === b) })).filter(
    (g) => g.items.length > 0,
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      <View style={styles.counts}>
        {ORDER.filter((b) => b !== 'none').map((b) => (
          <View key={b} style={styles.countCard}>
            <Text style={[styles.countNum, { color: BUCKET_COLOR[b] }]}>
              {views.filter((v) => v.bucket === b).length}
            </Text>
            <Text style={styles.countLabel}>{BUCKET_LABEL[b]}</Text>
          </View>
        ))}
      </View>

      {views.length === 0 ? (
        <Text style={styles.empty}>
          No warranties or loyalty cards yet. Scan a warranty card or loyalty/gift card and it will
          be tracked here with expiry reminders.
        </Text>
      ) : (
        grouped.map((g) => (
          <View key={g.bucket}>
            <Text style={[styles.section, { color: BUCKET_COLOR[g.bucket] }]}>{BUCKET_LABEL[g.bucket]}</Text>
            {g.items.map((v) => (
              <View key={v.id} style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>{v.label}</Text>
                  <Text style={styles.detail}>
                    {v.kind} · {v.detail}
                  </Text>
                  {v.reminderNote ? <Text style={styles.reminder}>🔔 {v.reminderNote}</Text> : null}
                </View>
                <View style={styles.rightCol}>
                  <View style={[styles.badge, { backgroundColor: BUCKET_COLOR[v.bucket] }]}>
                    <Text style={styles.badgeText}>{BUCKET_LABEL[v.bucket]}</Text>
                  </View>
                  {v.expiryISO ? <Text style={styles.expiry}>{v.expiryISO}</Text> : null}
                </View>
              </View>
            ))}
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { padding: 16, paddingBottom: 24 },
  counts: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  countCard: { flex: 1, backgroundColor: COLORS.screenBg, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  countNum: { fontSize: 24, fontWeight: '800' },
  countLabel: { fontSize: 11, color: COLORS.subtext, marginTop: 2, textAlign: 'center' },
  empty: { color: COLORS.subtext, marginTop: 24, lineHeight: 20 },
  section: { fontSize: 13, fontWeight: '700', marginTop: 20, marginBottom: 8, textTransform: 'uppercase' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  label: { fontSize: 16, fontWeight: '600', color: COLORS.text },
  detail: { fontSize: 12, color: COLORS.subtext, marginTop: 2 },
  reminder: { fontSize: 12, color: '#b45309', marginTop: 4, fontWeight: '600' },
  rightCol: { alignItems: 'flex-end' },
  badge: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  expiry: { fontSize: 12, color: COLORS.subtext, marginTop: 4 },
});
