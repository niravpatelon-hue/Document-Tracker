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
  type Expense,
  type Group,
  type MileageTrip,
  type Settlement,
  type WebUser,
} from './store';
import { seedState } from './seed';
import ActivityScreen from './screens/ActivityScreen';
import ExpensesScreen from './screens/ExpensesScreen';
import ScanScreen from './screens/ScanScreen';
import AddExpenseScreen from './screens/AddExpenseScreen';
import GroupsScreen from './screens/GroupsScreen';
import GroupDetailScreen from './screens/GroupDetailScreen';
import ReportsScreen from './screens/ReportsScreen';
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
  | { name: 'expenses' }
  | { name: 'groups' }
  | { name: 'account' }
  | { name: 'group'; groupId: string }
  | { name: 'scan' }
  | { name: 'add'; prefill?: ScanPrefill | null; presetGroupId?: string | null; editing?: Expense | null; returnTo?: Route }
  | { name: 'reports' }
  | { name: 'mileage' };

const TITLES: Record<string, string> = {
  expenses: 'Expenses',
  groups: 'Groups',
  account: 'Account',
  scan: 'Scan receipt',
  reports: 'Reports',
  mileage: 'Mileage',
};

const TAB_ROUTES = new Set(['home', 'expenses', 'groups', 'account']);
const BACK_ROUTES = new Set(['group', 'scan', 'add', 'reports', 'mileage']);

export default function App() {
  const [route, setRoute] = useState<Route>({ name: 'home' });
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [mileage, setMileage] = useState<MileageTrip[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [user, setUser] = useState<WebUser | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const s = loadState() ?? seedState();
    setExpenses(s.expenses ?? []);
    setGroups(s.groups ?? []);
    setSettlements(s.settlements ?? []);
    setMileage(s.mileage ?? []);
    setBudgets(s.budgets ?? []);
    setUser(loadUser());
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) {
      saveState({ expenses, groups, settlements, mileage, budgets });
    }
  }, [expenses, groups, settlements, mileage, budgets, loaded]);

  const navigate = useCallback((next: Route) => setRoute(next), []);

  const saveExpense = useCallback(
    (draft: Omit<Expense, 'id' | 'createdAt'>, editingId?: string | null) => {
      if (editingId) {
        setExpenses((prev) => prev.map((e) => (e.id === editingId ? { ...e, ...draft, id: e.id, createdAt: e.createdAt } : e)));
      } else {
        setExpenses((prev) => [{ ...draft, id: newId(), createdAt: Date.now() }, ...prev]);
      }
    },
    [],
  );

  const showTabBar = TAB_ROUTES.has(route.name);
  const showBack = BACK_ROUTES.has(route.name);
  const showTitle = route.name !== 'home';

  const activeTab: TabKey | null =
    route.name === 'home'
      ? 'home'
      : route.name === 'expenses'
      ? 'expenses'
      : route.name === 'groups' || route.name === 'group'
      ? 'groups'
      : route.name === 'account'
      ? 'account'
      : null;

  const goBack = () => {
    switch (route.name) {
      case 'group':
        return navigate({ name: 'groups' });
      case 'scan':
        return navigate({ name: 'home' });
      case 'add':
        return navigate(route.returnTo ?? { name: 'home' });
      case 'reports':
      case 'mileage':
        return navigate({ name: 'account' });
      default:
        return navigate({ name: 'home' });
    }
  };

  const body = useMemo(() => {
    switch (route.name) {
      case 'home':
        return (
          <ActivityScreen
            userName={user?.name ?? null}
            expenses={expenses}
            groups={groups}
            settlements={settlements}
            onScan={() => navigate({ name: 'scan' })}
            onAddExpense={() => navigate({ name: 'add', returnTo: { name: 'home' } })}
            onOpenExpenses={() => navigate({ name: 'expenses' })}
            onOpenGroups={() => navigate({ name: 'groups' })}
            onOpenGroup={(groupId) => navigate({ name: 'group', groupId })}
            onOpenReports={() => navigate({ name: 'reports' })}
          />
        );
      case 'expenses':
        return (
          <ExpensesScreen
            expenses={expenses}
            groups={groups}
            onScan={() => navigate({ name: 'scan' })}
            onAddExpense={() => navigate({ name: 'add', returnTo: { name: 'expenses' } })}
            onEditExpense={(e) => navigate({ name: 'add', editing: e, returnTo: { name: 'expenses' } })}
            onOpenReports={() => navigate({ name: 'reports' })}
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
      case 'reports':
        return (
          <ReportsScreen
            expenses={expenses}
            budgets={budgets}
            mileage={mileage}
            onAddBudget={(b) => setBudgets((prev) => [...prev, { ...b, id: newId() }])}
            onDeleteBudget={(id) => setBudgets((prev) => prev.filter((x) => x.id !== id))}
            onOpenMileage={() => navigate({ name: 'mileage' })}
          />
        );
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
            onOpenReports={() => navigate({ name: 'reports' })}
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
  }, [route, expenses, groups, settlements, mileage, budgets, user, navigate, saveExpense]);

  const headerTitle =
    route.name === 'group'
      ? groups.find((g) => g.id === route.groupId)?.name ?? 'Group'
      : route.name === 'add'
      ? route.editing
        ? 'Edit expense'
        : 'Add expense'
      : TITLES[route.name];

  if (loaded && !user) {
    return (
      <View style={styles.page}>
        <View style={styles.phone}>
          <LoginScreen
            onSignIn={(u) => {
              saveUser(u);
              setUser(u);
            }}
          />
        </View>
        <Text style={styles.caption}>Web preview · camera &amp; cloud OCR are stubbed here</Text>
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <View style={styles.phone}>
        {showTitle ? (
          <View style={styles.header}>
            {showBack ? (
              <Pressable onPress={goBack} style={styles.back}>
                <Text style={styles.backText}>‹ Back</Text>
              </Pressable>
            ) : (
              <View style={styles.back} />
            )}
            <Text style={styles.headerTitle}>{headerTitle}</Text>
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
