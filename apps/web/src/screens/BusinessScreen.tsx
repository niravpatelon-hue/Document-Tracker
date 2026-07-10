import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { summarizeGst } from '@domain/business/gst';
import { computeInvoiceTotals, receivablesSummary } from '@domain/business/invoicing';
import { mileageSummary } from '@domain/business/mileage';
import { formatINRCompact } from '@domain/money';
import { COLORS } from '../theme';
import { Card, HeroCard, Icon, SectionLabel, Tile, heroText } from '../components/ui';
import type {
  BusinessProfile,
  WebBusinessExpense,
  WebClient,
  WebInvoice,
  WebMileageTrip,
} from '../store';

interface Props {
  businessProfile: BusinessProfile;
  invoices: WebInvoice[];
  clients: WebClient[];
  businessExpenses: WebBusinessExpense[];
  mileage: WebMileageTrip[];
  onOpenInvoices: () => void;
  onOpenClients: () => void;
  onOpenGST: () => void;
  onOpenMileage: () => void;
  onOpenExpenses: () => void;
}

const TODAY = new Date().toISOString().slice(0, 10);

function isThisMonth(dateISO: string, todayISO: string): boolean {
  return (dateISO || '').slice(0, 7) === todayISO.slice(0, 7);
}

export default function BusinessScreen({
  businessProfile,
  invoices,
  clients,
  businessExpenses,
  mileage,
  onOpenInvoices,
  onOpenClients,
  onOpenGST,
  onOpenMileage,
  onOpenExpenses,
}: Props) {
  const receivables = useMemo(() => receivablesSummary(invoices, TODAY), [invoices]);

  const expensesThisMonth = useMemo(
    () => businessExpenses.filter((e) => isThisMonth(e.dateISO, TODAY)),
    [businessExpenses],
  );

  const gst = useMemo(() => {
    const outputEntries = invoices
      .filter((inv) => inv.status !== 'draft')
      .flatMap((inv) => computeInvoiceTotals(inv.items).byRate.map((r) => ({
        direction: 'output' as const,
        taxableCents: r.taxableCents,
        taxRatePct: r.rate,
        gstCents: r.taxCents,
      })));
    const inputEntries = expensesThisMonth.map((e) => ({
      direction: 'input' as const,
      taxableCents: e.amountCents,
      taxRatePct: e.taxRatePct,
      gstCents: e.gstCents,
    }));
    return summarizeGst([...outputEntries, ...inputEntries]);
  }, [invoices, expensesThisMonth]);

  const expensesGrossThisMonth = useMemo(
    () => expensesThisMonth.reduce((sum, e) => sum + e.amountCents + e.gstCents, 0),
    [expensesThisMonth],
  );

  const mileageThisMonth = useMemo(
    () => mileageSummary(mileage.filter((t) => isThisMonth(t.dateISO, TODAY))),
    [mileage],
  );

  const gstPayable = gst.netPayableCents;

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
      <HeroCard>
        <View style={s.heroTop}>
          <View style={s.heroIcon}>
            <Icon name="briefcase" color="#fff" size={20} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={heroText.cap}>BUSINESS</Text>
            <Text style={s.heroName} numberOfLines={1}>
              {businessProfile.name || 'Your business'}
            </Text>
          </View>
        </View>
        <View style={s.heroMetaRow}>
          <Text style={s.heroMeta}>{businessProfile.gstin || 'GSTIN not set'}</Text>
          {businessProfile.stateName ? <Text style={s.heroMeta}>· {businessProfile.stateName}</Text> : null}
        </View>
      </HeroCard>

      <View style={s.kpiGrid}>
        <Card style={s.kpiCard}>
          <Text style={s.kpiLabel}>Receivables</Text>
          <Text style={s.kpiValue}>{formatINRCompact(receivables.outstandingCents)}</Text>
          {receivables.overdueCents > 0 ? (
            <Text style={[s.kpiSub, { color: COLORS.warnText }]}>
              overdue {formatINRCompact(receivables.overdueCents)}
            </Text>
          ) : (
            <Text style={s.kpiSub}>outstanding</Text>
          )}
        </Card>

        <Card style={s.kpiCard}>
          <Text style={s.kpiLabel}>GST payable</Text>
          <Text style={[s.kpiValue, gstPayable < 0 ? { color: COLORS.success } : null]}>
            {formatINRCompact(Math.abs(gstPayable))}
          </Text>
          <Text style={s.kpiSub}>{gstPayable < 0 ? 'ITC credit' : 'this period'}</Text>
        </Card>

        <Card style={s.kpiCard}>
          <Text style={s.kpiLabel}>Expenses</Text>
          <Text style={s.kpiValue}>{formatINRCompact(expensesGrossThisMonth)}</Text>
          <Text style={s.kpiSub}>this month</Text>
        </Card>

        <Card style={s.kpiCard}>
          <Text style={s.kpiLabel}>Mileage</Text>
          <Text style={s.kpiValue}>{formatINRCompact(mileageThisMonth.totalCents)}</Text>
          <Text style={s.kpiSub}>
            {mileageThisMonth.totalKm.toFixed(0)} km · {mileageThisMonth.tripCount} trips
          </Text>
        </Card>
      </View>

      <SectionLabel>Manage</SectionLabel>
      <View style={s.tileGrid}>
        <Tile
          style={s.tile}
          onPress={onOpenInvoices}
          iconName="fileText"
          chipBg={COLORS.accentSoft}
          chipFg={COLORS.primary}
          title="Invoices"
          sub={`${invoices.length} invoice${invoices.length === 1 ? '' : 's'}`}
        />
        <Tile
          style={s.tile}
          onPress={onOpenClients}
          iconName="users"
          chipBg={COLORS.chip}
          chipFg={COLORS.subtext}
          title="Clients"
          sub={`${clients.length} client${clients.length === 1 ? '' : 's'}`}
        />
        <Tile
          style={s.tile}
          onPress={onOpenGST}
          iconName="percent"
          chipBg={COLORS.warnBg}
          chipFg={COLORS.warnText}
          title="GST & tax"
          sub={gstPayable < 0 ? `${formatINRCompact(Math.abs(gstPayable))} credit` : `${formatINRCompact(gstPayable)} due`}
        />
        <Tile
          style={s.tile}
          onPress={onOpenMileage}
          iconName="truck"
          chipBg={COLORS.incomeSoft}
          chipFg={COLORS.income}
          title="Mileage"
          sub={`${mileage.length} trip${mileage.length === 1 ? '' : 's'} logged`}
        />
        <Tile
          style={[s.tile, s.tileWide]}
          onPress={onOpenExpenses}
          iconName="wallet"
          chipBg={COLORS.expenseSoft}
          chipFg={COLORS.expense}
          title="Business expenses"
          sub={`${businessExpenses.length} recorded · ${formatINRCompact(expensesGrossThisMonth)} this month`}
        />
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.screenBg },
  content: { padding: 16, paddingBottom: 32 },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroName: { color: '#fff', fontSize: 18, fontWeight: '800', marginTop: 2 },
  heroMetaRow: { flexDirection: 'row', gap: 6, marginTop: 12 },
  heroMeta: { color: '#9fb0d0', fontSize: 12, fontWeight: '600' },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16 },
  kpiCard: { width: '48%', gap: 4 },
  kpiLabel: { fontSize: 12, color: COLORS.subtext, fontWeight: '600' },
  kpiValue: { fontSize: 20, fontWeight: '800', color: COLORS.text, marginTop: 2 },
  kpiSub: { fontSize: 11, color: COLORS.subtext, marginTop: 2 },
  tileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { width: '48%' },
  tileWide: { width: '100%' },
});
