import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { computeNetBalances } from '@domain/settleup/simplify';
import { COLORS } from '../theme';
import {
  Avatar,
  AvatarStack,
  BalanceAmount,
  Button,
  Card,
  Field,
  ListRow,
  Pill,
  SectionLabel,
  EmptyState,
} from '../components/ui';
import { ME, newId, type Expense, type Group, type GroupType, type Settlement } from '../store';

interface Props {
  expenses: Expense[];
  groups: Group[];
  settlements: Settlement[];
  onOpenGroup: (groupId: string) => void;
  onCreateGroup: (g: {
    name: string;
    emoji?: string;
    type: GroupType;
    members: { id: string; name: string; upi?: string }[];
  }) => void;
}

const EMOJIS = ['✈️', '🏠', '💑', '🎉', '🍕', '🏔️', '🚗', '💼'];
const TYPES: { key: GroupType; label: string }[] = [
  { key: 'trip', label: 'Trip' },
  { key: 'home', label: 'Home' },
  { key: 'couple', label: 'Couple' },
  { key: 'friends', label: 'Friends' },
  { key: 'other', label: 'Other' },
];

function GroupAvatar({ emoji, name }: { emoji?: string; name: string }) {
  if (emoji) {
    return (
      <View style={styles.groupEmoji}>
        <Text style={{ fontSize: 20 }}>{emoji}</Text>
      </View>
    );
  }
  return <Avatar name={name} size={44} />;
}

function netForGroup(group: Group, expenses: Expense[], settlements: Settlement[]): number {
  const ge = expenses.filter((e) => e.groupId === group.id);
  const gs = settlements.filter((s) => s.groupId === group.id);
  const balances = computeNetBalances(
    ge.map((e) => ({ payers: e.paidBy, allocations: e.allocations })),
    gs.map((s) => ({ fromUser: s.fromUser, toUser: s.toUser, amount: s.amountCents })),
  );
  return balances.find((b) => b.userId === ME)?.net ?? 0;
}

export default function GroupsScreen({ expenses, groups, settlements, onOpenGroup, onCreateGroup }: Props) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState(EMOJIS[0]);
  const [type, setType] = useState<GroupType>('trip');
  const [friendName, setFriendName] = useState('');
  const [friendUpi, setFriendUpi] = useState('');
  const [friends, setFriends] = useState<{ id: string; name: string; upi?: string }[]>([]);

  const overallNet = groups.reduce((sum, g) => sum + netForGroup(g, expenses, settlements), 0);

  function addFriend() {
    const n = friendName.trim();
    if (!n) return;
    setFriends((prev) => [...prev, { id: newId(), name: n, upi: friendUpi.trim() || undefined }]);
    setFriendName('');
    setFriendUpi('');
  }

  function removeFriend(id: string) {
    setFriends((prev) => prev.filter((f) => f.id !== id));
  }

  function resetForm() {
    setCreating(false);
    setName('');
    setEmoji(EMOJIS[0]);
    setType('trip');
    setFriendName('');
    setFriendUpi('');
    setFriends([]);
  }

  function submit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    onCreateGroup({
      name: trimmed,
      emoji,
      type,
      members: [{ id: ME, name: 'You' }, ...friends],
    });
    resetForm();
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      <Card style={styles.hero}>
        <Text style={styles.heroLabel}>Overall, across groups</Text>
        <BalanceAmount cents={overallNet} size={30} showSign={overallNet !== 0} />
        <Text style={styles.heroSub}>
          {overallNet === 0 ? "You're all settled up" : overallNet > 0 ? 'you are owed' : 'you owe'}
        </Text>
      </Card>

      <View style={styles.headerRow}>
        <SectionLabel>Your groups</SectionLabel>
        {!creating && <Button label="New group" onPress={() => setCreating(true)} icon="plus" style={styles.newBtn} />}
      </View>

      {creating && (
        <Card style={{ marginBottom: 14 }}>
          <Field label="Group name" value={name} onChangeText={setName} placeholder="e.g. Goa Trip" />

          <Text style={styles.label}>Emoji</Text>
          <View style={styles.row}>
            {EMOJIS.map((e) => (
              <Pill key={e} label={e} active={emoji === e} onPress={() => setEmoji(e)} />
            ))}
          </View>

          <Text style={styles.label}>Type</Text>
          <View style={styles.row}>
            {TYPES.map((t) => (
              <Pill key={t.key} label={t.label} active={type === t.key} onPress={() => setType(t.key)} />
            ))}
          </View>

          <Text style={styles.label}>Members</Text>
          <View style={styles.memberList}>
            <ListRow avatar={<Avatar name="You" size={34} />} title="You" subtitle="that's you" />
            {friends.map((f) => (
              <ListRow
                key={f.id}
                avatar={<Avatar name={f.name} size={34} />}
                title={f.name}
                subtitle={f.upi || undefined}
                rightTop="Remove"
                onPress={() => removeFriend(f.id)}
              />
            ))}
          </View>

          <View style={styles.addRow}>
            <Field
              value={friendName}
              onChangeText={setFriendName}
              placeholder="Friend's name"
              style={{ flex: 1 }}
            />
          </View>
          <View style={styles.addRow}>
            <Field
              value={friendUpi}
              onChangeText={setFriendUpi}
              placeholder="UPI (optional)"
              style={{ flex: 1 }}
            />
            <Button label="Add" onPress={addFriend} variant="secondary" />
          </View>

          <View style={styles.formActions}>
            <Button label="Create group" onPress={submit} disabled={!name.trim()} style={{ flex: 1 }} />
            <Button label="Cancel" onPress={resetForm} variant="ghost" />
          </View>
        </Card>
      )}

      {groups.length === 0 && !creating ? (
        <EmptyState
          emoji="👥"
          title="No groups yet"
          subtitle="Start a group to split trips, rent, or outings with friends."
          actionLabel="New group"
          onAction={() => setCreating(true)}
        />
      ) : (
        groups.map((g) => {
          const net = netForGroup(g, expenses, settlements);
          return (
            <Card key={g.id} style={{ marginBottom: 10 }} onPress={() => onOpenGroup(g.id)}>
              <ListRow
                avatar={<GroupAvatar emoji={g.emoji} name={g.name} />}
                title={g.name}
                subtitle={`${g.members.length} member${g.members.length === 1 ? '' : 's'}`}
                rightTop={<BalanceAmount cents={net} showSign={net !== 0} />}
                rightBottom={
                  <AvatarStack names={g.members.map((m) => m.name)} size={20} max={4} />
                }
              />
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
  hero: {
    alignItems: 'center',
    paddingVertical: 22,
    marginBottom: 16,
    backgroundColor: COLORS.primarySoft,
  },
  heroLabel: { color: COLORS.subtext, fontWeight: '700', fontSize: 12.5, marginBottom: 6 },
  heroSub: { color: COLORS.subtext, fontSize: 13, marginTop: 4 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  newBtn: { height: 36, paddingHorizontal: 16 },
  label: { color: COLORS.subtext, fontWeight: '700', fontSize: 12.5, marginTop: 10, marginBottom: 6 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  memberList: { marginBottom: 4 },
  addRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-end', marginTop: 8 },
  formActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  groupEmoji: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
