/**
 * "Friendly & rounded" design tokens — a warm, social, Splitwise-leaning look.
 * Teal-green primary, soft neutrals, orange for "you owe" and green for
 * "you are owed". Amounts are stored as integer paise; currency is INR.
 */
export const COLORS = {
  // Brand
  primary: '#1CC29F',
  primaryDark: '#159C80',
  primarySoft: '#E4F7F2',
  // Text / neutrals
  ink: '#1B2733',
  text: '#1B2733',
  subtext: '#6B7C8F',
  muted: '#9AA8B4',
  border: '#E9EEF1',
  divider: '#F0F3F5',
  screenBg: '#F5F7F8',
  bg: '#FFFFFF',
  card: '#FFFFFF',
  chip: '#EEF3F4',
  // Balance semantics
  owe: '#FF652F',
  oweSoft: '#FFE9E0',
  owed: '#1CC29F',
  owedSoft: '#E4F7F2',
  // Status
  danger: '#E5484D',
  warn: '#F5A623',
  warnSoft: '#FFF3DE',
  success: '#1CC29F',
  info: '#3B82F6',
  star: '#FFB800',
};

/** Distinct, friendly avatar / accent colors (assigned by index or hash). */
export const AVATAR_COLORS = [
  '#1CC29F', '#5B8DEF', '#FF652F', '#F5A623', '#9B59F6',
  '#EF5DA8', '#2DBFA8', '#F4655B', '#6C7BFF', '#00A8A8',
];

export const CURRENCY = 'INR';
export const CURRENCY_SYMBOL = '₹';

/** Premium dark palette for the Credit Cards section (card-forward, elegant). */
export const DARK = {
  bg: '#0B0E13',
  surface: '#151A21',
  surface2: '#1E252F',
  raised: '#232C38',
  text: '#F2F5F8',
  subtext: '#9BA6B2',
  muted: '#6B7684',
  border: '#2A323D',
  gold: '#E7C583',
  goldSoft: 'rgba(231,197,131,0.14)',
  green: '#33D9A6',
  greenSoft: 'rgba(51,217,166,0.14)',
  red: '#FF6B5A',
  blue: '#5B8DEF',
};

/** Deep, premium card-face gradients keyed by network. */
export const CARD_GRADIENTS: Record<string, [string, string]> = {
  visa: ['#243B6B', '#0B1220'],
  mastercard: ['#3E2434', '#160D14'],
  rupay: ['#123A2B', '#0A1A14'],
  amex: ['#1D4147', '#0B1B1E'],
  default: ['#232B36', '#0E1116'],
};
