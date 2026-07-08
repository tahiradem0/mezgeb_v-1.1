import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Image, Switch, Alert, Platform } from 'react-native';
import { Text } from 'react-native-paper';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { apiClient } from '../../api/client';

export default function SettingsScreen() {
  const navigation = useNavigation();
  const [user, setUser] = useState(null);
  const [settings, setSettings] = useState({
    darkMode: false,
    language: 'English',
    currency: 'ETB',
    budgetLimit: 10000,
    notificationsEnabled: true,
  });

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
        if (parsed.settings) setSettings(parsed.settings);
      }
      
      // 2. Fetch fresh profile
      const res = await apiClient.get('/auth/me');
      setUser(res.data);
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
      const { default: NetInfo } = await import('@react-native-community/netinfo');
      const netInfo = await NetInfo.fetch();
      
      if (netInfo.isConnected) {
        const res = await apiClient.patch('/auth/settings', { [key]: value });
        setUser(res.data);
        if (res.data.settings) setSettings(res.data.settings);
        await AsyncStorage.setItem('currentUser', JSON.stringify(res.data));
      } else {
        const { addToOfflineQueue } = await import('../../api/client');
        await addToOfflineQueue({
          method: 'PATCH',
          url: '/auth/settings',
          data: { [key]: value }
        });
      }
    } catch (error) {
      console.error('Error updating setting:', error);
      Alert.alert('Error', 'Failed to save setting');
      loadProfile(); // Revert on failure
    }
  };

  const pickImage = async () => {
    try {
      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        base64: true,
      });

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

  const handleLogout = async () => {
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('currentUser');
    navigation.reset({
      index: 0,
      routes: [{ name: 'Login' }],
    });
  };

  const renderSettingItem = (iconName, label, rightText = null, IconComponent = Feather, onPress = null) => (
    <TouchableOpacity style={styles.settingsItem} onPress={onPress} disabled={!onPress}>
      <View style={styles.settingsItemLeft}>
        <View style={styles.settingsIconBox}>
          <IconComponent name={iconName} size={20} color="#666666" />
        </View>
        <Text style={styles.settingsLabel}>{label}</Text>
      </View>
      <View style={styles.settingsItemRight}>
        {rightText && <Text style={styles.settingsRightText}>{rightText}</Text>}
        {onPress && <Feather name="chevron-right" size={20} color="#cccccc" />}
      </View>
    </TouchableOpacity>
  );

  const renderToggleItem = (iconName, label, value, onValueChange) => (
    <View style={styles.settingsItem}>
      <View style={styles.settingsItemLeft}>
        <View style={styles.settingsIconBox}>
          <Feather name={iconName} size={20} color="#666666" />
        </View>
        <Text style={styles.settingsLabel}>{label}</Text>
      </View>
      <View style={styles.settingsItemRight}>
        <Switch 
          value={value} 
          onValueChange={onValueChange} 
          trackColor={{ false: '#e0e0e0', true: '#4CAF50' }}
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
          
          <TouchableOpacity style={styles.settingsItem}>
            <View style={styles.settingsItemLeft}>
              <View style={styles.settingsIconBox}>
                <Feather name="lock" size={20} color="#666666" />
              </View>
              <Text style={styles.settingsLabel}>Change Password</Text>
            </View>
            <View style={styles.settingsItemRight}>
              <Feather name="chevron-right" size={20} color="#cccccc" />
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
          {renderSettingItem('dollar-sign', 'Currency', settings.currency, Feather, () => {
            const curs = ['ETB', 'USD', 'EUR'];
            const next = curs[(curs.indexOf(settings.currency) + 1) % curs.length];
            updateSetting('currency', next);
          })}
          <View style={styles.divider} />
          {renderSettingItem('target', 'Budget Limit', `${settings.currency} ${settings.budgetLimit}`, Feather, handleBudgetChange)}
          <View style={styles.divider} />
          {renderToggleItem('bell', 'Notifications', settings.notificationsEnabled, (v) => updateSetting('notificationsEnabled', v))}
        </View>
      </View>

      <View style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>Support</Text>
        <View style={styles.cardBlock}>
          {renderSettingItem('help-circle', 'Help & FAQ')}
          <View style={styles.divider} />
          {renderSettingItem('message-circle', 'Contact Us')}
        </View>
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Feather name="log-out" size={20} color="#ff3b30" style={{ marginRight: 10 }} />
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  header: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 20 },
  headerTitle: { fontSize: 28, fontWeight: '700', color: '#2e2e2e' },
  sectionContainer: { paddingHorizontal: 20, marginBottom: 25 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#2e2e2e', marginBottom: 12 },
  profileCard: { backgroundColor: '#ffffff', borderRadius: 20, padding: 20, shadowColor: '#000', shadowOpacity: 0.03, shadowOffset: { width: 0, height: 4 }, shadowRadius: 10, elevation: 2 },
  profileInfoContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  profileImageContainer: { position: 'relative', marginRight: 20 },
  profileImage: { width: 60, height: 60, borderRadius: 30 },
  changePhotoBtn: { position: 'absolute', bottom: -5, right: -5, backgroundColor: '#2e2e2e', width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#ffffff' },
  profileTextInfo: { justifyContent: 'center' },
  profileUsername: { fontSize: 18, fontWeight: '700', color: '#2e2e2e', marginBottom: 4 },
  profilePhone: { fontSize: 14, color: '#888888' },
  divider: { height: 1, backgroundColor: '#f0f0f0', marginVertical: 5 },
  cardBlock: { backgroundColor: '#ffffff', borderRadius: 20, paddingVertical: 10, paddingHorizontal: 20, shadowColor: '#000', shadowOpacity: 0.03, shadowOffset: { width: 0, height: 4 }, shadowRadius: 10, elevation: 2 },
  settingsItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
  settingsItemLeft: { flexDirection: 'row', alignItems: 'center' },
  settingsIconBox: { width: 36, height: 36, backgroundColor: '#FAFAFA', borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  settingsLabel: { fontSize: 16, fontWeight: '500', color: '#2e2e2e' },
  settingsItemRight: { flexDirection: 'row', alignItems: 'center' },
  settingsRightText: { fontSize: 14, color: '#888888', marginRight: 10 },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginHorizontal: 20, marginTop: 10, backgroundColor: '#ffebe9', paddingVertical: 16, borderRadius: 16 },
  logoutText: { fontSize: 16, fontWeight: '600', color: '#ff3b30' }
});
