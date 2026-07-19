import React, { useState, useEffect, useContext, useMemo } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Image, Switch, Alert, Platform, Linking, DeviceEventEmitter } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as LocalAuthentication from 'expo-local-authentication';
import { apiClient, addToOfflineQueue } from '../../api/client';
import { setIntentionalBackground } from '../../components/BiometricWrapper';
import NetInfo from '@react-native-community/netinfo';
import { ThemeContext } from '../../context/ThemeContext';
import ManageConnectionModal from '../../components/ManageConnectionModal';
import ChangePasswordModal from '../../components/ChangePasswordModal';

export default function SettingsScreen() {
  const { theme, toggleDarkMode } = useContext(ThemeContext);
  const styles = useMemo(() => createStyles(theme), [theme]);
  const navigation = useNavigation();
  const [user, setUser] = useState(null);
  const [localBiometric, setLocalBiometric] = useState(false);
  const [settings, setSettings] = useState({
    language: 'English',
    darkMode: false,
    currency: 'ETB',
    budgetLimit: '5000',
    notificationsEnabled: true
  });
  const [isConnectionModalVisible, setConnectionModalVisible] = useState(false);
  const [isPasswordModalVisible, setPasswordModalVisible] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      // 1. Instant cache load
      const u = await AsyncStorage.getItem('currentUser');
      if (u) {
        const parsed = JSON.parse(u);
        setUser(parsed);
        setLocalBiometric(parsed.biometricEnabled || false);
        if (parsed.settings) setSettings(parsed.settings);
      }
      
      // 2. Fetch fresh profile
      const res = await apiClient.get('/auth/me');
      setUser(res.data);
      setLocalBiometric(res.data.biometricEnabled || false);
      if (res.data.settings) setSettings(res.data.settings);
      await AsyncStorage.setItem('currentUser', JSON.stringify(res.data));
    } catch (e) {
      console.log('Error fetching profile:', e);
    }
  };

  const updateSetting = async (key, value) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings); // Optimistic UI update
    
    // Also optimistically update currentUser in storage so offline restarts keep the setting
    const updatedUser = { ...user, settings: newSettings };
    setUser(updatedUser);
    await AsyncStorage.setItem('currentUser', JSON.stringify(updatedUser));

    try {
      const netInfo = await NetInfo.fetch();
      
      const payload = { [key]: value };
      if (key === 'biometricEnabled') {
        // Optimistically update top level user
        const updatedUserWithBio = { ...user, biometricEnabled: value };
        setUser(updatedUserWithBio);
        await AsyncStorage.setItem('currentUser', JSON.stringify(updatedUserWithBio));
      }

      if (netInfo.isConnected) {
        const res = await apiClient.patch('/auth/settings', payload);
        setUser(res.data);
        if (res.data.settings) setSettings(res.data.settings);
        await AsyncStorage.setItem('currentUser', JSON.stringify(res.data));
      } else {
        await addToOfflineQueue({
          method: 'PATCH',
          url: '/auth/settings',
          data: { [key]: value }
        });
      }
      if (key === 'darkMode') toggleDarkMode(value);
    } catch (error) {
      console.error('Error updating setting:', error);
      Alert.alert('Error', 'Failed to save setting');
      loadProfile(); // Revert on failure
    }
  };

  const pickImage = async () => {
    try {
      setIntentionalBackground(true);
      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
      });
      setIntentionalBackground(false);

      if (!result.canceled) {
        const asset = result.assets[0];
        let base64Image = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
        
        // Optimistic UI update
        setUser({ ...user, profileImage: base64Image });
        
        // Send to backend
        const res = await apiClient.patch('/auth/settings', { profileImage: base64Image });
        setUser(res.data);
        await AsyncStorage.setItem('currentUser', JSON.stringify(res.data));
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to upload profile picture');
    }
  };

  const handleBudgetChange = () => {
    if (Platform.OS === 'web') {
      const val = window.prompt("Enter new budget limit:", settings.budgetLimit);
      if (val && !isNaN(val)) updateSetting('budgetLimit', Number(val));
    } else {
      Alert.prompt(
        "Budget Limit",
        "Enter your new monthly budget limit",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Save", onPress: (val) => {
            if (val && !isNaN(val)) updateSetting('budgetLimit', Number(val));
          }}
        ],
        "plain-text",
        settings.budgetLimit.toString(),
        "numeric"
      );
    }
  };

  const handleBiometricToggle = async (value) => {
    // Optimistic UI update to prevent switch from bouncing
    setLocalBiometric(value);

    if (value) {
      try {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Authenticate to enable App Lock',
        });
        
        if (!result.success) {
          // Revert toggle if authentication fails or is cancelled
          setLocalBiometric(false);
          
          if (result.error === 'not_enrolled' || result.error === 'passcode_not_set') {
            Alert.alert("Unavailable", "Your device does not have a screen lock (PIN, Pattern, or Fingerprint) configured. Please set one up in your device settings first.");
          } else if (result.error !== 'user_cancel' && result.error !== 'system_cancel' && result.error !== 'app_cancel') {
            // Alert other unexpected errors so we don't silently fail
            Alert.alert("Failed", `Authentication failed: ${result.error || 'Unknown'}`);
          }
          return;
        }
      } catch (e) {
        setLocalBiometric(false);
        console.error('Biometric toggle error', e);
        Alert.alert("Error", "Authentication is not available on this device.");
        return;
      }
    }
    
    updateSetting('biometricEnabled', value);
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('currentUser');
    DeviceEventEmitter.emit('logout');
  };

  const renderSettingItem = (iconName, label, rightText = null, IconComponent = Feather, onPress = null) => (
    <TouchableOpacity style={styles.settingsItem} onPress={onPress} disabled={!onPress}>
      <View style={styles.settingsItemLeft}>
        <View style={styles.settingsIconBox}>
          <IconComponent name={iconName} size={20} color={theme.colors.textSecondary} />
        </View>
        <Text style={styles.settingsLabel}>{label}</Text>
      </View>
      <View style={styles.settingsItemRight}>
        {rightText && <Text style={styles.settingsRightText}>{rightText}</Text>}
        {onPress && <Feather name="chevron-right" size={20} color={theme.colors.textMuted} />}
      </View>
    </TouchableOpacity>
  );

  const renderToggleItem = (iconName, label, value, onValueChange) => (
    <View style={styles.settingsItem}>
      <View style={styles.settingsItemLeft}>
        <View style={styles.settingsIconBox}>
          <Feather name={iconName} size={20} color={theme.colors.textSecondary} />
        </View>
        <Text style={styles.settingsLabel}>{label}</Text>
      </View>
      <View style={styles.settingsItemRight}>
        <Switch 
          value={value} 
          onValueChange={onValueChange} 
          trackColor={{ false: theme.colors.border, true: theme.colors.success }}
          thumbColor={Platform.OS === 'ios' ? '#ffffff' : (value ? '#ffffff' : '#f4f3f4')}
        />
      </View>
    </View>
  );

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <View style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>Profile</Text>
        
        <View style={styles.profileCard}>
          <View style={styles.profileInfoContainer}>
            <View style={styles.profileImageContainer}>
              <Image 
                source={{ uri: user?.profileImage || `https://ui-avatars.com/api/?name=${user?.username || 'User'}&background=333&color=fff&size=100` }}
                style={styles.profileImage}
              />
              <TouchableOpacity style={styles.changePhotoBtn} onPress={pickImage}>
                <Feather name="camera" size={14} color="#ffffff" />
              </TouchableOpacity>
            </View>
            <View style={styles.profileTextInfo}>
              <Text style={styles.profileUsername}>{user ? user.username : 'Loading...'}</Text>
              <Text style={styles.profilePhone}>{user ? user.phone : '+251-000-000-000'}</Text>
            </View>
          </View>
          
          <View style={styles.divider} />
          
          <TouchableOpacity style={styles.settingsItem} onPress={() => setPasswordModalVisible(true)}>
            <View style={styles.settingsItemLeft}>
              <View style={styles.settingsIconBox}>
                <Feather name="lock" size={20} color={theme.colors.textSecondary} />
              </View>
              <Text style={styles.settingsLabel}>Change Password</Text>
            </View>
            <View style={styles.settingsItemRight}>
              <Feather name="chevron-right" size={20} color={theme.colors.textMuted} />
            </View>
          </TouchableOpacity>
          
          <View style={styles.divider} />

          <TouchableOpacity style={styles.settingsItem} onPress={() => setConnectionModalVisible(true)}>
            <View style={styles.settingsItemLeft}>
              <View style={styles.settingsIconBox}>
                <Feather name="users" size={20} color={theme.colors.textSecondary} />
              </View>
              <Text style={styles.settingsLabel}>Manage Connections</Text>
            </View>
            <View style={styles.settingsItemRight}>
              <Feather name="chevron-right" size={20} color={theme.colors.textMuted} />
            </View>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>Preferences</Text>
        <View style={styles.cardBlock}>
          {renderSettingItem('globe', 'Language', settings.language, Feather, () => {
            const langs = ['English', 'Amharic', 'Oromo'];
            const next = langs[(langs.indexOf(settings.language) + 1) % langs.length];
            updateSetting('language', next);
          })}
          <View style={styles.divider} />
          {renderToggleItem('moon', 'Dark Mode', settings.darkMode, (v) => updateSetting('darkMode', v))}
          <View style={styles.divider} />

          {renderSettingItem('target', 'Budget Limit', `${settings.currency} ${settings.budgetLimit}`, Feather, handleBudgetChange)}
          <View style={styles.divider} />
          {renderToggleItem('bell', 'Budget Alerts', settings.budgetAlertEnabled, (v) => updateSetting('budgetAlertEnabled', v))}
          <View style={styles.divider} />
          {renderToggleItem('shield', 'Biometric Lock', localBiometric, handleBiometricToggle)}
        </View>
      </View>

      <View style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>Support</Text>
        <View style={styles.cardBlock}>

          {renderSettingItem('message-circle', 'Contact Us', null, Feather, () => {
            Linking.openURL('tel:+251978787960').catch((err) => Alert.alert("Error", "Could not open dialer"));
          })}
        </View>
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Feather name="log-out" size={20} color={theme.colors.error} style={{ marginRight: 10 }} />
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>

      <View style={{ height: 100 }} />

      <ManageConnectionModal 
        visible={isConnectionModalVisible} 
        onClose={() => setConnectionModalVisible(false)}
        onSuccess={() => {
          Alert.alert("Check Dashboard", "Your new group space should now be available!");
        }}
      />

      <ChangePasswordModal 
        visible={isPasswordModalVisible}
        onClose={() => setPasswordModalVisible(false)}
      />
    </ScrollView>
  );
}

const createStyles = (theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 20 },
  headerTitle: { fontSize: 28, fontWeight: '700', color: theme.colors.textPrimary },
  sectionContainer: { paddingHorizontal: 20, marginBottom: 25 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: theme.colors.textPrimary, marginBottom: 12 },
  profileCard: { backgroundColor: theme.colors.surface, borderRadius: 20, padding: 20, shadowColor: '#000', shadowOpacity: 0.03, shadowOffset: { width: 0, height: 4 }, shadowRadius: 10, elevation: 2 },
  profileInfoContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  profileImageContainer: { position: 'relative', marginRight: 20 },
  profileImage: { width: 60, height: 60, borderRadius: 30 },
  changePhotoBtn: { position: 'absolute', bottom: -5, right: -5, backgroundColor: theme.colors.primary, width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: theme.colors.surface },
  profileTextInfo: { justifyContent: 'center' },
  profileUsername: { fontSize: 18, fontWeight: '700', color: theme.colors.textPrimary, marginBottom: 4 },
  profilePhone: { fontSize: 14, color: theme.colors.textSecondary },
  divider: { height: 1, backgroundColor: theme.colors.border, marginVertical: 5 },
  cardBlock: { backgroundColor: theme.colors.surface, borderRadius: 20, paddingVertical: 10, paddingHorizontal: 20, shadowColor: '#000', shadowOpacity: 0.03, shadowOffset: { width: 0, height: 4 }, shadowRadius: 10, elevation: 2 },
  settingsItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
  settingsItemLeft: { flexDirection: 'row', alignItems: 'center' },
  settingsIconBox: { width: 36, height: 36, backgroundColor: theme.colors.surfaceElevated, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  settingsLabel: { fontSize: 16, fontWeight: '500', color: theme.colors.textPrimary },
  settingsItemRight: { flexDirection: 'row', alignItems: 'center' },
  settingsRightText: { fontSize: 14, color: theme.colors.textSecondary, marginRight: 10 },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginHorizontal: 20, marginTop: 10, backgroundColor: theme.colors.surfaceElevated, paddingVertical: 16, borderRadius: 16 },
  logoutText: { fontSize: 16, fontWeight: '600', color: theme.colors.error }
});
