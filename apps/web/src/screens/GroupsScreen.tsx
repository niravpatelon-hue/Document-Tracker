import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { computeNetBalances } from '@domain/settleup/simplify';
import { formatAmount } from '@domain/money';
import { COLORS } from '../theme';
import { newId, type WebExpense, type WebGroup, type WebSettlement } from '../store';

interface Props {
  groups: WebGroup[];
  expenses: WebExpense[];
  settlements: WebSettlement[];
  onOpenGroup: (groupId: string) => void;
  onCreateGroup: (g: Omit<WebGroup, 'id'>) => void;
}

const TYPES: WebGroup['type'][] = ['trip', 'household', 'event', 'other'];

function youNet(group: WebGroup, expenses: WebExpense[], settlements: WebSettlement[]): number {
  const ge = expenses.filter((e) => e.groupId === group.id);
  const gs = settlements.filter((s) => s.groupId === group.id);
  const balances = computeNetBalances(
    ge.map((e) => ({ payers: e.payers, allocations: e.allocations })),
    gs.map((s) => ({ fromUser: s.fromUser, toUser: s.toUser, amount: s.amount })),
  );
  return balances.find((b) => b.userId === 'u_you')?.net ?? 0;
}

export default function GroupsScreen({ groups, expenses, settlements, onOpenGroup, onCreateGroup }: Props) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<WebGroup['type']>('trip');
  const [memberInput, setMemberInput] = useState('');
  const [members, setMembers] = useState<string[]>([]);

  function addMember() {
    const n = memberInput.trim();
    if (n) {
      setMembers((prev) => [...prev, n]);
      setMemberInput('');
    }
  }

  function create() {
    if (!name.trim()) {
      return;
    }
    const mem = [
      { id: 'u_you', name: 'You', venmo: 'you' },
      ...members.map((n) => ({ id: newId(), name: n })),
    ];
    onCreateGroup({ name: name.trim(), type, members: mem });
    setCreating(false);
    setName('');
    setMembers([]);
  }

  const overall = groups.reduce((sum, g) => sum + youNet(g, expenses, settlements), 0);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      <View style={[styles.overall, { borderColor: overall >= 0 ? COLORS.success : COLORS.danger }]}>
        <Text style={styles.overallLabel}>Overall, across all groups</Text>
        <Text style={[styles.overallValue, { color: overall > 0 ? COLORS.success : overall < 0 ? COLORS.danger : COLORS.subtext }]}>
          {overall === 0
            ? "you're settled up"
            : overall > 0
            ? `you are owed $${formatAmount(overall)}`
            : `you owe $${formatAmount(-overall)}`}
        </Text>
      </View>

      {creating ? (
        <View style={styles.panel}>
          <Text style={styles.label}>Group name</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. Ski Trip" />
          <Text style={styles.label}>Type</Text>
          <View style={styles.chips}>
            {TYPES.map((t) => (
              <Pressable key={t} style={[styles.chip, type === t && styles.chipActive]} onPress={() => setType(t)}>
                <Text style={[styles.chipText, type === t && styles.chipTextActive]}>{t}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.label}>Members (you're included)</Text>
          <View style={styles.memberChips}>
            <View style={[styles.memberChip, styles.you]}>
              <Text style={styles.memberChipText}>You</Text>
            </View>
            {members.map((m, i) => (
              <View key={i} style={styles.memberChip}>
                <Text style={styles.memberChipText}>{m}</Text>
              </View>
            ))}
          </View>
          <View style={styles.addRow}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={memberInput}
              onChangeText={setMemberInput}
              placeholder="Add a member's name"
              onSubmitEditing={addMember}
            />
            <Pressable style={styles.addBtn} onPress={addMember}>
              <Text style={styles.addBtnText}>Add</Text>
            </Pressable>
          </View>
          <Pressable style={styles.primary} onPress={create}>
            <Text style={styles.primaryText}>Create group</Text>
          </Pressable>
          <Pressable onPress={() => setCreating(false)}>
            <Text style={styles.cancel}>Cancel</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable style={styles.primary} onPress={() => setCreating(true)}>
          <Text style={styles.primaryText}>+ New group</Text>
        </Pressable>
      )}

      <Text style={styles.section}>Your groups</Text>
      {groups.length === 0 ? (
        <Text style={styles.empty}>No groups yet.</Text>
      ) : (
        groups.map((g) => {
          const net = youNet(g, expenses, settlements);
          return (
            <Pressable key={g.id} style={styles.row} onPress={() => onOpenGroup(g.id)}>
              <View style={{ flex: 1 }}>
                <Text style={styles.groupName}>{g.name}</Text>
                <Text style={styles.groupMeta}>
                  {g.type} · {g.members.length} members
                </Text>
              </View>
              <Text
                style={[
                  styles.net,
                  { color: net > 0 ? COLORS.success : net < 0 ? COLORS.danger : COLORS.subtext },
                ]}
              >
                {net === 0 ? 'settled' : net > 0 ? `+$${formatAmount(net)}` : `-$${formatAmount(-net)}`}
              </Text>
            </Pressable>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { padding: 16, paddingBottom: 24 },
  overall: { borderWidth: 2, borderRadius: 12, padding: 14, marginBottom: 12 },
  overallLabel: { fontSize: 12, color: COLORS.subtext },
  overallValue: { fontSize: 17, fontWeight: '800', marginTop: 3 },
  panel: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, padding: 12, marginBottom: 8 },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.subtext, marginTop: 8, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 9, fontSize: 15, color: COLORS.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, backgroundColor: COLORS.chip },
  chipActive: { backgroundColor: COLORS.primary },
  chipText: { color: COLORS.text, fontWeight: '600', fontSize: 13 },
  chipTextActive: { color: '#fff' },
  memberChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  memberChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, backgroundColor: '#e6eaf0' },
  you: { backgroundColor: '#dbeafe' },
  memberChipText: { fontSize: 12, color: COLORS.text, fontWeight: '600' },
  addRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  addBtn: { backgroundColor: COLORS.chip, borderRadius: 8, paddingHorizontal: 16, justifyContent: 'center' },
  addBtnText: { color: COLORS.text, fontWeight: '700' },
  primary: { backgroundColor: COLORS.primary, borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 10 },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  cancel: { color: COLORS.subtext, textAlign: 'center', marginTop: 12, fontSize: 15 },
  section: { fontSize: 13, fontWeight: '700', color: COLORS.subtext, marginTop: 22, marginBottom: 8, textTransform: 'uppercase' },
  empty: { color: COLORS.subtext },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  groupName: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  groupMeta: { fontSize: 12, color: COLORS.subtext, marginTop: 2 },
  net: { fontSize: 15, fontWeight: '700' },
});
