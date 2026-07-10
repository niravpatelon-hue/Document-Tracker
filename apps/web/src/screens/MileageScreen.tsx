import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { mileageSummary, tripReimbursementCents } from '@domain/business/mileage';
import { formatINR } from '@domain/money';
import { COLORS } from '../theme';
import { Card, HeroCard, Icon, IconChip, SectionLabel, heroText } from '../components/ui';
import type { WebMileageTrip } from '../store';

interface Props {
  mileage: WebMileageTrip[];
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

  function startAdd() {
    setDateISO(TODAY);
    setPurpose('');
    setRoute('');
    setKm('');
    setRate(String(DEFAULT_RATE_RUPEES));
    setAdding(true);
  }

  function save() {
    if (kmNum <= 0 || !route.trim()) return;
    onAdd({
      dateISO,
      purpose: purpose.trim(),
      route: route.trim(),
      km: kmNum,
      ratePaisePerKm,
    });
    setAdding(false);
  }

  const canSave = kmNum > 0 && !!route.trim();

  if (adding) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => setAdding(false)} hitSlop={8}>
            <Icon name="chevron" color={COLORS.text} size={22} strokeWidth={2.4} />
          </Pressable>
          <Text style={styles.headerTitle}>Log trip</Text>
          <View style={{ width: 22 }} />
        </View>

        <Card style={{ marginTop: 12 }}>
          <Text style={styles.label}>Date</Text>
          <TextInput style={styles.input} value={dateISO} onChangeText={setDateISO} placeholder="YYYY-MM-DD" />

          <Text style={styles.label}>Purpose</Text>
          <TextInput
            style={styles.input}
            value={purpose}
            onChangeText={setPurpose}
            placeholder="Client meeting, site visit…"
          />

          <Text style={styles.label}>Route</Text>
          <TextInput style={styles.input} value={route} onChangeText={setRoute} placeholder="Office → Client site" />

          <View style={styles.row2}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Distance (km)</Text>
              <TextInput style={styles.input} value={km} onChangeText={setKm} keyboardType="decimal-pad" placeholder="0" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Rate (₹/km)</Text>
              <TextInput
                style={styles.input}
                value={rate}
                onChangeText={setRate}
                keyboardType="decimal-pad"
                placeholder="12"
              />
            </View>
          </View>
        </Card>

        <Card style={{ marginTop: 14 }}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Distance</Text>
            <Text style={styles.totalValue}>{kmNum.toFixed(1)} km</Text>
          </View>
          <View style={[styles.totalRow, { marginTop: 4 }]}>
            <Text style={styles.totalLabelBig}>Reimbursement</Text>
            <Text style={styles.totalValueBig}>{formatINR(liveReimbursement)}</Text>
          </View>
        </Card>

        <Pressable style={[styles.primary, !canSave && styles.primaryDisabled]} onPress={save} disabled={!canSave}>
          <Text style={styles.primaryText}>Save trip</Text>
        </Pressable>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      <HeroCard>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <IconChip name="truck" bg="rgba(255,255,255,0.15)" fg="#fff" size={38} />
          <View>
            <Text style={heroText.cap}>Total reimbursement</Text>
            <Text style={heroText.money}>{formatINR(summary.totalCents)}</Text>
          </View>
        </View>
        <Text style={heroText.sub}>
          {summary.totalKm.toFixed(1)} km across {summary.tripCount} trip{summary.tripCount === 1 ? '' : 's'}
        </Text>
      </HeroCard>

      <Pressable style={styles.primary} onPress={startAdd}>
        <Icon name="plus" color="#fff" size={18} />
        <Text style={styles.primaryText}>Log trip</Text>
      </Pressable>

      <SectionLabel>Trips</SectionLabel>
      {sorted.length === 0 ? (
        <Card><Text style={styles.empty}>No trips logged yet.</Text></Card>
      ) : (
        sorted.map((t) => {
          const reimb = tripReimbursementCents(t.km, t.ratePaisePerKm);
          return (
            <Card key={t.id} style={{ marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                <IconChip name="mapPin" bg={COLORS.accentSoft} fg={COLORS.primary} size={38} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.tripRoute}>{t.route}</Text>
                  <Text style={styles.tripMeta}>
                    {t.purpose ? `${t.purpose} · ` : ''}
                    {t.dateISO}
                  </Text>
                </View>
                <Pressable onPress={() => onDelete(t.id)} hitSlop={8}>
                  <Icon name="trash" color={COLORS.danger} size={17} />
                </Pressable>
              </View>
              <View style={styles.tripFooter}>
                <Text style={styles.tripKm}>{t.km.toFixed(1)} km</Text>
                <Text style={styles.tripReimb}>{formatINR(reimb)}</Text>
              </View>
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
  row2: { flexDirection: 'row', gap: 10 },
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
  tripRoute: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  tripMeta: { fontSize: 12, color: COLORS.subtext, marginTop: 2 },
  tripFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  tripKm: { fontSize: 13, color: COLORS.subtext, fontWeight: '600' },
  tripReimb: { fontSize: 16, fontWeight: '800', color: COLORS.text },
});
