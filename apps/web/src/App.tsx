import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { DocumentCategory } from '@domain/ocr/fieldparser';
import { COLORS } from './theme';
import {
  buildDocument,
  findDuplicates,
  loadState,
  newId,
  saveState,
  type CreateDocInput,
  type WebBudget,
  type WebDocument,
  type WebExpense,
  type WebGroup,
  type WebSettlement,
  type WebTransaction,
} from './store';
import { seedState } from './seed';
import HomeScreen from './screens/HomeScreen';
import DocumentsScreen from './screens/DocumentsScreen';
import ReviewScreen from './screens/ReviewScreen';
import SpendAnalysisScreen from './screens/SpendAnalysisScreen';
import TrackedItemsScreen from './screens/TrackedItemsScreen';
import GroupsScreen from './screens/GroupsScreen';
import GroupDetailScreen from './screens/GroupDetailScreen';
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
  | { name: 'documents'; autoScan?: boolean }
  | { name: 'review'; prefill: ReviewPrefill }
  | { name: 'analytics' }
  | { name: 'tracked' }
  | { name: 'groups' }
  | { name: 'group'; groupId: string; prefillDocId?: string };

const TITLES: Record<string, string> = {
  documents: 'Documents',
  review: 'Review & Save',
  analytics: 'Spending',
  tracked: 'Tracked items',
  groups: 'Groups',
};

const TAB_ROUTES = new Set(['home', 'analytics', 'groups', 'documents', 'tracked']);
const BACK_ROUTES = new Set(['review', 'group']);

export default function App() {
  const [route, setRoute] = useState<Route>({ name: 'home' });
  const [documents, setDocuments] = useState<WebDocument[]>([]);
  const [transactions, setTransactions] = useState<WebTransaction[]>([]);
  const [budgets, setBudgets] = useState<WebBudget[]>([]);
  const [groups, setGroups] = useState<WebGroup[]>([]);
  const [expenses, setExpenses] = useState<WebExpense[]>([]);
  const [settlements, setSettlements] = useState<WebSettlement[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const s = loadState() ?? seedState();
    setDocuments(s.documents ?? []);
    setTransactions(s.transactions ?? []);
    setBudgets(s.budgets ?? []);
    setGroups(s.groups ?? []);
    setExpenses(s.expenses ?? []);
    setSettlements(s.settlements ?? []);
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) {
      saveState({ documents, transactions, budgets, groups, expenses, settlements });
    }
  }, [documents, transactions, budgets, groups, expenses, settlements, loaded]);

  const navigate = useCallback((next: Route) => setRoute(next), []);

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
      : route.name === 'documents'
      ? 'documents'
      : null;

  const goBack = () => navigate(route.name === 'group' ? { name: 'groups' } : { name: 'home' });

  const body = useMemo(() => {
    switch (route.name) {
      case 'home':
        return (
          <HomeScreen
            documents={documents}
            transactions={transactions}
            onOpenReceipts={() => navigate({ name: 'documents' })}
            onOpenWarranty={() => navigate({ name: 'tracked' })}
            onOpenLoyalty={() => navigate({ name: 'tracked' })}
            onOpenSpending={() => navigate({ name: 'analytics' })}
          />
        );
      case 'documents':
        return (
          <DocumentsScreen
            documents={documents}
            groups={groups}
            autoOpenScan={route.autoScan}
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
          <SpendAnalysisScreen
            transactions={transactions}
            budgets={budgets}
            onAddBudget={(b) => setBudgets((prev) => [...prev, { ...b, id: newId() }])}
            onDeleteBudget={(id) => setBudgets((prev) => prev.filter((x) => x.id !== id))}
          />
        );
      case 'tracked':
        return <TrackedItemsScreen documents={documents} />;
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
      default:
        return null;
    }
  }, [route, documents, transactions, budgets, groups, expenses, settlements, navigate, addDocument]);

  const headerTitle = route.name === 'group' ? groups.find((g) => g.id === route.groupId)?.name ?? 'Group' : TITLES[route.name];

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
