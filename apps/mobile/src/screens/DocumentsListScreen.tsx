import React, { useCallback } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Q } from '@nozbe/watermelondb';
import { useDatabase } from '@nozbe/watermelondb/react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import type { Document } from '../db/models';
import { useQuery } from '../hooks/useQuery';
import { CLOUD_OCR_ENABLED, CURRENT_USER_ID } from '../config';
import { scanDocument } from '../capture/DocumentScanner';
import { recognizeText } from '../ocr/onDeviceText';
import { runOcr } from '../ocr/OcrService';

type Props = NativeStackScreenProps<RootStackParamList, 'Documents'>;

const CATEGORY_LABEL: Record<string, string> = {
  bills_receipts: 'Bill / Receipt',
  warranty: 'Warranty',
  loyalty: 'Loyalty / Gift card',
  other: 'Other',
};

export default function DocumentsListScreen({ navigation }: Props) {
  const database = useDatabase();
  const documents = useQuery<Document>(
    () =>
      database
        .get<Document>('documents')
        .query(Q.where('owner_id', CURRENT_USER_ID), Q.where('deleted_at', null), Q.sortBy('created_at', Q.desc)),
    [database],
  );

  const onScan = useCallback(async () => {
    try {
      const { pageImageUris } = await scanDocument();
      if (pageImageUris.length === 0) {
        return;
      }
      const ocr = await runOcr(pageImageUris, {
        recognizeText,
        cloudEnabled: CLOUD_OCR_ENABLED,
      });
      // phashPerPage is empty until the native downscale-to-grayscale step lands
      // that feeds domain/dedup/imagehash.averageHash (see ARCHITECTURE.md §9).
      navigation.navigate('CaptureReview', { pageImageUris, phashPerPage: [], ocr });
    } catch (error) {
      Alert.alert('Capture unavailable', error instanceof Error ? error.message : String(error));
    }
  }, [navigation]);

  return (
    <View style={styles.container}>
      <FlatList
        data={documents}
        keyExtractor={(item) => item.id}
        contentContainerStyle={documents.length === 0 && styles.emptyContainer}
        ListEmptyComponent={
          <Text style={styles.empty}>No documents yet. Scan a receipt to get started.</Text>
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.rowCategory}>{CATEGORY_LABEL[item.category] ?? item.category}</Text>
            <Text style={styles.rowSub}>
              {item.ocrStatus === 'cloud_done' ? 'Cloud OCR' : 'On-device OCR'}
            </Text>
          </View>
        )}
      />
      <View style={styles.actions}>
        <Pressable style={styles.secondaryButton} onPress={() => navigation.navigate('Ledger')}>
          <Text style={styles.secondaryButtonText}>Spending</Text>
        </Pressable>
        <Pressable style={styles.primaryButton} onPress={onScan}>
          <Text style={styles.primaryButtonText}>Scan document</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  emptyContainer: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  empty: { color: '#666', textAlign: 'center', fontSize: 16 },
  row: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e0e0e0' },
  rowCategory: { fontSize: 16, fontWeight: '600', color: '#111' },
  rowSub: { fontSize: 13, color: '#888', marginTop: 2 },
  actions: { flexDirection: 'row', padding: 16, gap: 12 },
  primaryButton: { flex: 1, backgroundColor: '#1f6feb', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  primaryButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  secondaryButton: { flex: 1, backgroundColor: '#eef1f5', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  secondaryButtonText: { color: '#1f2937', fontWeight: '600', fontSize: 16 },
});
