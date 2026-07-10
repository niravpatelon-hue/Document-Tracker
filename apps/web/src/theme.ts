export const COLORS = {
  bg: '#ffffff',
  screenBg: '#f5f7fb',
  // Brand blues (varied tones)
  primary: '#1d4ed8',
  primaryDark: '#1e3a8a',
  primaryMid: '#3b82f6',
  sky: '#60a5fa',
  accentSoft: '#dbeafe',
  // Neutrals
  text: '#0f172a',
  subtext: '#64748b',
  border: '#e7ebf2',
  chip: '#eef1f5',
  // Semantic
  danger: '#b42318',
  success: '#059669',
  warnBg: '#fef0e0',
  warnText: '#b45309',
  // Fintech direction tokens
  navyA: '#14213d',
  navyB: '#0b1220',
  good: '#059669',
  warn: '#b45309',
  info: '#2563eb',
  // Chart / summary series (income green, expense orange, savings amber)
  income: '#16a34a',
  incomeSoft: '#dcfce7',
  expense: '#f97316',
  expenseSoft: '#ffedd5',
  savings: '#eab308',
  savingsSoft: '#fef9c3',
  // Credit-card gradient (blue) + progress track
  cardA: '#2563eb',
  cardB: '#1e3a8a',
  track: '#eaf0f9',
};

export const CATEGORY_LABEL: Record<string, string> = {
  bills_receipts: 'Bill / Receipt',
  warranty: 'Warranty',
  loyalty: 'Loyalty / Gift card',
  other: 'Other',
};

/** App-wide currency for the Indian market. Amounts are stored as integer paise. */
export const CURRENCY = 'INR';
export const CURRENCY_SYMBOL = '₹';
