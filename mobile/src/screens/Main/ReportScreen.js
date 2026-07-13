import React, { useState, useCallback, useRef } from 'react';
import { View, StyleSheet, ScrollView, TextInput, TouchableOpacity, Text, Dimensions, Platform, Alert } from 'react-native';
import { Title , useTheme } from 'react-native-paper';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient, addToOfflineQueue } from '../../api/client';
import { getCache, storeCache } from '../../utils/cache';
import NetInfo from '@react-native-community/netinfo';
import EditExpenseModal from '../../components/EditExpenseModal';

export default function ReportScreen() {
  const theme = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const [groupId, setGroupId] = useState(null);
  const activeGroupRef = useRef(null);
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false); // filters toggle
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const loadGroupId = async () => {
        const stored = await AsyncStorage.getItem('activeGroupId');
        const active = stored === 'personal' || !stored ? null : stored;
        setGroupId(active);
        activeGroupRef.current = active;
        fetchData(active);
      };
      loadGroupId();
    }, [])
  );

  const fetchData = async (currentGroupId) => {
    setIsLoading(true);
    try {
      let expensesUrl = '/expenses';
      let categoriesUrl = '/categories';
      
      const contextKey = currentGroupId || 'personal';
      const catCacheKey = `report_categories_${contextKey}`;
      const expCacheKey = `report_expenses_${contextKey}`;

      // 1. INSTANT LOAD FROM CACHE
      const cachedCat = await getCache(catCacheKey);
      const cachedExp = await getCache(expCacheKey);
      
      if (cachedCat) setCategories(cachedCat);
      if (cachedExp) setExpenses(cachedExp);
      
      if (cachedCat || cachedExp) {
        setIsLoading(false);
      }

      // 2. BACKGROUND SYNC
      if (currentGroupId) {
        expensesUrl += `?groupId=${currentGroupId}`;
        categoriesUrl += `?groupId=${currentGroupId}`;
      }

      const [expRes, catRes] = await Promise.all([
        apiClient.get(expensesUrl),
        apiClient.get(categoriesUrl)
      ]);
      
      if (currentGroupId !== activeGroupRef.current) return; // Stale fetch

      // 3. CACHE UPDATE & RE-RENDER
      setExpenses(expRes.data);
      setCategories(catRes.data);
      
      storeCache(expCacheKey, expRes.data);
      storeCache(catCacheKey, catRes.data);
    } catch (error) {
      console.error('Error fetching report data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateExpense = async (updatedExpense) => {
    try {
      const netInfo = await NetInfo.fetch();
      if (netInfo.isConnected) {
        await apiClient.patch(`/expenses/${updatedExpense._id}`, updatedExpense);
      } else {
        await addToOfflineQueue({ method: 'PATCH', url: `/expenses/${updatedExpense._id}`, data: updatedExpense });
        const newExpenses = expenses.map(e => e._id === updatedExpense._id ? updatedExpense : e);
        setExpenses(newExpenses);
        await storeCache(`report_expenses_${groupId || 'personal'}`, newExpenses);
      }
      setIsEditModalVisible(false);
      setSelectedExpense(null);
      fetchData(groupId);
    } catch (error) {
      console.error('Error updating expense:', error);
      alert('Failed to update expense');
    }
  };

  const handleDeleteExpense = async (id) => {
    try {
      const netInfo = await NetInfo.fetch();
      if (netInfo.isConnected) {
        await apiClient.delete(`/expenses/${id}`);
      } else {
        await addToOfflineQueue({ method: 'DELETE', url: `/expenses/${id}` });
        const newExpenses = expenses.filter(e => e._id !== id);
        setExpenses(newExpenses);
        await storeCache(`report_expenses_${groupId || 'personal'}`, newExpenses);
      }
      setIsEditModalVisible(false);
      setSelectedExpense(null);
      fetchData(groupId);
    } catch (error) {
      console.error('Error deleting expense:', error);
      Alert.alert('Error', 'Failed to delete expense');
    }
  };

  const filteredExpenses = expenses
    .filter(e => {
      const cat = categories.find(c => c._id === (e.categoryId?._id || e.categoryId));
      const searchStr = searchQuery.toLowerCase();
      const reasonMatch = e.reason && e.reason.toLowerCase().includes(searchStr);
      const catMatch = cat && cat.name && cat.name.toLowerCase().includes(searchStr);
      const matchesSearch = reasonMatch || catMatch;

      const amt = e.amount || 0;
      const minA = minAmount ? parseFloat(minAmount) : -Infinity;
      const maxA = maxAmount ? parseFloat(maxAmount) : Infinity;
      const matchesAmount = amt >= minA && amt <= maxA;

      const d = new Date(e.date || Date.now());
      // Adjust start/end times so "2026-07-08" captures the whole day
      const dFrom = dateFrom ? new Date(`${dateFrom}T00:00:00`) : new Date(0);
      const dTo = dateTo ? new Date(`${dateTo}T23:59:59`) : new Date(8640000000000000);
      const matchesDate = d >= dFrom && d <= dTo;

      return matchesSearch && matchesAmount && matchesDate;
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Title style={styles.headerTitle}>Reports</Title>
        <TouchableOpacity style={styles.filterBtn} onPress={() => setShowFilters(!showFilters)}>
          <Feather name="filter" size={20} color="#2e2e2e" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <Feather name="search" size={20} color="#888" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search expenses..."
          placeholderTextColor="#888"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {showFilters && (
        <View style={styles.filterPanel}>
          <Text style={styles.filterLabel}>Amount Range</Text>
          <View style={styles.filterRow}>
            <TextInput
              style={styles.filterInput}
              placeholder="Min amount"
              placeholderTextColor="#aaa"
              keyboardType="numeric"
              value={minAmount}
              onChangeText={setMinAmount}
            />
            <Text style={styles.filterToText}>to</Text>
            <TextInput
              style={styles.filterInput}
              placeholder="Max amount"
              placeholderTextColor="#aaa"
              keyboardType="numeric"
              value={maxAmount}
              onChangeText={setMaxAmount}
            />
          </View>
          
          <Text style={[styles.filterLabel, {marginTop: 15}]}>Date Range</Text>
          <View style={styles.filterRow}>
            {Platform.OS === 'web' ? (
              React.createElement('input', {
                type: 'date',
                style: { flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #f0f0f0', outline: 'none', color: '#2e2e2e', fontFamily: 'inherit' },
                value: dateFrom,
                onChange: e => setDateFrom(e.target.value)
              })
            ) : (
              <TextInput
                style={styles.filterInput}
                placeholder="From YYYY-MM-DD"
                placeholderTextColor="#aaa"
                value={dateFrom}
                onChangeText={setDateFrom}
              />
            )}
            <Text style={styles.filterToText}>to</Text>
            {Platform.OS === 'web' ? (
              React.createElement('input', {
                type: 'date',
                style: { flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #f0f0f0', outline: 'none', color: '#2e2e2e', fontFamily: 'inherit' },
                value: dateTo,
                onChange: e => setDateTo(e.target.value)
              })
            ) : (
              <TextInput
                style={styles.filterInput}
                placeholder="To YYYY-MM-DD"
                placeholderTextColor="#aaa"
                value={dateTo}
                onChangeText={setDateTo}
              />
            )}
          </View>

          <TouchableOpacity 
            style={styles.clearFilterBtn}
            onPress={() => {
              setMinAmount('');
              setMaxAmount('');
              setDateFrom('');
              setDateTo('');
            }}
          >
            <Text style={styles.clearFilterText}>Clear Filters</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 150 }}>
        <View style={styles.tableContainer}>
          {/* Table Header */}
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderText, {flex: 1.4}]}>Date</Text>
            <Text style={[styles.tableHeaderText, {flex: 2.2}]}>Reason</Text>
            <Text style={[styles.tableHeaderText, {flex: 2.6, textAlign: 'center'}]}>Category</Text>
            <Text style={[styles.tableHeaderText, {flex: 1.8, textAlign: 'right'}]}>Amount</Text>
          </View>

          {/* Table Rows */}
          {filteredExpenses.map((item, index) => {
            const cat = categories.find(c => c._id === (item.categoryId?._id || item.categoryId)) || { name: 'Other', icon: '📝' };
            return (
              <TouchableOpacity 
                key={item._id || index} 
                style={styles.tableRow}
                onPress={() => {
                  setSelectedExpense(item);
                  setIsEditModalVisible(true);
                }}
              >
                <View style={{flex: 1.4}}>
                  <Text style={[styles.tableCellDate, { fontWeight: '700', color: '#2e2e2e', fontSize: 13 }]}>
                    {new Date(item.date || Date.now()).toLocaleDateString('en-US', {month: 'short', day: 'numeric'})}
                  </Text>
                  <Text style={{fontSize: 11, color: '#a0a0a0', marginTop: 2, fontWeight: '500'}}>
                    {new Date(item.date || Date.now()).getFullYear()}
                  </Text>
                </View>
                <View style={{flex: 2.2, paddingRight: 5, justifyContent: 'center'}}>
                  <Text style={styles.tableCellReason} numberOfLines={2}>{item.reason}</Text>
                  {groupId && item.userId?.username && (
                    <View style={{
                      flexDirection: 'row', 
                      alignItems: 'center', 
                      backgroundColor: '#e8f5e9', 
                      paddingHorizontal: 8, 
                      paddingVertical: 3, 
                      borderRadius: 12, 
                      alignSelf: 'flex-start', 
                      marginTop: 6,
                      maxWidth: '100%'
                    }}>
                      <Feather name="user" size={10} color="#2e7d32" style={{marginRight: 4}} />
                      <Text style={{fontSize: 10, color: '#2e7d32', fontWeight: '700', flexShrink: 1}} numberOfLines={1}>
                        {item.userId.username}
                      </Text>
                    </View>
                  )}
                </View>
                <View style={{flex: 2.6, alignItems: 'center', justifyContent: 'center'}}>
                  <View style={styles.tableCategoryPill}>
                    <Text style={styles.tableCategoryEmoji}>{cat.icon || '📦'}</Text>
                    <Text style={styles.tableCategoryText} numberOfLines={1}>{cat.name}</Text>
                  </View>
                </View>
                <View style={{flex: 1.8, alignItems: 'flex-end', justifyContent: 'center'}}>
                  <Text style={styles.tableCellAmount} numberOfLines={1} adjustsFontSizeToFit>{item.amount.toLocaleString()} ETB</Text>
                </View>
              </TouchableOpacity>
            )
          })}
          
          {!isLoading && filteredExpenses.length === 0 && (
            <View style={{padding: 30, alignItems: 'center'}}>
              <Text style={{color: '#888'}}>No expenses found.</Text>
            </View>
          )}
        </View>
      </ScrollView>

      <EditExpenseModal 
        visible={isEditModalVisible}
        expense={selectedExpense}
        categories={categories}
        onClose={() => {
          setIsEditModalVisible(false);
          setSelectedExpense(null);
        }}
        onSave={handleUpdateExpense}
        onDelete={handleDeleteExpense}
      />
    </View>
  );
}

const createStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: 20,
    paddingTop: 60,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.textPrimary,
  },
  filterBtn: {
    width: 40,
    height: 40,
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: theme.colors.textPrimary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    paddingHorizontal: 15,
    height: 50,
    marginBottom: 20,
    shadowColor: theme.colors.textPrimary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: theme.colors.textPrimary,
    outlineStyle: 'none',
  },
  filterPanel: {
    backgroundColor: theme.colors.surface,
    padding: 15,
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: 8,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  filterInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    color: theme.colors.textPrimary,
    backgroundColor: theme.colors.background,
  },
  filterToText: {
    marginHorizontal: 10,
    color: theme.colors.textSecondary,
    fontSize: 14,
  },
  clearFilterBtn: {
    marginTop: 20,
    paddingVertical: 12,
    backgroundColor: theme.colors.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#eee',
    alignItems: 'center',
  },
  clearFilterText: {
    color: theme.colors.textPrimary,
    fontWeight: '600',
    fontSize: 14,
  },
  tableContainer: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
    shadowColor: theme.colors.textPrimary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 5,
    elevation: 1,
    marginBottom: 20,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: theme.colors.background,
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  tableHeaderText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontWeight: '600',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 15,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    alignItems: 'center',
  },
  tableCellDate: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  tableCellReason: {
    fontSize: 13,
    color: theme.colors.textPrimary,
    fontWeight: '500',
  },
  tableCategoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    maxWidth: '100%',
  },
  tableCategoryEmoji: {
    fontSize: 12,
    marginRight: 4,
  },
  tableCategoryText: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  tableCellAmount: {
    fontSize: 14,
    fontWeight: 'bold',
    color: theme.colors.textPrimary,
  },
});
