/**
 * CardPayScreen — premium dark pay-bill flow for a single credit card.
 *
 * Full-bleed dark screen with its own top bar (close X + title). Presents
 * three selectable amount options (total due / minimum due / custom), shows
 * the reward coins that would be earned, and a big "Pay via UPI" action.
 * On success, swaps into an in-screen success state with a "Done" exit.
 */
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { formatINR, toCents } from '@domain/money';
import { minimumDueCents, rewardCoinsFor } from '@domain/analytics/cards';
import { DARK, CARD_GRADIENTS } from '../theme';
import { Icon } from '../components/ui';
import type { CreditCard } from '../store';

interface Props {
  card: CreditCard;
  onPay: (amountCents: number) => void;
  onClose: () => void;
}

type Option = 'total' | 'min' | 'custom';

export default function CardPayScreen({ card, onPay, onClose }: Props) {
  const [g1, g2] = CARD_GRADIENTS[card.network] ?? CARD_GRADIENTS.default;

  const totalDue = card.statementCents ?? card.outstandingCents;
  const minDue = card.minDueCents ?? minimumDueCents(card.outstandingCents);

  const [selected, setSelected] = useState<Option>('total');
  const [customRupees, setCustomRupees] = useState('');
  const [paidAmountCents, setPaidAmountCents] = useState<number | null>(null);

  const customCents = useMemo(() => {
    const n = parseFloat(customRupees);
    if (!Number.isFinite(n) || n <= 0) return 0;
    return toCents(n);
  }, [customRupees]);

  const amountCents = useMemo(() => {
    if (selected === 'total') return totalDue;
    if (selected === 'min') return minDue;
    return customCents;
  }, [selected, totalDue, minDue, customCents]);

  const validAmount = amountCents > 0 && amountCents <= Math.max(card.outstandingCents, totalDue, 1);
  const coins = rewardCoinsFor(amountCents, card.rewardRate ?? 1);

  function handlePay() {
    if (!validAmount) return;
    onPay(amountCents);
    setPaidAmountCents(amountCents);
  }

  if (paidAmountCents != null) {
    const paidCoins = rewardCoinsFor(paidAmountCents, card.rewardRate ?? 1);
    return (
      <View style={styles.root}>
        <View style={styles.topBar}>
          <View style={styles.topBarBtn} />
          <Text style={styles.topBarTitle}>Payment</Text>
          <View style={styles.topBarBtn} />
        </View>

        <View style={styles.successWrap}>
          <View style={styles.successCircle}>
            <Icon name="check" color={DARK.bg} size={40} strokeWidth={3} />
          </View>
          <Text style={styles.successTitle}>Payment successful</Text>
          <Text style={styles.successAmount}>{formatINR(paidAmountCents)}</Text>
          <Text style={styles.successCoins}>+{paidCoins} coins earned</Text>

          <Pressable
            onPress={onClose}
            style={({ pressed }) => [styles.primaryBtn, { marginTop: 32 }, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.primaryBtnText}>Done</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <Pressable onPress={onClose} hitSlop={10} style={styles.topBarBtn}>
          <Icon name="x" color={DARK.text} size={18} strokeWidth={2.4} />
        </Pressable>
        <Text style={styles.topBarTitle}>Pay bill</Text>
        <View style={styles.topBarBtn} />
      </View>

      <View style={styles.scroll}>
        {/* Mini card face */}
        <View
          style={[
            styles.miniCard,
            { backgroundImage: `linear-gradient(135deg, ${g1}, ${g2})` } as unknown as object,
          ]}
        >
          <View style={styles.miniCardTopRow}>
            <Text style={styles.miniCardIssuer}>{card.issuer ?? 'BANK'}</Text>
            <Text style={styles.miniCardNetwork}>{card.network.toUpperCase()}</Text>
          </View>
          <Text style={styles.miniCardNumber}>•••• {card.last4}</Text>
        </View>

        {/* Amount options */}
        <Text style={styles.sectionLabel}>CHOOSE AMOUNT</Text>

        <Pressable
          onPress={() => setSelected('total')}
          style={[styles.optionCard, selected === 'total' && styles.optionCardSelected]}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.optionLabel}>Total due</Text>
            <Text style={styles.optionSub}>Pay off the full statement</Text>
          </View>
          <Text style={styles.optionValue}>{formatINR(totalDue)}</Text>
        </Pressable>

        <Pressable
          onPress={() => setSelected('min')}
          style={[styles.optionCard, selected === 'min' && styles.optionCardSelected]}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.optionLabel}>Minimum due</Text>
            <Text style={styles.optionSub}>Keep the account in good standing</Text>
          </View>
          <Text style={styles.optionValue}>{formatINR(minDue)}</Text>
        </Pressable>

        <Pressable
          onPress={() => setSelected('custom')}
          style={[styles.optionCard, selected === 'custom' && styles.optionCardSelected]}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.optionLabel}>Custom amount</Text>
            <Text style={styles.optionSub}>Enter any amount to pay</Text>
          </View>
          {selected === 'custom' ? (
            <View style={styles.customInputWrap}>
              <Text style={styles.customInputPrefix}>₹</Text>
              <TextInput
                value={customRupees}
                onChangeText={setCustomRupees}
                placeholder="0"
                placeholderTextColor={DARK.muted}
                keyboardType="decimal-pad"
                style={styles.customInput}
              />
            </View>
          ) : (
            <Text style={styles.optionValue}>—</Text>
          )}
        </Pressable>

        {/* Chosen amount + coins */}
        <View style={styles.summaryPanel}>
          <Text style={styles.summaryLabel}>YOU'LL PAY</Text>
          <Text style={styles.summaryAmount}>{formatINR(amountCents)}</Text>
          <View style={styles.coinsRow}>
            <Icon name="star" color={DARK.gold} size={14} />
            <Text style={styles.coinsText}>You'll earn {coins} coins</Text>
          </View>
        </View>

        <Pressable
          onPress={handlePay}
          disabled={!validAmount}
          style={({ pressed }) => [
            styles.primaryBtn,
            !validAmount && styles.primaryBtnDisabled,
            pressed && validAmount && { opacity: 0.85 },
          ]}
        >
          <Text style={styles.primaryBtnText}>Pay {formatINR(amountCents)} via UPI</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: DARK.bg },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 10,
  },
  topBarBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: DARK.surface2,
  },
  topBarTitle: { color: DARK.text, fontWeight: '800', fontSize: 15, flex: 1, textAlign: 'center', marginHorizontal: 8 },

  scroll: { flex: 1, paddingHorizontal: 16, alignItems: 'center' },

  miniCard: {
    width: '100%',
    maxWidth: 368,
    height: 100,
    borderRadius: 18,
    padding: 18,
    justifyContent: 'space-between',
    marginTop: 6,
  },
  miniCardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  miniCardIssuer: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  miniCardNetwork: { color: 'rgba(255,255,255,0.85)', fontWeight: '800', fontSize: 12, letterSpacing: 1.2 },
  miniCardNumber: { color: '#fff', fontWeight: '700', fontSize: 16, letterSpacing: 2 },

  sectionLabel: {
    width: '100%',
    maxWidth: 368,
    color: DARK.muted,
    fontWeight: '700',
    fontSize: 11.5,
    letterSpacing: 0.8,
    marginTop: 22,
    marginBottom: 8,
  },

  optionCard: {
    width: '100%',
    maxWidth: 368,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: DARK.surface,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: DARK.border,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  optionCardSelected: {
    borderColor: DARK.gold,
    backgroundColor: DARK.goldSoft,
    boxShadow: `0 0 0 1px ${DARK.gold}, 0 0 18px rgba(231,197,131,0.25)`,
  } as unknown as object,
  optionLabel: { color: DARK.text, fontWeight: '800', fontSize: 14 },
  optionSub: { color: DARK.subtext, fontSize: 11.5, marginTop: 2 },
  optionValue: { color: DARK.text, fontWeight: '900', fontSize: 15 },

  customInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: DARK.surface2,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  customInputPrefix: { color: DARK.subtext, fontWeight: '800', fontSize: 14, marginRight: 4 },
  customInput: { color: DARK.text, fontWeight: '800', fontSize: 15, minWidth: 70, outlineStyle: 'none' } as unknown as object,

  summaryPanel: {
    width: '100%',
    maxWidth: 368,
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 20,
    backgroundColor: DARK.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: DARK.border,
    paddingVertical: 20,
  },
  summaryLabel: { color: DARK.muted, fontWeight: '700', fontSize: 11, letterSpacing: 0.8 },
  summaryAmount: { color: DARK.text, fontWeight: '900', fontSize: 30, marginTop: 6 },
  coinsRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  coinsText: { color: DARK.gold, fontWeight: '700', fontSize: 13 },

  primaryBtn: {
    width: '100%',
    maxWidth: 368,
    backgroundColor: DARK.gold,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 24,
  },
  primaryBtnDisabled: { opacity: 0.4 },
  primaryBtnText: { color: '#1B1406', fontWeight: '900', fontSize: 15 },

  successWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  successCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: DARK.green,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  successTitle: { color: DARK.text, fontWeight: '800', fontSize: 18 },
  successAmount: { color: DARK.text, fontWeight: '900', fontSize: 32, marginTop: 12 },
  successCoins: { color: DARK.gold, fontWeight: '700', fontSize: 14, marginTop: 10 },
});
