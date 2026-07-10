import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { COLORS } from '../theme';
import { Card, Icon, IconChip, SectionLabel } from '../components/ui';
import type { WebUser } from '../store';

interface Props {
  user: WebUser;
  documentsCount: number;
  trackedCount: number;
  groupsCount: number;
  onSignOut: () => void;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export default function ProfileScreen({ user, documentsCount, trackedCount, groupsCount, onSignOut }: Props) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      <View style={styles.head}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials(user.name)}</Text>
        </View>
        <Text style={styles.name}>{user.name || 'You'}</Text>
        <Text style={styles.email}>{user.email}</Text>
        <View style={styles.planPill}>
          <Text style={styles.planText}>Free plan</Text>
        </View>
      </View>

      <View style={styles.stats}>
        <Stat value={documentsCount} label="Documents" />
        <Stat value={trackedCount} label="Tracked" />
        <Stat value={groupsCount} label="Groups" />
      </View>

      <SectionLabel>Account</SectionLabel>
      <Card>
        <Row icon="receipt" title="OCR usage" value="On-device · unlimited" />
        <Row icon="bell" title="Expiry reminders" value="30 / 15 / 7 / 1 days" divider />
        <Row icon="wallet" title="Currency" value="USD" divider />
      </Card>

      <SectionLabel>About</SectionLabel>
      <Card>
        <Row icon="doc" title="Version" value="Preview 0.1" />
        <Row icon="shield" title="Data" value="Stored on this device" divider />
      </Card>

      <Pressable style={styles.signOut} onPress={onSignOut}>
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
      <Text style={styles.note}>
        Web preview — signing out clears your session; your captured data stays on this device until
        reset.
      </Text>
    </ScrollView>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Row({ icon, title, value, divider }: { icon: React.ComponentProps<typeof IconChip>['name']; title: string; value: string; divider?: boolean }) {
  return (
    <View style={[styles.row, divider && styles.divider]}>
      <IconChip name={icon} bg={COLORS.chip} fg={COLORS.subtext} size={34} />
      <Text style={styles.rowTitle}>{title}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.screenBg },
  scroll: { padding: 16, paddingBottom: 28 },
  head: { alignItems: 'center', paddingVertical: 12 },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 26, fontWeight: '800' },
  name: { fontSize: 20, fontWeight: '800', color: COLORS.text, marginTop: 12 },
  email: { fontSize: 14, color: COLORS.subtext, marginTop: 2 },
  planPill: { marginTop: 10, backgroundColor: COLORS.accentSoft, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 12 },
  planText: { color: COLORS.primary, fontWeight: '700', fontSize: 12 },
  stats: { flexDirection: 'row', gap: 10, marginTop: 12 },
  stat: { flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: '800', color: COLORS.text },
  statLabel: { fontSize: 11, color: COLORS.subtext, marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  divider: { borderTopWidth: 1, borderTopColor: COLORS.border },
  rowTitle: { flex: 1, marginLeft: 12, fontSize: 15, fontWeight: '600', color: COLORS.text },
  rowValue: { fontSize: 13, color: COLORS.subtext },
  signOut: { marginTop: 20, borderWidth: 1, borderColor: COLORS.danger, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  signOutText: { color: COLORS.danger, fontWeight: '700', fontSize: 15 },
  note: { fontSize: 12, color: COLORS.subtext, textAlign: 'center', marginTop: 14, lineHeight: 17 },
});
