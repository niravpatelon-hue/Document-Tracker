import React from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { COLORS } from '../theme';

/** ---- Icons (raw inline SVG; react-native-web renders DOM host elements) ---- */
export type IconName =
  | 'home' | 'chart' | 'users' | 'user' | 'receipt' | 'shield' | 'star' | 'camera'
  | 'bell' | 'chevron' | 'plus' | 'check' | 'calendar' | 'download' | 'trash'
  | 'edit' | 'close' | 'tag' | 'wallet' | 'doc';

export function Icon({
  name,
  color = COLORS.text,
  size = 20,
  strokeWidth = 1.9,
}: {
  name: IconName;
  color?: string;
  size?: number;
  strokeWidth?: number;
}) {
  const c = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: color,
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    width: size,
    height: size,
  };
  switch (name) {
    case 'home': return (<svg {...c}><path d="M4 11l8-7 8 7" /><path d="M6 10v9h12v-9" /></svg>);
    case 'chart': return (<svg {...c}><path d="M4 19V9M10 19V5M16 19v-7M22 19H2" /></svg>);
    case 'users': return (<svg {...c}><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.4" /><path d="M3 20c0-3 3-5 6-5s6 2 6 5" /></svg>);
    case 'user': return (<svg {...c}><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></svg>);
    case 'receipt': return (<svg {...c}><path d="M6 3h9l4 4v14l-2-1-2 1-2-1-2 1-2-1-2 1V3z" /><path d="M8 9h7M8 13h5" /></svg>);
    case 'shield': return (<svg {...c}><path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z" /></svg>);
    case 'star': return (<svg {...c}><path d="M12 4l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4L4.2 9.7l5.4-.8z" /></svg>);
    case 'camera': return (<svg {...c}><rect x="3" y="6" width="18" height="13" rx="2" /><circle cx="12" cy="12.5" r="3" /></svg>);
    case 'bell': return (<svg {...c}><path d="M18 8a6 6 0 10-12 0c0 7-3 8-3 8h18s-3-1-3-8" /><path d="M13.5 21a2 2 0 01-3 0" /></svg>);
    case 'chevron': return (<svg {...c}><path d="M9 6l6 6-6 6" /></svg>);
    case 'plus': return (<svg {...c}><path d="M12 5v14M5 12h14" /></svg>);
    case 'check': return (<svg {...c}><path d="M4 12l5 5L20 6" /></svg>);
    case 'calendar': return (<svg {...c}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 9h18M8 3v4M16 3v4" /></svg>);
    case 'download': return (<svg {...c}><path d="M12 3v12M7 10l5 5 5-5M4 21h16" /></svg>);
    case 'trash': return (<svg {...c}><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg>);
    case 'edit': return (<svg {...c}><path d="M4 20h4L18 10l-4-4L4 16z" /><path d="M13 5l4 4" /></svg>);
    case 'close': return (<svg {...c}><path d="M6 6l12 12M18 6L6 18" /></svg>);
    case 'tag': return (<svg {...c}><path d="M3 12l9-9h7v7l-9 9z" /><circle cx="15.5" cy="8.5" r="1.4" /></svg>);
    case 'wallet': return (<svg {...c}><rect x="3" y="6" width="18" height="13" rx="3" /><path d="M16 12h4" /></svg>);
    case 'doc': return (<svg {...c}><path d="M7 3h7l4 4v14H7z" /><path d="M9 11h6M9 15h4" /></svg>);
    default: return null;
  }
}

/** ---- Category visual mapping (icon + chip colors) ---- */
export function categoryVisual(category: string): { icon: IconName; bg: string; fg: string } {
  switch (category) {
    case 'bills_receipts': return { icon: 'receipt', bg: '#e0e7ff', fg: '#4f46e5' };
    case 'warranty': return { icon: 'shield', bg: '#fef0e0', fg: '#d97706' };
    case 'loyalty': return { icon: 'star', bg: '#e6f6ee', fg: '#059669' };
    default: return { icon: 'doc', bg: '#eef1f6', fg: '#64748b' };
  }
}

/** ---- Building blocks ---- */
export function IconChip({ name, bg, fg, size = 36 }: { name: IconName; bg: string; fg: string; size?: number }) {
  return (
    <View style={[ui.chip, { width: size, height: size, backgroundColor: bg }]}>
      <Icon name={name} color={fg} size={Math.round(size * 0.5)} />
    </View>
  );
}

export function SectionLabel({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <Text style={[ui.section, style]}>{children}</Text>;
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[ui.card, style]}>{children}</View>;
}

export function HeroCard({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[ui.hero, style]}>{children}</View>;
}

type Tone = 'warn' | 'good' | 'info' | 'neutral' | 'danger';
const TONE: Record<Tone, { bg: string; fg: string }> = {
  warn: { bg: COLORS.warnBg, fg: COLORS.warnText },
  good: { bg: '#e6f6ee', fg: COLORS.good },
  info: { bg: '#e7edf6', fg: COLORS.info },
  neutral: { bg: COLORS.chip, fg: COLORS.subtext },
  danger: { bg: '#fde8e6', fg: COLORS.danger },
};

export function StatusPill({ text, tone = 'neutral' }: { text: string; tone?: Tone }) {
  const t = TONE[tone];
  return (
    <View style={[ui.pill, { backgroundColor: t.bg }]}>
      <Text style={[ui.pillText, { color: t.fg }]}>{text}</Text>
    </View>
  );
}

export function Tile({
  onPress,
  iconName,
  chipBg,
  chipFg,
  title,
  sub,
  status,
  statusTone = 'warn',
  style,
}: {
  onPress?: () => void;
  iconName: IconName;
  chipBg: string;
  chipFg: string;
  title: string;
  sub: string;
  status?: string;
  statusTone?: Tone;
  style?: ViewStyle;
}) {
  return (
    <Pressable style={[ui.tile, style]} onPress={onPress}>
      <IconChip name={iconName} bg={chipBg} fg={chipFg} />
      <Text style={ui.tileTitle}>{title}</Text>
      <Text style={ui.tileSub}>{sub}</Text>
      {status ? (
        <View style={{ marginTop: 8, alignSelf: 'flex-start' }}>
          <StatusPill text={status} tone={statusTone} />
        </View>
      ) : null}
    </Pressable>
  );
}

const ui = StyleSheet.create({
  chip: { borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  section: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.subtext,
    letterSpacing: 0.06 * 12,
    textTransform: 'uppercase',
    marginTop: 20,
    marginBottom: 10,
  },
  card: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, padding: 14 },
  hero: {
    backgroundColor: COLORS.navyB,
    borderRadius: 20,
    padding: 18,
    boxShadow: '0 16px 30px -16px rgba(11,18,32,0.7)',
  } as object,
  pill: { borderRadius: 999, paddingVertical: 3, paddingHorizontal: 9, alignSelf: 'flex-start' },
  pillText: { fontSize: 11, fontWeight: '700' },
  tile: { backgroundColor: '#fff', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: COLORS.border },
  tileTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text, marginTop: 10 },
  tileSub: { fontSize: 12, color: COLORS.subtext, marginTop: 2 },
});

/** Shared hero text styles for consistency across screens. */
export const heroText = StyleSheet.create({
  cap: { color: '#9fb0d0', fontSize: 12, fontWeight: '600' },
  money: { color: '#fff', fontSize: 32, fontWeight: '800', letterSpacing: -0.5 },
  sub: { color: '#9fb0d0', fontSize: 12, marginTop: 8 },
});
