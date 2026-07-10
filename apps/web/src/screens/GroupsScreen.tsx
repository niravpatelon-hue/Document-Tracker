import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { computeNetBalances } from '@domain/settleup/simplify';
import { formatINR } from '@domain/money';
import { COLORS } from '../theme';
import { Card, HeroCard, Icon, IconChip, SectionLabel, StatusPill, heroText } from '../components/ui';
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
    if (!name.trim()) return;
    const mem = [{ id: 'u_you', name: 'You', venmo: 'you' }, ...members.map((n) => ({ id: newId(), name: n }))];
    onCreateGroup({ name: name.trim(), type, members: mem });
    setCreating(false);
    setName('');
    setMembers([]);
  }

  const overall = groups.reduce((sum, g) => sum + youNet(g, expenses, settlements), 0);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      <HeroCard>
        <Text style={heroText.cap}>Across all groups</Text>
        <Text style={[heroText.money, { color: overall > 0 ? '#6ee7a8' : overall < 0 ? '#fca5a5' : '#fff' }]}>
          {overall < 0 ? '-' : ''}{formatINR(Math.abs(overall))}
        </Text>
        <Text style={heroText.sub}>
          {overall === 0 ? "You're all settled up" : overall > 0 ? 'You are owed overall' : 'You owe overall'}
        </Text>
      </HeroCard>

      {creating ? (
        <Card style={{ marginTop: 14 }}>
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
            <View style={[styles.memberChip, styles.you]}><Text style={styles.memberChipText}>You</Text></View>
            {members.map((m, i) => (
              <View key={i} style={styles.memberChip}><Text style={styles.memberChipText}>{m}</Text></View>
            ))}
          </View>
          <View style={styles.addRow}>
            <TextInput style={[styles.input, { flex: 1 }]} value={memberInput} onChangeText={setMemberInput} placeholder="Add a member's name" onSubmitEditing={addMember} />
            <Pressable style={styles.addBtn} onPress={addMember}><Text style={styles.addBtnText}>Add</Text></Pressable>
          </View>
          <Pressable style={styles.primary} onPress={create}><Text style={styles.primaryText}>Create group</Text></Pressable>
          <Pressable onPress={() => setCreating(false)}><Text style={styles.cancel}>Cancel</Text></Pressable>
        </Card>
      ) : (
        <Pressable style={styles.primary} onPress={() => setCreating(true)}>
          <Icon name="plus" color="#fff" size={18} />
          <Text style={styles.primaryText}>New group</Text>
        </Pressable>
      )}

      <SectionLabel>Your groups</SectionLabel>
      {groups.length === 0 ? (
        <Card><Text style={styles.empty}>No groups yet.</Text></Card>
      ) : (
        groups.map((g) => {
          const net = youNet(g, expenses, settlements);
          return (
            <Pressable key={g.id} onPress={() => onOpenGroup(g.id)}>
              <Card style={{ marginBottom: 10, flexDirection: 'row', alignItems: 'center' }}>
                <IconChip name="users" bg={COLORS.accentSoft} fg={COLORS.primary} size={40} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.groupName}>{g.name}</Text>
                  <Text style={styles.groupMeta}>{g.type} · {g.members.length} members</Text>
                </View>
                <StatusPill
                  text={net === 0 ? 'settled' : net > 0 ? `+${formatINR(net)}` : `-${formatINR(-net)}`}
                  tone={net > 0 ? 'good' : net < 0 ? 'danger' : 'neutral'}
                />
              </Card>
            </Pressable>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.screenBg },
  scroll: { padding: 16, paddingBottom: 28 },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.subtext, marginTop: 8, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 9, fontSize: 15, color: COLORS.text, backgroundColor: '#fff' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, backgroundColor: COLORS.chip },
  chipActive: { backgroundColor: COLORS.primary },
  chipText: { color: COLORS.text, fontWeight: '600', fontSize: 13 },
  chipTextActive: { color: '#fff' },
  memberChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  memberChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, backgroundColor: COLORS.chip },
  you: { backgroundColor: COLORS.accentSoft },
  memberChipText: { fontSize: 12, color: COLORS.text, fontWeight: '600' },
  addRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  addBtn: { backgroundColor: COLORS.chip, borderRadius: 8, paddingHorizontal: 16, justifyContent: 'center' },
  addBtnText: { color: COLORS.text, fontWeight: '700' },
  primary: { backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, marginTop: 14 },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  cancel: { color: COLORS.subtext, textAlign: 'center', marginTop: 12, fontSize: 15 },
  empty: { color: COLORS.subtext },
  groupName: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  groupMeta: { fontSize: 12, color: COLORS.subtext, marginTop: 2 },
});
