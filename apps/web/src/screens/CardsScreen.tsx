import React, { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  formatINR,
  formatINRShort,
  groupIndian,
  toCents,
} from '@domain/money';
import {
  daysUntil,
  estimateCreditScore,
  minimumDueCents,
  rewardCoinsFor,
  scoreBand,
  summarizeCards,
} from '@domain/analytics/cards';
import { CARD_GRADIENTS, DARK } from '../theme';
import { Icon } from '../components/ui';
import type { CardNetwork, CardPayment, CreditCard, Expense } from '../store';

interface Props {
  cards: CreditCard[];
  payments: CardPayment[];
  expenses: Expense[];
  rewardCoins: number;
  onOpenCard: (cardId: string) => void;
  onPayCard: (cardId: string) => void;
  onAddCard: (c: {
    name: string;
    issuer?: string;
    network: 'visa' | 'mastercard' | 'rupay' | 'amex';
    last4: string;
    limitCents: number;
    outstandingCents: number;
    dueDateISO: string;
  }) => void;
  onRedeem: (coins: number) => void;
  onBack: () => void;
}

const TODAY = new Date().toISOString().slice(0, 10);

const NETWORKS: { key: CardNetwork; label: string }[] = [
  { key: 'visa', label: 'Visa' },
  { key: 'mastercard', label: 'Mastercard' },
  { key: 'rupay', label: 'RuPay' },
  { key: 'amex', label: 'Amex' },
];

const NETWORK_LABEL: Record<CardNetwork, string> = {
  visa: 'VISA',
  mastercard: 'MASTERCARD',
  rupay: 'RUPAY',
  amex: 'AMEX',
};

const BAND_LABEL: Record<string, string> = {
  poor: 'Poor',
  fair: 'Fair',
  good: 'Good',
  excellent: 'Excellent',
};

const CARD_W = 300;
const CARD_GAP = 14;
const SNAP = CARD_W + CARD_GAP;

/* ---- SVG arc helpers (semicircular score gauge) ---- */
function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const a = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy - r * Math.sin(a) };
}
function arcPath(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  const start = polar(cx, cy, r, startAngle);
  const end = polar(cx, cy, r, endAngle);
  const large = Math.abs(endAngle - startAngle) > 180 ? 1 : 0;
  const sweep = startAngle > endAngle ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${large} ${sweep} ${end.x} ${end.y}`;
}

function scoreArc(score: number): string {
  const f = Math.max(0, Math.min(1, (score - 300) / 600));
  const end = 180 - f * 180;
  return arcPath(100, 100, 80, 180, end);
}

function daysLabel(days: number): string {
  if (days < 0) return `Overdue ${Math.abs(days)}d`;
  if (days === 0) return 'Due today';
  return `Due in ${days} day${days === 1 ? '' : 's'}`;
}

export default function CardsScreen({
  cards,
  payments,
  expenses,
  rewardCoins,
  onOpenCard,
  onPayCard,
  onAddCard,
  onRedeem,
  onBack,
}: Props) {
  const [activeIndex, setActiveIndex] = useState(0);

  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [issuer, setIssuer] = useState('');
  const [network, setNetwork] = useState<CardNetwork>('visa');
  const [last4, setLast4] = useState('');
  const [limit, setLimit] = useState('');
  const [outstanding, setOutstanding] = useState('');
  const [dueDateISO, setDueDateISO] = useState(TODAY);

  const score = useMemo(
    () =>
      estimateCreditScore({
        cards: cards.map((c) => ({ outstandingCents: c.outstandingCents, limitCents: c.limitCents })),
        onTimePayments: payments.length,
        latePayments: 0,
      }),
    [cards, payments.length],
  );
  const band = useMemo(() => scoreBand(score), [score]);

  const summary = useMemo(
    () =>
      summarizeCards(
        cards.map((c) => ({
          outstandingCents: c.outstandingCents,
          limitCents: c.limitCents,
          dueDateISO: c.dueDateISO,
        })),
        TODAY,
      ),
    [cards],
  );

  const utilPct = useMemo(() => Math.round(summary.utilization * 100), [summary.utilization]);
  const utilColor = utilPct >= 70 ? DARK.red : utilPct >= 30 ? DARK.gold : DARK.green;
  const scoreFactor =
    summary.utilization < 0.3
      ? 'Low credit utilization'
      : 'High utilization is affecting your score';

  const nearestCard = useMemo(() => {
    if (!summary.nearestDueISO) return null;
    return cards.find((c) => c.dueDateISO === summary.nearestDueISO) ?? null;
  }, [cards, summary.nearestDueISO]);

  const nearestPay = nearestCard
    ? nearestCard.statementCents ?? nearestCard.outstandingCents
    : 0;
  const nearestMin = nearestCard
    ? nearestCard.minDueCents ?? minimumDueCents(nearestCard.outstandingCents)
    : 0;

  const recentPayments = useMemo(
    () => payments.slice().sort((a, b) => b.createdAt - a.createdAt).slice(0, 12),
    [payments],
  );

  // Card cycle spend (from expenses that hit each card) — powers a subtle
  // "spent this cycle" hint on the active card.
  const cardSpend = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of expenses) {
      if (e.cardId) map[e.cardId] = (map[e.cardId] ?? 0) + e.amountCents;
    }
    return map;
  }, [expenses]);

  function cardName(cardId: string): string {
    return cards.find((c) => c.id === cardId)?.name ?? 'Card';
  }

  const canSave =
    name.trim().length > 0 && last4.trim().length === 4 && toCents(parseFloat(limit) || 0) > 0;

  function resetForm() {
    setName('');
    setIssuer('');
    setNetwork('visa');
    setLast4('');
    setLimit('');
    setOutstanding('');
    setDueDateISO(TODAY);
  }

  function saveCard() {
    if (!canSave) return;
    onAddCard({
      name: name.trim(),
      issuer: issuer.trim() || undefined,
      network,
      last4: last4.trim(),
      limitCents: toCents(parseFloat(limit) || 0),
      outstandingCents: toCents(parseFloat(outstanding) || 0),
      dueDateISO: dueDateISO.trim() || TODAY,
    });
    resetForm();
    setAdding(false);
  }

  return (
    <View style={styles.root}>
      {/* 1. Top bar */}
      <View style={styles.topBar}>
        <Pressable onPress={onBack} hitSlop={10} style={styles.backBtn}>
          <View style={styles.chevBack}>
            <Icon name="chevron" color={DARK.text} size={20} strokeWidth={2.2} />
          </View>
        </Pressable>
        <Text style={styles.topTitle}>Cards</Text>
        <View style={styles.coinsPill}>
          <Icon name="sparkles" color={DARK.gold} size={14} strokeWidth={2} />
          <Text style={styles.coinsPillText}>{groupIndian(String(rewardCoins))} coins</Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollBody} showsVerticalScrollIndicator={false}>
        {/* 2. Credit score */}
        <View style={styles.scoreCard}>
          <Text style={styles.eyebrow}>Credit score</Text>
          <View style={styles.gaugeWrap}>
            <svg viewBox="0 0 200 116" width={220} height={128}>
              <defs>
                <linearGradient id="scoreGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor={DARK.gold} />
                  <stop offset="100%" stopColor={DARK.green} />
                </linearGradient>
              </defs>
              <path
                d={arcPath(100, 100, 80, 180, 0)}
                fill="none"
                stroke={DARK.border}
                strokeWidth={14}
                strokeLinecap="round"
              />
              <path
                d={scoreArc(score)}
                fill="none"
                stroke="url(#scoreGrad)"
                strokeWidth={14}
                strokeLinecap="round"
              />
            </svg>
            <View style={styles.gaugeCenter} pointerEvents="none">
              <Text style={styles.scoreValue}>{score}</Text>
              <Text style={[styles.scoreBand, { color: band === 'poor' ? DARK.red : band === 'fair' ? DARK.gold : DARK.green }]}>
                {BAND_LABEL[band]}
              </Text>
            </View>
          </View>
          <View style={styles.gaugeScaleRow}>
            <Text style={styles.gaugeScale}>300</Text>
            <Text style={styles.gaugeScale}>900</Text>
          </View>
          <Text style={styles.scoreUpdated}>Updated today</Text>
          <View style={styles.factorRow}>
            <View style={[styles.factorDot, { backgroundColor: summary.utilization < 0.3 ? DARK.green : DARK.red }]} />
            <Text style={styles.factorText}>{scoreFactor}</Text>
          </View>
        </View>

        {/* 3. Card stack */}
        {cards.length > 0 ? (
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={SNAP}
              decelerationRate="fast"
              contentContainerStyle={styles.stackBody}
              onScroll={(e) => {
                const x = e.nativeEvent.contentOffset.x;
                setActiveIndex(Math.round(x / SNAP));
              }}
              scrollEventThrottle={16}
            >
              {cards.map((card) => {
                const [from, to] = CARD_GRADIENTS[card.network] ?? CARD_GRADIENTS.default;
                const d = daysUntil(TODAY, card.dueDateISO);
                const urgent = d <= 3;
                const spent = cardSpend[card.id] ?? 0;
                return (
                  <Pressable
                    key={card.id}
                    onPress={() => onOpenCard(card.id)}
                    style={[
                      styles.cardFace,
                      { backgroundImage: `linear-gradient(135deg, ${from}, ${to})` } as unknown as object,
                    ]}
                  >
                    <View style={styles.cardTop}>
                      <View>
                        <Text style={styles.cardIssuer}>{card.issuer ?? card.name}</Text>
                        {card.issuer ? <Text style={styles.cardName}>{card.name}</Text> : null}
                      </View>
                      <Text style={styles.cardNetwork}>{NETWORK_LABEL[card.network]}</Text>
                    </View>
                    <Text style={styles.cardNumber}>{`•••• ${card.last4}`}</Text>
                    <View style={styles.cardBottom}>
                      <View>
                        <Text style={styles.cardFaceLabel}>Outstanding</Text>
                        <Text style={styles.cardOutstanding}>{formatINRShort(card.outstandingCents)}</Text>
                        {spent > 0 ? (
                          <Text style={styles.cardSpent}>{formatINRShort(spent)} spent this cycle</Text>
                        ) : null}
                      </View>
                      <View style={[styles.duePill, urgent && styles.duePillUrgent]}>
                        <Text style={[styles.dueText, urgent && { color: '#fff' }]}>{daysLabel(d)}</Text>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
            <View style={styles.dots}>
              {cards.map((c, i) => (
                <View key={c.id} style={[styles.dot, i === activeIndex && styles.dotActive]} />
              ))}
            </View>
          </>
        ) : (
          <View style={styles.emptyStack}>
            <Icon name="wallet" color={DARK.muted} size={26} />
            <Text style={styles.emptyStackText}>No cards yet. Add one to start tracking bills and rewards.</Text>
          </View>
        )}

        {/* 4. Pay nearest-due card */}
        {nearestCard ? (
          <View style={styles.paySection}>
            <Pressable style={styles.payBtn} onPress={() => onPayCard(nearestCard.id)}>
              <Text style={styles.payBtnText}>Pay {formatINR(nearestPay)}</Text>
            </Pressable>
            <Text style={styles.paySub}>
              {cardName(nearestCard.id)} · Min due {formatINRShort(nearestMin)} · earn coins
            </Text>
          </View>
        ) : null}

        {/* 5. Total outstanding + utilization */}
        {cards.length > 0 ? (
          <View style={styles.utilCard}>
            <View style={styles.utilRow}>
              <Text style={styles.utilLabel}>Total outstanding</Text>
              <Text style={styles.utilTotal}>{formatINR(summary.totalOutstandingCents)}</Text>
            </View>
            <View style={styles.utilTrack}>
              <View style={[styles.utilFill, { width: `${Math.min(100, Math.max(2, utilPct))}%`, backgroundColor: utilColor }]} />
            </View>
            <View style={styles.utilRow}>
              <Text style={[styles.utilPct, { color: utilColor }]}>{utilPct}% utilized</Text>
              <Text style={styles.utilLimit}>of {formatINRShort(summary.totalLimitCents)} limit</Text>
            </View>
          </View>
        ) : null}

        {/* 6. Rewards */}
        <View style={styles.rewardsCard}>
          <View style={styles.rewardsTop}>
            <View>
              <Text style={styles.eyebrow}>Rewards</Text>
              <View style={styles.coinsBalanceRow}>
                <Icon name="sparkles" color={DARK.gold} size={20} strokeWidth={2} />
                <Text style={styles.coinsBalance}>{groupIndian(String(rewardCoins))}</Text>
                <Text style={styles.coinsUnit}>coins</Text>
              </View>
            </View>
            <Pressable style={styles.redeemBtn} onPress={() => onRedeem(500)}>
              <Text style={styles.redeemText}>Redeem</Text>
            </Pressable>
          </View>
          <View style={styles.offerRow}>
            <View style={styles.offerTile}>
              <Icon name="star" color={DARK.gold} size={16} strokeWidth={2} />
              <Text style={styles.offerText}>Flat ₹500 back on ₹5,000 spend</Text>
            </View>
            <View style={styles.offerTile}>
              <Icon name="sparkles" color={DARK.green} size={16} strokeWidth={2} />
              <Text style={styles.offerText}>5% back on utility bills</Text>
            </View>
          </View>
        </View>

        {/* 7. Recent payments */}
        <Text style={styles.sectionTitle}>Recent payments</Text>
        {recentPayments.length === 0 ? (
          <View style={styles.emptyPayments}>
            <Text style={styles.emptyPaymentsText}>No payments yet.</Text>
          </View>
        ) : (
          <View style={styles.timeline}>
            {recentPayments.map((p, i) => {
              const coins = rewardCoinsFor(p.amountCents);
              return (
                <View key={p.id} style={[styles.tlRow, i > 0 && styles.tlRowBorder]}>
                  <View style={styles.tlDotCol}>
                    <View style={styles.tlDot} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.tlName}>{cardName(p.cardId)}</Text>
                    <Text style={styles.tlDate}>{p.dateISO}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.tlAmount}>-{formatINR(p.amountCents)}</Text>
                    {coins > 0 ? <Text style={styles.tlCoins}>+{groupIndian(String(coins))} coins</Text> : null}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* 8. Add card */}
        {!adding ? (
          <Pressable style={styles.addPill} onPress={() => setAdding(true)}>
            <Icon name="plus" color={DARK.text} size={16} strokeWidth={2.4} />
            <Text style={styles.addPillText}>Add card</Text>
          </Pressable>
        ) : (
          <View style={styles.form}>
            <View style={styles.formHead}>
              <Text style={styles.sectionTitle}>New card</Text>
              <Pressable onPress={() => setAdding(false)} hitSlop={8}>
                <Icon name="x" color={DARK.subtext} size={18} strokeWidth={2.2} />
              </Pressable>
            </View>

            <Text style={styles.fieldLabel}>Card name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Rewards Signature"
              placeholderTextColor={DARK.muted}
            />

            <Text style={styles.fieldLabel}>Issuer (optional)</Text>
            <TextInput
              style={styles.input}
              value={issuer}
              onChangeText={setIssuer}
              placeholder="e.g. Metro Bank"
              placeholderTextColor={DARK.muted}
            />

            <Text style={styles.fieldLabel}>Network</Text>
            <View style={styles.pillRow}>
              {NETWORKS.map((n) => {
                const on = network === n.key;
                return (
                  <Pressable
                    key={n.key}
                    onPress={() => setNetwork(n.key)}
                    style={[styles.netPill, on && styles.netPillOn]}
                  >
                    <Text style={[styles.netPillText, on && styles.netPillTextOn]}>{n.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.fieldLabel}>Last 4 digits</Text>
            <TextInput
              style={styles.input}
              value={last4}
              onChangeText={(t) => setLast4(t.replace(/[^0-9]/g, '').slice(0, 4))}
              placeholder="1234"
              placeholderTextColor={DARK.muted}
              keyboardType="numeric"
              maxLength={4}
            />

            <View style={styles.row2}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Credit limit (₹)</Text>
                <TextInput
                  style={styles.input}
                  value={limit}
                  onChangeText={setLimit}
                  placeholder="100000"
                  placeholderTextColor={DARK.muted}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Outstanding (₹)</Text>
                <TextInput
                  style={styles.input}
                  value={outstanding}
                  onChangeText={setOutstanding}
                  placeholder="0"
                  placeholderTextColor={DARK.muted}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>

            <Text style={styles.fieldLabel}>Due date (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.input}
              value={dueDateISO}
              onChangeText={setDueDateISO}
              placeholder={TODAY}
              placeholderTextColor={DARK.muted}
            />

            <Pressable style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]} onPress={saveCard} disabled={!canSave}>
              <Text style={styles.saveBtnText}>Save card</Text>
            </Pressable>
          </View>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: DARK.bg },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },
  backBtn: { width: 40 },
  chevBack: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: DARK.surface,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '180deg' }],
    borderWidth: 1,
    borderColor: DARK.border,
  },
  topTitle: { color: DARK.text, fontWeight: '900', fontSize: 18 },
  coinsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: DARK.goldSoft,
    borderWidth: 1,
    borderColor: 'rgba(231,197,131,0.35)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  coinsPillText: { color: DARK.gold, fontWeight: '800', fontSize: 12 },

  scroll: { flex: 1 },
  scrollBody: { padding: 16, paddingTop: 6 },

  eyebrow: {
    color: DARK.subtext,
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },

  scoreCard: {
    backgroundColor: DARK.surface,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: DARK.border,
    alignItems: 'center',
  },
  gaugeWrap: { width: 220, height: 128, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  gaugeCenter: {
    position: 'absolute',
    top: 34,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  scoreValue: { color: DARK.text, fontWeight: '900', fontSize: 40, lineHeight: 44 },
  scoreBand: { fontWeight: '800', fontSize: 14, marginTop: 2 },
  gaugeScaleRow: { flexDirection: 'row', justifyContent: 'space-between', width: 200, marginTop: -6 },
  gaugeScale: { color: DARK.muted, fontSize: 11, fontWeight: '700' },
  scoreUpdated: { color: DARK.muted, fontSize: 11.5, marginTop: 6 },
  factorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 12,
    backgroundColor: DARK.surface2,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  factorDot: { width: 8, height: 8, borderRadius: 4 },
  factorText: { color: DARK.text, fontSize: 12.5, fontWeight: '600' },

  stackBody: { paddingVertical: 18, paddingRight: 16 },
  cardFace: {
    width: CARD_W,
    height: 180,
    borderRadius: 20,
    padding: 20,
    marginRight: CARD_GAP,
    justifyContent: 'space-between',
    // subtle premium sheen border handled by gradient; keep elevation-like shadow
    boxShadow: '0 12px 30px rgba(0,0,0,0.45)' as unknown as undefined,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  cardIssuer: { color: '#fff', fontWeight: '800', fontSize: 15 },
  cardName: { color: 'rgba(255,255,255,0.72)', fontWeight: '600', fontSize: 12, marginTop: 2 },
  cardNetwork: { color: 'rgba(255,255,255,0.9)', fontWeight: '800', fontSize: 12, letterSpacing: 1.5 },
  cardNumber: { color: '#fff', fontWeight: '700', fontSize: 18, letterSpacing: 3 },
  cardBottom: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  cardFaceLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardOutstanding: { color: '#fff', fontWeight: '900', fontSize: 24, marginTop: 2 },
  cardSpent: { color: 'rgba(255,255,255,0.6)', fontSize: 10.5, marginTop: 3 },
  duePill: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  duePillUrgent: { backgroundColor: DARK.red },
  dueText: { color: '#fff', fontWeight: '800', fontSize: 11 },

  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: -4, marginBottom: 4 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: DARK.border },
  dotActive: { backgroundColor: DARK.gold, width: 18 },

  emptyStack: {
    backgroundColor: DARK.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: DARK.border,
    padding: 24,
    alignItems: 'center',
    gap: 10,
    marginTop: 16,
  },
  emptyStackText: { color: DARK.subtext, fontSize: 13, textAlign: 'center', lineHeight: 19 },

  paySection: { marginTop: 4 },
  payBtn: {
    backgroundColor: DARK.gold,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    boxShadow: '0 8px 22px rgba(231,197,131,0.25)' as unknown as undefined,
  },
  payBtnText: { color: '#1B1205', fontWeight: '900', fontSize: 16 },
  paySub: { color: DARK.subtext, fontSize: 12, textAlign: 'center', marginTop: 8 },

  utilCard: {
    backgroundColor: DARK.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: DARK.border,
    marginTop: 16,
  },
  utilRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  utilLabel: { color: DARK.subtext, fontSize: 12.5, fontWeight: '700' },
  utilTotal: { color: DARK.text, fontWeight: '900', fontSize: 18 },
  utilTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: DARK.surface2,
    overflow: 'hidden',
    marginVertical: 10,
  },
  utilFill: { height: 8, borderRadius: 4 },
  utilPct: { fontWeight: '800', fontSize: 12.5 },
  utilLimit: { color: DARK.muted, fontSize: 12 },

  rewardsCard: {
    backgroundColor: DARK.surface,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: DARK.border,
    marginTop: 16,
  },
  rewardsTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  coinsBalanceRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 7, marginTop: 6 },
  coinsBalance: { color: DARK.gold, fontWeight: '900', fontSize: 30, lineHeight: 32 },
  coinsUnit: { color: DARK.subtext, fontWeight: '700', fontSize: 13, marginBottom: 3 },
  redeemBtn: {
    backgroundColor: DARK.goldSoft,
    borderWidth: 1,
    borderColor: 'rgba(231,197,131,0.4)',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
  },
  redeemText: { color: DARK.gold, fontWeight: '800', fontSize: 13 },
  offerRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  offerTile: {
    flex: 1,
    backgroundColor: DARK.surface2,
    borderRadius: 14,
    padding: 12,
    gap: 8,
  },
  offerText: { color: DARK.text, fontSize: 12, fontWeight: '600', lineHeight: 17 },

  sectionTitle: { color: DARK.text, fontWeight: '800', fontSize: 15, marginTop: 22, marginBottom: 10 },

  emptyPayments: {
    backgroundColor: DARK.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: DARK.border,
    padding: 18,
  },
  emptyPaymentsText: { color: DARK.subtext, fontSize: 13 },

  timeline: {
    backgroundColor: DARK.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: DARK.border,
    paddingHorizontal: 16,
  },
  tlRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, gap: 12 },
  tlRowBorder: { borderTopWidth: 1, borderTopColor: DARK.border },
  tlDotCol: { width: 10, alignItems: 'center' },
  tlDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: DARK.green },
  tlName: { color: DARK.text, fontWeight: '700', fontSize: 14 },
  tlDate: { color: DARK.muted, fontSize: 11.5, marginTop: 2 },
  tlAmount: { color: DARK.text, fontWeight: '800', fontSize: 14 },
  tlCoins: { color: DARK.gold, fontWeight: '700', fontSize: 11.5, marginTop: 2 },

  addPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: DARK.surface2,
    borderWidth: 1,
    borderColor: DARK.border,
    borderRadius: 999,
    paddingVertical: 14,
    marginTop: 20,
  },
  addPillText: { color: DARK.text, fontWeight: '800', fontSize: 14 },

  form: {
    backgroundColor: DARK.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: DARK.border,
    padding: 18,
    marginTop: 20,
  },
  formHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fieldLabel: { color: DARK.subtext, fontSize: 12, fontWeight: '700', marginTop: 14, marginBottom: 6 },
  input: {
    backgroundColor: DARK.surface2,
    borderWidth: 1,
    borderColor: DARK.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: DARK.text,
    fontSize: 14,
    fontWeight: '600',
  },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  netPill: {
    backgroundColor: DARK.surface2,
    borderWidth: 1,
    borderColor: DARK.border,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
  },
  netPillOn: { backgroundColor: DARK.goldSoft, borderColor: DARK.gold },
  netPillText: { color: DARK.subtext, fontWeight: '700', fontSize: 12.5 },
  netPillTextOn: { color: DARK.gold },
  row2: { flexDirection: 'row', gap: 12 },
  saveBtn: {
    backgroundColor: DARK.gold,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 20,
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { color: '#1B1205', fontWeight: '900', fontSize: 15 },
});
