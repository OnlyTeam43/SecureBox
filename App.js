// App.js — Entry point

import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import { ThemeProvider } from './src/animal_ui/index.js';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { initCrashMonitoring } from './src/services/crashService';
import { useUserStore } from './src/store/useUserStore';

export default function App() {
  useEffect(() => {
    initCrashMonitoring();
    useUserStore.getState().incrementLaunchCount();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider mode="system">
          <ErrorBoundary>
            <AppNavigator />
          </ErrorBoundary>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
