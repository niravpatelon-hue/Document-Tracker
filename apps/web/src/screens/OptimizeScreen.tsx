import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { formatINR } from '@domain/money';
import { monthKeyOf, previousMonth, type SpendTxn } from '@domain/analytics/spend';
import {
  buildSuggestions,
  potentialSavingsCents,
  type OptimizeCard,
  type Suggestion,
  type SuggestionKind,
  type SuggestionSeverity,
} from '@domain/analytics/optimize';
import { COLORS } from '../theme';
import { Button, Card, EmptyState, Icon, IconChip, SectionLabel } from '../components/ui';
import { expenseToSpendTxn, type Budget, type CreditCard, type Expense } from '../store';

interface Props {
  expenses: Expense[];
  budgets: Budget[];
  cards: CreditCard[];
  onOpenCards: () => void;
  onOpenAnalysis: () => void;
  onOpenChat: () => void;
}

const TODAY = new Date().toISOString().slice(0, 10);

const SEVERITY_STYLE: Record<SuggestionSeverity, { fg: string; bg: string; icon: 'bell' | 'star' | 'sparkles' }> = {
  high: { fg: COLORS.danger, bg: COLORS.oweSoft, icon: 'bell' },
  warn: { fg: COLORS.warn, bg: COLORS.warnSoft, icon: 'star' },
  info: { fg: COLORS.primary, bg: COLORS.primarySoft, icon: 'sparkles' },
};

const CARD_KINDS: ReadonlySet<SuggestionKind> = new Set<SuggestionKind>(['card_due', 'card_utilization']);
const ANALYSIS_KINDS: ReadonlySet<SuggestionKind> = new Set<SuggestionKind>([
  'budget_over',
  'category_high',
  'spend_spike',
]);

export default function OptimizeScreen({ expenses, budgets, cards, onOpenCards, onOpenAnalysis, onOpenChat }: Props) {
  const nowKey = useMemo(() => monthKeyOf(TODAY), []);
  const prevKey = useMemo(() => previousMonth(nowKey), [nowKey]);

  const { txns, prevTxns } = useMemo(() => {
    const all: SpendTxn[] = expenses.map(expenseToSpendTxn);
    return {
      txns: all.filter((t) => monthKeyOf(t.dateISO) === nowKey),
      prevTxns: all.filter((t) => monthKeyOf(t.dateISO) === prevKey),
    };
  }, [expenses, nowKey, prevKey]);

  const budgetInputs = useMemo(
    () => budgets.map((b) => ({ category: b.category, limitCents: b.limitCents })),
    [budgets],
  );

  const cardInputs = useMemo<OptimizeCard[]>(
    () =>
      cards.map((c) => ({
        name: c.name,
        outstandingCents: c.outstandingCents,
        limitCents: c.limitCents,
        dueDateISO: c.dueDateISO,
      })),
    [cards],
  );

  const suggestions = useMemo(
    () =>
      buildSuggestions({
        txns,
        prevTxns,
        budgets: budgetInputs,
        cards: cardInputs,
        todayISO: TODAY,
      }),
    [txns, prevTxns, budgetInputs, cardInputs],
  );

  const savings = useMemo(() => potentialSavingsCents(suggestions), [suggestions]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      <Text style={styles.screenTitle}>Optimize</Text>

      <Card style={styles.hero}>
        <View style={styles.heroTopRow}>
          <IconChip name="sparkles" color={COLORS.primaryDark} bg="#FFFFFF" size={40} />
          <Text style={styles.heroTitle}>Optimize your spending</Text>
        </View>
        <Text style={styles.heroBig}>{formatINR(savings)}</Text>
        <Text style={styles.heroLine}>You could save about this much this month</Text>
        <Text style={styles.heroCount}>
          {suggestions.length} tip{suggestions.length === 1 ? '' : 's'} found
        </Text>
      </Card>

      <Card style={styles.chatCard} onPress={onOpenChat}>
        <View style={styles.chatRow}>
          <IconChip name="sparkles" color={COLORS.primaryDark} bg={COLORS.primarySoft} size={40} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.title}>Ask AI about your spending</Text>
            <Text style={styles.detail}>Get instant answers about any expense, budget, or card</Text>
          </View>
          <Icon name="chevron" color={COLORS.muted} size={20} />
        </View>
      </Card>

      <View style={{ marginTop: 20 }}>
        <SectionLabel>Suggestions</SectionLabel>
      </View>

      {suggestions.length === 0 ? (
        <Card style={{ marginTop: 10 }}>
          <EmptyState
            emoji="🎉"
            title="You're all optimized!"
            subtitle="No suggestions right now — check back after your next few expenses."
          />
        </Card>
      ) : (
        <View style={{ marginTop: 10 }}>
          {suggestions.map((s: Suggestion, i: number) => {
            const sev = SEVERITY_STYLE[s.severity];
            return (
              <Card key={s.id} style={i > 0 ? { marginTop: 10 } : undefined}>
                <View style={styles.row}>
                  <IconChip name={sev.icon} color={sev.fg} bg={sev.bg} size={40} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.title}>{s.title}</Text>
                    <Text style={styles.detail}>{s.detail}</Text>
                  </View>
                  {s.amountCents != null && s.amountCents > 0 && (
                    <View style={[styles.amountChip, { backgroundColor: sev.bg }]}>
                      <Text style={[styles.amountText, { color: sev.fg }]}>{formatINR(s.amountCents)}</Text>
                    </View>
                  )}
                </View>
                {CARD_KINDS.has(s.kind) && (
                  <View style={styles.actionRow}>
                    <Button label="Manage cards" onPress={onOpenCards} variant="secondary" icon="wallet" />
                  </View>
                )}
                {ANALYSIS_KINDS.has(s.kind) && (
                  <View style={styles.actionRow}>
                    <Button label="View analysis" onPress={onOpenAnalysis} variant="secondary" icon="arrowUp" />
                  </View>
                )}
              </Card>
            );
          })}
        </View>
      )}

      <View style={{ height: 12 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.screenBg },
  scroll: { padding: 16, paddingBottom: 28 },
  screenTitle: { color: COLORS.ink, fontWeight: '900', fontSize: 22 },

  hero: { marginTop: 14, backgroundColor: COLORS.primarySoft, borderRadius: 22, padding: 18 },
  heroTopRow: { flexDirection: 'row', alignItems: 'center' },
  heroTitle: { color: COLORS.primaryDark, fontWeight: '800', fontSize: 15, marginLeft: 10 },
  heroBig: { color: COLORS.ink, fontWeight: '900', fontSize: 30, marginTop: 16 },
  heroLine: { color: COLORS.ink, fontSize: 13.5, fontWeight: '600', marginTop: 4 },
  heroCount: { color: COLORS.primaryDark, fontSize: 12.5, fontWeight: '800', marginTop: 10 },

  chatCard: { marginTop: 14 },
  chatRow: { flexDirection: 'row', alignItems: 'center' },

  row: { flexDirection: 'row', alignItems: 'flex-start' },
  title: { color: COLORS.ink, fontWeight: '800', fontSize: 14.5 },
  detail: { color: COLORS.subtext, fontSize: 12.5, marginTop: 3, lineHeight: 18 },
  amountChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginLeft: 8,
  },
  amountText: { fontWeight: '800', fontSize: 12.5 },
  actionRow: { flexDirection: 'row', marginTop: 12 },
});
