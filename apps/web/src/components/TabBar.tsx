import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { COLORS } from '../theme';

export type TabKey = 'home' | 'expenses' | 'groups' | 'account';

interface Props {
  active: TabKey | null;
  onNavigate: (tab: TabKey) => void;
  onScan: () => void;
}

/** Raw inline SVG — react-native-web renders DOM host elements directly. */
function Icon({ name, color, size = 22 }: { name: TabKey | 'scan'; color: string; size?: number }) {
  const common = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: color,
    strokeWidth: 1.9,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    width: size,
    height: size,
  };
  switch (name) {
    case 'home':
      return (
        <svg {...common}>
          <path d="M4 11l8-7 8 7" />
          <path d="M6 10v9h12v-9" />
        </svg>
      );
    case 'expenses':
      return (
        <svg {...common}>
          <path d="M4 6h16M4 12h16M4 18h10" />
        </svg>
      );
    case 'groups':
      return (
        <svg {...common}>
          <circle cx="9" cy="8" r="3" />
          <circle cx="17" cy="9" r="2.4" />
          <path d="M3 20c0-3 3-5 6-5s6 2 6 5" />
        </svg>
      );
    case 'account':
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
        </svg>
      );
    case 'scan':
      return (
        <svg {...common} strokeWidth={2.2}>
          <path d="M4 8V6a2 2 0 012-2h2M16 4h2a2 2 0 012 2v2M20 16v2a2 2 0 01-2 2h-2M8 20H6a2 2 0 01-2-2v-2" />
          <path d="M4 12h16" />
        </svg>
      );
    default:
      return null;
  }
}

const TABS: { key: TabKey; label: string }[] = [
  { key: 'home', label: 'Home' },
  { key: 'expenses', label: 'Expenses' },
  { key: 'groups', label: 'Groups' },
  { key: 'account', label: 'Account' },
];

export default function TabBar({ active, onNavigate, onScan }: Props) {
  const left = TABS.slice(0, 2);
  const right = TABS.slice(2);
  return (
    <View style={styles.bar}>
      {left.map((t) => (
        <TabButton key={t.key} k={t.key} label={t.label} active={active === t.key} onPress={() => onNavigate(t.key)} />
      ))}
      <View style={styles.fabSlot}>
        <Pressable style={styles.fab} onPress={onScan} accessibilityLabel="Scan a receipt">
          <Icon name="scan" color="#fff" size={26} />
        </Pressable>
        <Text style={styles.fabLabel}>Scan</Text>
      </View>
      {right.map((t) => (
        <TabButton key={t.key} k={t.key} label={t.label} active={active === t.key} onPress={() => onNavigate(t.key)} />
      ))}
    </View>
  );
}

function TabButton({ k, label, active, onPress }: { k: TabKey; label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={styles.item} onPress={onPress}>
      <Icon name={k} color={active ? COLORS.primary : COLORS.muted} />
      <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    height: 64,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: '#fff',
    position: 'relative',
  },
  item: { flex: 1, alignItems: 'center', gap: 3, paddingTop: 6 },
  label: { fontSize: 10.5, fontWeight: '600', color: COLORS.muted },
  labelActive: { color: COLORS.primary },
  fabSlot: { width: 66, alignItems: 'center' },
  fab: {
    position: 'absolute',
    top: -26,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 10px 20px -6px rgba(28,194,159,0.6)',
  } as object,
  fabLabel: { fontSize: 10.5, fontWeight: '700', color: COLORS.primary, marginTop: 34 },
});
