/**
 * FRIENDLY & ROUNDED design system (Splitwise-leaning) for the web preview.
 *
 * Teal-green primary, soft neutrals, rounded pills, avatar-led rows, chunky
 * balances. Pure react-native primitives + raw inline SVG (react-native-web
 * renders SVG host elements). No react-dom, no external UI/icon/chart libs.
 *
 * Money is integer paise; amounts are formatted via @domain/money.formatINR.
 */
import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { formatINR } from '@domain/money';
import { COLORS } from '../theme';
import { categoryColor, categoryIcon, colorForId } from '../store';

const softShadow = {
  boxShadow: '0 2px 10px rgba(20,40,60,0.05)',
} as unknown as ViewStyle;

/* ------------------------------------------------------------------ */
/* Icon                                                               */
/* ------------------------------------------------------------------ */

export type IconName =
  | 'home' | 'list' | 'users' | 'user' | 'plus' | 'camera' | 'scan'
  | 'check' | 'close' | 'chevron' | 'edit' | 'trash' | 'search' | 'filter'
  | 'download' | 'receipt' | 'car' | 'calendar' | 'bell' | 'settings'
  | 'arrowUp' | 'arrowDown' | 'split' | 'wallet' | 'star' | 'mapPin'
  | 'sparkles' | 'x';

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
    case 'home':
      return (<svg {...c}><path d="M4 11l8-7 8 7" /><path d="M6 10v9h12v-9" /></svg>);
    case 'list':
      return (<svg {...c}><path d="M8 6h13M8 12h13M8 18h13" /><circle cx="4" cy="6" r="1.1" /><circle cx="4" cy="12" r="1.1" /><circle cx="4" cy="18" r="1.1" /></svg>);
    case 'users':
      return (<svg {...c}><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.4" /><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" /><path d="M15.5 14.6c2.4.2 4.5 2 4.5 4.4" /></svg>);
    case 'user':
      return (<svg {...c}><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></svg>);
    case 'plus':
      return (<svg {...c}><path d="M12 5v14M5 12h14" /></svg>);
    case 'camera':
      return (<svg {...c}><path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 011 1v9a1 1 0 01-1 1H4a1 1 0 01-1-1V9a1 1 0 011-1z" /><circle cx="12" cy="13" r="3.2" /></svg>);
    case 'scan':
      return (<svg {...c}><path d="M4 8V6a2 2 0 012-2h2M16 4h2a2 2 0 012 2v2M20 16v2a2 2 0 01-2 2h-2M8 20H6a2 2 0 01-2-2v-2" /><path d="M4 12h16" /></svg>);
    case 'check':
      return (<svg {...c}><path d="M4 12l5 5L20 6" /></svg>);
    case 'close':
    case 'x':
      return (<svg {...c}><path d="M6 6l12 12M18 6L6 18" /></svg>);
    case 'chevron':
      return (<svg {...c}><path d="M9 6l6 6-6 6" /></svg>);
    case 'edit':
      return (<svg {...c}><path d="M4 20h4L18 10l-4-4L4 16z" /><path d="M13 5l4 4" /></svg>);
    case 'trash':
      return (<svg {...c}><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg>);
    case 'search':
      return (<svg {...c}><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>);
    case 'filter':
      return (<svg {...c}><path d="M3 5h18l-7 8v5l-4 2v-7z" /></svg>);
    case 'download':
      return (<svg {...c}><path d="M12 3v12M7 10l5 5 5-5M4 21h16" /></svg>);
    case 'receipt':
      return (<svg {...c}><path d="M6 3h9l4 4v14l-2-1-2 1-2-1-2 1-2-1-2 1V3z" /><path d="M8 9h7M8 13h5" /></svg>);
    case 'car':
      return (<svg {...c}><path d="M3 13l2-5a2 2 0 012-1.4h8A2 2 0 0117 8l2 5" /><path d="M3 13h18v4a1 1 0 01-1 1h-1.5M5.5 18H4a1 1 0 01-1-1v-4" /><circle cx="7.5" cy="18" r="1.6" /><circle cx="16.5" cy="18" r="1.6" /></svg>);
    case 'calendar':
      return (<svg {...c}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 9h18M8 3v4M16 3v4" /></svg>);
    case 'bell':
      return (<svg {...c}><path d="M18 8a6 6 0 10-12 0c0 7-3 8-3 8h18s-3-1-3-8" /><path d="M13.5 21a2 2 0 01-3 0" /></svg>);
    case 'settings':
      return (<svg {...c}><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" /></svg>);
    case 'arrowUp':
      return (<svg {...c}><path d="M12 20V5M6 11l6-6 6 6" /></svg>);
    case 'arrowDown':
      return (<svg {...c}><path d="M12 4v15M6 13l6 6 6-6" /></svg>);
    case 'split':
      return (<svg {...c}><path d="M4 12h4l4-6h8M4 12h4l4 6h8" /><path d="M17 3l3 3-3 3M17 15l3 3-3 3" /></svg>);
    case 'wallet':
      return (<svg {...c}><rect x="3" y="6" width="18" height="13" rx="3" /><path d="M3 10h13a2 2 0 012 2 2 2 0 01-2 2h-1" /><circle cx="16" cy="12.5" r="1" fill={color} stroke="none" /></svg>);
    case 'star':
      return (<svg {...c}><path d="M12 4l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4L4.2 9.7l5.4-.8z" /></svg>);
    case 'mapPin':
      return (<svg {...c}><path d="M12 21c5-5 7-8.5 7-11a7 7 0 10-14 0c0 2.5 2 6 7 11z" /><circle cx="12" cy="10" r="2.5" /></svg>);
    case 'sparkles':
      return (<svg {...c}><path d="M12 4l1.6 4.2L18 10l-4.4 1.8L12 16l-1.6-4.2L6 10l4.4-1.8z" /><path d="M18.5 3.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" /></svg>);
    default:
      return (<svg {...c}><circle cx="12" cy="12" r="9" /></svg>);
  }
}

/* ------------------------------------------------------------------ */
/* IconChip                                                           */
/* ------------------------------------------------------------------ */

export function IconChip({
  name,
  color = COLORS.primary,
  bg,
  size = 40,
  iconSize,
  onPress,
  style,
}: {
  name: IconName;
  color?: string;
  bg?: string;
  size?: number;
  iconSize?: number;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const inner = (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 3,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: bg ?? withAlpha(color, 0.14),
        },
        style,
      ]}
    >
      <Icon name={name} color={color} size={iconSize ?? Math.round(size * 0.5)} />
    </View>
  );
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => (pressed ? { opacity: 0.7 } : null)}>
        {inner}
      </Pressable>
    );
  }
  return inner;
}

/* ------------------------------------------------------------------ */
/* Avatar / AvatarStack                                               */
/* ------------------------------------------------------------------ */

function initials(name: string): string {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Avatar({
  name,
  size = 40,
  color,
  style,
}: {
  name: string;
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const bg = color ?? colorForId(name);
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bg,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <Text
        style={{
          color: '#fff',
          fontWeight: '800',
          fontSize: Math.round(size * 0.4),
          letterSpacing: 0.3,
        }}
      >
        {initials(name)}
      </Text>
    </View>
  );
}

export function AvatarStack({
  names,
  size = 32,
  max = 4,
}: {
  names: string[];
  size?: number;
  max?: number;
}) {
  const shown = names.slice(0, max);
  const extra = names.length - shown.length;
  const overlap = Math.round(size * 0.32);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {shown.map((n, i) => (
        <View
          key={`${n}-${i}`}
          style={{
            marginLeft: i === 0 ? 0 : -overlap,
            borderRadius: size / 2,
            borderWidth: 2,
            borderColor: COLORS.card,
          }}
        >
          <Avatar name={n} size={size} />
        </View>
      ))}
      {extra > 0 && (
        <View
          style={{
            marginLeft: -overlap,
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: COLORS.chip,
            borderWidth: 2,
            borderColor: COLORS.card,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: COLORS.subtext, fontWeight: '700', fontSize: Math.round(size * 0.34) }}>
            +{extra}
          </Text>
        </View>
      )}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Card                                                               */
/* ------------------------------------------------------------------ */

export function Card({
  children,
  style,
  onPress,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}) {
  const base: StyleProp<ViewStyle> = [styles.card, softShadow, style];
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [base, pressed ? { opacity: 0.9 } : null]}>
        {children}
      </Pressable>
    );
  }
  return <View style={base}>{children}</View>;
}

/* ------------------------------------------------------------------ */
/* Button                                                             */
/* ------------------------------------------------------------------ */

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  disabled = false,
  style,
}: {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  icon?: IconName;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  let bg = COLORS.primary;
  let fg = '#fff';
  let borderColor: string | undefined;
  if (variant === 'secondary') {
    bg = COLORS.card;
    fg = COLORS.primary;
    borderColor = COLORS.primary;
  } else if (variant === 'ghost') {
    bg = 'transparent';
    fg = COLORS.subtext;
  } else if (variant === 'danger') {
    bg = COLORS.danger;
    fg = '#fff';
  }
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      style={({ pressed }) => [
        {
          height: 48,
          borderRadius: 999,
          paddingHorizontal: 22,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: bg,
          borderWidth: borderColor ? 1 : 0,
          borderColor,
          opacity: disabled ? 0.45 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {icon && (
        <View style={{ marginRight: 8 }}>
          <Icon name={icon} color={fg} size={19} strokeWidth={2.1} />
        </View>
      )}
      <Text style={{ color: fg, fontWeight: '800', fontSize: 15.5, letterSpacing: 0.2 }}>{label}</Text>
    </Pressable>
  );
}

/* ------------------------------------------------------------------ */
/* Pill                                                               */
/* ------------------------------------------------------------------ */

export function Pill({
  label,
  active = false,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          paddingHorizontal: 14,
          paddingVertical: 8,
          borderRadius: 999,
          backgroundColor: active ? COLORS.primarySoft : COLORS.chip,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <Text
        style={{
          color: active ? COLORS.primaryDark : COLORS.subtext,
          fontWeight: active ? '800' : '600',
          fontSize: 13,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/* ------------------------------------------------------------------ */
/* SectionLabel                                                       */
/* ------------------------------------------------------------------ */

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text
      style={{
        color: COLORS.subtext,
        fontWeight: '700',
        fontSize: 12,
        letterSpacing: 0.8,
        textTransform: 'uppercase',
        marginBottom: 8,
        marginTop: 4,
      }}
    >
      {children}
    </Text>
  );
}

/* ------------------------------------------------------------------ */
/* ListRow                                                            */
/* ------------------------------------------------------------------ */

export function ListRow({
  left,
  avatar,
  title,
  subtitle,
  rightTop,
  rightBottom,
  onPress,
  style,
}: {
  left?: React.ReactNode;
  avatar?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  rightTop?: React.ReactNode;
  rightBottom?: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const leading = left ?? avatar;
  const content = (
    <View style={[{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10 }, style]}>
      {leading != null && <View style={{ marginRight: 12 }}>{leading}</View>}
      <View style={{ flex: 1, minWidth: 0 }}>
        {typeof title === 'string' ? (
          <Text numberOfLines={1} style={{ color: COLORS.ink, fontWeight: '700', fontSize: 15 }}>
            {title}
          </Text>
        ) : (
          title
        )}
        {subtitle != null &&
          (typeof subtitle === 'string' ? (
            <Text numberOfLines={1} style={{ color: COLORS.subtext, fontSize: 12.5, marginTop: 2 }}>
              {subtitle}
            </Text>
          ) : (
            <View style={{ marginTop: 2 }}>{subtitle}</View>
          ))}
      </View>
      {(rightTop != null || rightBottom != null) && (
        <View style={{ alignItems: 'flex-end', marginLeft: 10 }}>
          {rightTop != null &&
            (typeof rightTop === 'string' ? (
              <Text style={{ color: COLORS.ink, fontWeight: '800', fontSize: 15 }}>{rightTop}</Text>
            ) : (
              rightTop
            ))}
          {rightBottom != null &&
            (typeof rightBottom === 'string' ? (
              <Text style={{ color: COLORS.subtext, fontSize: 12, marginTop: 2 }}>{rightBottom}</Text>
            ) : (
              <View style={{ marginTop: 2 }}>{rightBottom}</View>
            ))}
        </View>
      )}
    </View>
  );
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => (pressed ? { opacity: 0.6 } : null)}>
        {content}
      </Pressable>
    );
  }
  return content;
}

/* ------------------------------------------------------------------ */
/* CategoryAvatar                                                     */
/* ------------------------------------------------------------------ */

export function CategoryAvatar({ category, size = 40 }: { category: string; size?: number }) {
  const color = categoryColor(category);
  const emoji = categoryIcon(category);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: withAlpha(color, 0.18),
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontSize: Math.round(size * 0.5) }}>{emoji}</Text>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* BalanceAmount                                                      */
/* ------------------------------------------------------------------ */

export type BalanceKind = 'owed' | 'owe' | 'neutral';

export function BalanceAmount({
  cents,
  kind,
  size = 15,
  weight = '800',
  showSign = false,
}: {
  cents: number;
  kind?: BalanceKind;
  size?: number;
  weight?: TextStyle['fontWeight'];
  showSign?: boolean;
}) {
  let resolved: BalanceKind;
  if (kind) resolved = kind;
  else if (cents > 0) resolved = 'owed';
  else if (cents < 0) resolved = 'owe';
  else resolved = 'neutral';

  const color =
    resolved === 'owed' ? COLORS.owed : resolved === 'owe' ? COLORS.owe : COLORS.subtext;

  const abs = Math.abs(cents);
  const sign = showSign && cents !== 0 ? (cents > 0 ? '+' : '-') : '';
  return (
    <Text style={{ color, fontWeight: weight, fontSize: size }}>
      {sign}
      {formatINR(showSign ? abs : cents)}
    </Text>
  );
}

/* ------------------------------------------------------------------ */
/* SegmentBar                                                         */
/* ------------------------------------------------------------------ */

export function SegmentBar({
  segments,
  height = 10,
  radius,
}: {
  segments: { value: number; color: string }[];
  height?: number;
  radius?: number;
}) {
  const r = radius ?? height / 2;
  const total = segments.reduce((s, x) => s + Math.max(0, x.value), 0);
  return (
    <View
      style={{
        flexDirection: 'row',
        height,
        borderRadius: r,
        overflow: 'hidden',
        backgroundColor: COLORS.chip,
      }}
    >
      {total > 0 &&
        segments.map((s, i) => (
          <View key={i} style={{ flexGrow: Math.max(0, s.value) / total, backgroundColor: s.color }} />
        ))}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Money                                                              */
/* ------------------------------------------------------------------ */

export function Money({
  cents,
  size = 15,
  weight = '700',
  color = COLORS.ink,
  style,
}: {
  cents: number;
  size?: number;
  weight?: TextStyle['fontWeight'];
  color?: string;
  style?: StyleProp<TextStyle>;
}) {
  return <Text style={[{ color, fontWeight: weight, fontSize: size }, style]}>{formatINR(cents)}</Text>;
}

/* ------------------------------------------------------------------ */
/* Field                                                              */
/* ------------------------------------------------------------------ */

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  multiline = false,
  autoFocus = false,
  style,
}: {
  label?: string;
  value: string;
  onChangeText?: (t: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric' | 'decimal-pad' | 'email-address' | 'phone-pad';
  multiline?: boolean;
  autoFocus?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={style}>
      {label != null && (
        <Text style={{ color: COLORS.subtext, fontWeight: '700', fontSize: 12.5, marginBottom: 6 }}>
          {label}
        </Text>
      )}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={COLORS.muted}
        keyboardType={keyboardType}
        multiline={multiline}
        autoFocus={autoFocus}
        style={
          {
            borderWidth: 1,
            borderColor: COLORS.border,
            backgroundColor: COLORS.card,
            borderRadius: 12,
            paddingHorizontal: 14,
            paddingVertical: 12,
            fontSize: 15,
            color: COLORS.ink,
            minHeight: multiline ? 84 : undefined,
            textAlignVertical: multiline ? 'top' : 'center',
            outlineStyle: 'none',
          } as unknown as TextStyle
        }
      />
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* EmptyState                                                         */
/* ------------------------------------------------------------------ */

export function EmptyState({
  emoji,
  title,
  subtitle,
  actionLabel,
  onAction,
}: {
  emoji?: string;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 40, paddingHorizontal: 24 }}>
      {emoji != null && <Text style={{ fontSize: 44, marginBottom: 12 }}>{emoji}</Text>}
      <Text style={{ color: COLORS.ink, fontWeight: '800', fontSize: 17, textAlign: 'center' }}>{title}</Text>
      {subtitle != null && (
        <Text style={{ color: COLORS.subtext, fontSize: 13.5, textAlign: 'center', marginTop: 6, lineHeight: 20 }}>
          {subtitle}
        </Text>
      )}
      {actionLabel != null && onAction && (
        <View style={{ marginTop: 18 }}>
          <Button label={actionLabel} onPress={onAction} icon="plus" />
        </View>
      )}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* MiniBars                                                           */
/* ------------------------------------------------------------------ */

export function MiniBars({
  data,
  height = 44,
  color = COLORS.primary,
  labels,
}: {
  data: number[];
  height?: number;
  color?: string;
  labels?: string[];
}) {
  const max = Math.max(1, ...data.map((d) => Math.abs(d)));
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height, gap: 6 }}>
        {data.map((d, i) => {
          const h = Math.max(3, (Math.abs(d) / max) * height);
          const isLast = i === data.length - 1;
          return (
            <View key={i} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height }}>
              <View
                style={{
                  width: '100%',
                  height: h,
                  borderRadius: 5,
                  backgroundColor: isLast ? color : withAlpha(color, 0.3),
                }}
              />
            </View>
          );
        })}
      </View>
      {labels && (
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 5 }}>
          {labels.map((l, i) => (
            <Text key={i} style={{ flex: 1, textAlign: 'center', color: COLORS.muted, fontSize: 10 }}>
              {l}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* helpers                                                            */
/* ------------------------------------------------------------------ */

/** Add an alpha channel to a #RRGGBB hex color. */
function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  if (h.length !== 6) return hex;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 16,
  },
});
