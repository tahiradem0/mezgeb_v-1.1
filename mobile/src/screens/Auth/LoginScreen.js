import { useTheme } from 'react-native-paper';
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert, TouchableOpacity, Text, Dimensions, KeyboardAvoidingView, Platform, ScrollView, Modal, TextInput, DeviceEventEmitter } from 'react-native';
import { apiClient, API_BASE_URL } from '../../api/client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather } from '@expo/vector-icons';
import CustomAlert from '../../utils/CustomAlert';

const screenHeight = Dimensions.get('window').height;

export default function LoginScreen({ navigation, route }) {
  const theme = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [serverUrl, setServerUrl] = useState(API_BASE_URL);
  const [inputServerUrl, setInputServerUrl] = useState(API_BASE_URL);
  const [isServerModalVisible, setServerModalVisible] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const savedPhone = await AsyncStorage.getItem('savedPhoneNumber');
        if (savedPhone) setPhone(savedPhone);
        const savedUrl = await AsyncStorage.getItem('custom_api_url');
        if (savedUrl) {
          setServerUrl(savedUrl);
          setInputServerUrl(savedUrl);
        } else {
          setServerUrl(API_BASE_URL);
          setInputServerUrl(API_BASE_URL);
        }
      } catch (e) {}
    };
    loadSettings();
  }, []);

  const handleSaveServerUrl = async (url) => {
    try {
      if (!url || url.trim() === '') {
        await AsyncStorage.removeItem('custom_api_url');
        setServerUrl(API_BASE_URL);
        setInputServerUrl(API_BASE_URL);
        CustomAlert.alert('Reset', 'Server URL reset to auto-detected IP: ' + API_BASE_URL);
      } else {
        const clean = url.trim().replace(/\/+$/, '');
        await AsyncStorage.setItem('custom_api_url', clean);
        setServerUrl(clean);
        setInputServerUrl(clean);
        CustomAlert.alert('Saved', 'Server URL set to:\n' + clean);
      }
      setServerModalVisible(false);
    } catch (e) {
      CustomAlert.alert('Error', 'Could not save server URL');
    }
  };

  const handleLogin = async () => {
    if (!phone || !password) {
      CustomAlert.alert('Error', 'Please fill in all fields.');
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.post('/auth/login', { phone, password });
      const token = response.data.token;
      const user = response.data.user || response.data;
      
      if (token) {
        await AsyncStorage.setItem('token', token);
      }
      if (user) {
        if (!user.username && user.name) user.username = user.name;
        await AsyncStorage.setItem('currentUser', JSON.stringify(user));
      }
      await AsyncStorage.setItem('savedPhoneNumber', phone);
      
      DeviceEventEmitter.emit('login', token);
      if (route?.params?.setUserToken) {
        route.params.setUserToken(token);
      }
    } catch (error) {
      console.warn('Login error details:', error);
      if (error.response) {
        CustomAlert.alert('Login Failed', error.response?.data?.message || error.response?.data?.error || 'Invalid credentials. Try again.');
      } else {
        CustomAlert.alert(
          'Cannot Connect to Server',
          'Could not reach backend at:\n' + (serverUrl || API_BASE_URL) + '\n\nTap the server pill at the top right to verify your server IP.'
        );
      }
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
        
        {/* Server Connection Bar */}
        <View style={styles.topServerBar}>
          <TouchableOpacity 
            style={styles.serverPill}
            onPress={() => setServerModalVisible(true)}
          >
            <Feather name="server" size={13} color="#10b981" />
            <Text style={styles.serverPillText} numberOfLines={1}>
              {serverUrl ? serverUrl.replace(/^https?:\/\//, '') : 'Config Server'}
            </Text>
            <Feather name="edit-2" size={12} color="#888" />
          </TouchableOpacity>
        </View>

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
              <TouchableOpacity 
                style={styles.eyeIcon} 
                onPress={() => setShowPassword(!showPassword)}
              >
                <Feather 
                  name={showPassword ? "eye" : "eye-off"} 
                  size={20} 
                  color="#888888" 
                />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity 
            style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            <Text style={styles.loginBtnText}>
              {loading ? 'Signing In...' : 'Sign In'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.authFooter}>
          <Text style={styles.footerText}>Don't have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Register')}>
            <Text style={styles.footerLink}>Sign Up</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>

      {/* Backend Server Config Modal */}
      <Modal visible={isServerModalVisible} animationType="slide" transparent onRequestClose={() => setServerModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Backend Server Connection</Text>
              <TouchableOpacity onPress={() => setServerModalVisible(false)}>
                <Feather name="x" size={22} color={theme.colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalDesc}>
              Set the Express & MongoDB server URL for this device:
            </Text>

            <TextInput
              style={styles.serverInput}
              value={inputServerUrl}
              onChangeText={setInputServerUrl}
              placeholder="http://10.36.157.230:5000/api"
              placeholderTextColor="#9ca3af"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={styles.presetLabel}>Quick Presets:</Text>
            <View style={styles.presetRow}>
              <TouchableOpacity
                style={styles.presetChip}
                onPress={() => setInputServerUrl('http://10.36.157.230:5000/api')}
              >
                <Text style={styles.presetText}>PC Wi-Fi (10.36.157.230)</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.presetChip}
                onPress={() => setInputServerUrl('http://10.0.2.2:5000/api')}
              >
                <Text style={styles.presetText}>Emulator (10.0.2.2)</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: theme.colors.surfaceElevated || '#eee' }]}
                onPress={() => handleSaveServerUrl('')}
              >
                <Text style={[styles.modalBtnText, { color: theme.colors.textSecondary }]}>Auto Detect</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: theme.colors.primary }]}
                onPress={() => handleSaveServerUrl(inputServerUrl)}
              >
                <Text style={[styles.modalBtnText, { color: '#fff' }]}>Save & Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </KeyboardAvoidingView>
  );
}

const createStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 50,
    paddingBottom: 40,
    justifyContent: 'space-between',
  },
  topServerBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 10,
  },
  serverPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceElevated || '#f3f4f6',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 6,
    maxWidth: 240,
  },
  serverPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    flexShrink: 1,
  },
  authHeader: {
    alignItems: 'center',
    marginBottom: 30,
  },
  authLogo: {
    marginBottom: 20,
  },
  logoCircleOut: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: theme.colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  logoCircleIn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.textPrimary,
  },
  authTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 8,
  },
  authSubtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  formContainer: {
    width: '100%',
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 18,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 14,
    height: 52,
    paddingHorizontal: 14,
  },
  inputIcon: {
    marginRight: 10,
  },
  inputElement: {
    flex: 1,
    height: '100%',
    fontSize: 15,
    color: theme.colors.textPrimary,
  },
  eyeIcon: {
    padding: 10,
  },
  loginBtn: {
    backgroundColor: theme.colors.textPrimary,
    borderRadius: 14,
    height: 52,
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
    marginTop: 20,
  },
  footerText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  footerLink: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  modalDesc: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginBottom: 14,
    lineHeight: 18,
  },
  serverInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: theme.colors.textPrimary,
    backgroundColor: theme.colors.surfaceElevated || '#f9fafb',
    marginBottom: 14,
  },
  presetLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    marginBottom: 6,
  },
  presetRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  presetChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: theme.colors.surfaceElevated || '#f3f4f6',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  presetText: {
    fontSize: 12,
    color: theme.colors.textPrimary,
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
