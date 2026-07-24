import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { rewardCoinsFor } from '@domain/analytics/cards';
import { COLORS } from './theme';
import {
  loadState,
  loadUser,
  newId,
  saveState,
  saveUser,
  type Budget,
  type CardPayment,
  type CreditCard,
  type Expense,
  type Group,
  type MileageTrip,
  type RecurringExpense,
  type Settlement,
  type WebUser,
} from './store';
import { seedState } from './seed';
import { buildPeople, type ApportionedSettlement } from './people';
import { materializeDueRecurring } from './recurring';
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
  | { name: 'scan'; capturedFile?: File | null }
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
  const [loaded, setLoaded] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const s = loadState() ?? seedState();
    setExpenses(s.expenses ?? []);
    setGroups(s.groups ?? []);
    setSettlements(s.settlements ?? []);
    setMileage(s.mileage ?? []);
    setBudgets(s.budgets ?? []);
    setCards(s.cards ?? []);
    setCardPayments(s.cardPayments ?? []);
    setRewardCoins(s.rewardCoins ?? 0);
    setRecurring(s.recurring ?? []);
    setUser(loadUser());
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) {
      saveState({ expenses, groups, settlements, mileage, budgets, cards, cardPayments, rewardCoins, recurring });
    }
  }, [expenses, groups, settlements, mileage, budgets, cards, cardPayments, rewardCoins, recurring, loaded]);

  // Catch up any recurring rules whose next occurrence has already arrived —
  // runs once right after hydration (not on every `recurring` change, which
  // this same effect writes to).
  useEffect(() => {
    if (!loaded) return;
    setRecurring((currentRules) => {
      const { newExpenses, updatedRules } = materializeDueRecurring(currentRules, todayISO());
      if (newExpenses.length > 0) {
        setExpenses((prev) => [...newExpenses, ...prev]);
      }
      return updatedRules;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  const navigate = useCallback((next: Route) => setRoute(next), []);

  // The Scan action opens the device camera directly — the click() must fire
  // synchronously inside the same tap handler the user invoked (browsers
  // require a live user gesture to open a file/camera picker; a click() from
  // inside a mounted screen's useEffect after navigating is not reliable).
  // Cancelling the camera leaves the user exactly where they were, same as a
  // native camera app. A separate "upload a file" entry point still reaches
  // the classic ScanScreen upload flow with no capture attribute.
  const triggerScan = useCallback(() => {
    cameraInputRef.current?.click();
  }, []);

  const handleCameraCapture = useCallback((e: any) => {
    const file: File | undefined = e?.target?.files?.[0];
    if (file) {
      navigate({ name: 'scan', capturedFile: file });
    }
    if (cameraInputRef.current) {
      cameraInputRef.current.value = '';
    }
  }, [navigate]);

  const saveExpense = useCallback((draft: Omit<Expense, 'id' | 'createdAt'>, editingId?: string | null) => {
    if (editingId) {
      setExpenses((prev) => prev.map((e) => (e.id === editingId ? { ...e, ...draft, id: e.id, createdAt: e.createdAt } : e)));
    } else {
      setExpenses((prev) => [{ ...draft, settled: draft.settled ?? false, id: newId(), createdAt: Date.now() }, ...prev]);
    }
  }, []);

  const toggleSettled = useCallback((id: string) => {
    setExpenses((prev) => prev.map((e) => (e.id === id ? { ...e, settled: !e.settled } : e)));
  }, []);

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
  }, []);

  const deleteRecurring = useCallback((id: string) => {
    setRecurring((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const toggleRecurringActive = useCallback((id: string) => {
    setRecurring((prev) => prev.map((r) => (r.id === id ? { ...r, active: !r.active } : r)));
  }, []);

  const people = useMemo(() => buildPeople(groups, expenses, settlements), [groups, expenses, settlements]);

  const settlePeople = useCallback((apportioned: ApportionedSettlement[]) => {
    if (apportioned.length === 0) return;
    const now = Date.now();
    setSettlements((prev) => [
      ...apportioned.map((s) => ({ ...s, id: newId(), createdAt: now })),
      ...prev,
    ]);
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
            onUploadReceipt={() => navigate({ name: 'scan' })}
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
            onToggleSettled={toggleSettled}
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
            onCreateGroup={(g) => {
              const id = newId();
              setGroups((prev) => [...prev, { ...g, id, createdAt: Date.now() }]);
              navigate({ name: 'group', groupId: id });
            }}
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
            onDeleteExpense={(id) => setExpenses((prev) => prev.filter((e) => e.id !== id))}
            onRecordSettlement={(s) => setSettlements((prev) => [{ ...s, id: newId(), createdAt: Date.now() }, ...prev])}
            onToggleSettled={toggleSettled}
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
            capturedFile={route.capturedFile ?? null}
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
            onSignOut={() => {
              saveUser(null);
              setUser(null);
              navigate({ name: 'home' });
            }}
          />
        ) : null;
      default:
        return null;
    }
  }, [route, expenses, groups, settlements, mileage, budgets, cards, cardPayments, rewardCoins, recurring, people, user, navigate, saveExpense, payCard, toggleSettled, settlePeople, createRecurring, deleteRecurring, toggleRecurringActive, triggerScan]);

  const headerTitle =
    route.name === 'group'
      ? groups.find((g) => g.id === route.groupId)?.name ?? 'Group'
      : route.name === 'add'
      ? route.editing
        ? 'Edit expense'
        : 'Add expense'
      : TITLES[route.name] ?? '';

  if (loaded && !user) {
    return (
      <View style={styles.page}>
        <View style={styles.phone}>
          <LoginScreen onSignIn={(u) => { saveUser(u); setUser(u); }} />
        </View>
        <Text style={styles.caption}>Web preview · camera &amp; cloud OCR are stubbed here</Text>
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
      <Text style={styles.caption}>Web preview · camera &amp; cloud OCR are stubbed here</Text>
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
