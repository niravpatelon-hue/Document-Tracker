import React from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { COLORS } from '../theme';

/** ---- Icons (raw inline SVG; react-native-web renders DOM host elements) ---- */
export type IconName =
  | 'home' | 'chart' | 'users' | 'user' | 'receipt' | 'shield' | 'star' | 'camera'
  | 'bell' | 'chevron' | 'plus' | 'check' | 'calendar' | 'download' | 'trash'
  | 'edit' | 'close' | 'tag' | 'wallet' | 'doc'
  | 'arrowUp' | 'arrowDown' | 'send' | 'request' | 'more' | 'percent' | 'fileText'
  | 'truck' | 'briefcase' | 'building' | 'filter' | 'search' | 'clock' | 'refresh' | 'mapPin';

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
    case 'arrowUp': return (<svg {...c}><path d="M12 20V5M6 11l6-6 6 6" /></svg>);
    case 'arrowDown': return (<svg {...c}><path d="M12 4v15M6 13l6 6 6-6" /></svg>);
    case 'send': return (<svg {...c}><path d="M21 3L10 14M21 3l-7 18-4-7-7-4z" /></svg>);
    case 'request': return (<svg {...c}><path d="M3 21L14 10M3 21l7-2 2-7M14 10l7-7" /></svg>);
    case 'more': return (<svg {...c}><circle cx="5" cy="12" r="1.4" /><circle cx="12" cy="12" r="1.4" /><circle cx="19" cy="12" r="1.4" /></svg>);
    case 'percent': return (<svg {...c}><path d="M19 5L5 19" /><circle cx="7" cy="7" r="2.2" /><circle cx="17" cy="17" r="2.2" /></svg>);
    case 'fileText': return (<svg {...c}><path d="M7 3h7l4 4v14H7z" /><path d="M9 12h6M9 16h6M9 8h3" /></svg>);
    case 'truck': return (<svg {...c}><path d="M3 6h11v9H3zM14 9h4l3 3v3h-7" /><circle cx="7" cy="18" r="1.8" /><circle cx="17.5" cy="18" r="1.8" /></svg>);
    case 'briefcase': return (<svg {...c}><rect x="3" y="7" width="18" height="12" rx="2" /><path d="M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2M3 12h18" /></svg>);
    case 'building': return (<svg {...c}><rect x="5" y="3" width="14" height="18" rx="1.5" /><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2M10 21v-3h4v3" /></svg>);
    case 'filter': return (<svg {...c}><path d="M3 5h18l-7 8v6l-4-2v-4z" /></svg>);
    case 'search': return (<svg {...c}><circle cx="11" cy="11" r="6" /><path d="M16 16l4 4" /></svg>);
    case 'clock': return (<svg {...c}><circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" /></svg>);
    case 'refresh': return (<svg {...c}><path d="M20 11a8 8 0 10-2 5.3M20 5v6h-6" /></svg>);
    case 'mapPin': return (<svg {...c}><path d="M12 21c5-5 7-8 7-11a7 7 0 10-14 0c0 3 2 6 7 11z" /><circle cx="12" cy="10" r="2.5" /></svg>);
    default: return null;
  }
}

/** ---- Category visual mapping (icon + chip colors) ---- */
export function categoryVisual(category: string): { icon: IconName; bg: string; fg: string } {
  switch (category) {
    case 'bills_receipts': return { icon: 'receipt', bg: COLORS.accentSoft, fg: COLORS.primary };
    case 'warranty': return { icon: 'shield', bg: '#fef0e0', fg: '#d97706' };
    case 'loyalty': return { icon: 'star', bg: '#e6f6ee', fg: COLORS.good };
    default: return { icon: 'doc', bg: COLORS.chip, fg: COLORS.subtext };
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

/** ---- Helpers ---- */
let _uid = 0;
function useUid(prefix: string): string {
  const ref = React.useRef<string | null>(null);
  if (ref.current === null) ref.current = `${prefix}-${++_uid}`;
  return ref.current;
}

function initials(name: string): string {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Convert a list of points into a smooth-ish cubic path string. */
function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M${pts[0].x},${pts[0].y}`;
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i === 0 ? 0 : i - 1];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2 < pts.length ? i + 2 : i + 1];
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${c1x},${c1y} ${c2x},${c2y} ${p2.x},${p2.y}`;
  }
  return d;
}

/** ---- Sparkline: smooth line with soft gradient area fill + end dot ---- */
export function Sparkline({
  values,
  width = 250,
  height = 40,
  color = COLORS.income,
  fillFrom,
}: {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
  fillFrom?: string;
}) {
  const gid = useUid('spark');
  const pad = 4;
  const w = width;
  const h = height;
  const vals = values && values.length ? values : [0, 0];
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const n = vals.length;
  const pts = vals.map((v, i) => ({
    x: pad + (n === 1 ? 0 : (i / (n - 1)) * (w - pad * 2)),
    y: pad + (1 - (v - min) / span) * (h - pad * 2),
  }));
  const line = smoothPath(pts);
  const area = `${line} L${pts[pts.length - 1].x},${h} L${pts[0].x},${h} Z`;
  const last = pts[pts.length - 1];
  const from = fillFrom || color;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={from} stopOpacity={0.28} />
          <stop offset="100%" stopColor={from} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} stroke="none" />
      <path d={line} fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last.x} cy={last.y} r={3} fill={color} />
    </svg>
  );
}

/** ---- WeeklyBarChart: stacked vertical bars per day ---- */
export function WeeklyBarChart({
  days,
  height = 170,
}: {
  days: { label: string; segments: { value: number; color: string }[] }[];
  height?: number;
}) {
  const labelH = 20;
  const chartH = Math.max(40, height - labelH);
  const totals = days.map((d) => d.segments.reduce((s, seg) => s + Math.max(0, seg.value), 0));
  const max = Math.max(1, ...totals);
  const barW = 14;
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: chartH }}>
        {days.map((d, di) => {
          const total = totals[di];
          const stackH = (total / max) * (chartH - 8);
          return (
            <View key={di} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
              <View
                style={{
                  width: barW,
                  height: Math.max(2, stackH),
                  borderRadius: 6,
                  overflow: 'hidden',
                  flexDirection: 'column-reverse',
                  backgroundColor: COLORS.track,
                }}
              >
                {d.segments.map((seg, si) => {
                  const segH = total > 0 ? (Math.max(0, seg.value) / total) * Math.max(2, stackH) : 0;
                  return <View key={si} style={{ height: segH, backgroundColor: seg.color, width: '100%' }} />;
                })}
              </View>
            </View>
          );
        })}
      </View>
      <View style={{ height: 1, backgroundColor: COLORS.border, marginTop: 2 }} />
      <View style={{ flexDirection: 'row', marginTop: 6 }}>
        {days.map((d, di) => (
          <Text key={di} style={{ flex: 1, textAlign: 'center', fontSize: 11, color: COLORS.subtext, fontWeight: '600' }}>
            {d.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

/** ---- Gauge: 180° semicircle with track + value arc and centered % ---- */
export function Gauge({
  pct,
  size = 170,
  color = COLORS.income,
  label,
  sublabel,
}: {
  pct: number;
  size?: number;
  color?: string;
  label?: string;
  sublabel?: string;
}) {
  const clamped = Math.max(0, Math.min(100, isFinite(pct) ? pct : 0));
  const stroke = Math.max(8, size * 0.09);
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const w = size;
  const h = size / 2 + stroke / 2 + 2;
  const polar = (frac: number) => {
    const ang = Math.PI - frac * Math.PI; // 180deg -> 0deg
    return { x: cx + r * Math.cos(ang), y: cy - r * Math.sin(ang) };
  };
  const start = polar(0);
  const end = polar(1);
  const valEnd = polar(clamped / 100);
  const largeVal = clamped > 50 ? 1 : 0;
  const trackD = `M${start.x},${start.y} A${r},${r} 0 1 1 ${end.x},${end.y}`;
  const valD = `M${start.x},${start.y} A${r},${r} 0 ${largeVal} 1 ${valEnd.x},${valEnd.y}`;
  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ width: w, height: h, position: 'relative' }}>
        <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h}>
          <path d={trackD} fill="none" stroke={COLORS.track} strokeWidth={stroke} strokeLinecap="round" />
          <path d={valD} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" />
        </svg>
        <View style={{ position: 'absolute', left: 0, right: 0, top: h * 0.34, alignItems: 'center' }}>
          <Text style={{ fontSize: size * 0.2, fontWeight: '800', color: COLORS.text }}>{Math.round(clamped)}%</Text>
        </View>
      </View>
      {label ? <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.text, marginTop: 2 }}>{label}</Text> : null}
      {sublabel ? <Text style={{ fontSize: 12, color: COLORS.subtext, marginTop: 2 }}>{sublabel}</Text> : null}
    </View>
  );
}

/** ---- ProgressBar: rounded track + fill (clamped) ---- */
export function ProgressBar({
  pct,
  color = COLORS.primary,
  height = 8,
  track = COLORS.track,
}: {
  pct: number;
  color?: string;
  height?: number;
  track?: string;
}) {
  const clamped = Math.max(0, Math.min(100, isFinite(pct) ? pct : 0));
  return (
    <View style={{ height, borderRadius: height / 2, backgroundColor: track, overflow: 'hidden' }}>
      <View style={{ width: `${clamped}%`, height: '100%', backgroundColor: color, borderRadius: height / 2 }} />
    </View>
  );
}

/** ---- SegmentBar: single bar split proportionally by value ---- */
export function SegmentBar({
  segments,
  height = 10,
  radius = 6,
}: {
  segments: { value: number; color: string }[];
  height?: number;
  radius?: number;
}) {
  const total = segments.reduce((s, seg) => s + Math.max(0, seg.value), 0);
  return (
    <View style={{ height, borderRadius: radius, backgroundColor: COLORS.track, overflow: 'hidden', flexDirection: 'row' }}>
      {total > 0
        ? segments.map((seg, i) => (
            <View key={i} style={{ flex: Math.max(0, seg.value), backgroundColor: seg.color, height: '100%' }} />
          ))
        : null}
    </View>
  );
}

/** ---- CreditCard: blue gradient debit/credit card visual ---- */
export function CreditCard({
  holder,
  last4,
  expiry,
  brand = 'VISA',
}: {
  holder: string;
  last4: string;
  expiry: string;
  brand?: string;
}) {
  return (
    <View
      style={
        {
          width: '100%',
          height: 180,
          borderRadius: 18,
          padding: 18,
          justifyContent: 'space-between',
          backgroundImage: `linear-gradient(135deg, ${COLORS.cardA} 0%, ${COLORS.cardB} 100%)`,
          boxShadow: '0 16px 30px -16px rgba(30,58,138,0.6)',
        } as object
      }
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View
          style={{
            width: 40,
            height: 30,
            borderRadius: 6,
            backgroundColor: 'rgba(255,255,255,0.85)',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.5)',
          }}
        />
        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 1 }}>{brand}</Text>
      </View>
      <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700', letterSpacing: 2 }}>
        {`••••  ••••  ••••  ${last4}`}
      </Text>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <View>
          <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 9, fontWeight: '700', letterSpacing: 1 }}>CARD HOLDER</Text>
          <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700', marginTop: 2 }}>{holder}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 9, fontWeight: '700', letterSpacing: 1 }}>EXPIRES</Text>
          <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700', marginTop: 2 }}>{expiry}</Text>
        </View>
      </View>
    </View>
  );
}

/** ---- Avatar: circle with 1-2 letter initials ---- */
export function Avatar({
  name,
  size = 40,
  bg = COLORS.accentSoft,
  fg = COLORS.primary,
}: {
  name: string;
  size?: number;
  bg?: string;
  fg?: string;
}) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: fg, fontWeight: '800', fontSize: size * 0.4 }}>{initials(name)}</Text>
    </View>
  );
}
