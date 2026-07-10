import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { COLORS } from '../theme';
import { Avatar, Button, Card, IconChip, ListRow, SectionLabel } from '../components/ui';
import type { WebUser } from '../store';

interface Props {
  user: WebUser;
  expenseCount: number;
  groupCount: number;
  onOpenReports: () => void;
  onOpenMileage: () => void;
  onSignOut: () => void;
}

export default function AccountScreen({
  user,
  expenseCount,
  groupCount,
  onOpenReports,
  onOpenMileage,
  onSignOut,
}: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.scroll}>
        <SectionLabel>Account</SectionLabel>

        <Card style={styles.profileCard}>
          <Avatar name={user.name || 'Me'} size={72} />
          <Text style={styles.name}>{user.name || 'You'}</Text>
          <Text style={styles.email}>{user.email}</Text>
          <View style={styles.planPill}>
            <Text style={styles.planPillText}>Free plan</Text>
          </View>
        </Card>

        <View style={styles.statsRow}>
          <Card style={styles.statCard}>
            <Text style={styles.statValue}>{expenseCount}</Text>
            <Text style={styles.statLabel}>Expenses</Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={styles.statValue}>{groupCount}</Text>
            <Text style={styles.statLabel}>Groups</Text>
          </Card>
        </View>

        <View style={{ marginTop: 22 }}>
          <SectionLabel>Settings</SectionLabel>
          <Card style={{ paddingVertical: 4 }}>
            <ListRow
              left={<IconChip name="download" bg={COLORS.primarySoft} color={COLORS.primary} size={40} />}
              title="Reports & export"
              subtitle="Spend charts, CSV export"
              onPress={onOpenReports}
              rightTop={<Chevron />}
            />
            <View style={styles.divider} />
            <ListRow
              left={<IconChip name="car" bg={COLORS.primarySoft} color={COLORS.primary} size={40} />}
              title="Mileage log"
              subtitle="Track trips & reimbursement"
              onPress={onOpenMileage}
              rightTop={<Chevron />}
            />
            <View style={styles.divider} />
            <ListRow
              left={<IconChip name="wallet" bg={COLORS.chip} color={COLORS.subtext} size={40} />}
              title="Currency"
              rightTop="INR"
            />
            <View style={styles.divider} />
            <ListRow
              left={<IconChip name="bell" bg={COLORS.chip} color={COLORS.subtext} size={40} />}
              title="Reminders"
              rightTop="On"
            />
            <View style={styles.divider} />
            <ListRow
              left={<IconChip name="sparkles" bg={COLORS.chip} color={COLORS.subtext} size={40} />}
              title="About"
              rightTop="Preview"
            />
          </Card>
        </View>

        <Button
          label="Sign out"
          variant="danger"
          icon="close"
          onPress={onSignOut}
          style={{ marginTop: 22 }}
        />
      </View>
    </View>
  );
}

function Chevron() {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18}>
      <path
        d="M9 6l6 6-6 6"
        fill="none"
        stroke={COLORS.muted}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.screenBg },
  scroll: { padding: 16, paddingBottom: 28 },
  profileCard: {
    alignItems: 'center',
    paddingVertical: 26,
  },
  name: { marginTop: 14, fontSize: 19, fontWeight: '800', color: COLORS.ink },
  email: { marginTop: 3, fontSize: 13, color: COLORS.subtext, fontWeight: '600' },
  planPill: {
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: COLORS.primarySoft,
  },
  planPillText: { color: COLORS.primaryDark, fontSize: 12.5, fontWeight: '800' },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 14,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 18,
  },
  statValue: { fontSize: 22, fontWeight: '800', color: COLORS.ink },
  statLabel: { marginTop: 2, fontSize: 12.5, color: COLORS.subtext, fontWeight: '700' },
  divider: { height: 1, backgroundColor: COLORS.divider, marginLeft: 52 },
});
