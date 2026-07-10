import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { computeNetBalances, simplifyDebts } from '@domain/settleup/simplify';
import { buildSettleUpLink } from '@domain/settleup/deeplinks';
import { formatINR, toCents } from '@domain/money';
import { COLORS } from '../theme';
import { Card, HeroCard, Icon, IconChip, SectionLabel, StatusPill, heroText } from '../components/ui';
import type { WebDocument, WebExpense, WebGroup, WebSettlement } from '../store';
import ExpenseForm, { type ExpenseFormData } from './ExpenseForm';

interface Props {
  group: WebGroup;
  expenses: WebExpense[];
  settlements: WebSettlement[];
  receiptDocs: WebDocument[];
  prefillReceipt?: WebDocument | null;
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
  prefillReceipt,
  onAddExpense,
  onUpdateExpense,
  onDeleteExpense,
  onRecordSettlement,
}: Props) {
  const nameOf = (id: string) => group.members.find((m) => m.id === id)?.name ?? id;

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

  const [mode, setMode] = useState<'view' | 'add' | 'edit'>(prefillReceipt ? 'add' : 'view');
  const [pendingPrefill, setPendingPrefill] = useState<WebDocument | null>(prefillReceipt ?? null);
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
          prefillReceipt={mode === 'add' ? pendingPrefill : null}
          onSubmit={(data) => {
            if (mode === 'edit' && editId) onUpdateExpense(editId, data);
            else onAddExpense(data);
            setMode('view');
            setEditId(null);
            setPendingPrefill(null);
          }}
          onCancel={() => {
            setMode('view');
            setEditId(null);
            setPendingPrefill(null);
          }}
        />
      </ScrollView>
    );
  }

  const detail = detailId ? expenses.find((e) => e.id === detailId) : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      <HeroCard>
        <Text style={heroText.cap}>Your balance in this group</Text>
        <Text style={[heroText.money, { color: youNet > 0 ? '#6ee7a8' : youNet < 0 ? '#fca5a5' : '#fff' }]}>
          {youNet < 0 ? '-' : ''}{formatINR(Math.abs(youNet))}
        </Text>
        <Text style={heroText.sub}>
          {youNet === 0 ? "You're all settled up" : youNet > 0 ? 'You are owed' : 'You owe'}
        </Text>
      </HeroCard>

      <View style={styles.actionRow}>
        <Pressable style={styles.primary} onPress={() => setMode('add')}>
          <Icon name="plus" color="#fff" size={18} />
          <Text style={styles.primaryText}>Add expense</Text>
        </Pressable>
        <Pressable style={styles.secondary} onPress={() => setSettleOpen((s) => !s)}>
          <Text style={styles.secondaryText}>Settle up</Text>
        </Pressable>
      </View>

      <SectionLabel>Balances</SectionLabel>
      <Card>
        {balances.map((b, i) => (
          <View key={b.userId} style={[styles.balRow, i > 0 && styles.divider]}>
            <Text style={styles.balName}>{nameOf(b.userId)}</Text>
            <Text style={[styles.balNet, { color: b.net > 0 ? COLORS.good : b.net < 0 ? COLORS.danger : COLORS.subtext }]}>
              {b.net === 0 ? 'settled' : b.net > 0 ? `gets ${formatINR(b.net)}` : `owes ${formatINR(-b.net)}`}
            </Text>
          </View>
        ))}
      </Card>

      {settleOpen && (
        <Card style={{ marginTop: 12 }}>
          <SectionLabel style={{ marginTop: 0 } as object}>Suggested · fewest transfers</SectionLabel>
          {transfers.length === 0 ? (
            <Text style={styles.empty}>Everyone is settled.</Text>
          ) : (
            transfers.map((t, i) => {
              const toMember = group.members.find((m) => m.id === t.to);
              const upiLink = toMember?.upi
                ? buildSettleUpLink({ provider: 'upi', vpa: toMember.upi, payeeName: toMember.name }, { amount: t.amount, note: group.name })
                : null;
              const openLink = (url: string) => { try { window.open(url, '_blank'); } catch { /* no-op */ } };
              return (
                <View key={i} style={styles.settle}>
                  <Text style={styles.settleText}>
                    {nameOf(t.from)} → {nameOf(t.to)} <Text style={styles.bold}>{formatINR(t.amount)}</Text>
                  </Text>
                  <View style={styles.settleBtns}>
                    {upiLink ? (
                      <Pressable style={styles.upi} onPress={() => openLink(upiLink)}>
                        <Text style={styles.upiText}>Pay via UPI</Text>
                      </Pressable>
                    ) : null}
                    <Pressable style={styles.markBtn} onPress={() => onRecordSettlement({ groupId: group.id, fromUser: t.from, toUser: t.to, amount: t.amount })}>
                      <Text style={styles.markText}>Mark settled</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })
          )}
          <SectionLabel>Record a payment</SectionLabel>
          <View style={styles.payRow}>
            <MemberPicker members={group.members} value={sFrom} onChange={setSFrom} />
            <Text style={styles.arrow}>→</Text>
            <MemberPicker members={group.members} value={sTo} onChange={setSTo} />
          </View>
          <View style={styles.payAmountRow}>
            <TextInput style={styles.payInput} value={sAmount} onChangeText={setSAmount} placeholder="₹ amount" keyboardType="decimal-pad" />
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
        </Card>
      )}

      {detail && (
        <Card style={{ marginTop: 12, backgroundColor: COLORS.accentSoft, borderColor: COLORS.accentSoft }}>
          <Text style={styles.detailTitle}>{detail.description}</Text>
          <Text style={styles.detailMeta}>{formatINR(detail.totalCents)} · {detail.dateISO} · {detail.category}</Text>
          <Text style={styles.detailMeta}>Paid by {detail.payers.map((p) => `${nameOf(p.userId)} ${formatINR(p.cents)}`).join(', ')}</Text>
          <Text style={styles.detailMeta}>Split {detail.splitType} among {detail.involvedIds.length}:</Text>
          {detail.allocations.map((a) => (
            <Text key={a.userId} style={styles.detailAlloc}>• {nameOf(a.userId)} owes {formatINR(a.cents)}</Text>
          ))}
          {detail.notes ? <Text style={styles.detailNotes}>“{detail.notes}”</Text> : null}
          <View style={styles.detailBtns}>
            <Pressable style={styles.editBtn} onPress={() => { setEditId(detail.id); setDetailId(null); setMode('edit'); }}>
              <Icon name="edit" color="#fff" size={15} /><Text style={styles.editText}>Edit</Text>
            </Pressable>
            <Pressable style={styles.deleteBtn} onPress={() => { onDeleteExpense(detail.id); setDetailId(null); }}>
              <Icon name="trash" color="#fff" size={15} /><Text style={styles.deleteText}>Delete</Text>
            </Pressable>
            <Pressable style={styles.closeBtn} onPress={() => setDetailId(null)}><Text style={styles.closeText}>Close</Text></Pressable>
          </View>
        </Card>
      )}

      <SectionLabel>Activity</SectionLabel>
      <Card>
        {feed.length === 0 ? (
          <Text style={styles.empty}>No activity yet.</Text>
        ) : (
          feed.map((item, i) => {
            if (item.kind === 'settlement' && item.set) {
              const s = item.set;
              return (
                <View key={`s${i}`} style={[styles.feedRow, i > 0 && styles.divider]}>
                  <IconChip name="check" bg={COLORS.incomeSoft} fg={COLORS.good} size={36} />
                  <Text style={[styles.feedText, { flex: 1, marginLeft: 12 }]}>
                    {nameOf(s.fromUser)} paid {nameOf(s.toUser)} <Text style={styles.bold}>{formatINR(s.amount)}</Text>
                  </Text>
                </View>
              );
            }
            const e = item.exp!;
            const yourShare = e.allocations.find((a) => a.userId === 'u_you')?.cents ?? 0;
            return (
              <Pressable key={e.id} style={[styles.feedRow, i > 0 && styles.divider]} onPress={() => setDetailId(e.id)}>
                <IconChip name={e.sourceDocumentId ? 'receipt' : 'tag'} bg={COLORS.accentSoft} fg={COLORS.primary} size={36} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.feedText}>{e.description}{e.sourceDocumentId ? '  📎' : ''}</Text>
                  <Text style={styles.feedMeta}>
                    {nameOf(e.payers[0]?.userId ?? '')}{e.payers.length > 1 ? ' +' : ''} paid {formatINR(e.totalCents)}
                    {yourShare > 0 ? ` · you owe ${formatINR(yourShare)}` : ''}
                  </Text>
                </View>
                <Text style={styles.feedAmt}>{formatINR(e.totalCents)}</Text>
              </Pressable>
            );
          })
        )}
      </Card>
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
  container: { flex: 1, backgroundColor: COLORS.screenBg },
  scroll: { padding: 16, paddingBottom: 28 },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  primary: { flex: 1, backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 13, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  secondary: { flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  secondaryText: { color: COLORS.text, fontWeight: '700', fontSize: 15 },
  empty: { color: COLORS.subtext },
  balRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 9 },
  divider: { borderTopWidth: 1, borderTopColor: COLORS.border },
  balName: { fontSize: 15, color: COLORS.text, fontWeight: '600' },
  balNet: { fontSize: 14, fontWeight: '700' },
  settle: { backgroundColor: COLORS.screenBg, borderRadius: 10, padding: 12, marginBottom: 8 },
  settleText: { fontSize: 15, color: COLORS.text },
  bold: { fontWeight: '800' },
  settleBtns: { flexDirection: 'row', gap: 8, marginTop: 8 },
  upi: { backgroundColor: '#5f259f', borderRadius: 8, paddingVertical: 7, paddingHorizontal: 14 },
  upiText: { color: '#fff', fontWeight: '700' },
  markBtn: { backgroundColor: COLORS.chip, borderRadius: 8, paddingVertical: 7, paddingHorizontal: 14 },
  markText: { color: COLORS.text, fontWeight: '700' },
  payRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  arrow: { fontSize: 18, color: COLORS.subtext },
  pickerChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, flex: 1 },
  pchip: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 12, backgroundColor: COLORS.chip },
  pchipActive: { backgroundColor: COLORS.primary },
  pchipText: { fontSize: 12, color: COLORS.text, fontWeight: '600' },
  pchipTextActive: { color: '#fff' },
  payAmountRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  payInput: { flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: '#fff' },
  recordBtn: { backgroundColor: COLORS.good, borderRadius: 8, paddingHorizontal: 18, justifyContent: 'center' },
  recordText: { color: '#fff', fontWeight: '700' },
  detailTitle: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  detailMeta: { fontSize: 13, color: COLORS.subtext, marginTop: 4 },
  detailAlloc: { fontSize: 13, color: COLORS.text, marginTop: 2 },
  detailNotes: { fontSize: 13, color: COLORS.text, fontStyle: 'italic', marginTop: 6 },
  detailBtns: { flexDirection: 'row', gap: 8, marginTop: 12 },
  editBtn: { backgroundColor: COLORS.primary, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14, flexDirection: 'row', gap: 6, alignItems: 'center' },
  editText: { color: '#fff', fontWeight: '700' },
  deleteBtn: { backgroundColor: COLORS.danger, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14, flexDirection: 'row', gap: 6, alignItems: 'center' },
  deleteText: { color: '#fff', fontWeight: '700' },
  closeBtn: { backgroundColor: COLORS.chip, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14 },
  closeText: { color: COLORS.text, fontWeight: '700' },
  feedRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11 },
  feedText: { fontSize: 15, color: COLORS.text, fontWeight: '600' },
  feedMeta: { fontSize: 12, color: COLORS.subtext, marginTop: 2 },
  feedAmt: { fontSize: 15, fontWeight: '700', color: COLORS.text },
});
