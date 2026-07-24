import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { rewardCoinsFor } from '@domain/analytics/cards';
import { COLORS } from './theme';
import {
  loadLocalCache,
  loadUser,
  newId,
  saveLocalCache,
  saveUser,
  setCurrentUser,
  type Budget,
  type CardPayment,
  type CreditCard,
  type Expense,
  type Group,
  type Member,
  type MileageTrip,
  type PersistedState,
  type RecurringExpense,
  type Settlement,
  type WebUser,
} from './store';
import { buildPeople, type ApportionedSettlement } from './people';
import { materializeDueRecurring } from './recurring';
import { signIn as googleSignIn, trySilentSignIn, signOutGoogle, type GoogleProfile } from './auth/google';
import { DriveSession } from './drive/session';
import {
  createGroupFolder,
  deleteGroupExpense,
  deleteGroupRecurring,
  discoverGroups,
  getOrCreatePersonalFileId,
  inviteMember,
  loadPersonalFile,
  materializeGroupRecurring,
  savePersonalFile,
  writeGroupExpense,
  writeGroupRecurring,
  writeGroupSettlement,
  type GroupBundle,
  type PersonalFile,
} from './drive/driveStore';
import HomeScreen from './screens/HomeScreen';
import PersonalScreen from './screens/PersonalScreen';
import GroupsScreen from './screens/GroupsScreen';
import GroupDetailScreen from './screens/GroupDetailScreen';
import PeopleScreen from './screens/PeopleScreen';
import RecurringScreen from './screens/RecurringScreen';
import AnalysisScreen from './screens/AnalysisScreen';
import OptimizeScreen from './screens/OptimizeScreen';
import ChatScreen from './screens/ChatScreen';
import CardsScreen from './screens/CardsScreen';
import CardDetailScreen from './screens/CardDetailScreen';
import CardPayScreen from './screens/CardPayScreen';
import ScanScreen from './screens/ScanScreen';
import AddExpenseScreen from './screens/AddExpenseScreen';
import MileageScreen from './screens/MileageScreen';
import AccountScreen from './screens/AccountScreen';
import LoginScreen from './screens/LoginScreen';
import TabBar, { type TabKey } from './components/TabBar';

/** Prefill produced by the scanner and consumed by AddExpense. */
export interface ScanPrefill {
  description: string | null;
  amountCents: number | null;
  taxCents: number | null;
  dateISO: string | null;
  category: string;
  imageDataUrl: string | null;
  rawText: string;
  source: 'scan';
}

type Route =
  | { name: 'home' }
  | { name: 'personal' }
  | { name: 'groups' }
  | { name: 'people' }
  | { name: 'account' }
  | { name: 'analysis' }
  | { name: 'optimize' }
  | { name: 'chat'; returnTo?: Route }
  | { name: 'recurring' }
  | { name: 'cards' }
  | { name: 'cardDetail'; cardId: string }
  | { name: 'cardPay'; cardId: string; fromDetail?: boolean }
  | { name: 'group'; groupId: string }
  | { name: 'scan' }
  | { name: 'add'; prefill?: ScanPrefill | null; presetGroupId?: string | null; editing?: Expense | null; returnTo?: Route }
  | { name: 'mileage' };

const TITLES: Record<string, string> = {
  personal: 'Personal',
  groups: 'Groups',
  people: 'People',
  account: 'Account',
  scan: 'Scan receipt',
  mileage: 'Mileage',
  chat: 'Ask AI',
  recurring: 'Recurring',
};

// Only these two are true bottom tabs; everything else — including Cards,
// reachable from its Home tile — is a drill-in with a back arrow.
const TAB_ROUTES = new Set(['home', 'account']);
const BACK_ROUTES = new Set([
  'group', 'scan', 'add', 'optimize', 'mileage', 'personal', 'groups', 'analysis', 'people', 'chat', 'recurring',
]);
// Screens that render full-bleed with their own top bar — the app chrome is omitted.
const NO_CHROME = new Set(['home', 'cards', 'cardDetail', 'cardPay']);
// Screens that render their own title (so the app chrome shows no title text).
const NO_APP_TITLE = new Set(['home', 'analysis', 'optimize', 'cards', 'cardDetail', 'cardPay']);

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Assembles the flat, personal+group-merged shape every screen already expects, from a personal file + discovered group bundles. */
function mergeState(personal: PersonalFile, groupBundles: GroupBundle[]): PersistedState {
  return {
    expenses: [...personal.expenses, ...groupBundles.flatMap((g) => g.expenses)],
    groups: groupBundles.map((g) => ({ ...g.meta })),
    settlements: groupBundles.flatMap((g) => g.settlements),
    mileage: personal.mileage,
    budgets: personal.budgets,
    cards: personal.cards,
    cardPayments: personal.cardPayments,
    rewardCoins: personal.rewardCoins,
    recurring: [...personal.recurring, ...groupBundles.flatMap((g) => g.recurring)],
  };
}

function personalSliceOf(state: PersistedState): PersonalFile {
  return {
    expenses: state.expenses.filter((e) => e.groupId === null),
    budgets: state.budgets,
    cards: state.cards,
    cardPayments: state.cardPayments,
    mileage: state.mileage,
    recurring: state.recurring.filter((r) => r.groupId === null),
    rewardCoins: state.rewardCoins,
  };
}

type AuthStatus = 'checking' | 'signedOut' | 'signingIn' | 'loadingData' | 'ready' | 'error';

export default function App() {
  const [route, setRoute] = useState<Route>({ name: 'home' });
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [mileage, setMileage] = useState<MileageTrip[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [cardPayments, setCardPayments] = useState<CardPayment[]>([]);
  const [rewardCoins, setRewardCoins] = useState(0);
  const [recurring, setRecurring] = useState<RecurringExpense[]>([]);
  const [user, setUser] = useState<WebUser | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatus>('checking');
  const [authError, setAuthError] = useState<string | null>(null);
  const [pendingCapture, setPendingCapture] = useState<File | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  const sessionRef = useRef<DriveSession | null>(null);
  const personalFileIdRef = useRef<string | null>(null);
  const groupFolderIdsRef = useRef<Record<string, string>>({});

  const applyLoadedState = useCallback((s: PersistedState) => {
    setExpenses(s.expenses);
    setGroups(s.groups);
    setSettlements(s.settlements);
    setMileage(s.mileage);
    setBudgets(s.budgets);
    setCards(s.cards);
    setCardPayments(s.cardPayments);
    setRewardCoins(s.rewardCoins);
    setRecurring(s.recurring);
  }, []);

  /** Runs after any successful sign-in (silent or interactive): wires up Drive, hydrates from it, and catches up recurring bills. */
  const completeSignIn = useCallback(async (profile: GoogleProfile) => {
    setCurrentUser(profile.email);
    const nextUser: WebUser = { name: profile.name, email: profile.email, picture: profile.picture };
    setUser(nextUser);
    saveUser(nextUser);

    const cached = loadLocalCache(profile.email);
    if (cached) applyLoadedState(cached); // instant paint; Drive's fetch below always overwrites it

    setAuthStatus('loadingData');
    try {
      const session = new DriveSession({ accessToken: profile.accessToken, expiresAt: profile.expiresAt });
      sessionRef.current = session;

      const personalFileId = await getOrCreatePersonalFileId(session);
      personalFileIdRef.current = personalFileId;
      const [personal, groupBundles] = await Promise.all([loadPersonalFile(session, personalFileId), discoverGroups(session)]);

      // Catch up recurring bills — personal ones locally (persisted by the debounced sync effect below),
      // group ones per-folder with a dedupe-on-exists check (materializeGroupRecurring), since two
      // members could both be catching up the same overdue occurrence at once.
      const today = todayISO();
      const { newExpenses: personalNew, updatedRules: personalRules } = materializeDueRecurring(
        personal.recurring,
        today,
      );
      personal.recurring = personalRules;
      personal.expenses = [...personalNew, ...personal.expenses];

      await Promise.all(
        groupBundles.map(async (bundle) => {
          const { newExpenses, updatedRules } = await materializeGroupRecurring(session, bundle.folderId, bundle.recurring, today);
          bundle.recurring = updatedRules;
          bundle.expenses = [...newExpenses, ...bundle.expenses];
        }),
      );

      const folderIds: Record<string, string> = {};
      for (const b of groupBundles) folderIds[b.meta.id] = b.folderId;
      groupFolderIdsRef.current = folderIds;

      const merged = mergeState(personal, groupBundles);
      applyLoadedState(merged);
      saveLocalCache(profile.email, merged);
      setAuthStatus('ready');
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Could not load your data from Google Drive.');
      setAuthStatus('error');
    }
  }, [applyLoadedState]);

  useEffect(() => {
    const cachedProfile = loadUser();
    if (cachedProfile) setUser(cachedProfile); // optimistic name/picture paint only — no Drive access yet
    (async () => {
      const profile = await trySilentSignIn();
      if (!profile) {
        setAuthStatus('signedOut');
        return;
      }
      await completeSignIn(profile);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSignIn = useCallback(async () => {
    setAuthStatus('signingIn');
    setAuthError(null);
    try {
      const profile = await googleSignIn();
      await completeSignIn(profile);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Sign-in failed.');
      setAuthStatus('signedOut');
    }
  }, [completeSignIn]);

  const handleSignOut = useCallback(() => {
    signOutGoogle(sessionRef.current?.getAccessToken() ?? null);
    sessionRef.current = null;
    personalFileIdRef.current = null;
    groupFolderIdsRef.current = {};
    saveUser(null);
    setUser(null);
    setCurrentUser('');
    applyLoadedState({ expenses: [], groups: [], settlements: [], mileage: [], budgets: [], cards: [], cardPayments: [], rewardCoins: 0, recurring: [] });
    setAuthStatus('signedOut');
    setRoute({ name: 'home' });
  }, [applyLoadedState]);

  // Debounced sync of the personal slice to Drive — mirrors the old "one effect saves everything"
  // pattern, just scoped to personal-only fields (group writes happen explicitly per mutation, since
  // each group record is its own Drive file, not a blob).
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (authStatus !== 'ready' || !user) return;
    const snapshot = personalSliceOf({ expenses, groups, settlements, mileage, budgets, cards, cardPayments, rewardCoins, recurring });
    saveLocalCache(user.email, { expenses, groups, settlements, mileage, budgets, cards, cardPayments, rewardCoins, recurring });
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => {
      const session = sessionRef.current;
      const fileId = personalFileIdRef.current;
      if (session && fileId) void savePersonalFile(session, fileId, snapshot);
    }, 800);
    return () => {
      if (syncTimer.current) clearTimeout(syncTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expenses, groups, settlements, mileage, budgets, cards, cardPayments, rewardCoins, recurring, authStatus]);

  const navigate = useCallback((next: Route) => setRoute(next), []);

  // The Scan action opens ScanScreen and the device camera at the same time:
  // the camera click() must fire synchronously inside the same tap handler
  // the user invoked (browsers require a live user gesture to open a
  // file/camera picker), while navigating there immediately means the
  // screen's own upload drop-zone is already on hand as a fallback —
  // cancelling the camera, or preferring an existing photo/PDF/Word file.
  // Clearing any previous capture up front means a fresh scan never
  // re-processes yesterday's photo before the new one arrives.
  const triggerScan = useCallback(() => {
    setPendingCapture(null);
    navigate({ name: 'scan' });
    cameraInputRef.current?.click();
  }, [navigate]);

  const handleCameraCapture = useCallback((e: any) => {
    const file: File | undefined = e?.target?.files?.[0];
    if (file) {
      setPendingCapture(file);
    }
    if (cameraInputRef.current) {
      cameraInputRef.current.value = '';
    }
  }, []);

  const saveExpense = useCallback((draft: Omit<Expense, 'id' | 'createdAt'>, editingId?: string | null) => {
    const final: Expense = editingId
      ? { ...draft, id: editingId, createdAt: expenses.find((e) => e.id === editingId)?.createdAt ?? Date.now() }
      : { ...draft, settled: draft.settled ?? false, id: newId(), createdAt: Date.now() };
    if (editingId) {
      setExpenses((prev) => prev.map((e) => (e.id === editingId ? final : e)));
    } else {
      setExpenses((prev) => [final, ...prev]);
    }
    if (final.groupId !== null) {
      const folderId = groupFolderIdsRef.current[final.groupId];
      const session = sessionRef.current;
      if (session && folderId) void writeGroupExpense(session, folderId, final);
    }
  }, [expenses]);

  const toggleSettled = useCallback((id: string) => {
    setExpenses((prev) => {
      const next = prev.map((e) => (e.id === id ? { ...e, settled: !e.settled } : e));
      const updated = next.find((e) => e.id === id);
      if (updated && updated.groupId !== null) {
        const folderId = groupFolderIdsRef.current[updated.groupId];
        const session = sessionRef.current;
        if (session && folderId) void writeGroupExpense(session, folderId, updated);
      }
      return next;
    });
  }, []);

  const deleteExpense = useCallback((id: string) => {
    const target = expenses.find((e) => e.id === id);
    setExpenses((prev) => prev.filter((e) => e.id !== id));
    if (target && target.groupId !== null) {
      const folderId = groupFolderIdsRef.current[target.groupId];
      const session = sessionRef.current;
      if (session && folderId) void deleteGroupExpense(session, folderId, id);
    }
  }, [expenses]);

  const payCard = useCallback(
    (cardId: string, amountCents: number) => {
      const card = cards.find((c) => c.id === cardId);
      const coins = card ? rewardCoinsFor(amountCents, card.rewardRate ?? 1) : 0;
      setCardPayments((prev) => [{ id: newId(), cardId, amountCents, dateISO: todayISO(), note: 'Bill payment', createdAt: Date.now() }, ...prev]);
      setCards((prev) => prev.map((c) => (c.id === cardId ? { ...c, outstandingCents: Math.max(0, c.outstandingCents - amountCents) } : c)));
      setRewardCoins((rc) => rc + coins);
    },
    [cards],
  );

  const createRecurring = useCallback((input: Omit<RecurringExpense, 'id' | 'createdAt' | 'nextDueISO' | 'occurrenceCount'>) => {
    const rule: RecurringExpense = { ...input, id: newId(), createdAt: Date.now(), nextDueISO: input.startDateISO, occurrenceCount: 0 };
    const { newExpenses, updatedRules } = materializeDueRecurring([rule], todayISO());
    setRecurring((prev) => [...updatedRules, ...prev]);
    if (newExpenses.length > 0) setExpenses((prev) => [...newExpenses, ...prev]);
    if (rule.groupId !== null) {
      const folderId = groupFolderIdsRef.current[rule.groupId];
      const session = sessionRef.current;
      if (session && folderId) {
        void writeGroupRecurring(session, folderId, updatedRules[0]!);
        void Promise.all(newExpenses.map((e) => writeGroupExpense(session, folderId, e)));
      }
    }
  }, []);

  const deleteRecurring = useCallback((id: string) => {
    const target = recurring.find((r) => r.id === id);
    setRecurring((prev) => prev.filter((r) => r.id !== id));
    if (target && target.groupId !== null) {
      const folderId = groupFolderIdsRef.current[target.groupId];
      const session = sessionRef.current;
      if (session && folderId) void deleteGroupRecurring(session, folderId, id);
    }
  }, [recurring]);

  const toggleRecurringActive = useCallback((id: string) => {
    setRecurring((prev) => {
      const next = prev.map((r) => (r.id === id ? { ...r, active: !r.active } : r));
      const updated = next.find((r) => r.id === id);
      if (updated && updated.groupId !== null) {
        const folderId = groupFolderIdsRef.current[updated.groupId];
        const session = sessionRef.current;
        if (session && folderId) void writeGroupRecurring(session, folderId, updated);
      }
      return next;
    });
  }, []);

  const createGroup = useCallback(
    async (g: { name: string; emoji?: string; type: Group['type']; members: Member[] }) => {
      const session = sessionRef.current;
      if (!session || !user) return;
      const bundle = await createGroupFolder(session, g, user.email);
      groupFolderIdsRef.current[bundle.meta.id] = bundle.folderId;
      setGroups((prev) => [...prev, { ...bundle.meta }]);
      navigate({ name: 'group', groupId: bundle.meta.id });
    },
    [user, navigate],
  );

  const inviteToGroup = useCallback(
    async (groupId: string, member: Member) => {
      const session = sessionRef.current;
      const folderId = groupFolderIdsRef.current[groupId];
      const group = groups.find((gr) => gr.id === groupId);
      if (!session || !folderId || !group) return;
      const updated = await inviteMember(session, folderId, group, member);
      setGroups((prev) => prev.map((gr) => (gr.id === groupId ? { ...gr, members: updated.members } : gr)));
    },
    [groups],
  );

  const recordSettlement = useCallback(
    (s: { groupId: string; fromUser: string; toUser: string; amountCents: number; note?: string }) => {
      const settlement: Settlement = { ...s, id: newId(), createdAt: Date.now() };
      setSettlements((prev) => [settlement, ...prev]);
      const folderId = groupFolderIdsRef.current[s.groupId];
      const session = sessionRef.current;
      if (session && folderId) void writeGroupSettlement(session, folderId, settlement);
    },
    [],
  );

  const people = useMemo(() => buildPeople(groups, expenses, settlements), [groups, expenses, settlements]);

  const settlePeople = useCallback((apportioned: ApportionedSettlement[]) => {
    if (apportioned.length === 0) return;
    const now = Date.now();
    const created = apportioned.map((s) => ({ ...s, id: newId(), createdAt: now }));
    setSettlements((prev) => [...created, ...prev]);
    const session = sessionRef.current;
    if (session) {
      for (const s of created) {
        const folderId = groupFolderIdsRef.current[s.groupId];
        if (folderId) void writeGroupSettlement(session, folderId, s);
      }
    }
  }, []);

  const showBack = BACK_ROUTES.has(route.name);
  const showTabBar = TAB_ROUTES.has(route.name);
  const showTitle = !NO_APP_TITLE.has(route.name);
  const headerVisible = !NO_CHROME.has(route.name) && (showTitle || showBack);

  const activeTab: TabKey | null =
    route.name === 'home' ? 'home' : route.name === 'account' ? 'account' : null;

  const goBack = () => {
    switch (route.name) {
      case 'group':
        return navigate({ name: 'groups' });
      case 'add':
        return navigate(route.returnTo ?? { name: 'home' });
      case 'mileage':
        return navigate({ name: 'analysis' });
      case 'cardDetail':
        return navigate({ name: 'cards' });
      case 'cardPay':
        return navigate(route.fromDetail ? { name: 'cardDetail', cardId: route.cardId } : { name: 'cards' });
      case 'people':
        return navigate({ name: 'groups' });
      case 'chat':
        return navigate(route.returnTo ?? { name: 'optimize' });
      default:
        return navigate({ name: 'home' });
    }
  };

  const body = useMemo(() => {
    switch (route.name) {
      case 'home':
        return (
          <HomeScreen
            userName={user?.name ?? null}
            expenses={expenses}
            groups={groups}
            settlements={settlements}
            cards={cards}
            budgets={budgets}
            onScan={triggerScan}
            onAddExpense={() => navigate({ name: 'add', returnTo: { name: 'home' } })}
            onOpenPersonal={() => navigate({ name: 'personal' })}
            onOpenGroups={() => navigate({ name: 'groups' })}
            onOpenAnalysis={() => navigate({ name: 'analysis' })}
            onOpenOptimize={() => navigate({ name: 'optimize' })}
            onOpenCards={() => navigate({ name: 'cards' })}
            onOpenGroup={(groupId) => navigate({ name: 'group', groupId })}
            recurring={recurring}
            onOpenRecurring={() => navigate({ name: 'recurring' })}
            onOpenChat={() => navigate({ name: 'chat', returnTo: { name: 'home' } })}
          />
        );
      case 'personal':
        return (
          <PersonalScreen
            expenses={expenses}
            onScan={triggerScan}
            onAddExpense={() => navigate({ name: 'add', returnTo: { name: 'personal' } })}
            onEditExpense={(e) => navigate({ name: 'add', editing: e, returnTo: { name: 'personal' } })}
            onOpenAnalysis={() => navigate({ name: 'analysis' })}
            onDeleteExpense={deleteExpense}
          />
        );
      case 'groups':
        return (
          <GroupsScreen
            expenses={expenses}
            groups={groups}
            settlements={settlements}
            onOpenGroup={(groupId) => navigate({ name: 'group', groupId })}
            onOpenPeople={() => navigate({ name: 'people' })}
            onCreateGroup={(g) => void createGroup(g)}
          />
        );
      case 'people':
        return <PeopleScreen people={people} onSettle={settlePeople} />;
      case 'group': {
        const group = groups.find((g) => g.id === route.groupId);
        if (!group) return <View style={styles.content} />;
        return (
          <GroupDetailScreen
            group={group}
            expenses={expenses.filter((e) => e.groupId === group.id)}
            settlements={settlements.filter((s) => s.groupId === group.id)}
            onAddExpense={() => navigate({ name: 'add', presetGroupId: group.id, returnTo: { name: 'group', groupId: group.id } })}
            onEditExpense={(e) => navigate({ name: 'add', editing: e, returnTo: { name: 'group', groupId: group.id } })}
            onDeleteExpense={deleteExpense}
            onRecordSettlement={recordSettlement}
            onToggleSettled={toggleSettled}
            onInvite={(member) => void inviteToGroup(group.id, member)}
          />
        );
      }
      case 'analysis':
        return (
          <AnalysisScreen
            expenses={expenses}
            budgets={budgets}
            mileage={mileage}
            cards={cards}
            onAddBudget={(b) => setBudgets((prev) => [...prev, { ...b, id: newId() }])}
            onDeleteBudget={(id) => setBudgets((prev) => prev.filter((x) => x.id !== id))}
            onOpenMileage={() => navigate({ name: 'mileage' })}
            onOpenOptimize={() => navigate({ name: 'optimize' })}
          />
        );
      case 'optimize':
        return (
          <OptimizeScreen
            expenses={expenses}
            budgets={budgets}
            cards={cards}
            onOpenCards={() => navigate({ name: 'cards' })}
            onOpenAnalysis={() => navigate({ name: 'analysis' })}
            onOpenChat={() => navigate({ name: 'chat', returnTo: { name: 'optimize' } })}
          />
        );
      case 'chat':
        return <ChatScreen expenses={expenses} budgets={budgets} cards={cards} />;
      case 'recurring':
        return (
          <RecurringScreen
            recurring={recurring}
            groups={groups}
            onCreate={createRecurring}
            onDelete={deleteRecurring}
            onToggleActive={toggleRecurringActive}
          />
        );
      case 'cards':
        return (
          <CardsScreen
            cards={cards}
            payments={cardPayments}
            expenses={expenses}
            rewardCoins={rewardCoins}
            onOpenCard={(cardId) => navigate({ name: 'cardDetail', cardId })}
            onPayCard={(cardId) => navigate({ name: 'cardPay', cardId })}
            onAddCard={(c) => setCards((prev) => [{ ...c, id: newId(), createdAt: Date.now() }, ...prev])}
            onRedeem={(coins) => setRewardCoins((rc) => Math.max(0, rc - coins))}
            onBack={() => navigate({ name: 'home' })}
          />
        );
      case 'cardDetail': {
        const card = cards.find((c) => c.id === route.cardId);
        if (!card) return <View style={styles.content} />;
        return (
          <CardDetailScreen
            card={card}
            payments={cardPayments.filter((p) => p.cardId === card.id)}
            expenses={expenses.filter((e) => e.cardId === card.id)}
            onPay={() => navigate({ name: 'cardPay', cardId: card.id, fromDetail: true })}
            onDelete={() => {
              setCards((prev) => prev.filter((c) => c.id !== card.id));
              setCardPayments((prev) => prev.filter((p) => p.cardId !== card.id));
              navigate({ name: 'cards' });
            }}
            onBack={() => navigate({ name: 'cards' })}
          />
        );
      }
      case 'cardPay': {
        const card = cards.find((c) => c.id === route.cardId);
        if (!card) return <View style={styles.content} />;
        const fromDetail = route.fromDetail;
        return (
          <CardPayScreen
            card={card}
            onPay={(amountCents) => payCard(card.id, amountCents)}
            onClose={() => navigate(fromDetail ? { name: 'cardDetail', cardId: card.id } : { name: 'cards' })}
          />
        );
      }
      case 'scan':
        return (
          <ScanScreen
            capturedFile={pendingCapture}
            onParsed={(prefill) => navigate({ name: 'add', prefill, returnTo: { name: 'home' } })}
            onCancel={() => navigate({ name: 'home' })}
          />
        );
      case 'add': {
        const editing = route.editing ?? null;
        const returnTo = route.returnTo ?? { name: 'home' as const };
        return (
          <AddExpenseScreen
            prefill={route.prefill ?? null}
            editing={editing}
            groups={groups}
            presetGroupId={route.presetGroupId ?? null}
            onSave={(draft) => {
              saveExpense(draft, editing?.id ?? null);
              navigate(returnTo);
            }}
            onCancel={() => navigate(returnTo)}
          />
        );
      }
      case 'mileage':
        return (
          <MileageScreen
            mileage={mileage}
            onAdd={(t) => setMileage((prev) => [{ ...t, id: newId(), createdAt: Date.now() }, ...prev])}
            onDelete={(id) => setMileage((prev) => prev.filter((t) => t.id !== id))}
          />
        );
      case 'account':
        return user ? (
          <AccountScreen
            user={user}
            expenseCount={expenses.length}
            groupCount={groups.length}
            onOpenReports={() => navigate({ name: 'analysis' })}
            onOpenMileage={() => navigate({ name: 'mileage' })}
            onSignOut={handleSignOut}
          />
        ) : null;
      default:
        return null;
    }
  }, [
    route, expenses, groups, settlements, mileage, budgets, cards, cardPayments, rewardCoins, recurring, people,
    user, navigate, saveExpense, deleteExpense, payCard, toggleSettled, settlePeople, createRecurring,
    deleteRecurring, toggleRecurringActive, triggerScan, pendingCapture, createGroup, inviteToGroup,
    recordSettlement, handleSignOut,
  ]);

  const headerTitle =
    route.name === 'group'
      ? groups.find((g) => g.id === route.groupId)?.name ?? 'Group'
      : route.name === 'add'
      ? route.editing
        ? 'Edit expense'
        : 'Add expense'
      : TITLES[route.name] ?? '';

  if (authStatus === 'signedOut' || authStatus === 'signingIn' || (authStatus === 'checking' && !user)) {
    return (
      <View style={styles.page}>
        <View style={styles.phone}>
          <LoginScreen onSignIn={handleSignIn} signingIn={authStatus === 'signingIn'} error={authError} />
        </View>
        <Text style={styles.caption}>Sign-in and expense data are backed by your own Google Drive.</Text>
      </View>
    );
  }

  if (authStatus === 'loadingData' || authStatus === 'checking') {
    return (
      <View style={styles.page}>
        <View style={[styles.phone, styles.centered]}>
          <Text style={styles.loadingText}>Loading your data from Google Drive…</Text>
        </View>
      </View>
    );
  }

  if (authStatus === 'error') {
    return (
      <View style={styles.page}>
        <View style={[styles.phone, styles.centered]}>
          <Text style={styles.loadingText}>{authError ?? 'Something went wrong.'}</Text>
          <Pressable style={styles.retryBtn} onPress={() => user && handleSignIn()}>
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <View style={styles.phone}>
        {headerVisible ? (
          <View style={styles.header}>
            {showBack ? (
              <Pressable onPress={goBack} style={styles.back}>
                <Text style={styles.backText}>‹ Back</Text>
              </Pressable>
            ) : (
              <View style={styles.back} />
            )}
            <Text style={styles.headerTitle}>{showTitle ? headerTitle : ''}</Text>
            <View style={styles.back} />
          </View>
        ) : null}
        <View style={styles.content}>{body}</View>
        {showTabBar ? (
          <TabBar
            active={activeTab}
            onNavigate={(tab) => navigate({ name: tab } as Route)}
            onScan={triggerScan}
          />
        ) : null}
      </View>
      {React.createElement('input', {
        ref: cameraInputRef,
        type: 'file',
        accept: 'image/*',
        capture: 'environment',
        onChange: handleCameraCapture,
        style: { display: 'none' },
      })}
      <Text style={styles.caption}>Signed in as {user?.email}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#e7ecec', padding: 16 },
  phone: {
    width: 400,
    maxWidth: '100%',
    height: 820,
    maxHeight: '92%',
    backgroundColor: COLORS.screenBg,
    borderRadius: 28,
    overflow: 'hidden',
    boxShadow: '0 20px 60px rgba(20,40,60,0.18)',
    borderWidth: 1,
    borderColor: '#dfe6e6',
  } as object,
  centered: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  loadingText: { color: COLORS.subtext, fontSize: 15, fontWeight: '600', textAlign: 'center' },
  retryBtn: { marginTop: 16, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12, backgroundColor: COLORS.primary },
  retryText: { color: '#fff', fontWeight: '700' },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.bg,
  },
  back: { width: 64 },
  backText: { color: COLORS.primary, fontSize: 16, fontWeight: '600' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: COLORS.text },
  content: { flex: 1 },
  caption: { marginTop: 14, color: '#8a99a0', fontSize: 13 },
});
