import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { COLORS } from '../theme';

export type TabKey = 'home' | 'analytics' | 'groups' | 'documents';

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
    case 'analytics':
      return (
        <svg {...common}>
          <path d="M4 19V9M10 19V5M16 19v-7M22 19H2" />
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
    case 'documents':
      return (
        <svg {...common}>
          <path d="M6 3h9l4 4v14l-2-1-2 1-2-1-2 1-2-1-2 1V3z" />
          <path d="M8 9h7M8 13h5" />
        </svg>
      );
    case 'scan':
      return (
        <svg {...common} strokeWidth={2.2}>
          <rect x="3" y="6" width="18" height="13" rx="2" />
          <circle cx="12" cy="12.5" r="3" />
        </svg>
      );
    default:
      return null;
  }
}

const TABS: { key: TabKey; label: string }[] = [
  { key: 'home', label: 'Home' },
  { key: 'analytics', label: 'Spending' },
  { key: 'groups', label: 'Groups' },
  { key: 'documents', label: 'Docs' },
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
        <Pressable style={styles.fab} onPress={onScan} accessibilityLabel="Scan a document">
          <Icon name="scan" color="#fff" size={24} />
        </Pressable>
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
      <Icon name={k} color={active ? COLORS.primary : COLORS.subtext} />
      <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    height: 62,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: '#fff',
    position: 'relative',
  },
  item: { flex: 1, alignItems: 'center', gap: 3, paddingTop: 4 },
  label: { fontSize: 10.5, fontWeight: '600', color: COLORS.subtext },
  labelActive: { color: COLORS.primary },
  fabSlot: { width: 64, alignItems: 'center' },
  fab: {
    position: 'absolute',
    top: -24,
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 10px 20px -6px rgba(29,78,216,0.6)',
  } as object,
});
