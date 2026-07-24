import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { COLORS, DARK } from '../theme';

export type TabKey = 'home' | 'cards' | 'account';

interface Props {
  active: TabKey | null;
  onNavigate: (tab: TabKey) => void;
  onScan: () => void;
  /** Dark styling for when the Cards (premium) tab is active. */
  dark?: boolean;
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
    case 'cards':
      return (
        <svg {...common}>
          <rect x="3" y="6" width="18" height="13" rx="3" />
          <path d="M16 12h4" />
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
  { key: 'cards', label: 'Cards' },
  { key: 'account', label: 'Account' },
];

export default function TabBar({ active, onNavigate, onScan, dark = false }: Props) {
  const left = TABS.slice(0, 1);
  const right = TABS.slice(1);
  const barBg = dark ? DARK.surface : '#fff';
  const borderColor = dark ? DARK.border : COLORS.border;
  const inactive = dark ? DARK.muted : COLORS.muted;
  const activeColor = dark ? DARK.gold : COLORS.primary;
  const fabBg = dark ? DARK.gold : COLORS.primary;
  const fabShadow = dark ? '0 10px 20px -6px rgba(231,197,131,0.5)' : '0 10px 20px -6px rgba(28,194,159,0.6)';
  const fabIconColor = dark ? DARK.bg : '#fff';

  return (
    <View style={[styles.bar, { backgroundColor: barBg, borderTopColor: borderColor }]}>
      {left.map((t) => (
        <TabButton
          key={t.key}
          k={t.key}
          label={t.label}
          active={active === t.key}
          activeColor={activeColor}
          inactiveColor={inactive}
          onPress={() => onNavigate(t.key)}
        />
      ))}
      <View style={styles.fabSlot}>
        <Pressable
          style={[styles.fab, { backgroundColor: fabBg, boxShadow: fabShadow } as object]}
          onPress={onScan}
          accessibilityLabel="Scan a receipt"
        >
          <Icon name="scan" color={fabIconColor} size={24} />
        </Pressable>
        <Text style={[styles.fabLabel, { color: activeColor }]}>Scan</Text>
      </View>
      {right.map((t) => (
        <TabButton
          key={t.key}
          k={t.key}
          label={t.label}
          active={active === t.key}
          activeColor={activeColor}
          inactiveColor={inactive}
          onPress={() => onNavigate(t.key)}
        />
      ))}
    </View>
  );
}

function TabButton({
  k,
  label,
  active,
  activeColor,
  inactiveColor,
  onPress,
}: {
  k: TabKey;
  label: string;
  active: boolean;
  activeColor: string;
  inactiveColor: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.item} onPress={onPress}>
      <Icon name={k} color={active ? activeColor : inactiveColor} />
      <Text style={[styles.label, { color: active ? activeColor : inactiveColor }]}>{label}</Text>
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
    position: 'relative',
  },
  item: { flex: 1, alignItems: 'center', gap: 2, paddingTop: 6 },
  label: { fontSize: 10, fontWeight: '600' },
  fabSlot: { width: 60, alignItems: 'center' },
  fab: {
    position: 'absolute',
    top: -24,
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  } as object,
  fabLabel: { fontSize: 10, fontWeight: '700', marginTop: 32 },
});
