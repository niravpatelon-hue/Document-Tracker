import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { gstOnAmount, summarizeGst, type GstEntry } from '@domain/business/gst';
import { computeInvoiceTotals } from '@domain/business/invoicing';
import { formatINR, toCents } from '@domain/money';
import { COLORS } from '../theme';
import {
  Card,
  HeroCard,
  Icon,
  IconChip,
  SectionLabel,
  SegmentBar,
  StatusPill,
  heroText,
} from '../components/ui';
import {
  BUSINESS_EXPENSE_CATEGORIES,
  GST_RATES,
  businessCategoryIcon,
  type BusinessProfile,
  type WebBusinessExpense,
  type WebInvoice,
} from '../store';

interface Props {
  businessExpenses: WebBusinessExpense[];
  invoices: WebInvoice[];
  businessProfile: BusinessProfile;
  onAddExpense: (e: {
    vendor: string;
    category: string;
    dateISO: string;
    amountCents: number;
    taxRatePct: number;
    gstCents: number;
    direction: 'input' | 'output';
    gstin?: string;
    paymentMethod?: string;
  }) => void;
  onDeleteExpense: (id: string) => void;
}

const TODAY = new Date().toISOString().slice(0, 10);

const RATE_COLORS = [COLORS.sky, COLORS.primary, COLORS.savings, COLORS.expense, COLORS.danger];

export default function GSTScreen({
  businessExpenses,
  invoices,
  businessProfile,
  onAddExpense,
  onDeleteExpense,
}: Props) {
  const [adding, setAdding] = useState(false);
  const [vendor, setVendor] = useState('');
  const [category, setCategory] = useState(BUSINESS_EXPENSE_CATEGORIES[0]?.key ?? 'Other');
  const [dateISO, setDateISO] = useState(TODAY);
  const [amount, setAmount] = useState('');
  const [taxRatePct, setTaxRatePct] = useState<number>(18);
  const [gstin, setGstin] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');

  const summary = useMemo(() => {
    const entries: GstEntry[] = [];
    for (const inv of invoices) {
      const totals = computeInvoiceTotals(inv.items);
      for (const b of totals.byRate) {
        entries.push({ direction: 'output', taxableCents: b.taxableCents, taxRatePct: b.rate, gstCents: b.taxCents });
      }
    }
    for (const e of businessExpenses) {
      if (e.direction === 'input') {
        entries.push({
          direction: 'input',
          taxableCents: e.amountCents,
          taxRatePct: e.taxRatePct,
          gstCents: e.gstCents,
        });
      }
    }
    return summarizeGst(entries);
  }, [invoices, businessExpenses]);

  const amountCents = Math.max(0, toCents(parseFloat(amount) || 0));
  const liveGst = gstOnAmount(amountCents, taxRatePct);
  const liveGross = amountCents + liveGst;

  const sortedPurchases = useMemo(
    () => [...businessExpenses].sort((a, b) => b.createdAt - a.createdAt),
    [businessExpenses],
  );

  function startAdd() {
    setVendor('');
    setCategory(BUSINESS_EXPENSE_CATEGORIES[0]?.key ?? 'Other');
    setDateISO(TODAY);
    setAmount('');
    setTaxRatePct(18);
    setGstin('');
    setPaymentMethod('');
    setAdding(true);
  }

  function save() {
    if (!vendor.trim() || amountCents <= 0) return;
    onAddExpense({
      vendor: vendor.trim(),
      category,
      dateISO,
      amountCents,
      taxRatePct,
      gstCents: gstOnAmount(amountCents, taxRatePct),
      direction: 'input',
      gstin: gstin.trim() || undefined,
      paymentMethod: paymentMethod.trim() || undefined,
    });
    setAdding(false);
  }

  const canSave = !!vendor.trim() && amountCents > 0;
  const netPayable = summary.netPayableCents;
  const isCredit = netPayable < 0;

  const segments = summary.byRate.map((b, i) => ({
    value: b.taxableCents,
    color: RATE_COLORS[i % RATE_COLORS.length],
  }));

  if (adding) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => setAdding(false)} hitSlop={8}>
            <Icon name="chevron" color={COLORS.text} size={22} strokeWidth={2.4} />
          </Pressable>
          <Text style={styles.headerTitle}>Add purchase</Text>
          <View style={{ width: 22 }} />
        </View>

        <Card style={{ marginTop: 12 }}>
          <Text style={styles.label}>Vendor</Text>
          <TextInput style={styles.input} value={vendor} onChangeText={setVendor} placeholder="Vendor name" />

          <Text style={styles.label}>Category</Text>
          <View style={styles.chips}>
            {BUSINESS_EXPENSE_CATEGORIES.map((c) => (
              <Pressable
                key={c.key}
                style={[styles.chip, category === c.key && styles.chipActive]}
                onPress={() => setCategory(c.key)}
              >
                <Text style={[styles.chipText, category === c.key && styles.chipTextActive]}>
                  {c.icon} {c.key}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Date</Text>
          <TextInput style={styles.input} value={dateISO} onChangeText={setDateISO} placeholder="YYYY-MM-DD" />

          <Text style={styles.label}>Net amount (₹)</Text>
          <TextInput
            style={styles.input}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder="0.00"
          />

          <Text style={styles.label}>GST rate</Text>
          <View style={styles.chips}>
            {GST_RATES.map((r) => (
              <Pressable
                key={r}
                style={[styles.chip, taxRatePct === r && styles.chipActive]}
                onPress={() => setTaxRatePct(r)}
              >
                <Text style={[styles.chipText, taxRatePct === r && styles.chipTextActive]}>{r}%</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Vendor GSTIN (optional)</Text>
          <TextInput style={styles.input} value={gstin} onChangeText={setGstin} placeholder="22AAAAA0000A1Z5" />

          <Text style={styles.label}>Payment method (optional)</Text>
          <TextInput
            style={styles.input}
            value={paymentMethod}
            onChangeText={setPaymentMethod}
            placeholder="Card, UPI, bank transfer…"
          />
        </Card>

        <Card style={{ marginTop: 14 }}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Net</Text>
            <Text style={styles.totalValue}>{formatINR(amountCents)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>GST ({taxRatePct}%)</Text>
            <Text style={styles.totalValue}>{formatINR(liveGst)}</Text>
          </View>
          <View style={[styles.totalRow, { marginTop: 4 }]}>
            <Text style={styles.totalLabelBig}>Gross</Text>
            <Text style={styles.totalValueBig}>{formatINR(liveGross)}</Text>
          </View>
        </Card>

        <Pressable style={[styles.primary, !canSave && styles.primaryDisabled]} onPress={save} disabled={!canSave}>
          <Text style={styles.primaryText}>Save purchase</Text>
        </Pressable>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      <HeroCard>
        <Text style={heroText.cap}>Net GST payable</Text>
        <Text style={[heroText.money, isCredit && { color: COLORS.income }]}>
          {isCredit ? formatINR(Math.abs(netPayable)) : formatINR(netPayable)}
        </Text>
        {isCredit ? <StatusPill text="ITC credit carried forward" tone="good" /> : null}
        <View style={styles.heroPills}>
          <StatusPill text={`Output ${formatINR(summary.outputGstCents)}`} tone="info" />
          <StatusPill text={`Input / ITC ${formatINR(summary.inputGstCents)}`} tone="good" />
        </View>
        <Text style={heroText.sub}>GSTIN: {businessProfile.gstin || 'Not set'}</Text>
      </HeroCard>

      <SectionLabel>Output GST by rate</SectionLabel>
      <Card>
        {summary.byRate.length === 0 ? (
          <Text style={styles.empty}>No sales GST recorded yet.</Text>
        ) : (
          <>
            <SegmentBar segments={segments} />
            <View style={{ marginTop: 12 }}>
              {summary.byRate.map((b, i) => (
                <View key={b.rate} style={styles.rateRow}>
                  <View style={styles.rateLeft}>
                    <View style={[styles.dot, { backgroundColor: RATE_COLORS[i % RATE_COLORS.length] }]} />
                    <Text style={styles.rateText}>{b.rate}%</Text>
                  </View>
                  <Text style={styles.rateSub}>Taxable {formatINR(b.taxableCents)}</Text>
                  <Text style={styles.rateGst}>GST {formatINR(b.gstCents)}</Text>
                </View>
              ))}
            </View>
          </>
        )}
      </Card>

      <Pressable style={styles.primary} onPress={startAdd}>
        <Icon name="plus" color="#fff" size={18} />
        <Text style={styles.primaryText}>Add purchase</Text>
      </Pressable>

      <SectionLabel>Purchases (input GST)</SectionLabel>
      {sortedPurchases.length === 0 ? (
        <Card><Text style={styles.empty}>No purchases logged yet.</Text></Card>
      ) : (
        sortedPurchases.map((e) => {
          const gross = e.amountCents + e.gstCents;
          return (
            <Card key={e.id} style={{ marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                <IconChip name="tag" bg={COLORS.accentSoft} fg={COLORS.primary} size={38} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.invNumber}>{e.vendor}</Text>
                  <Text style={styles.invMeta}>
                    {businessCategoryIcon(e.category)} {e.category} · {e.dateISO}
                  </Text>
                </View>
                <Pressable onPress={() => onDeleteExpense(e.id)} hitSlop={8}>
                  <Icon name="trash" color={COLORS.danger} size={17} />
                </Pressable>
              </View>
              <View style={styles.invFooter}>
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                  <Text style={styles.invTotal}>{formatINR(e.amountCents)}</Text>
                  <StatusPill text={`${e.taxRatePct}% GST`} tone="neutral" />
                </View>
                <Text style={styles.grossText}>Gross {formatINR(gross)}</Text>
              </View>
              <Text style={styles.gstLine}>GST {formatINR(e.gstCents)}</Text>
            </Card>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.screenBg },
  scroll: { padding: 16, paddingBottom: 28 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  heroPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.subtext, marginTop: 8, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontSize: 15,
    color: COLORS.text,
    backgroundColor: '#fff',
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, backgroundColor: COLORS.chip },
  chipActive: { backgroundColor: COLORS.primary },
  chipText: { color: COLORS.text, fontWeight: '600', fontSize: 13 },
  chipTextActive: { color: '#fff' },
  empty: { color: COLORS.subtext },
  primary: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryDisabled: { opacity: 0.5 },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  totalLabel: { color: COLORS.subtext, fontSize: 13 },
  totalValue: { color: COLORS.text, fontSize: 13, fontWeight: '600' },
  totalLabelBig: { color: COLORS.text, fontSize: 15, fontWeight: '700' },
  totalValueBig: { color: COLORS.text, fontSize: 15, fontWeight: '800' },
  rateRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, gap: 8 },
  rateLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, width: 56 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  rateText: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  rateSub: { fontSize: 12, color: COLORS.subtext, flex: 1 },
  rateGst: { fontSize: 12, fontWeight: '700', color: COLORS.text },
  invNumber: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  invMeta: { fontSize: 12, color: COLORS.subtext, marginTop: 2 },
  invFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  invTotal: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  grossText: { fontSize: 12, color: COLORS.subtext },
  gstLine: { fontSize: 12, color: COLORS.subtext, marginTop: 4 },
});
