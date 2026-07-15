import 'react-native-gesture-handler';
import React, { useEffect, useContext, Component } from 'react';
import { View, Text as RNText, LogBox, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider as PaperProvider } from 'react-native-paper';
import NetInfo from '@react-native-community/netinfo';
import { syncOfflineData } from './src/api/client';
import AppNavigator from './src/navigation/AppNavigator';
import BiometricWrapper from './src/components/BiometricWrapper';
import { ThemeProvider, ThemeContext } from './src/context/ThemeContext';

// ── Safely configure notifications ──────────────────────────────
// Wrapped in try-catch so the app doesn't crash if the native module
// is missing or not properly initialized.
let Notifications = null;
try {
  Notifications = require('expo-notifications');
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
} catch (e) {
  console.warn('expo-notifications not available:', e.message);
}

// ── Suppress known harmless warnings ────────────────────────────
LogBox.ignoreLogs([
  'Invalid DOM property `transform-origin`',
  'expo-notifications',
]);

// ── Error Boundary ──────────────────────────────────────────────
// Catches any React render crash and shows a fallback instead of
// the Android "this app has a bug" popup.
class ErrorBoundary extends Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('App Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={ebStyles.container}>
          <RNText style={ebStyles.emoji}>⚠️</RNText>
          <RNText style={ebStyles.title}>Something went wrong</RNText>
          <RNText style={ebStyles.message}>
            {this.state.error?.message || 'An unexpected error occurred'}
          </RNText>
          <TouchableOpacity
            style={ebStyles.button}
            onPress={() => this.setState({ hasError: false, error: null })}
          >
            <RNText style={ebStyles.buttonText}>Try Again</RNText>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const ebStyles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30, backgroundColor: '#f8f9fa' },
  emoji: { fontSize: 48, marginBottom: 16 },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 12, color: '#333' },
  message: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 24 },
  button: { backgroundColor: '#208AEF', paddingHorizontal: 30, paddingVertical: 12, borderRadius: 24 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});

// ── App Root (inside ThemeProvider) ──────────────────────────────
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

// ── Main App Component ──────────────────────────────────────────
export default function App() {
  useEffect(() => {
    // Listen for network changes to trigger offline sync
    let unsubscribe;
    try {
      unsubscribe = NetInfo.addEventListener(state => {
        if (state.isConnected) {
          syncOfflineData();
        }
      });
    } catch (e) {
      console.warn('NetInfo error:', e.message);
    }

    // Configure push notifications safely
    async function configurePushNotifications() {
      if (!Notifications) return;
      try {
        const { status } = await Notifications.getPermissionsAsync();
        let finalStatus = status;
        if (finalStatus !== 'granted') {
          const { status: newStatus } = await Notifications.requestPermissionsAsync();
          finalStatus = newStatus;
        }
      } catch (error) {
        console.warn('Push notification setup failed:', error.message);
      }
    }
    configurePushNotifications();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AppRoot />
      </ThemeProvider>
    </ErrorBoundary>
  );
}
