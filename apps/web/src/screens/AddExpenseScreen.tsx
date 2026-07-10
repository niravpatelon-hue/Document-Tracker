/**
 * AddExpenseScreen — the unified expense editor that FUSES receipt scanning
 * with Splitwise-style group splitting.
 *
 * A scanned receipt (source='scan') and a manual entry flow into the SAME
 * editor and the SAME `Expense` shape. A "Personal" expense is just a split
 * of one (paidBy=[ME], involved=[ME]); "Split with group" opens the full
 * paid-by / participants / split-type machinery backed by the tested
 * @domain/splitting engine.
 */
import React, { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { computeSplit, type SplitParticipantInput, type SplitType } from '@domain/splitting';
import { formatINR, fromCents, toCents } from '@domain/money';
import { COLORS } from '../theme';
import {
  Avatar,
  BalanceAmount,
  Button,
  CategoryAvatar,
  Field,
  Icon,
  Money,
  Pill,
  SectionLabel,
} from '../components/ui';
import {
  EXPENSE_CATEGORIES,
  ME,
  type Allocation,
  type Expense,
  type Group,
  type Payment,
} from '../store';

interface Props {
  prefill?: {
    description?: string;
    amountCents?: number | null;
    taxCents?: number | null;
    dateISO?: string | null;
    category?: string;
    imageDataUrl?: string | null;
    rawText?: string | null;
    source?: 'scan' | 'manual';
  } | null;
  editing?: Expense | null;
  groups: Group[];
  presetGroupId?: string | null;
  onSave: (draft: Omit<Expense, 'id' | 'createdAt'>) => void;
  onCancel: () => void;
}

type Mode = 'personal' | 'split';

const SPLIT_TYPES: { key: SplitType; label: string }[] = [
  { key: 'equal', label: 'Equally' },
  { key: 'percentage', label: 'Percent %' },
  { key: 'exact', label: 'Exact ₹' },
  { key: 'share', label: 'Shares' },
  { key: 'adjustment', label: '+/− Adjust' },
];

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Rupees-string for the amount field, seeded from cents. */
function centsToStr(c: number | null | undefined): string {
  if (c == null || c === 0) return '';
  return String(fromCents(c));
}

export default function AddExpenseScreen({
  prefill,
  editing,
  groups,
  presetGroupId,
  onSave,
  onCancel,
}: Props) {
  const isEdit = !!editing;

  /* -------- core fields (seed from editing first, then prefill) -------- */
  const [description, setDescription] = useState(
    editing?.description ?? prefill?.description ?? '',
  );
  const [amountStr, setAmountStr] = useState(
    centsToStr(editing?.amountCents ?? prefill?.amountCents),
  );
  const [dateISO, setDateISO] = useState(
    editing?.dateISO ?? prefill?.dateISO ?? todayISO(),
  );
  const [category, setCategory] = useState(
    editing?.category ?? prefill?.category ?? 'General',
  );
  const [notes, setNotes] = useState(editing?.notes ?? '');

  /* -------- split machinery -------- */
  const [mode, setMode] = useState<Mode>(
    editing ? (editing.groupId ? 'split' : 'personal') : presetGroupId ? 'split' : 'personal',
  );
  const [groupId, setGroupId] = useState<string | null>(
    editing?.groupId ?? presetGroupId ?? groups[0]?.id ?? null,
  );
  const [payerId, setPayerId] = useState<string>(editing?.paidBy?.[0]?.userId ?? ME);
  const [involved, setInvolved] = useState<Set<string>>(
    new Set(editing?.involvedIds ?? []),
  );
  const [splitType, setSplitType] = useState<SplitType>(editing?.splitType ?? 'equal');
  const [values, setValues] = useState<Record<string, string>>(() =>
    seedValues(editing),
  );

  /* Carry-forward media / meta. */
  const imageDataUrl = editing?.imageDataUrl ?? prefill?.imageDataUrl ?? null;
  const rawText = editing?.rawText ?? prefill?.rawText ?? null;
  const taxCents = editing?.taxCents ?? prefill?.taxCents ?? null;
  const source: 'scan' | 'manual' = prefill?.source ?? editing?.source ?? 'manual';
  const scanned = source === 'scan';

  const group = useMemo(
    () => (groupId ? groups.find((g) => g.id === groupId) ?? null : null),
    [groupId, groups],
  );

  const amountNum = Number(amountStr);
  const amountValid = Number.isFinite(amountNum) && amountNum > 0;
  const totalCents = amountValid ? toCents(amountNum) : 0;

  /* If a group was chosen but nobody is selected yet, default to everyone. */
  const participantIds = useMemo(() => {
    if (!group) return [] as string[];
    const chosen = group.members.filter((m) => involved.has(m.id)).map((m) => m.id);
    if (chosen.length > 0) return chosen;
    return group.members.map((m) => m.id);
  }, [group, involved]);

  /* Live split computation via the real @domain engine. */
  const { allocations, splitError } = useMemo(() => {
    if (mode === 'personal') {
      return { allocations: [{ userId: ME, cents: totalCents }] as Allocation[], splitError: null };
    }
    if (!group) return { allocations: [] as Allocation[], splitError: null };
    if (participantIds.length === 0) {
      return { allocations: [] as Allocation[], splitError: 'Pick at least one person.' };
    }
    const participants: SplitParticipantInput[] = participantIds.map((id) => {
      if (splitType === 'equal') return { userId: id };
      const raw = Number(values[id] ?? '');
      const num = Number.isFinite(raw) ? raw : 0;
      if (splitType === 'percentage') return { userId: id, value: num };
      if (splitType === 'share') return { userId: id, value: Math.round(num) };
      // exact / adjustment are entered in rupees -> paise
      return { userId: id, value: toCents(num) };
    });
    try {
      const out = computeSplit(totalCents, splitType, participants).map((a) => ({
        userId: a.userId,
        cents: a.cents,
      }));
      return { allocations: out, splitError: null as string | null };
    } catch (e) {
      return {
        allocations: [] as Allocation[],
        splitError: e instanceof Error ? e.message : String(e),
      };
    }
  }, [mode, group, participantIds, splitType, values, totalCents]);

  /* -------- actions -------- */
  const [formError, setFormError] = useState<string | null>(null);

  function toggleInvolved(id: string) {
    if (!group) return;
    // Materialise the current effective set, then toggle.
    const base = new Set(participantIds);
    if (base.has(id)) base.delete(id);
    else base.add(id);
    setInvolved(base);
  }

  function nameOf(id: string): string {
    if (id === ME) return 'You';
    return group?.members.find((m) => m.id === id)?.name ?? id;
  }

  function handleSave() {
    setFormError(null);
    if (!description.trim()) return setFormError('Enter a description.');
    if (!amountValid) return setFormError('Enter a valid amount greater than zero.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) return setFormError('Use date format YYYY-MM-DD.');

    let paidBy: Payment[];
    let involvedIds: string[];
    let finalAllocations: Allocation[];
    let finalSplitType: SplitType;
    let finalGroupId: string | null;

    if (mode === 'personal') {
      paidBy = [{ userId: ME, cents: totalCents }];
      involvedIds = [ME];
      finalAllocations = [{ userId: ME, cents: totalCents }];
      finalSplitType = 'equal';
      finalGroupId = null;
    } else {
      if (!group) return setFormError('Pick a group to split with, or switch to Personal.');
      if (participantIds.length === 0) return setFormError('Pick at least one participant.');
      if (splitError) return setFormError(splitError);
      if (allocations.length === 0) return setFormError('Split could not be computed.');
      paidBy = [{ userId: payerId, cents: totalCents }];
      involvedIds = participantIds;
      finalAllocations = allocations;
      finalSplitType = splitType;
      finalGroupId = group.id;
    }

    const draft: Omit<Expense, 'id' | 'createdAt'> = {
      description: description.trim(),
      amountCents: totalCents,
      currency: 'INR',
      dateISO,
      category,
      notes: notes.trim() || undefined,
      source,
      imageDataUrl,
      rawText,
      taxCents,
      groupId: finalGroupId,
      paidBy,
      involvedIds,
      splitType: finalSplitType,
      allocations: finalAllocations,
    };
    onSave(draft);
  }

  const valuePlaceholder =
    splitType === 'percentage'
      ? '%'
      : splitType === 'share'
      ? 'shares'
      : splitType === 'adjustment'
      ? '± ₹'
      : '₹';
  const needsValues = splitType !== 'equal';

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={onCancel} hitSlop={8} style={({ pressed }) => (pressed ? { opacity: 0.6 } : null)}>
          <Icon name="x" color={COLORS.subtext} size={24} />
        </Pressable>
        <Text style={styles.headerTitle}>{isEdit ? 'Edit expense' : 'Add expense'}</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* 1. Scanned receipt banner */}
      {imageDataUrl ? (
        <View style={styles.scanCard}>
          <Image source={{ uri: imageDataUrl }} style={styles.thumb} resizeMode="cover" />
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Icon name="sparkles" color={COLORS.primary} size={16} />
              <Text style={styles.scanTitle}>Scanned & auto-filled</Text>
            </View>
            <Text style={styles.scanSub}>Review the details below and adjust anything.</Text>
          </View>
        </View>
      ) : null}

      {/* 2. Core fields */}
      <View style={{ marginTop: imageDataUrl ? 4 : 8 }}>
        <Field
          label="Description"
          value={description}
          onChangeText={setDescription}
          placeholder="e.g. Dinner at Barbeque Nation"
          autoFocus={!isEdit && !description}
        />
      </View>

      <View style={styles.row2}>
        <Field
          label={`Amount (${'₹'})`}
          value={amountStr}
          onChangeText={setAmountStr}
          placeholder="0.00"
          keyboardType="decimal-pad"
          style={{ flex: 1 }}
        />
        <Field
          label="Date"
          value={dateISO}
          onChangeText={setDateISO}
          placeholder="2026-07-10"
          style={{ flex: 1 }}
        />
      </View>

      {/* Category picker */}
      <Text style={styles.fieldLabel}>Category</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 12, paddingVertical: 4, paddingRight: 8 }}
      >
        {EXPENSE_CATEGORIES.map((c) => {
          const active = category === c.key;
          return (
            <Pressable
              key={c.key}
              onPress={() => setCategory(c.key)}
              style={({ pressed }) => [styles.catItem, pressed ? { opacity: 0.7 } : null]}
            >
              <View style={[styles.catRing, active ? { borderColor: c.color } : null]}>
                <CategoryAvatar category={c.key} size={44} />
              </View>
              <Text style={[styles.catLabel, active ? { color: COLORS.ink, fontWeight: '800' } : null]}>
                {c.key}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={{ marginTop: 12 }}>
        <Field
          label="Notes (optional)"
          value={notes}
          onChangeText={setNotes}
          placeholder="Add a note"
          multiline
        />
      </View>

      {/* 3. Split section — the fusion */}
      <View style={{ marginTop: 20 }}>
        <SectionLabel>Split</SectionLabel>
      </View>
      <View style={styles.segment}>
        <Pressable
          onPress={() => setMode('personal')}
          style={[styles.segItem, mode === 'personal' ? styles.segItemActive : null]}
        >
          <Icon name="wallet" color={mode === 'personal' ? COLORS.primaryDark : COLORS.subtext} size={18} />
          <Text style={[styles.segText, mode === 'personal' ? styles.segTextActive : null]}>Personal</Text>
        </Pressable>
        <Pressable
          onPress={() => setMode('split')}
          style={[styles.segItem, mode === 'split' ? styles.segItemActive : null]}
        >
          <Icon name="split" color={mode === 'split' ? COLORS.primaryDark : COLORS.subtext} size={18} />
          <Text style={[styles.segText, mode === 'split' ? styles.segTextActive : null]}>
            Split with group
          </Text>
        </Pressable>
      </View>

      {mode === 'personal' ? (
        <View style={styles.personalNote}>
          <Icon name="check" color={COLORS.owed} size={18} />
          <Text style={styles.personalNoteText}>
            This is all yours — {amountValid ? formatINR(totalCents) : `${'₹'}0`} added to your personal
            spend.
          </Text>
        </View>
      ) : groups.length === 0 ? (
        <View style={styles.hintCard}>
          <Text style={styles.hintText}>
            You have no groups yet. Create a group first to split an expense with friends or flatmates.
          </Text>
        </View>
      ) : (
        <View style={{ marginTop: 4 }}>
          {/* Group picker */}
          <Text style={styles.fieldLabel}>Group</Text>
          <View style={styles.pillWrap}>
            {groups.map((g) => (
              <Pill
                key={g.id}
                label={`${g.emoji ? g.emoji + ' ' : ''}${g.name}`}
                active={groupId === g.id}
                onPress={() => {
                  setGroupId(g.id);
                  setInvolved(new Set()); // reset -> defaults to everyone in new group
                }}
              />
            ))}
          </View>

          {group ? (
            <>
              {/* Paid by */}
              <Text style={styles.fieldLabel}>Paid by</Text>
              <View style={styles.pillWrap}>
                {group.members.map((m) => {
                  const active = payerId === m.id;
                  return (
                    <Pressable
                      key={m.id}
                      onPress={() => setPayerId(m.id)}
                      style={[styles.payer, active ? styles.payerActive : null]}
                    >
                      <Avatar name={m.name} size={22} color={m.color} />
                      <Text style={[styles.payerText, active ? { color: COLORS.primaryDark, fontWeight: '800' } : null]}>
                        {m.id === ME ? 'You' : m.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Participants */}
              <Text style={styles.fieldLabel}>Split between ({participantIds.length})</Text>
              <View style={styles.pillWrap}>
                {group.members.map((m) => {
                  const on = participantIds.includes(m.id);
                  return (
                    <Pressable
                      key={m.id}
                      onPress={() => toggleInvolved(m.id)}
                      style={[styles.chip, on ? styles.chipOn : null]}
                    >
                      {on ? <Icon name="check" color="#fff" size={13} strokeWidth={2.6} /> : null}
                      <Text style={[styles.chipText, on ? { color: '#fff' } : null]}>
                        {m.id === ME ? 'You' : m.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Split type */}
              <Text style={styles.fieldLabel}>How to split</Text>
              <View style={styles.pillWrap}>
                {SPLIT_TYPES.map((s) => (
                  <Pill
                    key={s.key}
                    label={s.label}
                    active={splitType === s.key}
                    onPress={() => setSplitType(s.key)}
                  />
                ))}
              </View>

              {/* Per-participant value inputs + live allocation preview */}
              <View style={styles.splitCard}>
                {participantIds.map((id) => {
                  const alloc = allocations.find((a) => a.userId === id)?.cents ?? 0;
                  return (
                    <View key={id} style={styles.splitRow}>
                      <Avatar name={nameOf(id)} size={30} color={group.members.find((m) => m.id === id)?.color} />
                      <Text style={styles.splitName} numberOfLines={1}>
                        {nameOf(id)}
                      </Text>
                      {needsValues ? (
                        <View style={styles.valueBox}>
                          <Field
                            value={values[id] ?? ''}
                            onChangeText={(v) => setValues((prev) => ({ ...prev, [id]: v }))}
                            placeholder={valuePlaceholder}
                            keyboardType="decimal-pad"
                          />
                        </View>
                      ) : null}
                      <View style={{ minWidth: 88, alignItems: 'flex-end' }}>
                        {splitError ? (
                          <Text style={styles.dash}>—</Text>
                        ) : (
                          <Money cents={alloc} size={14} weight="800" />
                        )}
                      </View>
                    </View>
                  );
                })}

                {/* Sum / balance line */}
                <View style={styles.splitTotal}>
                  {splitError ? (
                    <Text style={styles.splitError}>{splitError}</Text>
                  ) : (
                    <Text style={styles.splitTotalText}>
                      Total {formatINR(allocations.reduce((s, a) => s + a.cents, 0))} of{' '}
                      {formatINR(totalCents)}
                    </Text>
                  )}
                </View>
              </View>

              {/* Your net for this expense */}
              {!splitError ? (
                <View style={styles.netRow}>
                  <Text style={styles.netLabel}>Your net on this expense</Text>
                  <BalanceAmount
                    cents={
                      (payerId === ME ? totalCents : 0) -
                      (allocations.find((a) => a.userId === ME)?.cents ?? 0)
                    }
                    showSign
                    size={15}
                  />
                </View>
              ) : null}
            </>
          ) : null}
        </View>
      )}

      {/* 4. Save / cancel */}
      {formError ? <Text style={styles.formError}>{formError}</Text> : null}
      <View style={{ marginTop: 20 }}>
        <Button
          label={isEdit ? 'Save changes' : 'Save expense'}
          icon="check"
          onPress={handleSave}
          disabled={!amountValid || !description.trim() || (mode === 'split' && (!group || !!splitError))}
        />
        <View style={{ marginTop: 10 }}>
          <Button label="Cancel" variant="ghost" onPress={onCancel} />
        </View>
      </View>
    </ScrollView>
  );
}

/** Seed the per-participant value strings when editing an existing expense. */
function seedValues(editing?: Expense | null): Record<string, string> {
  const m: Record<string, string> = {};
  if (!editing || !editing.groupId) return m;
  const total = editing.amountCents;
  if (editing.splitType === 'exact') {
    editing.allocations.forEach((a) => (m[a.userId] = String(fromCents(a.cents))));
  } else if (editing.splitType === 'percentage' && total > 0) {
    editing.allocations.forEach(
      (a) => (m[a.userId] = String(Math.round((a.cents / total) * 1000) / 10)),
    );
  }
  // share / adjustment can't be reliably reconstructed from allocations; leave blank.
  return m;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.screenBg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  headerTitle: { color: COLORS.ink, fontWeight: '800', fontSize: 18 },

  scanCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.primarySoft,
    borderRadius: 18,
    padding: 10,
    marginBottom: 8,
  },
  thumb: { width: 54, height: 54, borderRadius: 12, backgroundColor: COLORS.chip },
  scanTitle: { color: COLORS.primaryDark, fontWeight: '800', fontSize: 13.5 },
  scanSub: { color: COLORS.subtext, fontSize: 12, marginTop: 2 },

  row2: { flexDirection: 'row', gap: 12, marginTop: 12 },

  fieldLabel: {
    color: COLORS.subtext,
    fontWeight: '700',
    fontSize: 12.5,
    marginBottom: 6,
    marginTop: 14,
  },

  catItem: { alignItems: 'center', width: 56 },
  catRing: {
    borderRadius: 999,
    borderWidth: 2,
    borderColor: 'transparent',
    padding: 2,
  },
  catLabel: { color: COLORS.subtext, fontSize: 11, marginTop: 4, fontWeight: '600' },

  segment: {
    flexDirection: 'row',
    backgroundColor: COLORS.chip,
    borderRadius: 999,
    padding: 4,
    gap: 4,
    marginTop: 4,
  },
  segItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 999,
  },
  segItemActive: { backgroundColor: COLORS.card, boxShadow: '0 1px 4px rgba(20,40,60,0.10)' } as object,
  segText: { color: COLORS.subtext, fontWeight: '700', fontSize: 13.5 },
  segTextActive: { color: COLORS.primaryDark, fontWeight: '800' },

  personalNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.owedSoft,
    borderRadius: 14,
    padding: 12,
    marginTop: 12,
  },
  personalNoteText: { color: COLORS.ink, fontSize: 13, flex: 1, lineHeight: 18 },

  hintCard: {
    backgroundColor: COLORS.warnSoft,
    borderRadius: 14,
    padding: 14,
    marginTop: 12,
  },
  hintText: { color: COLORS.ink, fontSize: 13, lineHeight: 19 },

  pillWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  payer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: COLORS.chip,
  },
  payerActive: { backgroundColor: COLORS.primarySoft },
  payerText: { color: COLORS.subtext, fontWeight: '600', fontSize: 13 },

  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: COLORS.chip,
  },
  chipOn: { backgroundColor: COLORS.primary },
  chipText: { color: COLORS.subtext, fontWeight: '700', fontSize: 13 },

  splitCard: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    marginTop: 14,
  },
  splitRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  splitName: { flex: 1, color: COLORS.ink, fontWeight: '600', fontSize: 14 },
  valueBox: { width: 92 },
  dash: { color: COLORS.muted, fontWeight: '800', fontSize: 14 },

  splitTotal: {
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
    marginTop: 6,
    paddingTop: 10,
  },
  splitTotalText: { color: COLORS.subtext, fontSize: 12.5, fontWeight: '600', textAlign: 'right' },
  splitError: { color: COLORS.danger, fontSize: 12.5, fontWeight: '700' },

  netRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingHorizontal: 4,
  },
  netLabel: { color: COLORS.subtext, fontSize: 13, fontWeight: '600' },

  formError: {
    color: COLORS.danger,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 16,
    textAlign: 'center',
  },
});
