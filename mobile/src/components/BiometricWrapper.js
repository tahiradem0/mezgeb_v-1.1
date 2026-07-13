import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, AppState } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { Feather } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';

export let isIntentionalBackground = false;
export const setIntentionalBackground = (val) => { isIntentionalBackground = val; };

export default function BiometricWrapper({ children }) {
  const theme = useTheme();
  const [isLocked, setIsLocked] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    checkBiometricSetting();

    const subscription = AppState.addEventListener('change', nextAppState => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // App has come to the foreground!
        if (isIntentionalBackground) {
          // Bypassing biometric check because user intentionally opened a system UI (like Image Picker)
          // We don't reset it here immediately because it might still be resolving the image picker promise
        } else {
          checkBiometricSetting();
        }
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const checkBiometricSetting = async () => {
    try {
      const u = await AsyncStorage.getItem('currentUser');
      if (u) {
        const user = JSON.parse(u);
        if (user.biometricEnabled) {
          setBiometricEnabled(true);
          setIsLocked(true);
          authenticate();
        } else {
          setBiometricEnabled(false);
          setIsLocked(false);
        }
      }
    } catch (e) {}
  };

  const authenticate = async () => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (!hasHardware || !isEnrolled) {
        // Fallback to password or just let them in if hardware isn't supported
        setIsLocked(false);
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock Haiil',
        fallbackLabel: 'Use Passcode',
      });

      if (result.success) {
        setIsLocked(false);
      }
    } catch (e) {
      console.log('Biometric error', e);
    }
  };

  if (isLocked) {
    return (
      <View style={[styles.lockedContainer, { backgroundColor: theme.colors.background }]}>
        <Feather name="lock" size={64} color={theme.colors.primary} style={{ marginBottom: 20 }} />
        <Text style={[styles.lockedText, { color: theme.colors.textPrimary }]}>App Locked</Text>
        <Text style={[styles.subText, { color: theme.colors.textSecondary }]}>Authenticate to continue</Text>
        
        <TouchableOpacity style={[styles.unlockBtn, { backgroundColor: theme.colors.primary }]} onPress={authenticate}>
          <Text style={styles.unlockBtnText}>Unlock</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return children;
}

const styles = StyleSheet.create({
  lockedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lockedText: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subText: {
    fontSize: 16,
    marginBottom: 40,
  },
  unlockBtn: {
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 24,
  },
  unlockBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
