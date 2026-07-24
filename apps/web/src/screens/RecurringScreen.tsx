/**
 * RecurringScreen — manage recurring expense rules (rent, subscriptions,
 * bills) that periodically materialize into real Expenses (see
 * `../recurring.ts`). This screen only edits the RULE — personal or
 * auto-split to a group, on a Weekly/Monthly/Yearly cadence — never the
 * generated Expenses themselves.
 *
 * Two states toggled by local boolean state (same convention as
 * GroupsScreen's `creating` flag): a LIST view of existing rules, and a
 * CREATE FORM view that mirrors AddExpenseScreen's Personal/Split machinery
 * (same group picker, paid-by picker, participant chips, split-type Pills,
 * and live @domain/splitting preview), plus a Cadence section unique to
 * recurring rules.
 */
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { computeSplit, type SplitAllocation, type SplitParticipantInput, type SplitType } from '@domain/splitting';
import { formatINR, toCents } from '@domain/money';
import { COLORS } from '../theme';
import {
  Avatar,
  Button,
  Card,
  CategoryAvatar,
  EmptyState,
  Field,
  Icon,
  ListRow,
  Money,
  Pill,
  SectionLabel,
} from '../components/ui';
import {
  EXPENSE_CATEGORIES,
  ME,
  type Group,
  type RecurringExpense,
  type RecurringFrequency,
  type RecurringParticipantValue,
} from '../store';
import { frequencyLabel } from '../recurring';

interface Props {
  recurring: RecurringExpense[];
  groups: Group[];
  onCreate: (input: Omit<RecurringExpense, 'id' | 'createdAt' | 'nextDueISO' | 'occurrenceCount'>) => void;
  onDelete: (id: string) => void;
  onToggleActive: (id: string) => void;
}

type SplitMode = 'personal' | 'split';

const SPLIT_TYPES: { key: SplitType; label: string }[] = [
  { key: 'equal', label: 'Equally' },
  { key: 'percentage', label: 'Percent %' },
  { key: 'exact', label: 'Exact ₹' },
  { key: 'share', label: 'Shares' },
  { key: 'adjustment', label: '+/− Adjust' },
];

const FREQUENCIES: { key: RecurringFrequency; label: string }[] = [
  { key: 'weekly', label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
  { key: 'yearly', label: 'Yearly' },
];

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Singular unit word for the interval field's label, e.g. "week" / "month" / "year". */
function unitWord(frequency: RecurringFrequency): string {
  return frequency === 'weekly' ? 'week' : frequency === 'monthly' ? 'month' : 'year';
}

export default function RecurringScreen({ recurring, groups, onCreate, onDelete, onToggleActive }: Props) {
  /* -------- screen-level toggle (mirrors GroupsScreen's `creating`) -------- */
  const [creating, setCreating] = useState(false);

  /* -------- core fields -------- */
  const [description, setDescription] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [category, setCategory] = useState('General');
  const [notes, setNotes] = useState('');

  /* -------- cadence -------- */
  const [frequency, setFrequency] = useState<RecurringFrequency>('monthly');
  const [intervalStr, setIntervalStr] = useState('1');
  const [startDateISO, setStartDateISO] = useState(todayISO());

  /* -------- split machinery (mirrors AddExpenseScreen) -------- */
  const [mode, setMode] = useState<SplitMode>('personal');
  const [groupId, setGroupId] = useState<string | null>(groups[0]?.id ?? null);
  const [payerId, setPayerId] = useState<string>(ME);
  const [involved, setInvolved] = useState<Set<string>>(new Set());
  const [splitType, setSplitType] = useState<SplitType>('equal');
  const [values, setValues] = useState<Record<string, string>>({});

  const [formError, setFormError] = useState<string | null>(null);

  const group = useMemo(
    () => (groupId ? groups.find((g) => g.id === groupId) ?? null : null),
    [groupId, groups],
  );

  const amountNum = Number(amountStr);
  const amountValid = Number.isFinite(amountNum) && amountNum > 0;
  const totalCents = amountValid ? toCents(amountNum) : 0;

  const intervalValid = /^\d+$/.test(intervalStr.trim()) && Number(intervalStr) >= 1;
  const intervalNum = Math.max(1, Math.round(Number(intervalStr)) || 1);
  const dateValid = /^\d{4}-\d{2}-\d{2}$/.test(startDateISO);

  /* If a group was chosen but nobody is selected yet, default to everyone. */
  const participantIds = useMemo(() => {
    if (!group) return [] as string[];
    const chosen = group.members.filter((m) => involved.has(m.id)).map((m) => m.id);
    if (chosen.length > 0) return chosen;
    return group.members.map((m) => m.id);
  }, [group, involved]);

  /** Raw per-participant values for non-equal split types (equal needs none — mirrors seed data). */
  const participantValues = useMemo<RecurringParticipantValue[]>(() => {
    if (splitType === 'equal') return [];
    return participantIds.map((id) => {
      const raw = Number(values[id] ?? '');
      const num = Number.isFinite(raw) ? raw : 0;
      if (splitType === 'percentage') return { userId: id, value: num };
      if (splitType === 'share') return { userId: id, value: Math.round(num) };
      // exact / adjustment are entered in rupees -> paise
      return { userId: id, value: toCents(num) };
    });
  }, [participantIds, splitType, values]);

  /* Live split computation via the real @domain engine — preview only. The
     rule itself just stores raw participantValues; occurrences compute the
     real allocation when materialized (see ../recurring.ts), using this same
     "look up by userId" approach. */
  const { allocationsPreview, splitError } = useMemo(() => {
    if (mode === 'personal') {
      return {
        allocationsPreview: [{ userId: ME, cents: totalCents }] as SplitAllocation[],
        splitError: null as string | null,
      };
    }
    if (!group) return { allocationsPreview: [] as SplitAllocation[], splitError: null as string | null };
    if (participantIds.length === 0) {
      return { allocationsPreview: [] as SplitAllocation[], splitError: 'Pick at least one person.' };
    }
    const participants: SplitParticipantInput[] = participantIds.map((id) => ({
      userId: id,
      value: participantValues.find((p) => p.userId === id)?.value,
    }));
    try {
      const out = computeSplit(totalCents, splitType, participants);
      return { allocationsPreview: out, splitError: null as string | null };
    } catch (e) {
      return {
        allocationsPreview: [] as SplitAllocation[],
        splitError: e instanceof Error ? e.message : String(e),
      };
    }
  }, [mode, group, participantIds, participantValues, splitType, totalCents]);

  function toggleInvolved(id: string) {
    if (!group) return;
    const base = new Set(participantIds);
    if (base.has(id)) base.delete(id);
    else base.add(id);
    setInvolved(base);
  }

  function nameOf(id: string): string {
    if (id === ME) return 'You';
    return group?.members.find((m) => m.id === id)?.name ?? id;
  }

  function groupLabel(gid: string | null): string {
    if (!gid) return 'Personal';
    const g = groups.find((x) => x.id === gid);
    if (!g) return 'Personal';
    return g.emoji ? `${g.emoji} ${g.name}` : g.name;
  }

  function resetForm() {
    setDescription('');
    setAmountStr('');
    setCategory('General');
    setNotes('');
    setFrequency('monthly');
    setIntervalStr('1');
    setStartDateISO(todayISO());
    setMode('personal');
    setGroupId(groups[0]?.id ?? null);
    setPayerId(ME);
    setInvolved(new Set());
    setSplitType('equal');
    setValues({});
    setFormError(null);
    setCreating(false);
  }

  function handleSave() {
    setFormError(null);
    if (!description.trim()) return setFormError('Enter a description.');
    if (!amountValid) return setFormError('Enter a valid amount greater than zero.');
    if (!intervalValid) return setFormError('Enter a valid interval of at least 1.');
    if (!dateValid) return setFormError('Use start date format YYYY-MM-DD.');

    let finalGroupId: string | null;
    let finalPaidBy: string;
    let finalInvolvedIds: string[];
    let finalSplitType: SplitType;
    let finalParticipantValues: RecurringParticipantValue[];

    if (mode === 'personal') {
      finalGroupId = null;
      finalPaidBy = ME;
      finalInvolvedIds = [ME];
      finalSplitType = 'equal';
      finalParticipantValues = [];
    } else {
      if (!group) return setFormError('Pick a group to split with, or switch to Personal.');
      if (participantIds.length === 0) return setFormError('Pick at least one participant.');
      if (splitError) return setFormError(splitError);
      finalGroupId = group.id;
      finalPaidBy = payerId;
      finalInvolvedIds = participantIds;
      finalSplitType = splitType;
      finalParticipantValues = participantValues;
    }

    onCreate({
      description: description.trim(),
      amountCents: totalCents,
      category,
      frequency,
      interval: intervalNum,
      startDateISO,
      groupId: finalGroupId,
      paidBy: finalPaidBy,
      involvedIds: finalInvolvedIds,
      splitType: finalSplitType,
      participantValues: finalParticipantValues,
      notes: notes.trim() || undefined,
      active: true,
    });
    resetForm();
  }

  function handleDeleteRule(rule: RecurringExpense) {
    const ok =
      typeof window === 'undefined' ||
      window.confirm(
        `Delete "${rule.description}"? Past expenses already generated from this rule are not affected — only future occurrences will stop.`,
      );
    if (ok) onDelete(rule.id);
  }

  /** Active rules first, then soonest next-due first. */
  const sortedRecurring = useMemo(() => {
    return [...recurring].sort((a, b) => {
      if (a.active !== b.active) return a.active ? -1 : 1;
      if (a.nextDueISO < b.nextDueISO) return -1;
      if (a.nextDueISO > b.nextDueISO) return 1;
      return 0;
    });
  }, [recurring]);

  const valuePlaceholder =
    splitType === 'percentage'
      ? '%'
      : splitType === 'share'
      ? 'shares'
      : splitType === 'adjustment'
      ? '± ₹'
      : '₹';
  const needsValues = splitType !== 'equal';

  /* ------------------------------------------------------------------ */
  /* LIST VIEW                                                          */
  /* ------------------------------------------------------------------ */
  const listView = (
    <>
      <Button label="New recurring expense" icon="plus" onPress={() => setCreating(true)} />

      {recurring.length === 0 ? (
        <EmptyState
          emoji="🔁"
          title="No recurring expenses yet"
          subtitle="Set up rent, subscriptions, or bills to auto-track and auto-split them."
          actionLabel="New recurring expense"
          onAction={() => setCreating(true)}
        />
      ) : (
        <View style={{ marginTop: 20 }}>
          <SectionLabel>Your recurring expenses</SectionLabel>
          {sortedRecurring.map((rule) => (
            <Card key={rule.id} style={styles.ruleCard}>
              <ListRow
                left={<CategoryAvatar category={rule.category} />}
                title={rule.description}
                subtitle={`${frequencyLabel(rule.frequency, rule.interval)} · ${groupLabel(rule.groupId)}`}
                rightTop={<Money cents={rule.amountCents} size={15} weight="800" />}
                rightBottom={`Next: ${rule.nextDueISO}`}
              />
              <View style={styles.ruleFooter}>
                <Pill
                  label={rule.active ? 'Active' : 'Paused'}
                  active={rule.active}
                  onPress={() => onToggleActive(rule.id)}
                />
                <Pressable
                  onPress={() => handleDeleteRule(rule)}
                  hitSlop={8}
                  style={({ pressed }) => [styles.trashBtn, pressed ? { opacity: 0.6 } : null]}
                >
                  <Icon name="trash" color={COLORS.danger} size={18} />
                </Pressable>
              </View>
            </Card>
          ))}
        </View>
      )}
    </>
  );

  /* ------------------------------------------------------------------ */
  /* CREATE FORM VIEW                                                   */
  /* ------------------------------------------------------------------ */
  const formView = (
    <>
      <Text style={styles.formTitle}>New recurring expense</Text>

      <View style={{ marginTop: 4 }}>
        <Field
          label="Description"
          value={description}
          onChangeText={setDescription}
          placeholder="e.g. Rent, Netflix, Wifi bill"
          autoFocus
        />
      </View>

      <View style={{ marginTop: 12 }}>
        <Field
          label="Amount (₹)"
          value={amountStr}
          onChangeText={setAmountStr}
          placeholder="0.00"
          keyboardType="decimal-pad"
        />
      </View>

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

      {/* Cadence */}
      <View style={{ marginTop: 20 }}>
        <SectionLabel>Cadence</SectionLabel>
      </View>
      <View style={styles.pillWrap}>
        {FREQUENCIES.map((f) => (
          <Pill key={f.key} label={f.label} active={frequency === f.key} onPress={() => setFrequency(f.key)} />
        ))}
      </View>
      <View style={styles.row2}>
        <Field
          label={`Every N ${unitWord(frequency)}(s)`}
          value={intervalStr}
          onChangeText={setIntervalStr}
          placeholder="1"
          keyboardType="numeric"
          style={{ flex: 1 }}
        />
        <Field
          label="Start date"
          value={startDateISO}
          onChangeText={setStartDateISO}
          placeholder="2026-07-24"
          style={{ flex: 1 }}
        />
      </View>
      <Text style={styles.cadenceHint}>
        {frequencyLabel(frequency, intervalNum)} starting {startDateISO}
      </Text>

      {/* Split */}
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
            This will be added to your personal spend {frequencyLabel(frequency, intervalNum).toLowerCase()}.
          </Text>
        </View>
      ) : groups.length === 0 ? (
        <View style={styles.hintCard}>
          <Text style={styles.hintText}>
            You have no groups yet. Create a group first to auto-split a recurring expense with friends or
            flatmates.
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
                      <Text
                        style={[
                          styles.payerText,
                          active ? { color: COLORS.primaryDark, fontWeight: '800' } : null,
                        ]}
                      >
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
                  const alloc = allocationsPreview.find((a) => a.userId === id)?.cents ?? 0;
                  return (
                    <View key={id} style={styles.splitRow}>
                      <Avatar
                        name={nameOf(id)}
                        size={30}
                        color={group.members.find((m) => m.id === id)?.color}
                      />
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

                {/* Sum / total line */}
                <View style={styles.splitTotal}>
                  {splitError ? (
                    <Text style={styles.splitError}>{splitError}</Text>
                  ) : (
                    <Text style={styles.splitTotalText}>
                      Total {formatINR(allocationsPreview.reduce((s, a) => s + a.cents, 0))} of{' '}
                      {formatINR(totalCents)}
                    </Text>
                  )}
                </View>
              </View>
            </>
          ) : null}
        </View>
      )}

      {formError ? <Text style={styles.formError}>{formError}</Text> : null}

      <View style={{ marginTop: 20 }}>
        <Button
          label="Create recurring expense"
          icon="check"
          onPress={handleSave}
          disabled={
            !amountValid ||
            !description.trim() ||
            !intervalValid ||
            !dateValid ||
            (mode === 'split' && (!group || participantIds.length === 0 || !!splitError))
          }
        />
        <View style={{ marginTop: 10 }}>
          <Button label="Cancel" variant="ghost" onPress={resetForm} />
        </View>
      </View>
    </>
  );

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
    >
      {creating ? formView : listView}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.screenBg },

  formTitle: { color: COLORS.ink, fontWeight: '800', fontSize: 18, marginBottom: 12 },

  fieldLabel: {
    color: COLORS.subtext,
    fontWeight: '700',
    fontSize: 12.5,
    marginBottom: 6,
    marginTop: 14,
  },

  row2: { flexDirection: 'row', gap: 12, marginTop: 12 },

  catItem: { alignItems: 'center', width: 56 },
  catRing: {
    borderRadius: 999,
    borderWidth: 2,
    borderColor: 'transparent',
    padding: 2,
  },
  catLabel: { color: COLORS.subtext, fontSize: 11, marginTop: 4, fontWeight: '600' },

  cadenceHint: { color: COLORS.subtext, fontSize: 12.5, marginTop: 10, fontWeight: '600' },

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

  formError: {
    color: COLORS.danger,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 16,
    textAlign: 'center',
  },

  ruleCard: { marginBottom: 10 },
  ruleFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },
  trashBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.chip,
  },
});
