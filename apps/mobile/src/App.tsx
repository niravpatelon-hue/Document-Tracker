import React from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { DatabaseProvider } from '@nozbe/watermelondb/react';
import { database } from './db';
import RootNavigator from './navigation/RootNavigator';

export default function App() {
  return (
    <DatabaseProvider database={database}>
      <SafeAreaProvider>
        <StatusBar barStyle="dark-content" />
        <NavigationContainer>
          <RootNavigator />
        </NavigationContainer>
      </SafeAreaProvider>
    </DatabaseProvider>
  );
}
