import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { DocumentCategory } from '@domain/ocr/fieldparser';
import { COLORS } from './theme';
import {
  buildDocument,
  findDuplicates,
  loadState,
  saveState,
  type CreateDocInput,
  type WebDocument,
  type WebTransaction,
} from './store';
import { seedState } from './seed';
import DocumentsScreen from './screens/DocumentsScreen';
import ReviewScreen from './screens/ReviewScreen';
import LedgerScreen from './screens/LedgerScreen';
import SplitDemoScreen from './screens/SplitDemoScreen';

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
  | { name: 'documents' }
  | { name: 'review'; prefill: ReviewPrefill }
  | { name: 'ledger' }
  | { name: 'split' };

const TITLES: Record<Route['name'], string> = {
  documents: 'Documents',
  review: 'Review & Save',
  ledger: 'Spending',
  split: 'Split demo',
};

export default function App() {
  const [route, setRoute] = useState<Route>({ name: 'documents' });
  const [documents, setDocuments] = useState<WebDocument[]>([]);
  const [transactions, setTransactions] = useState<WebTransaction[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Load persisted state (or seed) once.
  useEffect(() => {
    const state = loadState() ?? seedState();
    setDocuments(state.documents);
    setTransactions(state.transactions);
    setLoaded(true);
  }, []);

  // Persist on change.
  useEffect(() => {
    if (loaded) {
      saveState({ documents, transactions });
    }
  }, [documents, transactions, loaded]);

  const addDocument = useCallback(
    (input: CreateDocInput): WebDocument[] => {
      const dupes = findDuplicates(input, documents);
      if (dupes.length > 0) {
        const proceed = window.confirm(
          'This looks like a purchase you already logged. Save anyway?',
        );
        if (!proceed) {
          return dupes;
        }
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

  const canGoBack = route.name !== 'documents';
  const navigate = useCallback((next: Route) => setRoute(next), []);

  const body = useMemo(() => {
    switch (route.name) {
      case 'documents':
        return (
          <DocumentsScreen
            documents={documents}
            onReview={(prefill) => navigate({ name: 'review', prefill })}
            onOpenLedger={() => navigate({ name: 'ledger' })}
            onOpenSplit={() => navigate({ name: 'split' })}
          />
        );
      case 'review':
        return (
          <ReviewScreen
            prefill={route.prefill}
            onSave={(input) => {
              const blocked = addDocument(input);
              if (blocked.length === 0) {
                navigate({ name: 'documents' });
              }
            }}
            onCancel={() => navigate({ name: 'documents' })}
          />
        );
      case 'ledger':
        return <LedgerScreen transactions={transactions} />;
      case 'split':
        return <SplitDemoScreen />;
      default:
        return null;
    }
  }, [route, documents, transactions, navigate, addDocument]);

  return (
    <View style={styles.page}>
      <View style={styles.phone}>
        <View style={styles.header}>
          {canGoBack ? (
            <Pressable onPress={() => navigate({ name: 'documents' })} style={styles.back}>
              <Text style={styles.backText}>‹ Back</Text>
            </Pressable>
          ) : (
            <View style={styles.back} />
          )}
          <Text style={styles.headerTitle}>{TITLES[route.name]}</Text>
          <View style={styles.back} />
        </View>
        <View style={styles.content}>{body}</View>
      </View>
      <Text style={styles.caption}>
        Web preview of the Document Tracker Android app · camera &amp; cloud OCR are stubbed here
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eceff3',
    padding: 16,
  },
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
