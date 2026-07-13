import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Modal, TouchableOpacity, ScrollView, TextInput, Alert, ActivityIndicator } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import NetInfo from '@react-native-community/netinfo';
import { createGroup, joinGroup, apiClient } from '../api/client';

export default function ManageConnectionModal({ visible, onClose, onSuccess }) {
  const theme = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  
  const [activeTab, setActiveTab] = useState('create'); // 'create' or 'join'
  
  // Create state
  const [myConnectionId, setMyConnectionId] = useState('');
  const [groupName, setGroupName] = useState('');
  
  // Join state
  const [partnerPhone, setPartnerPhone] = useState('');
  const [joinConnectionId, setJoinConnectionId] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [myGroups, setMyGroups] = useState([]);
  const [loadingGroups, setLoadingGroups] = useState(false);

  useEffect(() => {
    if (visible) {
      loadMyConnectionId();
    }
    if (visible && activeTab === 'mine') {
      fetchMyGroups();
    }
  }, [visible, activeTab]);

  const fetchMyGroups = async () => {
    try {
      setLoadingGroups(true);
      const response = await apiClient.get('/groups');
      setMyGroups(response.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingGroups(false);
    }
  };

  const loadMyConnectionId = async () => {
    try {
      let connId = await AsyncStorage.getItem('myConnectionId');
      if (!connId) {
        connId = 'CONN-' + Math.floor(1000 + Math.random() * 9000);
        await AsyncStorage.setItem('myConnectionId', connId);
      }
      setMyConnectionId(connId);
    } catch (e) {
      console.error(e);
    }
  };

  const handleGenerateNewId = async () => {
    try {
      const newId = 'CONN-' + Math.floor(1000 + Math.random() * 9000);
      await AsyncStorage.setItem('myConnectionId', newId);
      setMyConnectionId(newId);
      Alert.alert('Success', 'New ID generated!');
    } catch (e) {}
  };

  const copyToClipboard = async () => {
    await Clipboard.setStringAsync(myConnectionId);
    Alert.alert('Success', 'Copied to clipboard!');
  };

  const handleCreate = async () => {
    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected) {
      Alert.alert('Offline', 'Please connect to the internet to create a new group.');
      return;
    }
    if (!groupName.trim()) {
      Alert.alert('Error', 'Please enter a group name');
      return;
    }
    try {
      setLoading(true);
      await createGroup(groupName.trim(), myConnectionId);
      Alert.alert('Success', 'Group created! Share the ID with your partner.');
      setGroupName('');
      onSuccess(); // Triggers reload
      onClose();
    } catch (e) {
      Alert.alert('Error', e.response?.data?.error || e.message || 'Failed to create connection');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected) {
      Alert.alert('Offline', 'Please connect to the internet to join a group.');
      return;
    }
    if (!partnerPhone.trim() || !joinConnectionId.trim()) {
      Alert.alert('Error', 'Please enter partner phone number and connection ID');
      return;
    }
    try {
      setLoading(true);
      await joinGroup(partnerPhone.trim(), joinConnectionId.trim());
      Alert.alert('Success', 'Successfully connected to group!');
      setPartnerPhone('');
      setJoinConnectionId('');
      onSuccess(); // Triggers reload
      onClose();
    } catch (e) {
      Alert.alert('Error', e.response?.data?.error || e.message || 'Failed to join connection');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent={true} animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Manage Connections</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Feather name="x" size={24} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Tabs */}
          <View style={styles.tabsContainer}>
            <TouchableOpacity 
              style={[styles.tab, activeTab === 'create' && styles.activeTab]}
              onPress={() => setActiveTab('create')}
            >
              <Text style={[styles.tabText, activeTab === 'create' && styles.activeTabText]}>Create</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.tab, activeTab === 'join' && styles.activeTab]}
              onPress={() => setActiveTab('join')}
            >
              <Text style={[styles.tabText, activeTab === 'join' && styles.activeTabText]}>Join</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.tab, activeTab === 'mine' && styles.activeTab]}
              onPress={() => setActiveTab('mine')}
            >
              <Text style={[styles.tabText, activeTab === 'mine' && styles.activeTabText]}>My Groups</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {activeTab === 'create' ? (
              <View style={styles.formContainer}>
                <Text style={styles.helperText}>Create a shared space. Share this ID with your partner.</Text>
                
                <Text style={styles.label}>Group Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Home, Business"
                  placeholderTextColor={theme.colors.textMuted}
                  value={groupName}
                  onChangeText={setGroupName}
                />

                <Text style={styles.label}>Your Connection ID</Text>
                <View style={styles.idRow}>
                  <TextInput
                    style={[styles.input, { flex: 1, marginBottom: 0, backgroundColor: theme.colors.surfaceElevated }]}
                    value={myConnectionId}
                    editable={false}
                  />
                  <TouchableOpacity style={styles.regenerateBtn} onPress={handleGenerateNewId}>
                    <Feather name="refresh-cw" size={20} color={theme.colors.textPrimary} />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity style={styles.copyBtn} onPress={copyToClipboard}>
                  <Feather name="copy" size={18} color={theme.colors.primary} style={{ marginRight: 8 }} />
                  <Text style={styles.copyBtnText}>Copy Connection ID</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.submitBtn} onPress={handleCreate} disabled={loading}>
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Create Connection</Text>}
                </TouchableOpacity>
              </View>
            ) : activeTab === 'join' ? (
              <View style={styles.formContainer}>
                <Text style={styles.helperText}>Enter the details shared by your partner.</Text>

                <Text style={styles.label}>Partner Phone Number</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. +251..."
                  placeholderTextColor={theme.colors.textMuted}
                  value={partnerPhone}
                  onChangeText={setPartnerPhone}
                  keyboardType="phone-pad"
                />

                <Text style={styles.label}>Connection ID</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. CONN-1234"
                  placeholderTextColor={theme.colors.textMuted}
                  value={joinConnectionId}
                  onChangeText={setJoinConnectionId}
                  autoCapitalize="characters"
                />

                <TouchableOpacity style={styles.submitBtn} onPress={handleJoin} disabled={loading}>
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Connect</Text>}
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.formContainer}>
                <Text style={styles.helperText}>Your shared spaces and connections.</Text>
                {loadingGroups ? (
                  <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 20 }} />
                ) : myGroups.length === 0 ? (
                  <Text style={{ textAlign: 'center', color: theme.colors.textMuted, marginTop: 20 }}>No connections yet.</Text>
                ) : (
                  myGroups.map(group => (
                    <View key={group._id} style={styles.groupCard}>
                      <View style={styles.groupInfo}>
                        <Text style={styles.groupName}>{group.name}</Text>
                        <Text style={styles.groupId}>ID: {group.connectionId}</Text>
                      </View>
                      <View style={styles.groupMembers}>
                        <Feather name="users" size={14} color={theme.colors.textSecondary} />
                        <Text style={styles.groupMembersText}>{group.members?.length || 1} members</Text>
                      </View>
                    </View>
                  ))
                )}
              </View>
            )}
          </ScrollView>

        </View>
      </View>
    </Modal>
  );
}

const createStyles = (theme) => StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    borderRadius: 24,
    padding: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.textPrimary,
  },
  closeBtn: {
    padding: 4,
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: theme.colors.background,
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: theme.colors.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  activeTabText: {
    color: theme.colors.textPrimary,
  },
  formContainer: {
    paddingBottom: 20,
  },
  helperText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: 8,
  },
  input: {
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: theme.colors.textPrimary,
    marginBottom: 20,
  },
  idRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  regenerateBtn: {
    width: 50,
    height: 50,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    marginBottom: 24,
  },
  copyBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  submitBtn: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  submitBtnText: {
    color: theme.colors.surface,
    fontSize: 16,
    fontWeight: 'bold',
  },
  groupCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  groupId: {
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  groupMembers: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceElevated,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  groupMembersText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginLeft: 4,
    fontWeight: '600',
  },
});
