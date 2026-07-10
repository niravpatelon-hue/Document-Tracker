import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { computeInvoiceTotals, effectiveStatus, receivablesSummary } from '@domain/business/invoicing';
import { formatINR } from '@domain/money';
import { COLORS } from '../theme';
import { Card, HeroCard, Icon, IconChip, SectionLabel, StatusPill, heroText } from '../components/ui';
import {
  GST_RATES,
  newId,
  type BusinessProfile,
  type InvoiceStatus,
  type WebClient,
  type WebInvoice,
  type WebInvoiceItem,
} from '../store';

interface Props {
  invoices: WebInvoice[];
  clients: WebClient[];
  businessProfile: BusinessProfile;
  onCreate: (inv: {
    number: string;
    clientId: string;
    dateISO: string;
    dueDateISO: string;
    items: WebInvoiceItem[];
    status: InvoiceStatus;
    notes?: string;
  }) => void;
  onUpdateStatus: (id: string, status: InvoiceStatus) => void;
  onDelete: (id: string) => void;
  onOpenClients: () => void;
}

const TODAY = new Date().toISOString().slice(0, 10);
const FILTERS: { key: 'all' | InvoiceStatus; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'draft', label: 'Draft' },
  { key: 'sent', label: 'Sent' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'paid', label: 'Paid' },
];

const STATUS_TONE: Record<InvoiceStatus, 'warn' | 'good' | 'info' | 'neutral' | 'danger'> = {
  draft: 'neutral',
  sent: 'info',
  overdue: 'danger',
  paid: 'good',
};

function nextInvoiceNumber(invoices: WebInvoice[]): string {
  let max = 0;
  for (const inv of invoices) {
    const m = /(\d+)\s*$/.exec(inv.number || '');
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `INV-${String(max + 1).padStart(4, '0')}`;
}

function addDaysISO(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

interface DraftLine {
  key: string;
  description: string;
  qty: string;
  rate: string;
  taxRatePct: number;
  hsn: string;
}

function emptyLine(): DraftLine {
  return { key: newId(), description: '', qty: '1', rate: '', taxRatePct: 18, hsn: '' };
}

export default function InvoicesScreen({
  invoices,
  clients,
  businessProfile,
  onCreate,
  onUpdateStatus,
  onDelete,
  onOpenClients,
}: Props) {
  const [filter, setFilter] = useState<'all' | InvoiceStatus>('all');
  const [creating, setCreating] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const [clientId, setClientId] = useState<string>('');
  const [number, setNumber] = useState('');
  const [dateISO, setDateISO] = useState(TODAY);
  const [dueDateISO, setDueDateISO] = useState(addDaysISO(TODAY, 15));
  const [status, setStatus] = useState<InvoiceStatus>('draft');
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()]);

  const summary = useMemo(() => receivablesSummary(invoices, TODAY), [invoices]);

  const clientMap = useMemo(() => {
    const m = new Map<string, WebClient>();
    clients.forEach((c) => m.set(c.id, c));
    return m;
  }, [clients]);

  const filtered = useMemo(() => {
    return invoices
      .filter((inv) => filter === 'all' || effectiveStatus(inv, TODAY) === filter)
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [invoices, filter]);

  const draftItems: WebInvoiceItem[] = lines.map((l) => ({
    description: l.description,
    qty: parseFloat(l.qty) || 0,
    rateCents: Math.round((parseFloat(l.rate) || 0) * 100),
    taxRatePct: l.taxRatePct,
    hsn: l.hsn || undefined,
  }));
  const totals = computeInvoiceTotals(draftItems);

  function startCreate() {
    setClientId(clients[0]?.id ?? '');
    setNumber(nextInvoiceNumber(invoices));
    setDateISO(TODAY);
    setDueDateISO(addDaysISO(TODAY, 15));
    setStatus('draft');
    setLines([emptyLine()]);
    setCreating(true);
  }

  function updateLine(key: string, patch: Partial<DraftLine>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }
  function addLine() {
    setLines((prev) => [...prev, emptyLine()]);
  }
  function removeLine(key: string) {
    setLines((prev) => (prev.length > 1 ? prev.filter((l) => l.key !== key) : prev));
  }

  function save() {
    const validLines = draftItems.filter((it) => it.description.trim() && it.qty > 0);
    if (!clientId || validLines.length === 0) return;
    onCreate({
      number: number.trim() || nextInvoiceNumber(invoices),
      clientId,
      dateISO,
      dueDateISO,
      items: validLines,
      status,
    });
    setCreating(false);
  }

  const canSave = !!clientId && draftItems.some((it) => it.description.trim() && it.qty > 0);

  if (creating) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => setCreating(false)} hitSlop={8}>
            <Icon name="chevron" color={COLORS.text} size={22} strokeWidth={2.4} />
          </Pressable>
          <Text style={styles.headerTitle}>New invoice</Text>
          <View style={{ width: 22 }} />
        </View>

        <Card style={{ marginTop: 12 }}>
          <Text style={styles.label}>Client</Text>
          {clients.length === 0 ? (
            <Text style={styles.empty}>No clients yet.</Text>
          ) : (
            <View style={styles.chips}>
              {clients.map((c) => (
                <Pressable
                  key={c.id}
                  style={[styles.chip, clientId === c.id && styles.chipActive]}
                  onPress={() => setClientId(c.id)}
                >
                  <Text style={[styles.chipText, clientId === c.id && styles.chipTextActive]}>{c.name}</Text>
                </Pressable>
              ))}
            </View>
          )}
          <Pressable onPress={onOpenClients}>
            <Text style={styles.link}>Manage clients</Text>
          </Pressable>

          <Text style={styles.label}>Invoice number</Text>
          <TextInput style={styles.input} value={number} onChangeText={setNumber} placeholder="INV-0001" />

          <View style={styles.row2}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Date</Text>
              <TextInput style={styles.input} value={dateISO} onChangeText={setDateISO} placeholder="YYYY-MM-DD" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Due date</Text>
              <TextInput style={styles.input} value={dueDateISO} onChangeText={setDueDateISO} placeholder="YYYY-MM-DD" />
            </View>
          </View>

          <Text style={styles.label}>Status</Text>
          <View style={styles.chips}>
            {(['draft', 'sent', 'paid'] as InvoiceStatus[]).map((s) => (
              <Pressable key={s} style={[styles.chip, status === s && styles.chipActive]} onPress={() => setStatus(s)}>
                <Text style={[styles.chipText, status === s && styles.chipTextActive]}>{s}</Text>
              </Pressable>
            ))}
          </View>
        </Card>

        <SectionLabel>Line items</SectionLabel>
        {lines.map((l, idx) => (
          <Card key={l.key} style={{ marginBottom: 10 }}>
            <View style={styles.lineHeader}>
              <Text style={styles.lineIndex}>Item {idx + 1}</Text>
              {lines.length > 1 ? (
                <Pressable onPress={() => removeLine(l.key)} hitSlop={8}>
                  <Icon name="trash" color={COLORS.danger} size={16} />
                </Pressable>
              ) : null}
            </View>
            <TextInput
              style={styles.input}
              value={l.description}
              onChangeText={(v) => updateLine(l.key, { description: v })}
              placeholder="Description"
            />
            <View style={styles.row2}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Qty</Text>
                <TextInput
                  style={styles.input}
                  value={l.qty}
                  onChangeText={(v) => updateLine(l.key, { qty: v })}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Rate (₹)</Text>
                <TextInput
                  style={styles.input}
                  value={l.rate}
                  onChangeText={(v) => updateLine(l.key, { rate: v })}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                />
              </View>
            </View>
            <Text style={styles.label}>GST rate</Text>
            <View style={styles.chips}>
              {GST_RATES.map((r) => (
                <Pressable
                  key={r}
                  style={[styles.chip, l.taxRatePct === r && styles.chipActive]}
                  onPress={() => updateLine(l.key, { taxRatePct: r })}
                >
                  <Text style={[styles.chipText, l.taxRatePct === r && styles.chipTextActive]}>{r}%</Text>
                </Pressable>
              ))}
            </View>
          </Card>
        ))}
        <Pressable style={styles.addLineBtn} onPress={addLine}>
          <Icon name="plus" color={COLORS.primary} size={16} />
          <Text style={styles.addLineText}>Add line item</Text>
        </Pressable>

        <Card style={{ marginTop: 14 }}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalValue}>{formatINR(totals.subtotalCents)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Tax</Text>
            <Text style={styles.totalValue}>{formatINR(totals.taxCents)}</Text>
          </View>
          <View style={[styles.totalRow, { marginTop: 4 }]}>
            <Text style={styles.totalLabelBig}>Total</Text>
            <Text style={styles.totalValueBig}>{formatINR(totals.totalCents)}</Text>
          </View>
        </Card>

        <Pressable style={[styles.primary, !canSave && styles.primaryDisabled]} onPress={save} disabled={!canSave}>
          <Text style={styles.primaryText}>Save invoice</Text>
        </Pressable>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      <HeroCard>
        <Text style={heroText.cap}>Outstanding</Text>
        <Text style={heroText.money}>{formatINR(summary.outstandingCents)}</Text>
        <View style={styles.heroPills}>
          <StatusPill text={`Overdue ${formatINR(summary.overdueCents)}`} tone="danger" />
          <StatusPill text={`Paid ${formatINR(summary.paidCents)}`} tone="good" />
          <StatusPill text={`Draft ${formatINR(summary.draftCents)}`} tone="neutral" />
        </View>
      </HeroCard>

      <Pressable style={styles.primary} onPress={startCreate}>
        <Icon name="plus" color="#fff" size={18} />
        <Text style={styles.primaryText}>New invoice</Text>
      </Pressable>

      <View style={[styles.chips, { marginTop: 16 }]}>
        {FILTERS.map((f) => (
          <Pressable
            key={f.key}
            style={[styles.chip, filter === f.key && styles.chipActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.chipText, filter === f.key && styles.chipTextActive]}>{f.label}</Text>
          </Pressable>
        ))}
      </View>

      <SectionLabel>Invoices</SectionLabel>
      {filtered.length === 0 ? (
        <Card><Text style={styles.empty}>No invoices in this filter.</Text></Card>
      ) : (
        filtered.map((inv) => {
          const eff = effectiveStatus(inv, TODAY);
          const total = computeInvoiceTotals(inv.items).totalCents;
          const client = clientMap.get(inv.clientId);
          return (
            <Card key={inv.id} style={{ marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                <IconChip name="fileText" bg={COLORS.accentSoft} fg={COLORS.primary} size={38} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.invNumber}>{inv.number}</Text>
                  <Text style={styles.invMeta}>{client?.name ?? 'Unknown client'} · due {inv.dueDateISO}</Text>
                </View>
                <Pressable onPress={() => setOpenMenuId(openMenuId === inv.id ? null : inv.id)} hitSlop={8}>
                  <Icon name="more" color={COLORS.subtext} size={18} />
                </Pressable>
              </View>
              <View style={styles.invFooter}>
                <Text style={styles.invTotal}>{formatINR(total)}</Text>
                <StatusPill text={eff} tone={STATUS_TONE[eff]} />
              </View>
              {openMenuId === inv.id ? (
                <View style={styles.menu}>
                  {eff !== 'sent' && eff !== 'overdue' ? (
                    <Pressable
                      style={styles.menuItem}
                      onPress={() => {
                        onUpdateStatus(inv.id, 'sent');
                        setOpenMenuId(null);
                      }}
                    >
                      <Icon name="send" color={COLORS.text} size={15} />
                      <Text style={styles.menuText}>Mark sent</Text>
                    </Pressable>
                  ) : null}
                  {eff !== 'paid' ? (
                    <Pressable
                      style={styles.menuItem}
                      onPress={() => {
                        onUpdateStatus(inv.id, 'paid');
                        setOpenMenuId(null);
                      }}
                    >
                      <Icon name="check" color={COLORS.good} size={15} />
                      <Text style={styles.menuText}>Mark paid</Text>
                    </Pressable>
                  ) : null}
                  <Pressable
                    style={styles.menuItem}
                    onPress={() => {
                      onDelete(inv.id);
                      setOpenMenuId(null);
                    }}
                  >
                    <Icon name="trash" color={COLORS.danger} size={15} />
                    <Text style={[styles.menuText, { color: COLORS.danger }]}>Delete</Text>
                  </Pressable>
                </View>
              ) : null}
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
  row2: { flexDirection: 'row', gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, backgroundColor: COLORS.chip },
  chipActive: { backgroundColor: COLORS.primary },
  chipText: { color: COLORS.text, fontWeight: '600', fontSize: 13 },
  chipTextActive: { color: '#fff' },
  link: { color: COLORS.primary, fontWeight: '600', fontSize: 13, marginTop: 8 },
  empty: { color: COLORS.subtext },
  primary: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  primaryDisabled: { opacity: 0.5 },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  lineHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  lineIndex: { fontSize: 12, fontWeight: '700', color: COLORS.subtext },
  addLineBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center', paddingVertical: 8 },
  addLineText: { color: COLORS.primary, fontWeight: '700', fontSize: 13 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  totalLabel: { fontSize: 13, color: COLORS.subtext },
  totalValue: { fontSize: 13, color: COLORS.text, fontWeight: '600' },
  totalLabelBig: { fontSize: 15, color: COLORS.text, fontWeight: '700' },
  totalValueBig: { fontSize: 17, color: COLORS.text, fontWeight: '800' },
  invNumber: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  invMeta: { fontSize: 12, color: COLORS.subtext, marginTop: 2 },
  invFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  invTotal: { fontSize: 15, fontWeight: '800', color: COLORS.text },
  menu: { marginTop: 10, borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 8, gap: 4 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  menuText: { fontSize: 13, fontWeight: '600', color: COLORS.text },
});
