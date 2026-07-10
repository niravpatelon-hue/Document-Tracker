import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { mileageSummary, tripReimbursementCents } from '@domain/business/mileage';
import { formatINR } from '@domain/money';
import { COLORS } from '../theme';
import { Button, Card, Field, Icon, IconChip, ListRow, SectionLabel, EmptyState } from '../components/ui';
import type { MileageTrip } from '../store';

interface Props {
  mileage: MileageTrip[];
  onAdd: (t: { dateISO: string; purpose: string; route: string; km: number; ratePaisePerKm: number }) => void;
  onDelete: (id: string) => void;
}

const TODAY = new Date().toISOString().slice(0, 10);
const DEFAULT_RATE_RUPEES = 12;

export default function MileageScreen({ mileage, onAdd, onDelete }: Props) {
  const [adding, setAdding] = useState(false);
  const [dateISO, setDateISO] = useState(TODAY);
  const [purpose, setPurpose] = useState('');
  const [route, setRoute] = useState('');
  const [km, setKm] = useState('');
  const [rate, setRate] = useState(String(DEFAULT_RATE_RUPEES));

  const summary = useMemo(() => mileageSummary(mileage), [mileage]);
  const sorted = useMemo(() => [...mileage].sort((a, b) => b.dateISO.localeCompare(a.dateISO)), [mileage]);

  const kmNum = parseFloat(km) || 0;
  const rateNum = parseFloat(rate) || 0;
  const ratePaisePerKm = Math.round(rateNum * 100);
  const liveReimbursement = tripReimbursementCents(kmNum, ratePaisePerKm);
  const canSave = kmNum > 0 && !!route.trim();

  function startAdd() {
    setDateISO(TODAY);
    setPurpose('');
    setRoute('');
    setKm('');
    setRate(String(DEFAULT_RATE_RUPEES));
    setAdding(true);
  }

  function save() {
    if (!canSave) return;
    onAdd({
      dateISO,
      purpose: purpose.trim(),
      route: route.trim(),
      km: kmNum,
      ratePaisePerKm,
    });
    setAdding(false);
  }

  if (adding) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => setAdding(false)} hitSlop={8} style={styles.backBtn}>
            <Icon name="chevron" color={COLORS.text} size={20} strokeWidth={2.4} />
          </Pressable>
          <Text style={styles.headerTitle}>Log trip</Text>
          <View style={{ width: 32 }} />
        </View>

        <Card style={{ marginTop: 14 }}>
          <Field label="Date" value={dateISO} onChangeText={setDateISO} placeholder="YYYY-MM-DD" />
          <Field
            label="Purpose"
            value={purpose}
            onChangeText={setPurpose}
            placeholder="Client meeting, site visit…"
            style={{ marginTop: 14 }}
          />
          <Field
            label="Route"
            value={route}
            onChangeText={setRoute}
            placeholder="Office to Client site"
            style={{ marginTop: 14 }}
          />
          <View style={styles.row2}>
            <Field
              label="Distance (km)"
              value={km}
              onChangeText={setKm}
              keyboardType="decimal-pad"
              placeholder="0"
              style={{ flex: 1 }}
            />
            <Field
              label="Rate (Rs/km)"
              value={rate}
              onChangeText={setRate}
              keyboardType="decimal-pad"
              placeholder={String(DEFAULT_RATE_RUPEES)}
              style={{ flex: 1 }}
            />
          </View>
        </Card>

        <Card style={{ marginTop: 14 }}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Distance</Text>
            <Text style={styles.totalValue}>{kmNum.toFixed(1)} km</Text>
          </View>
          <View style={[styles.totalRow, { marginTop: 6 }]}>
            <Text style={styles.totalLabelBig}>Reimbursement</Text>
            <Text style={styles.totalValueBig}>{formatINR(liveReimbursement)}</Text>
          </View>
        </Card>

        <Button
          label="Save trip"
          onPress={save}
          disabled={!canSave}
          icon="check"
          style={{ marginTop: 18 }}
        />
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      <SectionLabel>Mileage</SectionLabel>

      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <IconChip name="car" bg={COLORS.primarySoft} color={COLORS.primary} size={44} />
          <View style={{ marginLeft: 12, flex: 1 }}>
            <Text style={styles.summaryLabel}>Total reimbursement</Text>
            <Text style={styles.summaryValue}>{formatINR(summary.totalCents)}</Text>
          </View>
        </View>
        <View style={styles.summaryFooter}>
          <Text style={styles.summaryMeta}>
            {summary.totalKm.toFixed(1)} km · {summary.tripCount} trip{summary.tripCount === 1 ? '' : 's'}
          </Text>
        </View>
      </Card>

      <Button label="Log trip" onPress={startAdd} icon="plus" style={{ marginTop: 14 }} />

      <View style={{ marginTop: 22 }}>
        <SectionLabel>Trips</SectionLabel>
        {sorted.length === 0 ? (
          <Card>
            <EmptyState emoji="🚗" title="No trips logged yet" subtitle="Log a trip to start tracking reimbursement." />
          </Card>
        ) : (
          <Card style={{ paddingVertical: 4 }}>
            {sorted.map((t, i) => {
              const reimb = tripReimbursementCents(t.km, t.ratePaisePerKm);
              return (
                <View key={t.id}>
                  <ListRow
                    left={<IconChip name="mapPin" bg={COLORS.primarySoft} color={COLORS.primary} size={40} />}
                    title={t.route}
                    subtitle={`${t.purpose ? `${t.purpose} · ` : ''}${t.dateISO} · ${t.km.toFixed(1)} km`}
                    rightTop={formatINR(reimb)}
                    rightBottom={
                      <Pressable onPress={() => onDelete(t.id)} hitSlop={8} style={{ marginTop: 4 }}>
                        <Icon name="trash" color={COLORS.danger} size={16} />
                      </Pressable>
                    }
                  />
                  {i < sorted.length - 1 && <View style={styles.divider} />}
                </View>
              );
            })}
          </Card>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.screenBg },
  scroll: { padding: 16, paddingBottom: 28 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.chip,
  },
  headerTitle: { fontSize: 16, fontWeight: '800', color: COLORS.ink },
  row2: { flexDirection: 'row', gap: 10, marginTop: 14 },
  summaryLabel: { fontSize: 12.5, fontWeight: '700', color: COLORS.subtext },
  summaryValue: { fontSize: 22, fontWeight: '800', color: COLORS.ink, marginTop: 2 },
  summaryFooter: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },
  summaryMeta: { fontSize: 12.5, color: COLORS.subtext, fontWeight: '600' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { color: COLORS.subtext, fontSize: 13, fontWeight: '600' },
  totalValue: { color: COLORS.ink, fontSize: 13, fontWeight: '700' },
  totalLabelBig: { color: COLORS.ink, fontSize: 15, fontWeight: '800' },
  totalValueBig: { color: COLORS.primary, fontSize: 18, fontWeight: '800' },
  divider: { height: 1, backgroundColor: COLORS.divider, marginLeft: 52 },
});
