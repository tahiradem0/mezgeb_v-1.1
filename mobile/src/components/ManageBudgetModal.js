import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Modal, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { apiClient } from '../api/client';
import NetInfo from '@react-native-community/netinfo';

export default function ManageBudgetModal({ visible, onClose, currentGroupId, groups, user }) {
  const theme = useTheme();
  const styles = createStyles(theme);

  const [isLoading, setIsLoading] = useState(false);
  const [budgets, setBudgets] = useState([]);
  
  // Form State
  const [amount, setAmount] = useState('');
  const [period, setPeriod] = useState('Monthly');
  const [selectedContext, setSelectedContext] = useState(currentGroupId || 'personal');

  useEffect(() => {
    if (visible) {
      setSelectedContext(currentGroupId || 'personal');
      fetchBudgets();
    }
  }, [visible, currentGroupId]);

  const fetchBudgets = async () => {
    setIsLoading(true);
    try {
      // Just fetch all budgets for this user (they'll only get ones they are authorized for)
      const res = await apiClient.get('/budgets');
      setBudgets(res.data);
      
      // Auto-populate form if budget exists for selected context
      const activeBudget = res.data.find(b => 
        (selectedContext === 'personal' && b.groupId === null) || 
        (b.groupId === selectedContext)
      );
      
      if (activeBudget) {
        setAmount(activeBudget.amount.toString());
        setPeriod(activeBudget.period);
      } else {
        setAmount('');
        setPeriod('Monthly');
      }
    } catch (e) {
      console.error('Failed to fetch budgets:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // When context changes, update form
    const activeBudget = budgets.find(b => 
      (selectedContext === 'personal' && b.groupId === null) || 
      (b.groupId === selectedContext)
    );
    
    if (activeBudget) {
      setAmount(activeBudget.amount.toString());
      setPeriod(activeBudget.period);
    } else {
      setAmount('');
      setPeriod('Monthly');
    }
  }, [selectedContext, budgets]);

  const handleSave = async () => {
    if (!amount || isNaN(amount) || Number(amount) <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid budget amount.');
      return;
    }

    try {
      setIsLoading(true);
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        Alert.alert('Offline', 'You need an internet connection to manage budgets.');
        return;
      }

      const payload = {
        amount: Number(amount),
        period,
        groupId: selectedContext === 'personal' ? null : selectedContext
      };

      await apiClient.post('/budgets', payload);
      Alert.alert('Success', 'Budget limit has been saved successfully!');
      fetchBudgets();
    } catch (e) {
      console.error('Failed to save budget:', e);
      Alert.alert('Error', 'Failed to save budget limit.');
    } finally {
      setIsLoading(false);
    }
  };

  const activeBudget = budgets.find(b => 
    (selectedContext === 'personal' && b.groupId === null) || 
    (b.groupId === selectedContext)
  );

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContent}
        >
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Manage Budget Limit</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Feather name="x" size={24} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollBody} showsVerticalScrollIndicator={false}>
            {/* Context Selector */}
            <Text style={styles.inputLabel}>Apply budget to:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.contextScroll}>
              <TouchableOpacity 
                style={[styles.contextPill, selectedContext === 'personal' && styles.contextPillActive]}
                onPress={() => setSelectedContext('personal')}
              >
                <Feather name="user" size={16} color={selectedContext === 'personal' ? '#fff' : theme.colors.textSecondary} style={{marginRight: 6}} />
                <Text style={[styles.contextPillText, selectedContext === 'personal' && styles.contextPillTextActive]}>
                  Personal
                </Text>
              </TouchableOpacity>
              
              {groups && groups.map(g => (
                <TouchableOpacity 
                  key={g._id}
                  style={[styles.contextPill, selectedContext === g._id && styles.contextPillActive]}
                  onPress={() => setSelectedContext(g._id)}
                >
                  <Feather name="users" size={16} color={selectedContext === g._id ? '#fff' : theme.colors.textSecondary} style={{marginRight: 6}} />
                  <Text style={[styles.contextPillText, selectedContext === g._id && styles.contextPillTextActive]}>
                    {g.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.divider} />

            {/* Existing Budget Info */}
            {activeBudget ? (
              <View style={styles.infoBox}>
                <MaterialIcons name="info-outline" size={20} color={theme.colors.primary} style={{marginTop: 2, marginRight: 8}} />
                <View style={{flex: 1}}>
                  <Text style={styles.infoText}>
                    An active {activeBudget.period.toLowerCase()} budget of {activeBudget.amount.toLocaleString()} ETB exists.
                  </Text>
                  <Text style={styles.infoSubText}>
                    Last updated by <Text style={{fontWeight: 'bold'}}>{activeBudget.updatedBy?.username || 'Unknown'}</Text>
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.infoBox}>
                <MaterialIcons name="info-outline" size={20} color={theme.colors.textSecondary} style={{marginTop: 2, marginRight: 8}} />
                <Text style={[styles.infoText, {color: theme.colors.textSecondary}]}>
                  No budget limit is currently set for this context.
                </Text>
              </View>
            )}

            {/* Form */}
            <Text style={styles.inputLabel}>Amount (ETB)</Text>
            <View style={styles.inputContainer}>
              <Text style={styles.currencyPrefix}>ETB</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 5000"
                placeholderTextColor={theme.colors.textMuted}
                keyboardType="numeric"
                value={amount}
                onChangeText={setAmount}
              />
            </View>

            <Text style={styles.inputLabel}>Time Period</Text>
            <View style={styles.periodRow}>
              {['Weekly', 'Monthly', 'Yearly'].map(p => (
                <TouchableOpacity 
                  key={p}
                  style={[styles.periodBtn, period === p && styles.periodBtnActive]}
                  onPress={() => setPeriod(p)}
                >
                  <Text style={[styles.periodBtnText, period === p && styles.periodBtnTextActive]}>{p}</Text>
                </TouchableOpacity>
              ))}
            </View>

          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity 
              style={styles.saveBtn} 
              onPress={handleSave}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveBtnText}>{activeBudget ? 'Update Budget' : 'Set Budget'}</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const createStyles = (theme) => StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: theme.colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: theme.colors.textPrimary },
  closeBtn: { padding: 5 },
  scrollBody: { paddingBottom: 20 },
  inputLabel: { fontSize: 14, fontWeight: '600', color: theme.colors.textPrimary, marginBottom: 8, marginTop: 10 },
  contextScroll: { flexDirection: 'row', marginBottom: 15 },
  contextPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, marginRight: 10 },
  contextPillActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  contextPillText: { fontSize: 14, fontWeight: '600', color: theme.colors.textSecondary },
  contextPillTextActive: { color: '#ffffff' },
  divider: { height: 1, backgroundColor: theme.colors.border, marginVertical: 15 },
  infoBox: { flexDirection: 'row', backgroundColor: theme.colors.surfaceElevated, padding: 15, borderRadius: 12, marginBottom: 20 },
  infoText: { fontSize: 14, color: theme.colors.textPrimary, lineHeight: 20 },
  infoSubText: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 4 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, paddingHorizontal: 15, height: 55, marginBottom: 20 },
  currencyPrefix: { fontSize: 16, fontWeight: '600', color: theme.colors.textSecondary, marginRight: 10 },
  input: { flex: 1, fontSize: 16, color: theme.colors.textPrimary },
  periodRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30 },
  periodBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, marginHorizontal: 4 },
  periodBtnActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  periodBtnText: { fontSize: 14, fontWeight: '600', color: theme.colors.textSecondary },
  periodBtnTextActive: { color: '#ffffff' },
  footer: { paddingTop: 15, paddingBottom: Platform.OS === 'ios' ? 20 : 0 },
  saveBtn: { backgroundColor: theme.colors.primary, height: 55, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' }
});
