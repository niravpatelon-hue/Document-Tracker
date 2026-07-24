import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { buildSettleUpLink } from '@domain/settleup/deeplinks';
import { COLORS } from '../theme';
import { Avatar, BalanceAmount, Button, Card, EmptyState, ListRow } from '../components/ui';
import { apportionSettlement, type ApportionedSettlement, type Person } from '../people';

interface Props {
  people: Person[];
  onSettle: (settlements: ApportionedSettlement[]) => void;
}

export default function PeopleScreen({ people, onSettle }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggle(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function openLink(url: string) {
    try {
      window.open(url, '_blank');
    } catch {
      /* no-op */
    }
  }

  function payViaUpi(person: Person) {
    const vpa = person.upi;
    if (!vpa) return;
    const url = buildSettleUpLink(
      { provider: 'upi', vpa, payeeName: person.name },
      { amount: Math.abs(person.totalNetCents), note: 'Settle up' },
    );
    openLink(url);
  }

  function settleUp(person: Person) {
    const n = person.groups.length;
    const confirmed = window.confirm(
      `Mark all balances with ${person.name} across ${n} group${n === 1 ? '' : 's'} as settled?`,
    );
    if (confirmed) {
      onSettle(apportionSettlement(person));
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      <Text style={styles.subtitle}>Balances across your groups</Text>

      {people.length === 0 ? (
        <EmptyState
          emoji="🤝"
          title="No shared balances yet"
          subtitle="Split an expense in a group to see balances with people here."
        />
      ) : (
        people.map((person) => {
          const isExpanded = expanded.has(person.key);
          const showPayViaUpi = Boolean(person.upi) && person.totalNetCents < 0;
          const n = person.groups.length;
          return (
            <Card key={person.key} style={styles.personCard} onPress={() => toggle(person.key)}>
              <ListRow
                avatar={<Avatar name={person.name} size={44} />}
                title={person.name}
                subtitle={`across ${n} group${n === 1 ? '' : 's'}`}
                rightTop={<BalanceAmount cents={person.totalNetCents} showSign />}
              />

              {isExpanded && (
                <View style={styles.expanded}>
                  {person.groups.map((g, i) => (
                    <View key={g.groupId} style={[styles.groupRow, i > 0 && styles.divider]}>
                      <Text numberOfLines={1} style={styles.groupName}>
                        {g.groupName}
                      </Text>
                      <BalanceAmount cents={g.netCents} />
                    </View>
                  ))}

                  <View style={styles.actionRow}>
                    {showPayViaUpi && (
                      <Button
                        label="Pay via UPI"
                        variant="secondary"
                        onPress={() => payViaUpi(person)}
                        style={styles.actionBtn}
                      />
                    )}
                    <Button label="Settle up" onPress={() => settleUp(person)} style={styles.actionBtn} />
                  </View>
                </View>
              )}
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
  subtitle: { color: COLORS.subtext, fontSize: 13.5, marginBottom: 14 },
  personCard: { marginBottom: 10 },
  expanded: { marginTop: 6, paddingTop: 8, borderTopWidth: 1, borderTopColor: COLORS.divider },
  groupRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
  groupName: { flex: 1, color: COLORS.ink, fontWeight: '600', fontSize: 13.5, marginRight: 10 },
  divider: { borderTopWidth: 1, borderTopColor: COLORS.divider },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  actionBtn: { flex: 1 },
});
