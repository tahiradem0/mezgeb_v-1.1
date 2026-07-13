import React, { useEffect } from 'react';
import { LogBox } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

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
import BiometricWrapper from './src/components/BiometricWrapper';

import { ThemeProvider, ThemeContext } from './src/context/ThemeContext';
import { useContext } from 'react';

const AppRoot = () => {
  const { theme } = useContext(ThemeContext);
  return (
    <SafeAreaProvider>
      <PaperProvider theme={theme}>
        <BiometricWrapper>
          <AppNavigator />
        </BiometricWrapper>
      </PaperProvider>
    </SafeAreaProvider>
  );
};

  export default function App() {
  useEffect(() => {
    // Listen for network changes to trigger offline sync
    const unsubscribe = NetInfo.addEventListener(state => {
      if (state.isConnected) {
        syncOfflineData();
      }
    });

    async function configurePushNotifications() {
      try {
        const { status } = await Notifications.getPermissionsAsync();
        let finalStatus = status;

        if (finalStatus !== 'granted') {
          const { status: newStatus } = await Notifications.requestPermissionsAsync();
          finalStatus = newStatus;
        }
      } catch (error) {
        console.warn('Push notifications are not supported in Expo Go.');
      }
    }
    configurePushNotifications();

    return () => unsubscribe();
  }, []);

  return (
    <ThemeProvider>
      <AppRoot />
    </ThemeProvider>
  );
}
