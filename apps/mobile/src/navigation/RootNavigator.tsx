import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { RootStackParamList } from './types';
import DocumentsListScreen from '../screens/DocumentsListScreen';
import CaptureReviewScreen from '../screens/CaptureReviewScreen';
import LedgerScreen from '../screens/LedgerScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  return (
    <Stack.Navigator initialRouteName="Documents">
      <Stack.Screen
        name="Documents"
        component={DocumentsListScreen}
        options={{ title: 'Documents' }}
      />
      <Stack.Screen
        name="CaptureReview"
        component={CaptureReviewScreen}
        options={{ title: 'Review & Save' }}
      />
      <Stack.Screen name="Ledger" component={LedgerScreen} options={{ title: 'Spending' }} />
    </Stack.Navigator>
  );
}
