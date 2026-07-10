import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { computeNetBalances, simplifyDebts } from '@domain/settleup/simplify';
import { buildSettleUpLink } from '@domain/settleup/deeplinks';
import { formatAmount, toCents } from '@domain/money';
import { COLORS } from '../theme';
import { categoryIcon, type WebDocument, type WebExpense, type WebGroup, type WebSettlement } from '../store';
import ExpenseForm, { type ExpenseFormData } from './ExpenseForm';

interface Props {
  group: WebGroup;
  expenses: WebExpense[];
  settlements: WebSettlement[];
  receiptDocs: WebDocument[];
  onAddExpense: (e: ExpenseFormData) => void;
  onUpdateExpense: (id: string, patch: ExpenseFormData) => void;
  onDeleteExpense: (id: string) => void;
  onRecordSettlement: (s: Omit<WebSettlement, 'id' | 'createdAt'>) => void;
}

export default function GroupDetailScreen({
  group,
  expenses,
  settlements,
  receiptDocs,
  onAddExpense,
  onUpdateExpense,
  onDeleteExpense,
  onRecordSettlement,
}: Props) {
  const nameOf = (id: string) => group.members.find((m) => m.id === id)?.name ?? id;
  const venmoOf = (id: string) => {
    const m = group.members.find((x) => x.id === id);
    return m?.venmo ?? (m?.name ?? id).toLowerCase().replace(/\s+/g, '-');
  };

  const { balances, transfers } = useMemo(() => {
    const b = computeNetBalances(
      expenses.map((e) => ({ payers: e.payers, allocations: e.allocations })),
      settlements.map((s) => ({ fromUser: s.fromUser, toUser: s.toUser, amount: s.amount })),
    );
    let t: ReturnType<typeof simplifyDebts> = [];
    try {
      t = simplifyDebts(b);
    } catch {
      t = [];
    }
    return { balances: b, transfers: t };
  }, [expenses, settlements]);

  const youNet = balances.find((b) => b.userId === 'u_you')?.net ?? 0;

  const [mode, setMode] = useState<'view' | 'add' | 'edit'>('view');
  const [editId, setEditId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [settleOpen, setSettleOpen] = useState(false);
  const [sFrom, setSFrom] = useState('u_you');
  const [sTo, setSTo] = useState(group.members[1]?.id ?? 'u_you');
  const [sAmount, setSAmount] = useState('');

  const feed = useMemo(() => {
    const items: { kind: 'expense' | 'settlement'; at: number; exp?: WebExpense; set?: WebSettlement }[] = [
      ...expenses.map((e) => ({ kind: 'expense' as const, at: e.createdAt, exp: e })),
      ...settlements.map((s) => ({ kind: 'settlement' as const, at: s.createdAt, set: s })),
    ];
    return items.sort((a, b) => b.at - a.at);
  }, [expenses, settlements]);

  if (mode === 'add' || mode === 'edit') {
    const initial = mode === 'edit' ? expenses.find((e) => e.id === editId) ?? null : null;
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
        <ExpenseForm
          group={group}
          receiptDocs={receiptDocs}
          initial={initial}
          onSubmit={(data) => {
            if (mode === 'edit' && editId) {
              onUpdateExpense(editId, data);
            } else {
              onAddExpense(data);
            }
            setMode('view');
            setEditId(null);
          }}
          onCancel={() => {
            setMode('view');
            setEditId(null);
          }}
        />
      </ScrollView>
    );
  }

  const detail = detailId ? expenses.find((e) => e.id === detailId) : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      <View style={[styles.summary, { borderColor: youNet >= 0 ? COLORS.success : COLORS.danger }]}>
        <Text style={styles.summaryText}>
          {youNet === 0
            ? "You're all settled up"
            : youNet > 0
            ? 'You are owed '
            : 'You owe '}
          {youNet !== 0 ? <Text style={styles.summaryAmt}>${formatAmount(Math.abs(youNet))}</Text> : null}
        </Text>
      </View>

      <View style={styles.balances}>
        {balances.map((b) => (
          <View key={b.userId} style={styles.balRow}>
            <Text style={styles.balName}>{nameOf(b.userId)}</Text>
            <Text style={[styles.balNet, { color: b.net > 0 ? COLORS.success : b.net < 0 ? COLORS.danger : COLORS.subtext }]}>
              {b.net === 0 ? 'settled' : b.net > 0 ? `+$${formatAmount(b.net)}` : `-$${formatAmount(-b.net)}`}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.actionRow}>
        <Pressable style={styles.primary} onPress={() => setMode('add')}>
          <Text style={styles.primaryText}>+ Add expense</Text>
        </Pressable>
        <Pressable style={styles.secondary} onPress={() => setSettleOpen((s) => !s)}>
          <Text style={styles.secondaryText}>Settle up</Text>
        </Pressable>
      </View>

      {settleOpen && (
        <View style={styles.panel}>
          <Text style={styles.section}>Suggested · fewest transfers</Text>
          {transfers.length === 0 ? (
            <Text style={styles.empty}>Everyone is settled.</Text>
          ) : (
            transfers.map((t, i) => {
              const link = buildSettleUpLink(
                { provider: 'venmo', username: venmoOf(t.to) },
                { amount: t.amount, note: group.name },
              );
              return (
                <View key={i} style={styles.settle}>
                  <Text style={styles.settleText}>
                    {nameOf(t.from)} → {nameOf(t.to)} <Text style={styles.bold}>${formatAmount(t.amount)}</Text>
                  </Text>
                  <View style={styles.settleBtns}>
                    <Pressable style={styles.venmo} onPress={() => { try { window.open(link, '_blank'); } catch { /* no-op */ } }}>
                      <Text style={styles.venmoText}>Venmo</Text>
                    </Pressable>
                    <Pressable
                      style={styles.markBtn}
                      onPress={() => onRecordSettlement({ groupId: group.id, fromUser: t.from, toUser: t.to, amount: t.amount })}
                    >
                      <Text style={styles.markText}>Mark settled</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })
          )}

          <Text style={styles.section}>Record a payment</Text>
          <View style={styles.payRow}>
            <MemberPicker members={group.members} value={sFrom} onChange={setSFrom} />
            <Text style={styles.arrow}>→</Text>
            <MemberPicker members={group.members} value={sTo} onChange={setSTo} />
          </View>
          <View style={styles.payAmountRow}>
            <TextInput style={styles.payInput} value={sAmount} onChangeText={setSAmount} placeholder="$ amount" keyboardType="decimal-pad" />
            <Pressable
              style={styles.recordBtn}
              onPress={() => {
                const amt = toCents(Number(sAmount));
                if (sFrom !== sTo && amt > 0) {
                  onRecordSettlement({ groupId: group.id, fromUser: sFrom, toUser: sTo, amount: amt });
                  setSAmount('');
                }
              }}
            >
              <Text style={styles.recordText}>Record</Text>
            </Pressable>
          </View>
        </View>
      )}

      {detail && (
        <View style={styles.detailPanel}>
          <Text style={styles.detailTitle}>
            {categoryIcon(detail.category)} {detail.description}
          </Text>
          <Text style={styles.detailMeta}>
            ${formatAmount(detail.totalCents)} · {detail.dateISO} · {detail.category}
          </Text>
          <Text style={styles.detailMeta}>
            Paid by {detail.payers.map((p) => `${nameOf(p.userId)} $${formatAmount(p.cents)}`).join(', ')}
          </Text>
          <Text style={styles.detailMeta}>Split {detail.splitType} among {detail.involvedIds.length}:</Text>
          {detail.allocations.map((a) => (
            <Text key={a.userId} style={styles.detailAlloc}>
              • {nameOf(a.userId)} owes ${formatAmount(a.cents)}
            </Text>
          ))}
          {detail.notes ? <Text style={styles.detailNotes}>“{detail.notes}”</Text> : null}
          <View style={styles.detailBtns}>
            <Pressable
              style={styles.editBtn}
              onPress={() => {
                setEditId(detail.id);
                setDetailId(null);
                setMode('edit');
              }}
            >
              <Text style={styles.editText}>Edit</Text>
            </Pressable>
            <Pressable
              style={styles.deleteBtn}
              onPress={() => {
                onDeleteExpense(detail.id);
                setDetailId(null);
              }}
            >
              <Text style={styles.deleteText}>Delete</Text>
            </Pressable>
            <Pressable style={styles.closeBtn} onPress={() => setDetailId(null)}>
              <Text style={styles.closeText}>Close</Text>
            </Pressable>
          </View>
        </View>
      )}

      <Text style={styles.section}>Activity</Text>
      {feed.length === 0 ? (
        <Text style={styles.empty}>No activity yet.</Text>
      ) : (
        feed.map((item, i) => {
          if (item.kind === 'settlement' && item.set) {
            const s = item.set;
            return (
              <View key={`s${i}`} style={styles.feedRow}>
                <Text style={styles.feedIcon}>💸</Text>
                <Text style={styles.feedText}>
                  {nameOf(s.fromUser)} paid {nameOf(s.toUser)}{' '}
                  <Text style={styles.bold}>${formatAmount(s.amount)}</Text>
                </Text>
              </View>
            );
          }
          const e = item.exp!;
          const yourShare = e.allocations.find((a) => a.userId === 'u_you')?.cents ?? 0;
          return (
            <Pressable key={e.id} style={styles.feedRow} onPress={() => setDetailId(e.id)}>
              <Text style={styles.feedIcon}>{categoryIcon(e.category)}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.feedText}>
                  {e.description}
                  {e.sourceDocumentId ? ' 📎' : ''}
                </Text>
                <Text style={styles.feedMeta}>
                  {nameOf(e.payers[0]?.userId ?? '')}{e.payers.length > 1 ? ' +' : ''} paid ${formatAmount(e.totalCents)}
                  {yourShare > 0 ? ` · you owe $${formatAmount(yourShare)}` : ''}
                </Text>
              </View>
              <Text style={styles.feedAmt}>${formatAmount(e.totalCents)}</Text>
            </Pressable>
          );
        })
      )}
    </ScrollView>
  );
}

function MemberPicker({ members, value, onChange }: { members: WebGroup['members']; value: string; onChange: (id: string) => void }) {
  return (
    <View style={styles.pickerChips}>
      {members.map((m) => (
        <Pressable key={m.id} style={[styles.pchip, value === m.id && styles.pchipActive]} onPress={() => onChange(m.id)}>
          <Text style={[styles.pchipText, value === m.id && styles.pchipTextActive]}>{m.name}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { padding: 16, paddingBottom: 24 },
  summary: { borderWidth: 2, borderRadius: 12, padding: 14, marginBottom: 12 },
  summaryText: { fontSize: 16, color: COLORS.text, fontWeight: '600' },
  summaryAmt: { fontWeight: '800' },
  balances: { backgroundColor: COLORS.screenBg, borderRadius: 10, padding: 12 },
  balRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  balName: { fontSize: 14, color: COLORS.text, fontWeight: '600' },
  balNet: { fontSize: 14, fontWeight: '700' },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  primary: { flex: 1, backgroundColor: COLORS.primary, borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  secondary: { flex: 1, backgroundColor: COLORS.chip, borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  secondaryText: { color: COLORS.text, fontWeight: '700', fontSize: 15 },
  panel: { backgroundColor: COLORS.screenBg, borderRadius: 12, padding: 12, marginTop: 12 },
  section: { fontSize: 13, fontWeight: '700', color: COLORS.subtext, marginTop: 12, marginBottom: 8, textTransform: 'uppercase' },
  empty: { color: COLORS.subtext },
  settle: { backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 8 },
  settleText: { fontSize: 15, color: COLORS.text },
  bold: { fontWeight: '800' },
  settleBtns: { flexDirection: 'row', gap: 8, marginTop: 8 },
  venmo: { backgroundColor: '#008CFF', borderRadius: 8, paddingVertical: 7, paddingHorizontal: 14 },
  venmoText: { color: '#fff', fontWeight: '700' },
  markBtn: { backgroundColor: COLORS.chip, borderRadius: 8, paddingVertical: 7, paddingHorizontal: 14 },
  markText: { color: COLORS.text, fontWeight: '700' },
  payRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  arrow: { fontSize: 18, color: COLORS.subtext },
  pickerChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, flex: 1 },
  pchip: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 12, backgroundColor: '#e6eaf0' },
  pchipActive: { backgroundColor: COLORS.primary },
  pchipText: { fontSize: 12, color: COLORS.text, fontWeight: '600' },
  pchipTextActive: { color: '#fff' },
  payAmountRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  payInput: { flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: '#fff' },
  recordBtn: { backgroundColor: COLORS.success, borderRadius: 8, paddingHorizontal: 18, justifyContent: 'center' },
  recordText: { color: '#fff', fontWeight: '700' },
  detailPanel: { backgroundColor: '#eef6ff', borderRadius: 12, padding: 14, marginTop: 12 },
  detailTitle: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  detailMeta: { fontSize: 13, color: COLORS.subtext, marginTop: 4 },
  detailAlloc: { fontSize: 13, color: COLORS.text, marginTop: 2 },
  detailNotes: { fontSize: 13, color: COLORS.text, fontStyle: 'italic', marginTop: 6 },
  detailBtns: { flexDirection: 'row', gap: 8, marginTop: 12 },
  editBtn: { backgroundColor: COLORS.primary, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 16 },
  editText: { color: '#fff', fontWeight: '700' },
  deleteBtn: { backgroundColor: COLORS.danger, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 16 },
  deleteText: { color: '#fff', fontWeight: '700' },
  closeBtn: { backgroundColor: COLORS.chip, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 16 },
  closeText: { color: COLORS.text, fontWeight: '700' },
  feedRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: 10 },
  feedIcon: { fontSize: 20 },
  feedText: { fontSize: 15, color: COLORS.text, fontWeight: '600' },
  feedMeta: { fontSize: 12, color: COLORS.subtext, marginTop: 2 },
  feedAmt: { fontSize: 15, fontWeight: '700', color: COLORS.text },
});
