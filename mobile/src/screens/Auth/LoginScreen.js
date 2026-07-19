import { useTheme } from 'react-native-paper';
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert, TouchableOpacity, Text, Dimensions, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { apiClient } from '../../api/client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather } from '@expo/vector-icons';
import { TextInput } from 'react-native';
import CustomAlert from '../../utils/CustomAlert';


const screenHeight = Dimensions.get('window').height;

export default function LoginScreen({ navigation, route }) {
  const theme = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadSavedPhone = async () => {
      try {
        const savedPhone = await AsyncStorage.getItem('savedPhoneNumber');
        if (savedPhone) setPhone(savedPhone);
      } catch (e) {}
    };
    loadSavedPhone();
  }, []);

  const handleLogin = async () => {
    if (!phone || !password) {
      CustomAlert.alert('Error', 'Please fill in all fields.');
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.post('/auth/login', { phone, password });
      const { token, user } = response.data;
      await AsyncStorage.setItem('token', token);
      await AsyncStorage.setItem('currentUser', JSON.stringify(user));
      await AsyncStorage.setItem('savedPhoneNumber', phone); // Save phone for next time
      
      // Update app state
      if (route?.params?.setUserToken) {
        route.params.setUserToken(token);
      }
    } catch (error) {
      CustomAlert.alert('Login Failed', error.response?.data?.error || 'Invalid credentials. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        <View style={styles.authHeader}>
          <View style={styles.authLogo}>
            <View style={styles.logoCircleOut}>
              <View style={styles.logoCircleIn} />
            </View>
          </View>
          <Text style={styles.authTitle}>Welcome Back</Text>
          <Text style={styles.authSubtitle}>Sign in to continue tracking your expenses</Text>
        </View>

        <View style={styles.formContainer}>
          {Platform.OS === 'web' && (
            <View style={{ width: 0, height: 0, overflow: 'hidden', opacity: 0 }}>
              <TextInput value="" onChangeText={() => {}} />
              <TextInput secureTextEntry={true} value="" onChangeText={() => {}} />
            </View>
          )}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Phone Number</Text>
            <View style={styles.inputWrapper}>
              <Feather name="phone" size={20} color="#888888" style={styles.inputIcon} />
              <TextInput
                style={styles.inputElement}
                placeholder="+251 912 345 678"
                placeholderTextColor="#cccccc"
                keyboardType="phone-pad"
                autoCapitalize="none"
                value={phone}
                onChangeText={setPhone}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Password</Text>
            <View style={styles.inputWrapper}>
              <Feather name="lock" size={20} color="#888888" style={styles.inputIcon} />
              <TextInput
                style={styles.inputElement}
                placeholder="Enter your password"
                placeholderTextColor="#cccccc"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
                autoComplete="new-password"
                textContentType="newPassword"
                importantForAutofill="no"
                autoCorrect={false}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                <Feather name={showPassword ? "eye" : "eye-off"} size={20} color="#888888" />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity style={[styles.loginBtn, loading && styles.loginBtnDisabled]} onPress={handleLogin} disabled={loading}>
            <Text style={styles.loginBtnText}>{loading ? "Signing in..." : "Sign In"}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.authFooter}>
          <Text style={styles.footerText}>Don't have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Register')}>
            <Text style={styles.footerLink}>Create Account</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.surface,
  },
  scrollContent: {
    minHeight: screenHeight,
    paddingHorizontal: 25,
    paddingTop: 80,
    paddingBottom: 40,
  },
  authHeader: {
    alignItems: 'center',
    marginBottom: 40,
  },
  authLogo: {
    marginBottom: 20,
  },
  logoCircleOut: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.colors.textPrimary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoCircleIn: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: theme.colors.surface,
  },
  authTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 8,
  },
  authSubtitle: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  formContainer: {
    marginBottom: 30,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 16,
    paddingHorizontal: 15,
    height: 56,
  },
  inputIcon: {
    marginRight: 10,
  },
  inputElement: {
    flex: 1,
    height: '100%',
    fontSize: 16,
    color: theme.colors.textPrimary,
  },
  eyeIcon: {
    padding: 10,
  },
  loginBtn: {
    backgroundColor: theme.colors.textPrimary,
    borderRadius: 16,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  loginBtnDisabled: {
    opacity: 0.7,
  },
  loginBtnText: {
    color: theme.colors.surface,
    fontSize: 16,
    fontWeight: '600',
  },
  authFooter: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 'auto',
    marginBottom: 20,
  },
  footerText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  footerLink: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  }
});
