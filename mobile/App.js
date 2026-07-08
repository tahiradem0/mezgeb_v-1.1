import React, { useEffect } from 'react';
import { LogBox } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

LogBox.ignoreLogs(['Invalid DOM property `transform-origin`']);

// Silence Expo Web red box overlay for known harmless warnings
const originalConsoleError = console.error;
console.error = (...args) => {
  const msg = args.join(' ');
  if (msg.includes('transform-origin')) return;
  if (msg.includes('shadow*')) return;
  if (msg.includes('pointerEvents')) return;
  
  originalConsoleError(...args);
};
import { Provider as PaperProvider, DefaultTheme } from 'react-native-paper';
import NetInfo from '@react-native-community/netinfo';
import { syncOfflineData } from './src/api/client';
import AppNavigator from './src/navigation/AppNavigator';

import { theme } from './src/theme';

export default function App() {
  useEffect(() => {
    // Listen for network changes to trigger offline sync
    const unsubscribe = NetInfo.addEventListener(state => {
      if (state.isConnected) {
        syncOfflineData();
      }
    });
    return () => unsubscribe();
  }, []);

  return (
    <SafeAreaProvider>
      <PaperProvider theme={theme}>
        <AppNavigator />
      </PaperProvider>
    </SafeAreaProvider>
  );
}
