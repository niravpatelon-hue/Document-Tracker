import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { COLORS } from '../theme';
import { Card, Icon, IconChip, SectionLabel } from '../components/ui';
import type { AppMode, BusinessProfile, WebUser } from '../store';

interface Props {
  user: WebUser;
  mode: AppMode;
  onSetMode: (m: AppMode) => void;
  businessProfile: BusinessProfile;
  onSaveBusinessProfile: (p: BusinessProfile) => void;
  documentsCount: number;
  trackedCount: number;
  groupsCount: number;
  invoicesCount: number;
  clientsCount: number;
  onSignOut: () => void;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export default function ProfileScreen({
  user,
  mode,
  onSetMode,
  businessProfile,
  onSaveBusinessProfile,
  documentsCount,
  trackedCount,
  groupsCount,
  invoicesCount,
  clientsCount,
  onSignOut,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(businessProfile.name);
  const [gstin, setGstin] = useState(businessProfile.gstin);
  const [stateName, setStateName] = useState(businessProfile.stateName ?? '');

  const startEdit = () => {
    setName(businessProfile.name);
    setGstin(businessProfile.gstin);
    setStateName(businessProfile.stateName ?? '');
    setEditing(true);
  };

  const save = () => {
    onSaveBusinessProfile({
      name: name.trim(),
      gstin: gstin.trim().toUpperCase(),
      stateName: stateName.trim() || undefined,
    });
    setEditing(false);
  };

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

      <View style={styles.segment}>
        <Pressable
          style={[styles.segmentBtn, mode === 'personal' && styles.segmentBtnActive]}
          onPress={() => onSetMode('personal')}
        >
          <Text style={[styles.segmentText, mode === 'personal' && styles.segmentTextActive]}>Personal</Text>
        </Pressable>
        <Pressable
          style={[styles.segmentBtn, mode === 'business' && styles.segmentBtnActive]}
          onPress={() => onSetMode('business')}
        >
          <Text style={[styles.segmentText, mode === 'business' && styles.segmentTextActive]}>Business</Text>
        </Pressable>
      </View>

      <View style={styles.stats}>
        {mode === 'personal' ? (
          <>
            <Stat value={documentsCount} label="Documents" />
            <Stat value={trackedCount} label="Tracked" />
            <Stat value={groupsCount} label="Groups" />
          </>
        ) : (
          <>
            <Stat value={invoicesCount} label="Invoices" />
            <Stat value={clientsCount} label="Clients" />
            <Stat value={documentsCount} label="Documents" />
          </>
        )}
      </View>

      {mode === 'business' && (
        <>
          <SectionLabel>Business profile</SectionLabel>
          <Card>
            {editing ? (
              <>
                <Text style={styles.label}>Business name</Text>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="Your business name"
                />
                <Text style={styles.label}>GSTIN</Text>
                <TextInput
                  style={styles.input}
                  value={gstin}
                  onChangeText={setGstin}
                  placeholder="22AAAAA0000A1Z5"
                  autoCapitalize="characters"
                />
                <Text style={styles.label}>State</Text>
                <TextInput
                  style={styles.input}
                  value={stateName}
                  onChangeText={setStateName}
                  placeholder="e.g. Maharashtra"
                />
                <View style={styles.editBtnRow}>
                  <Pressable style={styles.cancelBtn} onPress={() => setEditing(false)}>
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </Pressable>
                  <Pressable style={styles.saveBtn} onPress={save}>
                    <Icon name="check" color="#fff" size={16} />
                    <Text style={styles.saveBtnText}>Save</Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <>
                <Row
                  icon="briefcase"
                  title="Business name"
                  value={businessProfile.name || 'Not set'}
                />
                <Row
                  icon="fileText"
                  title="GSTIN"
                  value={businessProfile.gstin || 'Not set'}
                  divider
                  valueStyle={styles.mono}
                />
                <Row
                  icon="mapPin"
                  title="State"
                  value={businessProfile.stateName || 'Not set'}
                  divider
                />
                <Pressable style={styles.editLink} onPress={startEdit}>
                  <Icon name="edit" color={COLORS.primary} size={16} />
                  <Text style={styles.editLinkText}>Edit business profile</Text>
                </Pressable>
              </>
            )}
          </Card>
        </>
      )}

      <SectionLabel>Account</SectionLabel>
      <Card>
        <Row icon="receipt" title="OCR usage" value="On-device · unlimited" />
        <Row icon="bell" title="Expiry reminders" value="30 / 15 / 7 / 1 days" divider />
        <Row icon="wallet" title="Currency" value="INR (₹)" divider />
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

function Row({
  icon,
  title,
  value,
  divider,
  valueStyle,
}: {
  icon: React.ComponentProps<typeof IconChip>['name'];
  title: string;
  value: string;
  divider?: boolean;
  valueStyle?: object;
}) {
  return (
    <View style={[styles.row, divider && styles.divider]}>
      <IconChip name={icon} bg={COLORS.chip} fg={COLORS.subtext} size={34} />
      <Text style={styles.rowTitle}>{title}</Text>
      <Text style={[styles.rowValue, valueStyle]}>{value}</Text>
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
  segment: {
    flexDirection: 'row',
    backgroundColor: COLORS.chip,
    borderRadius: 999,
    padding: 4,
    marginTop: 16,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 999,
    alignItems: 'center',
  },
  segmentBtnActive: {
    backgroundColor: COLORS.primary,
  },
  segmentText: { fontSize: 14, fontWeight: '700', color: COLORS.subtext },
  segmentTextActive: { color: '#fff' },
  stats: { flexDirection: 'row', gap: 10, marginTop: 14 },
  stat: { flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: '800', color: COLORS.text },
  statLabel: { fontSize: 11, color: COLORS.subtext, marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  divider: { borderTopWidth: 1, borderTopColor: COLORS.border },
  rowTitle: { flex: 1, marginLeft: 12, fontSize: 15, fontWeight: '600', color: COLORS.text },
  rowValue: { fontSize: 13, color: COLORS.subtext },
  mono: { fontFamily: 'monospace' as const, letterSpacing: 0.5 },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.subtext, marginTop: 8, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 12,
    fontSize: 14,
    color: COLORS.text,
    backgroundColor: '#fff',
  },
  editBtnRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  cancelBtnText: { color: COLORS.subtext, fontWeight: '700', fontSize: 14 },
  saveBtn: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  editLink: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 14,
    marginTop: 2,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  editLinkText: { color: COLORS.primary, fontWeight: '700', fontSize: 14 },
  signOut: { marginTop: 20, borderWidth: 1, borderColor: COLORS.danger, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  signOutText: { color: COLORS.danger, fontWeight: '700', fontSize: 15 },
  note: { fontSize: 12, color: COLORS.subtext, textAlign: 'center', marginTop: 14, lineHeight: 17 },
});
