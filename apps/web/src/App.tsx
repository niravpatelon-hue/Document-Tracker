import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { DocumentCategory } from '@domain/ocr/fieldparser';
import { COLORS } from './theme';
import {
  buildDocument,
  findDuplicates,
  loadState,
  loadUser,
  newId,
  saveState,
  saveUser,
  type AppMode,
  type BusinessProfile,
  type CreateDocInput,
  type InvoiceStatus,
  type WebBudget,
  type WebBusinessExpense,
  type WebClient,
  type WebDocument,
  type WebExpense,
  type WebGroup,
  type WebIncome,
  type WebInvoice,
  type WebMileageTrip,
  type WebSettlement,
  type WebTransaction,
  type WebUser,
} from './store';
import { seedState } from './seed';
import HomeScreen from './screens/HomeScreen';
import DocumentsScreen from './screens/DocumentsScreen';
import ReviewScreen from './screens/ReviewScreen';
import SpendingsScreen from './screens/SpendingsScreen';
import TrackedItemsScreen from './screens/TrackedItemsScreen';
import GroupsScreen from './screens/GroupsScreen';
import GroupDetailScreen from './screens/GroupDetailScreen';
import BusinessScreen from './screens/BusinessScreen';
import InvoicesScreen from './screens/InvoicesScreen';
import ClientsScreen from './screens/ClientsScreen';
import GSTScreen from './screens/GSTScreen';
import MileageScreen from './screens/MileageScreen';
import LoginScreen from './screens/LoginScreen';
import ProfileScreen from './screens/ProfileScreen';
import TabBar, { type TabKey } from './components/TabBar';

export interface ReviewPrefill {
  category: DocumentCategory;
  vendor: string;
  totalCents: number | null;
  taxCents: number | null;
  dateISO: string;
  imei: string | null;
  serial: string | null;
  productName: string | null;
  retailer: string | null;
  imageDataUrl: string | null;
  rawText: string;
  ocrMode: 'on_device' | 'cloud' | 'manual';
}

type Route =
  | { name: 'home' }
  | { name: 'documents'; autoScan?: boolean; intendedCategory?: DocumentCategory }
  | { name: 'review'; prefill: ReviewPrefill }
  | { name: 'analytics' }
  | { name: 'tracked' }
  | { name: 'groups' }
  | { name: 'group'; groupId: string; prefillDocId?: string }
  | { name: 'business' }
  | { name: 'invoices' }
  | { name: 'clients' }
  | { name: 'gst' }
  | { name: 'mileage' }
  | { name: 'profile' };

/** A blank prefill for adding an item by hand (no scan). */
function blankPrefill(category: DocumentCategory): ReviewPrefill {
  return {
    category,
    vendor: '',
    totalCents: null,
    taxCents: null,
    dateISO: '',
    imei: null,
    serial: null,
    productName: null,
    retailer: null,
    imageDataUrl: null,
    rawText: '',
    ocrMode: 'manual',
  };
}

const TITLES: Record<string, string> = {
  documents: 'Documents',
  review: 'Review & Save',
  analytics: 'Spending',
  tracked: 'Tracked items',
  groups: 'Groups',
  business: 'Business',
  invoices: 'Invoices',
  clients: 'Clients',
  gst: 'GST & Tax',
  mileage: 'Mileage',
  profile: 'Profile',
};

const TAB_ROUTES = new Set(['home', 'analytics', 'groups', 'business', 'profile', 'documents', 'tracked']);
const BACK_ROUTES = new Set(['review', 'group', 'invoices', 'clients', 'gst', 'mileage']);
const EMPTY_BUSINESS_PROFILE: BusinessProfile = { name: '', gstin: '' };

export default function App() {
  const [route, setRoute] = useState<Route>({ name: 'home' });
  const [documents, setDocuments] = useState<WebDocument[]>([]);
  const [transactions, setTransactions] = useState<WebTransaction[]>([]);
  const [incomes, setIncomes] = useState<WebIncome[]>([]);
  const [budgets, setBudgets] = useState<WebBudget[]>([]);
  const [groups, setGroups] = useState<WebGroup[]>([]);
  const [expenses, setExpenses] = useState<WebExpense[]>([]);
  const [settlements, setSettlements] = useState<WebSettlement[]>([]);
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile>(EMPTY_BUSINESS_PROFILE);
  const [clients, setClients] = useState<WebClient[]>([]);
  const [invoices, setInvoices] = useState<WebInvoice[]>([]);
  const [mileage, setMileage] = useState<WebMileageTrip[]>([]);
  const [businessExpenses, setBusinessExpenses] = useState<WebBusinessExpense[]>([]);
  const [user, setUser] = useState<WebUser | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const s = loadState() ?? seedState();
    setDocuments(s.documents ?? []);
    setTransactions(s.transactions ?? []);
    setIncomes(s.incomes ?? []);
    setBudgets(s.budgets ?? []);
    setGroups(s.groups ?? []);
    setExpenses(s.expenses ?? []);
    setSettlements(s.settlements ?? []);
    setBusinessProfile(s.businessProfile ?? EMPTY_BUSINESS_PROFILE);
    setClients(s.clients ?? []);
    setInvoices(s.invoices ?? []);
    setMileage(s.mileage ?? []);
    setBusinessExpenses(s.businessExpenses ?? []);
    setUser(loadUser());
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) {
      saveState({
        documents,
        transactions,
        incomes,
        budgets,
        groups,
        expenses,
        settlements,
        businessProfile,
        clients,
        invoices,
        mileage,
        businessExpenses,
      });
    }
  }, [documents, transactions, incomes, budgets, groups, expenses, settlements, businessProfile, clients, invoices, mileage, businessExpenses, loaded]);

  const navigate = useCallback((next: Route) => setRoute(next), []);
  const mode: AppMode = user?.mode ?? 'personal';

  const setMode = useCallback((m: AppMode) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, mode: m };
      saveUser(next);
      return next;
    });
    setRoute({ name: 'home' });
  }, []);

  const addDocument = useCallback(
    (input: CreateDocInput): WebDocument[] => {
      const dupes = findDuplicates(input, documents);
      if (dupes.length > 0 && !window.confirm('This looks like a purchase you already logged. Save anyway?')) {
        return dupes;
      }
      const { doc, txn } = buildDocument(input);
      setDocuments((prev) => [doc, ...prev]);
      if (txn) {
        setTransactions((prev) => [txn, ...prev]);
      }
      return [];
    },
    [documents],
  );

  const showTabBar = TAB_ROUTES.has(route.name);
  const showBack = BACK_ROUTES.has(route.name);
  const showTitle = route.name !== 'home';

  const activeTab: TabKey | null =
    route.name === 'home'
      ? 'home'
      : route.name === 'analytics'
      ? 'analytics'
      : route.name === 'groups'
      ? 'groups'
      : route.name === 'business'
      ? 'business'
      : route.name === 'profile'
      ? 'profile'
      : null;

  const goBack = () => {
    if (route.name === 'group') return navigate({ name: 'groups' });
    if (route.name === 'invoices' || route.name === 'clients' || route.name === 'gst' || route.name === 'mileage') {
      return navigate({ name: 'business' });
    }
    return navigate({ name: 'home' });
  };

  const body = useMemo(() => {
    switch (route.name) {
      case 'home':
        return (
          <HomeScreen
            mode={mode}
            userName={user?.name ?? null}
            transactions={transactions}
            incomes={incomes}
            documents={documents}
            groups={groups}
            invoices={invoices}
            clients={clients}
            businessExpenses={businessExpenses}
            mileage={mileage}
            businessProfile={businessProfile}
            onScan={() => navigate({ name: 'documents', autoScan: true })}
            onOpenSpending={() => navigate({ name: 'analytics' })}
            onOpenReceipts={() => navigate({ name: 'documents' })}
            onOpenTracked={() => navigate({ name: 'tracked' })}
            onOpenGroups={() => navigate({ name: 'groups' })}
            onOpenInvoices={() => navigate({ name: 'invoices' })}
            onOpenGST={() => navigate({ name: 'gst' })}
            onOpenClients={() => navigate({ name: 'clients' })}
            onOpenMileage={() => navigate({ name: 'mileage' })}
          />
        );
      case 'documents':
        return (
          <DocumentsScreen
            documents={documents}
            groups={groups}
            autoOpenScan={route.autoScan}
            intendedCategory={route.intendedCategory}
            onReview={(prefill) => navigate({ name: 'review', prefill })}
            onOpenGroups={() => navigate({ name: 'groups' })}
            onSplitToGroup={(groupId, docId) => navigate({ name: 'group', groupId, prefillDocId: docId })}
          />
        );
      case 'review':
        return (
          <ReviewScreen
            prefill={route.prefill}
            onSave={(input) => {
              if (addDocument(input).length === 0) {
                navigate({ name: 'home' });
              }
            }}
            onCancel={() => navigate({ name: 'home' })}
          />
        );
      case 'analytics':
        return (
          <SpendingsScreen
            mode={mode}
            transactions={transactions}
            incomes={incomes}
            budgets={budgets}
            businessExpenses={businessExpenses}
            onScan={() => navigate({ name: 'documents', autoScan: true })}
            onAddExpense={() =>
              mode === 'business'
                ? navigate({ name: 'gst' })
                : navigate({ name: 'review', prefill: blankPrefill('bills_receipts') })
            }
            onOpenMileage={() => navigate({ name: 'mileage' })}
            onAddBudget={(b) => setBudgets((prev) => [...prev, { ...b, id: newId() }])}
            onDeleteBudget={(id) => setBudgets((prev) => prev.filter((x) => x.id !== id))}
          />
        );
      case 'tracked':
        return (
          <TrackedItemsScreen
            documents={documents}
            onAddManual={(cat) => navigate({ name: 'review', prefill: blankPrefill(cat) })}
            onAddScan={(cat) => navigate({ name: 'documents', autoScan: true, intendedCategory: cat })}
          />
        );
      case 'groups':
        return (
          <GroupsScreen
            groups={groups}
            expenses={expenses}
            settlements={settlements}
            onOpenGroup={(groupId) => navigate({ name: 'group', groupId })}
            onCreateGroup={(g) => {
              const id = newId();
              setGroups((prev) => [...prev, { ...g, id }]);
              navigate({ name: 'group', groupId: id });
            }}
          />
        );
      case 'group': {
        const group = groups.find((g) => g.id === route.groupId);
        if (!group) {
          return <View style={styles.content} />;
        }
        const prefillReceipt = route.prefillDocId
          ? documents.find((d) => d.id === route.prefillDocId) ?? null
          : null;
        return (
          <GroupDetailScreen
            group={group}
            expenses={expenses.filter((e) => e.groupId === group.id)}
            settlements={settlements.filter((s) => s.groupId === group.id)}
            receiptDocs={documents.filter((d) => d.category === 'bills_receipts' && d.totalCents != null)}
            prefillReceipt={prefillReceipt}
            onAddExpense={(e) => setExpenses((prev) => [{ ...e, id: newId(), createdAt: Date.now() }, ...prev])}
            onUpdateExpense={(id, patch) => setExpenses((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)))}
            onDeleteExpense={(id) => setExpenses((prev) => prev.filter((e) => e.id !== id))}
            onRecordSettlement={(s) => setSettlements((prev) => [{ ...s, id: newId(), createdAt: Date.now() }, ...prev])}
          />
        );
      }
      case 'business':
        return (
          <BusinessScreen
            businessProfile={businessProfile}
            invoices={invoices}
            clients={clients}
            businessExpenses={businessExpenses}
            mileage={mileage}
            onOpenInvoices={() => navigate({ name: 'invoices' })}
            onOpenClients={() => navigate({ name: 'clients' })}
            onOpenGST={() => navigate({ name: 'gst' })}
            onOpenMileage={() => navigate({ name: 'mileage' })}
            onOpenExpenses={() => navigate({ name: 'analytics' })}
          />
        );
      case 'invoices':
        return (
          <InvoicesScreen
            invoices={invoices}
            clients={clients}
            businessProfile={businessProfile}
            onCreate={(inv) => setInvoices((prev) => [{ ...inv, id: newId(), createdAt: Date.now() }, ...prev])}
            onUpdateStatus={(id, status: InvoiceStatus) =>
              setInvoices((prev) => prev.map((iv) => (iv.id === id ? { ...iv, status } : iv)))
            }
            onDelete={(id) => setInvoices((prev) => prev.filter((iv) => iv.id !== id))}
            onOpenClients={() => navigate({ name: 'clients' })}
          />
        );
      case 'clients':
        return (
          <ClientsScreen
            clients={clients}
            invoices={invoices}
            onCreate={(c) => setClients((prev) => [{ ...c, id: newId(), createdAt: Date.now() }, ...prev])}
            onDelete={(id) => setClients((prev) => prev.filter((c) => c.id !== id))}
          />
        );
      case 'gst':
        return (
          <GSTScreen
            businessExpenses={businessExpenses}
            invoices={invoices}
            businessProfile={businessProfile}
            onAddExpense={(e) => setBusinessExpenses((prev) => [{ ...e, id: newId(), createdAt: Date.now() }, ...prev])}
            onDeleteExpense={(id) => setBusinessExpenses((prev) => prev.filter((x) => x.id !== id))}
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
      case 'profile':
        return user ? (
          <ProfileScreen
            user={user}
            mode={mode}
            onSetMode={setMode}
            businessProfile={businessProfile}
            onSaveBusinessProfile={(p) => setBusinessProfile(p)}
            documentsCount={documents.length}
            trackedCount={documents.filter((d) => d.category === 'warranty' || d.category === 'loyalty').length}
            groupsCount={groups.length}
            invoicesCount={invoices.length}
            clientsCount={clients.length}
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
  }, [route, mode, documents, transactions, incomes, budgets, groups, expenses, settlements, businessProfile, clients, invoices, mileage, businessExpenses, navigate, addDocument, setMode, user]);

  const headerTitle = route.name === 'group' ? groups.find((g) => g.id === route.groupId)?.name ?? 'Group' : TITLES[route.name];

  if (loaded && !user) {
    return (
      <View style={styles.page}>
        <View style={styles.phone}>
          <LoginScreen
            onSignIn={(u) => {
              const withMode: WebUser = { ...u, mode: 'personal' };
              saveUser(withMode);
              setUser(withMode);
            }}
          />
        </View>
        <Text style={styles.caption}>
          Web preview of the Document Tracker Android app · camera &amp; cloud OCR are stubbed here
        </Text>
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
            mode={mode}
            onNavigate={(tab) => navigate({ name: tab } as Route)}
            onScan={() => navigate({ name: 'documents', autoScan: true })}
          />
        ) : null}
      </View>
      <Text style={styles.caption}>
        Web preview of the Document Tracker Android app · camera &amp; cloud OCR are stubbed here
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#eceff3', padding: 16 },
  phone: {
    width: 400,
    maxWidth: '100%',
    height: 820,
    maxHeight: '92%',
    backgroundColor: COLORS.bg,
    borderRadius: 28,
    overflow: 'hidden',
    boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
    borderWidth: 1,
    borderColor: '#dfe3e8',
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
  caption: { marginTop: 14, color: '#8a94a6', fontSize: 13 },
});
