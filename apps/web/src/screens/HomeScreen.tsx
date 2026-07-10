import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { formatAmount } from '@domain/money';
import {
  classifySpendCategory,
  monthKeyOf,
  monthOverMonth,
  spendByMonth,
  type SpendTxn,
} from '@domain/analytics/spend';
import { computeStatus, resolveTriggerDate } from '@domain/trackeditems/status';
import { COLORS } from '../theme';
import type { WebDocument, WebTransaction } from '../store';

interface Props {
  documents: WebDocument[];
  transactions: WebTransaction[];
  onOpenReceipts: () => void;
  onOpenWarranty: () => void;
  onOpenLoyalty: () => void;
  onOpenSpending: () => void;
}

const strokeCommon = {
  viewBox: '0 0 24 24',
  fill: 'none',
  strokeWidth: 1.9,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  width: 18,
  height: 18,
};

function TileIcon({ kind, color }: { kind: string; color: string }) {
  switch (kind) {
    case 'receipt':
      return (
        <svg {...strokeCommon} stroke={color}>
          <path d="M6 3h9l4 4v14l-2-1-2 1-2-1-2 1-2-1-2 1V3z" />
          <path d="M8 9h7M8 13h5" />
        </svg>
      );
    case 'shield':
      return (
        <svg {...strokeCommon} stroke={color}>
          <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z" />
        </svg>
      );
    case 'star':
      return (
        <svg {...strokeCommon} stroke={color}>
          <path d="M12 4l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4L4.2 9.7l5.4-.8z" />
        </svg>
      );
    case 'chart':
      return (
        <svg {...strokeCommon} stroke={color}>
          <path d="M4 19V9M10 19V5M16 19v-7" />
        </svg>
      );
    default:
      return null;
  }
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function buildSpark(values: number[], w: number, h: number) {
  const pts = values.length >= 2 ? values : [values[0] ?? 0, values[0] ?? 0];
  const max = Math.max(...pts);
  const min = Math.min(...pts);
  const range = Math.max(1, max - min);
  const stepX = w / (pts.length - 1);
  const coords = pts.map((v, i) => [i * stepX, h - ((v - min) / range) * (h - 8) - 4] as const);
  const line = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c[0].toFixed(1)} ${c[1].toFixed(1)}`).join(' ');
  const area = `${line} L${w} ${h} L0 ${h} Z`;
  const last = coords[coords.length - 1]!;
  return { line, area, lastX: last[0], lastY: last[1] };
}

export default function HomeScreen({
  documents,
  transactions,
  onOpenReceipts,
  onOpenWarranty,
  onOpenLoyalty,
  onOpenSpending,
}: Props) {
  const today = todayISO();

  const spendTxns: SpendTxn[] = useMemo(
    () => transactions.map((t) => ({ amount: t.amount, category: classifySpendCategory(t.vendor), dateISO: t.dateISO, vendor: t.vendor })),
    [transactions],
  );
  const byMonth = useMemo(() => spendByMonth(spendTxns), [spendTxns]);
  const currentMonth = byMonth.length ? byMonth[byMonth.length - 1]!.month : monthKeyOf(today);
  const mom = useMemo(() => monthOverMonth(spendTxns, currentMonth), [spendTxns, currentMonth]);
  const spark = useMemo(() => buildSpark(byMonth.map((m) => m.total), 250, 40), [byMonth]);

  const receipts = documents.filter((d) => d.category === 'bills_receipts');
  const warranties = documents.filter((d) => d.category === 'warranty');
  const loyalty = documents.filter((d) => d.category === 'loyalty');

  const warrantyExpiring = warranties.filter((d) => {
    const dd = d.details ?? {};
    const anchor = dd.purchaseDate ? String(dd.purchaseDate) : null;
    const months = dd.warrantyMonths != null ? Number(dd.warrantyMonths) : null;
    if (!anchor || months == null) return false;
    try {
      const trig = resolveTriggerDate({ triggerType: 'duration_from_purchase', anchorDate: anchor, durationMonths: months });
      return trig ? computeStatus(trig, today) === 'expiring_soon' : false;
    } catch {
      return false;
    }
  }).length;

  const monthLabel = new Date(today).toLocaleDateString('en-US', { month: 'long' });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      <View style={styles.top}>
        <Text style={styles.hi}>
          Hi there <Text style={styles.hiMonth}>· {monthLabel}</Text>
        </Text>
        <View style={styles.bell}>
          <svg {...strokeCommon} stroke="#334155" width={17} height={17}>
            <path d="M18 8a6 6 0 10-12 0c0 7-3 8-3 8h18s-3-1-3-8" />
            <path d="M13.5 21a2 2 0 01-3 0" />
          </svg>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardCap}>Total spent this month</Text>
        <View style={styles.moneyRow}>
          <Text style={styles.money}>${formatAmount(mom.current)}</Text>
          {mom.deltaPct != null ? (
            <Text style={styles.pill}>
              {mom.delta >= 0 ? '▲' : '▼'} {Math.abs(Math.round(mom.deltaPct))}%
            </Text>
          ) : null}
        </View>
        <svg viewBox={`0 0 250 40`} preserveAspectRatio="none" width="100%" height={40} style={{ marginTop: 12, display: 'block' }}>
          <defs>
            <linearGradient id="hg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#6ee7a8" stopOpacity="0.4" />
              <stop offset="1" stopColor="#6ee7a8" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={spark.area} fill="url(#hg)" />
          <path d={spark.line} fill="none" stroke="#6ee7a8" strokeWidth={2} />
          <circle cx={spark.lastX} cy={spark.lastY} r={3} fill="#6ee7a8" />
        </svg>
        <Text style={styles.cardSub}>
          {receipts.length} receipts
          {mom.deltaPct != null ? ` · $${formatAmount(Math.abs(mom.delta))} ${mom.delta >= 0 ? 'more' : 'less'} than last month` : ''}
        </Text>
      </View>

      <View style={styles.grid}>
        <Tile
          onPress={onOpenReceipts}
          chipBg="#e0e7ff"
          icon={<TileIcon kind="receipt" color="#4f46e5" />}
          title="Bills & Receipts"
          sub={`${receipts.length} documents`}
        />
        <Tile
          onPress={onOpenWarranty}
          chipBg="#fef0e0"
          icon={<TileIcon kind="shield" color="#d97706" />}
          title="Warranty"
          sub={`${warranties.length} tracked`}
          status={warrantyExpiring > 0 ? `${warrantyExpiring} expiring` : undefined}
        />
        <Tile
          onPress={onOpenLoyalty}
          chipBg="#e6f6ee"
          icon={<TileIcon kind="star" color="#059669" />}
          title="Loyalty & Rewards"
          sub={`${loyalty.length} programs`}
        />
        <Tile
          onPress={onOpenSpending}
          chipBg="#e7edf6"
          icon={<TileIcon kind="chart" color="#2563eb" />}
          title="Spending"
          sub="by category"
        />
      </View>
    </ScrollView>
  );
}

function Tile(props: {
  onPress: () => void;
  chipBg: string;
  icon: React.ReactNode;
  title: string;
  sub: string;
  status?: string;
}) {
  return (
    <Pressable style={styles.tile} onPress={props.onPress}>
      <View style={[styles.chip, { backgroundColor: props.chipBg }]}>{props.icon}</View>
      <Text style={styles.tileTitle}>{props.title}</Text>
      <Text style={styles.tileSub}>{props.sub}</Text>
      {props.status ? (
        <View style={styles.statusPill}>
          <Text style={styles.statusText}>{props.status}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.screenBg },
  scroll: { padding: 16, paddingBottom: 24 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  hi: { fontSize: 18, fontWeight: '800', color: COLORS.text, letterSpacing: -0.2 },
  hiMonth: { color: COLORS.subtext, fontWeight: '600' },
  bell: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#eaeef6', alignItems: 'center', justifyContent: 'center' },
  card: {
    backgroundColor: COLORS.navyB,
    borderRadius: 20,
    padding: 18,
    boxShadow: '0 16px 30px -16px rgba(11,18,32,0.7)',
  } as object,
  cardCap: { color: '#9fb0d0', fontSize: 12, fontWeight: '600' },
  moneyRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 4 },
  money: { color: '#fff', fontSize: 34, fontWeight: '800', letterSpacing: -0.5 },
  pill: { backgroundColor: 'rgba(110,231,168,0.16)', color: '#6ee7a8', fontSize: 12, fontWeight: '700', paddingVertical: 3, paddingHorizontal: 9, borderRadius: 999 },
  cardSub: { color: '#9fb0d0', fontSize: 12, marginTop: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 16 },
  tile: {
    width: '47.5%',
    flexGrow: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chip: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  tileTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  tileSub: { fontSize: 12, color: COLORS.subtext, marginTop: 2 },
  statusPill: { alignSelf: 'flex-start', marginTop: 8, backgroundColor: COLORS.warnBg, borderRadius: 999, paddingVertical: 2, paddingHorizontal: 8 },
  statusText: { color: COLORS.warnText, fontSize: 10.5, fontWeight: '700' },
});
