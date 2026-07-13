import React, { useState, useCallback, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, Alert, TextInput as RNTextInput, Keyboard, Platform, Image, KeyboardAvoidingView } from 'react-native';
import { Text , useTheme } from 'react-native-paper';
import { apiClient, addToOfflineQueue } from '../../api/client';
import NetInfo from '@react-native-community/netinfo';
import { Feather } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ManageCategoryModal from '../../components/ManageCategoryModal';

const CustomWebCalendar = ({ value, onChange, onClose }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date(value.getFullYear(), value.getMonth(), 1));

  const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

  const daysInMonth = getDaysInMonth(currentMonth.getFullYear(), currentMonth.getMonth());
  const firstDay = getFirstDayOfMonth(currentMonth.getFullYear(), currentMonth.getMonth());

  const days = [];
  for (let i = 0; i < firstDay; i++) {
    days.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i));
  }

  const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));

  const dayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  return (
    <View style={{ marginTop: 10, marginBottom: 15, padding: 15, backgroundColor: '#ffffff', borderRadius: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowOffset: { width: 0, height: 4 }, shadowRadius: 10, elevation: 4, borderWidth: 1, borderColor: '#f0f0f0' }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
        <TouchableOpacity onPress={prevMonth} style={{ padding: 5 }}><Feather name="chevron-left" size={20} color="#2e2e2e" /></TouchableOpacity>
        <Text style={{ fontSize: 16, fontWeight: '700', color: '#2e2e2e' }}>
          {currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
        </Text>
        <TouchableOpacity onPress={nextMonth} style={{ padding: 5 }}><Feather name="chevron-right" size={20} color="#2e2e2e" /></TouchableOpacity>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {dayNames.map((day, i) => (
          <View key={`day-${i}`} style={{ width: '14.28%', alignItems: 'center', marginBottom: 10 }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: '#a0a0a0' }}>{day}</Text>
          </View>
        ))}
        {days.map((dateObj, i) => {
          const isSelected = dateObj && dateObj.toDateString() === value.toDateString();
          const isToday = dateObj && dateObj.toDateString() === new Date().toDateString();
          return (
            <TouchableOpacity
              key={`date-${i}`}
              disabled={!dateObj}
              onPress={() => { if (dateObj) { onChange(dateObj); onClose(); } }}
              style={{
                width: '14.28%',
                aspectRatio: 1,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: isSelected ? '#2e2e2e' : (isToday ? '#f0f0f0' : 'transparent'),
                borderRadius: 20,
                marginBottom: 5,
              }}
            >
              {dateObj && (
                <Text style={{ fontSize: 14, color: isSelected ? '#ffffff' : '#2e2e2e', fontWeight: isSelected ? '700' : '500' }}>
                  {dateObj.getDate()}
                </Text>
              )}
            </TouchableOpacity>
          )
        })}
      </View>
    </View>
  );
};

export default function ExpensesScreen({ navigation }) {
  const theme = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [categories, setCategories] = useState([]);
  const [groupId, setGroupId] = useState(null);
  const activeGroupRef = useRef(null);
  const [dateType, setDateType] = useState('today'); 
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [receiptUrl, setReceiptUrl] = useState(null);
  const [saving, setSaving] = useState(false);

  const [previousReasons, setPreviousReasons] = useState([]);
  const [filteredReasons, setFilteredReasons] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isCategoryModalVisible, setIsCategoryModalVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const loadGroupId = async () => {
        const stored = await AsyncStorage.getItem('activeGroupId');
        const active = stored === 'personal' || !stored ? null : stored;
        setGroupId(active);
        activeGroupRef.current = active;
        fetchCategories(active);
        fetchPreviousReasons(active);
      };
      loadGroupId();
    }, [])
  );

  const fetchPreviousReasons = async (currentGroupId) => {
    try {
      const url = currentGroupId ? `/expenses?groupId=${currentGroupId}` : '/expenses';
      const response = await apiClient.get(url);
      if (currentGroupId !== activeGroupRef.current) return;
      const uniqueReasons = [...new Set(response.data.map(exp => exp.reason).filter(Boolean))];
      setPreviousReasons(uniqueReasons);
    } catch (error) {
      console.error('Error fetching expenses for reasons:', error);
    }
  };

  const fetchCategories = async (currentGroupId) => {
    try {
      const url = currentGroupId ? `/categories?groupId=${currentGroupId}` : '/categories';
      const response = await apiClient.get(url);
      if (currentGroupId !== activeGroupRef.current) return;
      setCategories(response.data);
    } catch (e) {
      console.log('Error fetching categories:', e);
    }
  };

  const handleCategorySave = (savedCategory) => {
    setIsCategoryModalVisible(false);
    setCategoryId(savedCategory._id);
    fetchCategories(groupId); // Refresh the list of categories
  };

  const handleSave = async () => {
    if (!amount || !reason || !categoryId) {
      Alert.alert('Error', 'Please enter amount, reason, and select a category.');
      return;
    }

    setSaving(true);
    let finalDate = new Date();
    if (dateType === 'yesterday') {
      finalDate.setDate(finalDate.getDate() - 1);
    } else if (dateType === 'custom') {
      finalDate = date;
    }

    const expenseData = {
      amount: Number(amount),
      reason,
      categoryId,
      date: finalDate.toISOString(),
      receiptUrl,
      ...(groupId && { groupId })
    };

    try {
      const netInfo = await NetInfo.fetch();
      if (netInfo.isConnected) {
        // If online, generate ID so the backend uses it immediately
        expenseData._id = require('../../utils/cache').generateObjectId();
        await apiClient.post('/expenses', expenseData);
      } else {
        const tempId = require('../../utils/cache').generateObjectId();
        expenseData._id = tempId;
        await addToOfflineQueue({
          method: 'POST',
          url: '/expenses',
          data: expenseData
        });
        Alert.alert('Offline', 'Expense saved offline. It will sync when connected.');
      }
      setAmount('');
      setReason('');
      setCategoryId('');
      setDateType('today');
      setReceiptUrl(null);
      navigation.navigate('Dashboard');
    } catch (error) {
      console.error('Error adding expense:', error);
      Alert.alert('Error', error.response?.data?.error || 'Failed to add expense');
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.navigate('Dashboard')}>
          <Feather name="arrow-left" size={24} color="#2e2e2e" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Record Expense</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Amount Input */}
        <View style={styles.amountGroup}>
          <Text style={styles.label}>Amount</Text>
          <View style={styles.amountInputWrapper}>
            <RNTextInput
              style={styles.amountInput}
              placeholder="0.00"
              placeholderTextColor="#888888"
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
            />
            <Text style={styles.currencyLabel}>ETB</Text>
          </View>
        </View>

        {/* Category Selection */}
        <View style={styles.formGroup}>
          <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12}}>
            <Text style={[styles.label, {marginBottom: 0}]}>Category</Text>
            <TouchableOpacity onPress={() => setIsCategoryModalVisible(true)}>
              <Feather name="plus-circle" size={24} color="#2e2e2e" />
            </TouchableOpacity>
          </View>
          <View style={styles.categorySelector}>
            {categories.map((cat) => {
              const isSelected = categoryId === cat._id;
              return (
                <TouchableOpacity 
                  key={cat._id} 
                  style={[styles.categoryItem, isSelected && styles.categoryItemActive]}
                  onPress={() => setCategoryId(cat._id)}
                >
                  <View style={[styles.categoryIconBox, isSelected && styles.categoryIconBoxActive, { backgroundColor: isSelected ? '#ffffff' : `${cat.color || '#2e2e2e'}20` }]}>
                    <Text style={styles.categoryEmoji}>{cat.icon || '📦'}</Text>
                  </View>
                  <Text style={[styles.categoryName, isSelected && styles.categoryNameActive]} numberOfLines={1}>{cat.name}</Text>
                </TouchableOpacity>
              )
            })}
          </View>
        </View>
        {/* Reason Input */}
        <View style={[styles.formGroup, { zIndex: 10, elevation: 10 }]}>
          <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12}}>
            <Text style={[styles.label, {marginBottom: 0}]}>Reason</Text>
            <TouchableOpacity 
              onPress={async () => {
                try {
                  let result = await ImagePicker.launchImageLibraryAsync({
                    mediaTypes: ImagePicker.MediaTypeOptions.Images,
                    allowsEditing: true,
                    quality: 0.5,
                    base64: true
                  });
                  if (!result.canceled) {
                    const base64Data = result.assets[0].base64;
                    if (base64Data) {
                      setReceiptUrl(`data:image/jpeg;base64,${base64Data}`);
                    } else if (result.assets[0].uri.startsWith('data:image')) {
                      setReceiptUrl(result.assets[0].uri);
                    } else {
                      // On web, if it's a blob URL, we need to convert it to base64
                      if (Platform.OS === 'web' && result.assets[0].uri.startsWith('blob:')) {
                        const response = await fetch(result.assets[0].uri);
                        const blob = await response.blob();
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          setReceiptUrl(reader.result);
                        };
                        reader.readAsDataURL(blob);
                      } else {
                        alert("Could not get base64 image data.");
                      }
                    }
                  }
                } catch (e) {
                  alert("Image Picker Error: " + e.message);
                }
              }}
            >
              <Feather name="camera" size={20} color="#888" />
            </TouchableOpacity>
          </View>
          
          {receiptUrl && (
            <View style={{ marginBottom: 15, alignItems: 'center' }}>
              <View style={{ position: 'relative' }}>
                <Image source={{ uri: receiptUrl }} style={{ width: 140, height: 140, borderRadius: 12, backgroundColor: '#f0f0f0' }} resizeMode="cover" />
                <TouchableOpacity 
                  style={{ position: 'absolute', top: -10, right: -10, backgroundColor: '#fff', borderRadius: 15, padding: 2, elevation: 5, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 3, shadowOffset: { width: 0, height: 2 } }}
                  onPress={() => setReceiptUrl(null)}
                >
                  <Feather name="x-circle" size={26} color="#f44336" />
                </TouchableOpacity>
              </View>
            </View>
          )}

          <View style={styles.inputWrapper}>
            <RNTextInput
              style={styles.textInput}
              placeholder="What was this expense for?"
              placeholderTextColor="#a0a0a0"
              value={reason}
              onChangeText={(text) => {
                setReason(text);
                if (text.length >= 2) {
                  const filtered = previousReasons.filter(r => r.toLowerCase().includes(text.toLowerCase()));
                  setFilteredReasons(filtered.slice(0, 5));
                  setShowSuggestions(true);
                } else {
                  setShowSuggestions(false);
                }
              }}
              onFocus={() => {
                if (reason.length >= 2 && filteredReasons.length > 0) setShowSuggestions(true);
              }}
              onBlur={() => {
                // slight delay to allow clicks on dropdown
                setTimeout(() => setShowSuggestions(false), 200);
              }}
            />
          </View>

          {/* Autocomplete Dropdown */}
          {showSuggestions && filteredReasons.length > 0 && (
            <View style={styles.autocompleteDropdown}>
              {filteredReasons.map((suggestion, index) => (
                <TouchableOpacity 
                  key={index} 
                  style={[
                    styles.autocompleteItem,
                    index === filteredReasons.length - 1 && { borderBottomWidth: 0 }
                  ]}
                  onPress={() => {
                    setReason(suggestion);
                    setShowSuggestions(false);
                    Keyboard.dismiss();
                  }}
                >
                  <Text style={styles.suggestionIcon}>💡</Text>
                  <Text style={styles.suggestionText} numberOfLines={1}>{suggestion}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Date Selection */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Date</Text>
          <View style={styles.dateOptions}>
            <TouchableOpacity 
              style={[styles.dateOption, dateType === 'today' && styles.dateOptionActive]}
              onPress={() => { setDateType('today'); setShowDatePicker(false); }}
            >
              <Text style={[styles.dateOptionText, dateType === 'today' && styles.dateOptionTextActive]}>Today</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.dateOption, dateType === 'yesterday' && styles.dateOptionActive]}
              onPress={() => { setDateType('yesterday'); setShowDatePicker(false); }}
            >
              <Text style={[styles.dateOptionText, dateType === 'yesterday' && styles.dateOptionTextActive]}>Yesterday</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.dateOption, dateType === 'custom' && styles.dateOptionActive]}
              onPress={() => { setDateType('custom'); setShowDatePicker(true); }}
            >
              <Feather name="calendar" size={16} color={dateType === 'custom' ? '#ffffff' : '#666666'} style={{ marginRight: 6 }} />
              <Text style={[styles.dateOptionText, dateType === 'custom' && styles.dateOptionTextActive]}>
                {dateType === 'custom' ? date.toLocaleDateString() : 'Pick Date'}
              </Text>
            </TouchableOpacity>
          </View>
          
          {/* Custom Web Calendar */}
          {Platform.OS === 'web' && dateType === 'custom' && showDatePicker && (
            <CustomWebCalendar 
              value={date} 
              onChange={(d) => { setDate(d); setDateType('custom'); }} 
              onClose={() => setShowDatePicker(false)} 
            />
          )}

          {/* Custom Date Picker for Mobile */}
          {Platform.OS !== 'web' && showDatePicker && (
            <DateTimePicker
              value={date}
              mode="date"
              display="default"
              onChange={(e, d) => { setShowDatePicker(false); if(d) setDate(d); }}
            />
          )}
        </View>

        {/* Save Button */}
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
          <Text style={styles.saveBtnText}>{saving ? 'Saving...' : '💾 Save Expense'}</Text>
        </TouchableOpacity>

      </ScrollView>

      {/* Category Manage Modal */}
      <ManageCategoryModal
        visible={isCategoryModalVisible}
        category={null} // We only add from here, not edit
        onClose={() => setIsCategoryModalVisible(false)}
        onSave={handleCategorySave}
        onDelete={() => {}} // No delete from here
      />
    </KeyboardAvoidingView>
  );
}

const createStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  backBtn: {
    width: 40,
    height: 40,
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: theme.colors.textPrimary,
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  amountGroup: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 30,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: 12,
  },
  amountInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: theme.colors.border,
    paddingBottom: 5,
  },
  amountInput: {
    fontSize: 40,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    textAlign: 'center',
    minWidth: 150,
  },
  currencyLabel: {
    fontSize: 20,
    fontWeight: '500',
    color: theme.colors.textSecondary,
    marginLeft: 10,
    marginBottom: -10,
  },
  formGroup: {
    marginBottom: 25,
  },
  categorySelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  categoryItem: {
    width: '31%',
    backgroundColor: theme.colors.surface,
    paddingVertical: 15,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: theme.colors.textPrimary,
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 5,
    elevation: 1,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  categoryItemActive: {
    backgroundColor: theme.colors.textPrimary,
  },
  categoryIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryIconBoxActive: {
    backgroundColor: theme.colors.surface,
  },
  categoryEmoji: {
    fontSize: 22,
  },
  categoryName: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  categoryNameActive: {
    color: theme.colors.surface,
  },
  inputWrapper: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    paddingHorizontal: 15,
    paddingVertical: 16,
    shadowColor: theme.colors.textPrimary,
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 5,
    elevation: 1,
  },
  textInput: {
    fontSize: 15,
    color: theme.colors.textPrimary,
  },
  autocompleteDropdown: {
    position: 'absolute',
    top: 85,
    left: 0,
    right: 0,
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    paddingVertical: 5,
    shadowColor: theme.colors.textPrimary,
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  autocompleteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.background,
  },
  suggestionIcon: {
    fontSize: 16,
    marginRight: 10,
  },
  suggestionText: {
    fontSize: 14,
    color: theme.colors.textPrimary,
    fontWeight: '500',
    flex: 1,
  },
  dateOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  dateOption: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: theme.colors.textPrimary,
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 5,
    elevation: 1,
    marginBottom: 10,
  },
  dateOptionActive: {
    backgroundColor: theme.colors.textPrimary,
  },
  dateOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  dateOptionTextActive: {
    color: theme.colors.surface,
  },
  saveBtn: {
    backgroundColor: theme.colors.textPrimary,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: theme.colors.textPrimary,
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 5,
  },
  saveBtnText: {
    color: theme.colors.surface,
    fontSize: 16,
    fontWeight: '700',
  }
});
