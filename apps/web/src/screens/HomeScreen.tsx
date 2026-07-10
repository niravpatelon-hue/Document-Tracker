import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { formatINRCompact, formatINRShort } from '@domain/money';
import {
  classifySpendCategory,
  monthKeyOf,
  previousMonth,
  spendByCategory,
  type SpendTxn,
} from '@domain/analytics/spend';
import {
  computeInvoiceTotals,
  effectiveStatus,
  receivablesSummary,
} from '@domain/business/invoicing';
import { summarizeGst, type GstEntry } from '@domain/business/gst';
import { mileageSummary } from '@domain/business/mileage';
import { COLORS } from '../theme';
import {
  Avatar,
  Card,
  CreditCard,
  Gauge,
  HeroCard,
  Icon,
  IconChip,
  ProgressBar,
  SectionLabel,
  SegmentBar,
  StatusPill,
  WeeklyBarChart,
  heroText,
  type IconName,
} from '../components/ui';
import type {
  BusinessProfile,
  WebBusinessExpense,
  WebClient,
  WebDocument,
  WebGroup,
  WebIncome,
  WebInvoice,
  WebMileageTrip,
  WebTransaction,
} from '../store';

interface Props {
  mode: 'personal' | 'business';
  userName: string | null;
  // personal data
  transactions: WebTransaction[]; // paise expenses
  incomes: WebIncome[];
  documents: WebDocument[];
  groups: WebGroup[];
  // business data
  invoices: WebInvoice[];
  clients: WebClient[];
  businessExpenses: WebBusinessExpense[];
  mileage: WebMileageTrip[];
  businessProfile: BusinessProfile;
  // navigation callbacks
  onScan: () => void;
  onOpenSpending: () => void;
  onOpenReceipts: () => void;
  onOpenTracked: () => void;
  onOpenGroups: () => void;
  onOpenInvoices: () => void;
  onOpenGST: () => void;
  onOpenClients: () => void;
  onOpenMileage: () => void;
}

/** Rotating palette for category / rate segment bars (blue-led, on-brand). */
const CAT_COLORS = [
  COLORS.primary,
  COLORS.primaryMid,
  COLORS.sky,
  COLORS.savings,
  COLORS.expense,
  COLORS.info,
  '#8b5cf6',
  '#0ea5e9',
];

const PERSONAL_LIMIT_PAISE = 10000000; // ₹1,00,000 monthly spending limit

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Seven days of the current week (Mon→Sun) with short weekday labels. */
function weekDays(today: string): { iso: string; label: string }[] {
  const base = new Date(`${today}T00:00:00`);
  const dow = (base.getDay() + 6) % 7; // Monday = 0
  const monday = new Date(base);
  monday.setDate(base.getDate() - dow);
  const labels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const out: { iso: string; label: string }[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    out.push({ iso: d.toISOString().slice(0, 10), label: labels[i]! });
  }
  return out;
}

function pctDelta(current: number, previous: number): number | null {
  return previous > 0 ? ((current - previous) / previous) * 100 : null;
}

function shortDate(iso: string): string {
  try {
    return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}

/** Small delta pill for a hero card (green up when good). */
function DeltaPill({ deltaPct, goodWhenUp }: { deltaPct: number | null; goodWhenUp: boolean }) {
  if (deltaPct == null) return null;
  const up = deltaPct >= 0;
  const good = up === goodWhenUp;
  const bg = good ? 'rgba(110,231,168,0.16)' : 'rgba(248,180,120,0.18)';
  const fg = good ? '#6ee7a8' : '#f8b478';
  return (
    <View style={{ backgroundColor: bg, borderRadius: 999, paddingVertical: 3, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', gap: 3 }}>
      <Text style={{ color: fg, fontSize: 12, fontWeight: '800' }}>{up ? '▲' : '▼'}</Text>
      <Text style={{ color: fg, fontSize: 12, fontWeight: '700' }}>{Math.abs(Math.round(deltaPct))}%</Text>
    </View>
  );
}

/** Legend chip row (colored dot + label). */
function Legend({ items }: { items: { color: string; label: string }[] }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 12 }}>
      {items.map((it, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 9, height: 9, borderRadius: 3, backgroundColor: it.color }} />
          <Text style={{ color: 'rgba(255,255,255,0.82)', fontSize: 11.5, fontWeight: '600' }}>{it.label}</Text>
        </View>
      ))}
    </View>
  );
}

/** A compact KPI card used in the stat row. */
function StatCard({
  label,
  value,
  deltaPct,
  goodWhenUp,
  tone,
}: {
  label: string;
  value: string;
  deltaPct?: number | null;
  goodWhenUp?: boolean;
  tone?: 'warn';
}) {
  const showDelta = deltaPct != null && goodWhenUp !== undefined;
  const up = (deltaPct ?? 0) >= 0;
  const good = up === goodWhenUp;
  const deltaColor = good ? COLORS.income : COLORS.expense;
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[styles.statValue, tone === 'warn' && { color: COLORS.warnText }]} numberOfLines={1}>
        {value}
      </Text>
      {showDelta ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 }}>
          <Icon name={up ? 'arrowUp' : 'arrowDown'} color={deltaColor} size={13} strokeWidth={2.4} />
          <Text style={{ color: deltaColor, fontSize: 11, fontWeight: '700' }}>{Math.abs(Math.round(deltaPct))}%</Text>
        </View>
      ) : (
        <View style={{ height: 17 }} />
      )}
    </View>
  );
}

/** Round quick-action button with a caption. */
function QuickCircle({ icon, label, onPress }: { icon: IconName; label: string; onPress?: () => void }) {
  return (
    <Pressable style={{ alignItems: 'center', gap: 6, flex: 1 }} onPress={onPress}>
      <View style={styles.quickCircle}>
        <Icon name={icon} color={COLORS.primary} size={20} />
      </View>
      <Text style={styles.quickLabel} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function Header({ firstName, right, onBell }: { firstName: string; right: string; onBell?: () => void }) {
  return (
    <View style={styles.top}>
      <Text style={styles.hi} numberOfLines={1}>
        Hi {firstName} <Text style={styles.hiMuted}>· {right}</Text>
      </Text>
      <Pressable onPress={onBell}>
        <IconChip name="bell" bg="#eaeef6" fg="#334155" size={36} />
      </Pressable>
    </View>
  );
}

export default function HomeScreen(props: Props) {
  const {
    mode,
    userName,
    transactions,
    incomes,
    groups,
    invoices,
    clients,
    businessExpenses,
    mileage,
    businessProfile,
    onOpenSpending,
    onOpenGroups,
    onOpenInvoices,
    onOpenGST,
    onOpenClients,
    onOpenMileage,
  } = props;

  const today = todayISO();
  const month = monthKeyOf(today);
  const prevMonth = previousMonth(month);
  const monthLabel = new Date(`${today}T00:00:00`).toLocaleDateString('en-US', { month: 'long' });
  const firstName = userName ? userName.trim().split(/\s+/)[0] || 'there' : 'there';
  const week = useMemo(() => weekDays(today), [today]);

  /* ------------------------------ PERSONAL ------------------------------ */
  const personal = useMemo(() => {
    const agg = (mk: string) => {
      const exp = transactions.filter((t) => monthKeyOf(t.dateISO) === mk).reduce((s, t) => s + t.amount, 0);
      const incs = incomes.filter((i) => monthKeyOf(i.dateISO) === mk);
      const inc = incs.reduce((s, i) => s + i.amountCents, 0);
      const saved = incs.reduce((s, i) => s + (i.savedCents ?? 0), 0);
      return { exp, inc, saved, balance: inc - exp };
    };
    const cur = agg(month);
    const prev = agg(prevMonth);

    const chartDays = week.map((d) => {
      const exp = transactions.filter((t) => t.dateISO === d.iso).reduce((s, t) => s + t.amount, 0);
      const dayInc = incomes.filter((i) => i.dateISO === d.iso);
      const inc = dayInc.reduce((s, i) => s + i.amountCents, 0);
      const saved = dayInc.reduce((s, i) => s + (i.savedCents ?? 0), 0);
      return {
        label: d.label,
        segments: [
          { value: saved, color: COLORS.savings },
          { value: inc, color: COLORS.income },
          { value: exp, color: COLORS.expense },
        ],
      };
    });

    const monthSpend: SpendTxn[] = transactions
      .filter((t) => monthKeyOf(t.dateISO) === month)
      .map((t) => ({ amount: t.amount, category: classifySpendCategory(t.vendor), dateISO: t.dateISO, vendor: t.vendor }));
    const catTotals = spendByCategory(monthSpend);
    const catTotal = catTotals.reduce((s, c) => s + c.total, 0);
    const catRows = catTotals.map((c, i) => ({
      category: c.category,
      total: c.total,
      color: CAT_COLORS[i % CAT_COLORS.length]!,
      pct: catTotal > 0 ? (c.total / catTotal) * 100 : 0,
    }));

    const savingsRate = cur.inc > 0 ? (cur.saved / cur.inc) * 100 : 0;

    // Goal tracker: fill goals in order from the total saved pool.
    const savedPool = incomes.reduce((s, i) => s + (i.savedCents ?? 0), 0);
    const goalDefs = [
      { name: 'Emergency fund', target: 20000000, color: COLORS.primary },
      { name: 'Goa trip', target: 8000000, color: COLORS.savings },
      { name: 'New laptop', target: 12000000, color: COLORS.primaryMid },
    ];
    let remaining = savedPool;
    const goals = goalDefs.map((g) => {
      const current = Math.max(0, Math.min(g.target, remaining));
      remaining = Math.max(0, remaining - g.target);
      return { ...g, current, pct: (current / g.target) * 100 };
    });

    const recent = [...transactions].sort((a, b) => (a.dateISO < b.dateISO ? 1 : a.dateISO > b.dateISO ? -1 : 0)).slice(0, 6);

    return { cur, prev, chartDays, catRows, catTotal, savingsRate, goals, recent };
  }, [transactions, incomes, month, prevMonth, week]);

  /* ------------------------------ BUSINESS ------------------------------ */
  const business = useMemo(() => {
    const revenueThisMonth = invoices
      .filter((inv) => monthKeyOf(inv.dateISO) === month && effectiveStatus(inv, today) === 'paid')
      .reduce((s, inv) => s + computeInvoiceTotals(inv.items).totalCents, 0);
    const revenuePrevMonth = invoices
      .filter((inv) => monthKeyOf(inv.dateISO) === prevMonth && effectiveStatus(inv, today) === 'paid')
      .reduce((s, inv) => s + computeInvoiceTotals(inv.items).totalCents, 0);

    const chartDays = week.map((d) => {
      const rev = invoices
        .filter((inv) => inv.dateISO === d.iso && effectiveStatus(inv, today) === 'paid')
        .reduce((s, inv) => s + computeInvoiceTotals(inv.items).totalCents, 0);
      const exp = businessExpenses
        .filter((e) => e.dateISO === d.iso)
        .reduce((s, e) => s + e.amountCents + e.gstCents, 0);
      return {
        label: d.label,
        segments: [
          { value: rev, color: COLORS.income },
          { value: exp, color: COLORS.expense },
        ],
      };
    });

    const receivables = receivablesSummary(
      invoices.map((inv) => ({ status: inv.status, dueDateISO: inv.dueDateISO, items: inv.items })),
      today,
    );

    // GST: expenses are input credit, invoice tax is output.
    const gstEntries: GstEntry[] = [];
    for (const e of businessExpenses) {
      gstEntries.push({ direction: 'input', taxableCents: e.amountCents, taxRatePct: e.taxRatePct, gstCents: e.gstCents });
    }
    for (const inv of invoices) {
      for (const br of computeInvoiceTotals(inv.items).byRate) {
        gstEntries.push({ direction: 'output', taxableCents: br.taxableCents, taxRatePct: br.rate, gstCents: br.taxCents });
      }
    }
    const gst = summarizeGst(gstEntries);
    const gstRateRows = gst.byRate
      .filter((r) => r.gstCents > 0)
      .map((r, i) => ({ rate: r.rate, gstCents: r.gstCents, color: CAT_COLORS[i % CAT_COLORS.length]! }));

    const expensesThisMonth = businessExpenses
      .filter((e) => monthKeyOf(e.dateISO) === month)
      .reduce((s, e) => s + e.amountCents + e.gstCents, 0);

    const clientName = new Map(clients.map((c) => [c.id, c.name]));
    const unpaid = invoices
      .map((inv) => ({ inv, eff: effectiveStatus(inv, today), total: computeInvoiceTotals(inv.items).totalCents }))
      .filter((x) => x.eff === 'sent' || x.eff === 'overdue')
      .sort((a, b) => (a.eff === 'overdue' ? -1 : 1) - (b.eff === 'overdue' ? -1 : 1) || b.total - a.total)
      .slice(0, 4)
      .map((x) => ({
        number: x.inv.number,
        client: clientName.get(x.inv.clientId) ?? 'Client',
        total: x.total,
        eff: x.eff,
      }));

    const monthTrips = mileage.filter((t) => monthKeyOf(t.dateISO) === month);
    const mile = mileageSummary(monthTrips.map((t) => ({ km: t.km, ratePaisePerKm: t.ratePaisePerKm, dateISO: t.dateISO })));

    return {
      revenueThisMonth,
      revenuePrevMonth,
      chartDays,
      receivables,
      gst,
      gstRateRows,
      expensesThisMonth,
      unpaid,
      mile,
    };
  }, [invoices, businessExpenses, clients, mileage, month, prevMonth, today, week]);

  /* -------------------------------------------------------------------- */

  if (mode === 'business') {
    const b = business;
    const invTone = (eff: string): 'warn' | 'info' | 'danger' =>
      eff === 'overdue' ? 'danger' : 'info';
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
        <Header firstName={firstName} right={businessProfile.name || 'Business'} />

        <HeroCard>
          <Text style={heroText.cap}>Revenue this month</Text>
          <View style={styles.moneyRow}>
            <Text style={heroText.money}>{formatINRCompact(b.revenueThisMonth)}</Text>
            <DeltaPill deltaPct={pctDelta(b.revenueThisMonth, b.revenuePrevMonth)} goodWhenUp />
          </View>
          <View style={{ marginTop: 14 }}>
            <WeeklyBarChart days={b.chartDays} height={140} />
          </View>
          <Legend
            items={[
              { color: COLORS.income, label: 'Revenue' },
              { color: COLORS.expense, label: 'Expenses' },
            ]}
          />
        </HeroCard>

        <View style={styles.statRow}>
          <StatCard
            label="Receivables"
            value={formatINRCompact(b.receivables.outstandingCents)}
            tone={b.receivables.overdueCents > 0 ? 'warn' : undefined}
          />
          <StatCard label="GST payable" value={formatINRCompact(Math.max(0, b.gst.netPayableCents))} />
          <StatCard label="Expenses" value={formatINRCompact(b.expensesThisMonth)} />
        </View>

        <SectionLabel>Quick actions</SectionLabel>
        <View style={styles.quickRow}>
          <QuickCircle icon="fileText" label="Invoice" onPress={onOpenInvoices} />
          <QuickCircle icon="plus" label="Expense" onPress={onOpenSpending} />
          <QuickCircle icon="truck" label="Log trip" onPress={onOpenMileage} />
          <QuickCircle icon="users" label="Clients" onPress={onOpenClients} />
        </View>

        <SectionLabel>Receivables</SectionLabel>
        <Card>
          {b.unpaid.length === 0 ? (
            <Text style={styles.emptyText}>No outstanding invoices.</Text>
          ) : (
            b.unpaid.map((u, i) => (
              <Pressable
                key={u.number + i}
                onPress={onOpenInvoices}
                style={[styles.listRow, i > 0 && styles.listDivider]}
              >
                <IconChip name="fileText" bg={COLORS.accentSoft} fg={COLORS.primary} size={38} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {u.number}
                  </Text>
                  <Text style={styles.rowSub} numberOfLines={1}>
                    {u.client}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Text style={styles.rowAmount}>{formatINRShort(u.total)}</Text>
                  <StatusPill text={u.eff === 'overdue' ? 'Overdue' : 'Sent'} tone={invTone(u.eff)} />
                </View>
              </Pressable>
            ))
          )}
        </Card>

        <SectionLabel>GST summary</SectionLabel>
        <Pressable onPress={onOpenGST}>
          <Card>
            <View style={styles.gstGrid}>
              <View style={{ flex: 1 }}>
                <Text style={styles.miniLabel}>Output</Text>
                <Text style={styles.miniValue}>{formatINRShort(b.gst.outputGstCents)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.miniLabel}>Input (ITC)</Text>
                <Text style={styles.miniValue}>{formatINRShort(b.gst.inputGstCents)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.miniLabel}>Net payable</Text>
                <Text style={[styles.miniValue, { color: b.gst.netPayableCents >= 0 ? COLORS.text : COLORS.income }]}>
                  {formatINRShort(b.gst.netPayableCents)}
                </Text>
              </View>
            </View>
            {b.gstRateRows.length > 0 ? (
              <>
                <View style={{ marginTop: 12 }}>
                  <SegmentBar segments={b.gstRateRows.map((r) => ({ value: r.gstCents, color: r.color }))} height={10} />
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 10 }}>
                  {b.gstRateRows.map((r) => (
                    <View key={r.rate} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <View style={{ width: 9, height: 9, borderRadius: 3, backgroundColor: r.color }} />
                      <Text style={styles.legendText}>
                        {r.rate}% · {formatINRShort(r.gstCents)}
                      </Text>
                    </View>
                  ))}
                </View>
              </>
            ) : (
              <Text style={[styles.emptyText, { marginTop: 10 }]}>No GST recorded yet.</Text>
            )}
          </Card>
        </Pressable>

        <SectionLabel>Mileage · {monthLabel}</SectionLabel>
        <Pressable onPress={onOpenMileage}>
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <IconChip name="truck" bg={COLORS.accentSoft} fg={COLORS.primary} size={44} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.rowTitle}>{b.mile.totalKm.toLocaleString('en-IN')} km</Text>
                <Text style={styles.rowSub}>
                  {b.mile.tripCount} trip{b.mile.tripCount === 1 ? '' : 's'} this month
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.miniLabel}>Reimbursement</Text>
                <Text style={styles.rowAmount}>{formatINRShort(b.mile.totalCents)}</Text>
              </View>
            </View>
          </Card>
        </Pressable>
      </ScrollView>
    );
  }

  /* ------------------------------- PERSONAL RENDER ------------------------------- */
  const p = personal;
  const balanceDelta = pctDelta(p.cur.balance, p.prev.balance);
  const groupMembers = groups[0]?.members?.map((m) => m.name) ?? [];
  const payees = groupMembers.length ? groupMembers.slice(0, 6) : ['Aarav', 'Diya', 'Kabir', 'Meera', 'Riya'];
  const spentPct = (p.cur.exp / PERSONAL_LIMIT_PAISE) * 100;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      <Header firstName={firstName} right={monthLabel} />

      <HeroCard>
        <Text style={heroText.cap}>Balance this month</Text>
        <View style={styles.moneyRow}>
          <Text style={heroText.money}>{formatINRCompact(p.cur.balance)}</Text>
          <DeltaPill deltaPct={balanceDelta} goodWhenUp />
        </View>
        <View style={{ marginTop: 14 }}>
          <WeeklyBarChart days={p.chartDays} height={150} />
        </View>
        <Legend
          items={[
            { color: COLORS.savings, label: 'Savings' },
            { color: COLORS.income, label: 'Income' },
            { color: COLORS.expense, label: 'Expenses' },
          ]}
        />
      </HeroCard>

      <View style={styles.statRow}>
        <StatCard label="Income" value={formatINRCompact(p.cur.inc)} deltaPct={pctDelta(p.cur.inc, p.prev.inc)} goodWhenUp />
        <StatCard label="Expenses" value={formatINRCompact(p.cur.exp)} deltaPct={pctDelta(p.cur.exp, p.prev.exp)} goodWhenUp={false} />
        <StatCard label="Saved" value={formatINRCompact(p.cur.saved)} deltaPct={pctDelta(p.cur.saved, p.prev.saved)} goodWhenUp />
      </View>

      <SectionLabel>My card</SectionLabel>
      <CreditCard holder={userName || 'Your Name'} last4="7890" expiry="03/30" brand="VISA" />
      <View style={styles.quickRow}>
        <QuickCircle icon="arrowUp" label="Top up" onPress={onOpenSpending} />
        <QuickCircle icon="send" label="Send" onPress={onOpenSpending} />
        <QuickCircle icon="request" label="Request" onPress={onOpenSpending} />
        <QuickCircle icon="clock" label="History" onPress={onOpenSpending} />
        <QuickCircle icon="more" label="More" onPress={onOpenSpending} />
      </View>

      <SectionLabel>Quick payment</SectionLabel>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 16, paddingVertical: 2 }}>
        {payees.map((name, i) => (
          <Pressable key={name + i} onPress={onOpenGroups} style={{ alignItems: 'center', gap: 6, width: 60 }}>
            <Avatar name={name} size={52} />
            <Text style={styles.quickLabel} numberOfLines={1}>
              {name.split(/\s+/)[0]}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <SectionLabel>Monthly spending limit</SectionLabel>
      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
          <Text style={styles.rowTitle}>{formatINRShort(p.cur.exp)}</Text>
          <Text style={styles.rowSub}>of {formatINRShort(PERSONAL_LIMIT_PAISE)}</Text>
        </View>
        <ProgressBar pct={spentPct} color={spentPct >= 100 ? COLORS.danger : COLORS.primary} height={10} />
        <Text style={[styles.rowSub, { marginTop: 8 }]}>
          {spentPct >= 100 ? 'Over your limit' : `${Math.round(Math.max(0, 100 - spentPct))}% remaining`}
        </Text>
      </Card>

      <SectionLabel>Cost analysis · {monthLabel}</SectionLabel>
      <Card>
        <Text style={styles.rowTitle}>{formatINRShort(p.catTotal)}</Text>
        <Text style={[styles.rowSub, { marginBottom: 10 }]}>spent across categories</Text>
        {p.catRows.length === 0 ? (
          <Text style={styles.emptyText}>No spending recorded this month.</Text>
        ) : (
          <>
            <SegmentBar segments={p.catRows.map((c) => ({ value: c.total, color: c.color }))} height={12} />
            <View style={{ marginTop: 12, gap: 8 }}>
              {p.catRows.slice(0, 5).map((c) => (
                <View key={c.category} style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ width: 9, height: 9, borderRadius: 3, backgroundColor: c.color, marginRight: 8 }} />
                  <Text style={[styles.legendText, { flex: 1, color: COLORS.text }]} numberOfLines={1}>
                    {c.category}
                  </Text>
                  <Text style={styles.legendText}>{Math.round(c.pct)}%</Text>
                  <Text style={[styles.rowAmount, { marginLeft: 12, fontSize: 13 }]}>{formatINRShort(c.total)}</Text>
                </View>
              ))}
            </View>
          </>
        )}
      </Card>

      <SectionLabel>Financial health</SectionLabel>
      <Card style={{ alignItems: 'center' }}>
        <Gauge pct={p.savingsRate} size={170} color={COLORS.savings} sublabel="of monthly income saved" />
      </Card>

      <SectionLabel>Goal tracker</SectionLabel>
      <Card style={{ gap: 14 }}>
        {p.goals.map((g) => (
          <View key={g.name}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
              <Text style={styles.goalName}>{g.name}</Text>
              <Text style={styles.rowSub}>
                {formatINRShort(g.current)} / {formatINRShort(g.target)}
              </Text>
            </View>
            <ProgressBar pct={g.pct} color={g.color} height={8} />
          </View>
        ))}
      </Card>

      <View style={styles.historyHeader}>
        <SectionLabel>Transaction history</SectionLabel>
        <Pressable onPress={onOpenSpending}>
          <Text style={styles.link}>See all</Text>
        </Pressable>
      </View>
      <Card>
        {p.recent.length === 0 ? (
          <Text style={styles.emptyText}>No transactions yet.</Text>
        ) : (
          p.recent.map((t, i) => (
            <Pressable key={t.id} onPress={onOpenSpending} style={[styles.listRow, i > 0 && styles.listDivider]}>
              <IconChip name="receipt" bg={COLORS.accentSoft} fg={COLORS.primary} size={38} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {t.vendor}
                </Text>
                <Text style={styles.rowSub}>{shortDate(t.dateISO)}</Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <Text style={[styles.rowAmount, { color: COLORS.expense }]}>−{formatINRShort(t.amount)}</Text>
                <StatusPill text="Completed" tone="good" />
              </View>
            </Pressable>
          ))
        )}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.screenBg },
  scroll: { padding: 16, paddingBottom: 32 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  hi: { fontSize: 18, fontWeight: '800', color: COLORS.text, letterSpacing: -0.2, flex: 1 },
  hiMuted: { color: COLORS.subtext, fontWeight: '600' },
  moneyRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 4 },

  statRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  statCard: { flex: 1, backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, padding: 12 },
  statLabel: { fontSize: 11, color: COLORS.subtext, fontWeight: '600' },
  statValue: { fontSize: 17, fontWeight: '800', color: COLORS.text, marginTop: 4, letterSpacing: -0.3 },

  quickRow: { flexDirection: 'row', gap: 6, marginTop: 14 },
  quickCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: COLORS.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLabel: { fontSize: 11, color: COLORS.subtext, fontWeight: '600' },

  listRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  listDivider: { borderTopWidth: 1, borderTopColor: COLORS.border },
  rowTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  rowSub: { fontSize: 12, color: COLORS.subtext, marginTop: 2 },
  rowAmount: { fontSize: 14, fontWeight: '800', color: COLORS.text },

  gstGrid: { flexDirection: 'row', gap: 8 },
  miniLabel: { fontSize: 11, color: COLORS.subtext, fontWeight: '600' },
  miniValue: { fontSize: 15, fontWeight: '800', color: COLORS.text, marginTop: 3, letterSpacing: -0.2 },

  legendText: { fontSize: 12, color: COLORS.subtext, fontWeight: '600' },
  goalName: { fontSize: 13, fontWeight: '700', color: COLORS.text },

  historyHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  link: { fontSize: 12, fontWeight: '700', color: COLORS.primary, marginTop: 8 },

  emptyText: { fontSize: 13, color: COLORS.subtext, paddingVertical: 6 },
});
