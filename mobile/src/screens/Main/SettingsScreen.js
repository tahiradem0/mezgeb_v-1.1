import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { Text } from 'react-native-paper';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { apiClient } from '../../api/client';

export default function SettingsScreen() {
  const navigation = useNavigation();
  const [user, setUser] = useState(null);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const u = await AsyncStorage.getItem('currentUser');
      if (u) {
        setUser(JSON.parse(u));
      }
    } catch (e) {}
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('currentUser');
    navigation.reset({
      index: 0,
      routes: [{ name: 'Login' }],
    });
  };

  const renderSettingItem = (iconName, label, rightText = null, IconComponent = Feather) => (
    <TouchableOpacity style={styles.settingsItem}>
      <View style={styles.settingsItemLeft}>
        <View style={styles.settingsIconBox}>
          <IconComponent name={iconName} size={20} color="#666666" />
        </View>
        <Text style={styles.settingsLabel}>{label}</Text>
      </View>
      <View style={styles.settingsItemRight}>
        {rightText && <Text style={styles.settingsRightText}>{rightText}</Text>}
        <Feather name="chevron-right" size={20} color="#cccccc" />
      </View>
    </TouchableOpacity>
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
                source={{ uri: `https://ui-avatars.com/api/?name=${user?.username || 'User'}&background=333&color=fff&size=100` }}
                style={styles.profileImage}
              />
              <TouchableOpacity style={styles.changePhotoBtn}>
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
          {renderSettingItem('globe', 'Language', 'English')}
          <View style={styles.divider} />
          {renderSettingItem('moon', 'Theme', 'System')}
          <View style={styles.divider} />
          {renderSettingItem('dollar-sign', 'Currency', 'ETB')}
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
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#2e2e2e',
  },
  sectionContainer: {
    paddingHorizontal: 20,
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2e2e2e',
    marginBottom: 12,
  },
  profileCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 2,
  },
  profileInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  profileImageContainer: {
    position: 'relative',
    marginRight: 20,
  },
  profileImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  changePhotoBtn: {
    position: 'absolute',
    bottom: -5,
    right: -5,
    backgroundColor: '#2e2e2e',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  profileTextInfo: {
    justifyContent: 'center',
  },
  profileUsername: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2e2e2e',
    marginBottom: 4,
  },
  profilePhone: {
    fontSize: 14,
    color: '#888888',
  },
  divider: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginVertical: 5,
  },
  cardBlock: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 2,
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  settingsItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingsIconBox: {
    width: 36,
    height: 36,
    backgroundColor: '#FAFAFA',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  settingsLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#2e2e2e',
  },
  settingsItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingsRightText: {
    fontSize: 14,
    color: '#888888',
    marginRight: 10,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 20,
    marginTop: 10,
    backgroundColor: '#ffebe9',
    paddingVertical: 16,
    borderRadius: 16,
  },
  button: {
    paddingVertical: 5,
    borderRadius: 8,
  }
});
