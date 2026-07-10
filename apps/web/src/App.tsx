import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
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
  type Settlement,
  type WebUser,
} from './store';
import { seedState } from './seed';
import HomeScreen from './screens/HomeScreen';
import PersonalScreen from './screens/PersonalScreen';
import GroupsScreen from './screens/GroupsScreen';
import GroupDetailScreen from './screens/GroupDetailScreen';
import AnalysisScreen from './screens/AnalysisScreen';
import OptimizeScreen from './screens/OptimizeScreen';
import CardsScreen from './screens/CardsScreen';
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
  | { name: 'account' }
  | { name: 'analysis' }
  | { name: 'optimize' }
  | { name: 'cards' }
  | { name: 'group'; groupId: string }
  | { name: 'scan' }
  | { name: 'add'; prefill?: ScanPrefill | null; presetGroupId?: string | null; editing?: Expense | null; returnTo?: Route }
  | { name: 'mileage' };

const TITLES: Record<string, string> = {
  personal: 'Personal',
  groups: 'Groups',
  account: 'Account',
  scan: 'Scan receipt',
  mileage: 'Mileage',
};

const TAB_ROUTES = new Set(['home', 'personal', 'groups', 'analysis', 'account']);
const BACK_ROUTES = new Set(['group', 'scan', 'add', 'optimize', 'cards', 'mileage']);
// These screens render their own full-width title, so the app chrome omits it.
const OWN_HEADER = new Set(['home', 'analysis', 'optimize', 'cards']);

export default function App() {
  const [route, setRoute] = useState<Route>({ name: 'home' });
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [mileage, setMileage] = useState<MileageTrip[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [cardPayments, setCardPayments] = useState<CardPayment[]>([]);
  const [user, setUser] = useState<WebUser | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const s = loadState() ?? seedState();
    setExpenses(s.expenses ?? []);
    setGroups(s.groups ?? []);
    setSettlements(s.settlements ?? []);
    setMileage(s.mileage ?? []);
    setBudgets(s.budgets ?? []);
    setCards(s.cards ?? []);
    setCardPayments(s.cardPayments ?? []);
    setUser(loadUser());
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) {
      saveState({ expenses, groups, settlements, mileage, budgets, cards, cardPayments });
    }
  }, [expenses, groups, settlements, mileage, budgets, cards, cardPayments, loaded]);

  const navigate = useCallback((next: Route) => setRoute(next), []);

  const saveExpense = useCallback((draft: Omit<Expense, 'id' | 'createdAt'>, editingId?: string | null) => {
    if (editingId) {
      setExpenses((prev) => prev.map((e) => (e.id === editingId ? { ...e, ...draft, id: e.id, createdAt: e.createdAt } : e)));
    } else {
      setExpenses((prev) => [{ ...draft, id: newId(), createdAt: Date.now() }, ...prev]);
    }
  }, []);

  const showTabBar = TAB_ROUTES.has(route.name);
  const showBack = BACK_ROUTES.has(route.name);
  const showTitle = !OWN_HEADER.has(route.name);

  const activeTab: TabKey | null =
    route.name === 'home'
      ? 'home'
      : route.name === 'personal'
      ? 'personal'
      : route.name === 'groups' || route.name === 'group'
      ? 'groups'
      : route.name === 'analysis'
      ? 'analysis'
      : route.name === 'account'
      ? 'account'
      : null;

  const goBack = () => {
    switch (route.name) {
      case 'group':
        return navigate({ name: 'groups' });
      case 'add':
        return navigate(route.returnTo ?? { name: 'home' });
      case 'mileage':
        return navigate({ name: 'analysis' });
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
            onScan={() => navigate({ name: 'scan' })}
            onAddExpense={() => navigate({ name: 'add', returnTo: { name: 'home' } })}
            onOpenPersonal={() => navigate({ name: 'personal' })}
            onOpenGroups={() => navigate({ name: 'groups' })}
            onOpenAnalysis={() => navigate({ name: 'analysis' })}
            onOpenOptimize={() => navigate({ name: 'optimize' })}
            onOpenCards={() => navigate({ name: 'cards' })}
            onOpenGroup={(groupId) => navigate({ name: 'group', groupId })}
          />
        );
      case 'personal':
        return (
          <PersonalScreen
            expenses={expenses}
            onScan={() => navigate({ name: 'scan' })}
            onAddExpense={() => navigate({ name: 'add', returnTo: { name: 'personal' } })}
            onEditExpense={(e) => navigate({ name: 'add', editing: e, returnTo: { name: 'personal' } })}
            onOpenAnalysis={() => navigate({ name: 'analysis' })}
          />
        );
      case 'groups':
        return (
          <GroupsScreen
            expenses={expenses}
            groups={groups}
            settlements={settlements}
            onOpenGroup={(groupId) => navigate({ name: 'group', groupId })}
            onCreateGroup={(g) => {
              const id = newId();
              setGroups((prev) => [...prev, { ...g, id, createdAt: Date.now() }]);
              navigate({ name: 'group', groupId: id });
            }}
          />
        );
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
          />
        );
      case 'cards':
        return (
          <CardsScreen
            cards={cards}
            payments={cardPayments}
            onAddCard={(c) => setCards((prev) => [{ ...c, id: newId(), createdAt: Date.now() }, ...prev])}
            onDeleteCard={(id) => {
              setCards((prev) => prev.filter((c) => c.id !== id));
              setCardPayments((prev) => prev.filter((p) => p.cardId !== id));
            }}
            onRecordPayment={(p) => {
              setCardPayments((prev) => [{ ...p, id: newId(), createdAt: Date.now() }, ...prev]);
              setCards((prev) => prev.map((c) => (c.id === p.cardId ? { ...c, outstandingCents: Math.max(0, c.outstandingCents - p.amountCents) } : c)));
            }}
          />
        );
      case 'scan':
        return (
          <ScanScreen
            onParsed={(prefill) => navigate({ name: 'add', prefill, returnTo: { name: 'home' } })}
            onManual={() => navigate({ name: 'add', returnTo: { name: 'home' } })}
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
  }, [route, expenses, groups, settlements, mileage, budgets, cards, cardPayments, user, navigate, saveExpense]);

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
        {showTitle || showBack ? (
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
            onScan={() => navigate({ name: 'scan' })}
          />
        ) : null}
      </View>
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
