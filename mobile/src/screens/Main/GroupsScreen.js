import React, { useState, useEffect, useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, FlatList, TextInput as RNTextInput, Platform } from 'react-native';
import { Text } from 'react-native-paper';
import { apiClient } from '../../api/client';
import { getCache, storeCache } from '../../utils/cache';
import { Feather } from '@expo/vector-icons';
import { BarChart } from 'react-native-chart-kit';
import { Dimensions } from 'react-native';
import EditExpenseModal from '../../components/EditExpenseModal';
import ManageCategoryModal from '../../components/ManageCategoryModal';

const screenWidth = Dimensions.get('window').width;

export default function GroupsScreen({ route }) {
  const groupId = route?.params?.groupId;
  const [categories, setCategories] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [isCategoryModalVisible, setIsCategoryModalVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);

  useEffect(() => {
    fetchData();
  }, [groupId]);

  const fetchData = async () => {
    try {
      let categoriesUrl = '/categories';
      let expensesUrl = '/expenses';
      
      const contextKey = groupId || 'personal';
      const catCacheKey = `groups_categories_${contextKey}`;
      const expCacheKey = `groups_expenses_${contextKey}`;

      // 1. INSTANT LOAD FROM CACHE
      const cachedCat = await getCache(catCacheKey);
      const cachedExp = await getCache(expCacheKey);
      
      if (cachedCat) setCategories(cachedCat);
      if (cachedExp) setExpenses(cachedExp);

      // 2. BACKGROUND SYNC
      if (groupId) {
        categoriesUrl += `?groupId=${groupId}`;
        expensesUrl += `?groupId=${groupId}`;
      }

      const [catRes, expRes] = await Promise.all([
        apiClient.get(categoriesUrl),
        apiClient.get(expensesUrl)
      ]);
      
      // 3. CACHE UPDATE & RE-RENDER
      setCategories(catRes.data);
      setExpenses(expRes.data);
      
      storeCache(catCacheKey, catRes.data);
      storeCache(expCacheKey, expRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  const handleUpdateExpense = async (updatedExpense) => {
    try {
      await apiClient.patch(`/expenses/${updatedExpense._id}`, updatedExpense);
      setIsEditModalVisible(false);
      setSelectedExpense(null);
      fetchData();
    } catch (error) {
      console.error('Error updating expense:', error);
      alert('Failed to update expense');
    }
  };

  const handleDeleteExpense = async (id) => {
    try {
      await apiClient.delete(`/expenses/${id}`);
      setIsEditModalVisible(false);
      setSelectedExpense(null);
      fetchData();
    } catch (error) {
      console.error('Error deleting expense:', error);
      alert('Failed to delete expense');
    }
  };

  const handleCategorySave = (savedCategory) => {
    setIsCategoryModalVisible(false);
    setEditingCategory(null);
    if (selectedCategory && selectedCategory._id === savedCategory._id) {
      setSelectedCategory(savedCategory);
    }
    fetchData();
  };

  const handleCategoryDelete = (deletedId) => {
    setIsCategoryModalVisible(false);
    setEditingCategory(null);
    if (selectedCategory && selectedCategory._id === deletedId) {
      setSelectedCategory(null);
    }
    fetchData();
  };

  const renderCategoryGrid = () => (
    <View style={styles.gridContainer}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
        <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Select a Category</Text>
        <TouchableOpacity onPress={() => { setEditingCategory(null); setIsCategoryModalVisible(true); }}>
          <Feather name="plus-circle" size={24} color="#2e2e2e" />
        </TouchableOpacity>
      </View>
      <View style={styles.categorySelector}>
        {categories.map((cat) => {
          const catExpenses = expenses.filter(e => e.categoryId?._id === cat._id || e.categoryId === cat._id);
          const total = catExpenses.reduce((sum, e) => sum + e.amount, 0);

          return (
            <TouchableOpacity 
              key={cat._id} 
              style={styles.categoryCard}
              onPress={() => setSelectedCategory(cat)}
            >
              <View style={[styles.categoryIconBox, { backgroundColor: `${cat.color || '#2e2e2e'}20` }]}>
                <Text style={styles.categoryEmoji}>{cat.icon || '📦'}</Text>
              </View>
              <Text style={styles.categoryName} numberOfLines={1}>{cat.name}</Text>
              <Text style={styles.categoryTotal}>{total.toLocaleString()} ETB</Text>
            </TouchableOpacity>
          )
        })}
      </View>
    </View>
  );

  const renderCategoryDetail = () => {
    const catExpenses = expenses.filter(e => e.categoryId?._id === selectedCategory._id || e.categoryId === selectedCategory._id);
    const total = catExpenses.reduce((sum, e) => sum + e.amount, 0);
    
    // Calculate this month
    const now = new Date();
    const thisMonthExpenses = catExpenses.filter(e => {
      const d = new Date(e.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const monthTotal = thisMonthExpenses.reduce((sum, e) => sum + e.amount, 0);

    return (
      <View style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => setSelectedCategory(null)}>
            <Feather name="arrow-left" size={24} color="#2e2e2e" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{selectedCategory.icon || '📦'} {selectedCategory.name}</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity style={styles.backBtn} onPress={() => { setEditingCategory(selectedCategory); setIsCategoryModalVisible(true); }}>
              <Feather name="edit-2" size={20} color="#2e2e2e" />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
          <View style={styles.statsHeaderRow}>
            <Text style={styles.statsTitleText}>Statistics</Text>
            <Feather name="eye" size={20} color="#888888" />
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Total Spent</Text>
              <Text style={styles.statValue}>{total.toLocaleString()}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>This Month</Text>
              <Text style={styles.statValue}>{monthTotal.toLocaleString()}</Text>
            </View>
          </View>

          {/* Chart Section */}
          <View style={styles.chartSection}>
            <View style={styles.chartHeader}>
              <Text style={styles.chartTitle}>Spending Trend</Text>
              <View style={styles.periodTabs}>
                <View style={styles.periodTabActive}><Text style={styles.periodTabTextActive}>Weekly</Text></View>
                <View style={styles.periodTab}><Text style={styles.periodTabText}>Monthly</Text></View>
                <View style={styles.periodTab}><Text style={styles.periodTabText}>Yearly</Text></View>
              </View>
            </View>

            <View style={styles.dateRangeContainer}>
              {Platform.OS === 'web' ? (
                React.createElement('input', {
                  type: 'date',
                  style: { flex: 1, padding: '10px 15px', borderRadius: '12px', border: '1px solid #f0f0f0', outline: 'none', color: '#2e2e2e', fontFamily: 'inherit' },
                  value: dateFrom,
                  onChange: e => setDateFrom(e.target.value)
                })
              ) : (
                <View style={styles.datePickerWrapper}>
                  <Text style={{color: '#888', flex: 1}}>{dateFrom || 'mm/dd/yyyy'}</Text>
                  <Feather name="calendar" size={16} color="#2e2e2e" />
                </View>
              )}
              <Text style={styles.dateRangeTo}>to</Text>
              {Platform.OS === 'web' ? (
                React.createElement('input', {
                  type: 'date',
                  style: { flex: 1, padding: '10px 15px', borderRadius: '12px', border: '1px solid #f0f0f0', outline: 'none', color: '#2e2e2e', fontFamily: 'inherit' },
                  value: dateTo,
                  onChange: e => setDateTo(e.target.value)
                })
              ) : (
                <View style={styles.datePickerWrapper}>
                  <Text style={{color: '#888', flex: 1}}>{dateTo || 'mm/dd/yyyy'}</Text>
                  <Feather name="calendar" size={16} color="#2e2e2e" />
                </View>
              )}
            </View>

            <View style={{ alignItems: 'center', marginTop: 20 }}>
              <BarChart
                data={{
                  labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                  datasets: [{ data: [0, 0, 0, monthTotal, 0, 0, 0] }]
                }}
                width={screenWidth - 80}
                height={200}
                yAxisLabel=""
                formatYLabel={(yValue) => {
                  const num = parseInt(yValue, 10);
                  if (num >= 1000) return (num / 1000).toFixed(0) + 'k';
                  return yValue;
                }}
                chartConfig={{
                  backgroundColor: '#ffffff',
                  backgroundGradientFrom: '#ffffff',
                  backgroundGradientTo: '#ffffff',
                  decimalPlaces: 0,
                  color: () => '#2e2e2e',
                  labelColor: () => '#888888',
                  barPercentage: 0.5,
                  fillShadowGradient: '#2e2e2e',
                  fillShadowGradientOpacity: 1,
                  propsForBackgroundLines: { strokeWidth: 1, stroke: '#f0f0f0', strokeDasharray: '0' },
                }}
                showBarTops={false}
                fromZero={true}
                withInnerLines={true}
                style={{ borderRadius: 16 }}
              />
            </View>
          </View>

          {/* Table */}
          <View style={styles.tableSection}>
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.tableHeaderCell, { flex: 1.2 }]}>Date</Text>
              <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Reason</Text>
              <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'right' }]}>Amount</Text>
            </View>
            {catExpenses.map((e, idx) => (
              <TouchableOpacity 
                key={idx} 
                style={styles.tableRow}
                onPress={() => {
                  setSelectedExpense(e);
                  setIsEditModalVisible(true);
                }}
              >
                <Text style={[styles.tableCellDate, { flex: 1.2 }]}>{new Date(e.date).toLocaleDateString(undefined, {month:'short', day:'numeric'})}</Text>
                <Text style={[styles.tableCellReason, { flex: 2 }]} numberOfLines={1}>{e.reason}</Text>
                <Text style={[styles.tableCellAmount, { flex: 1, textAlign: 'right' }]}>{e.amount.toLocaleString()}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Export Button */}
          <TouchableOpacity style={styles.exportBtn}>
            <Feather name="file-text" size={18} color="#fff" style={{marginRight: 8}} />
            <Text style={styles.exportBtnText}>Export to PDF</Text>
          </TouchableOpacity>

        </ScrollView>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {!selectedCategory ? (
        <>
          <View style={[styles.header, { justifyContent: 'flex-start' }]}>
            <Text style={[styles.headerTitle, { fontSize: 24 }]}>Categories</Text>
          </View>
          <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
            {renderCategoryGrid()}
          </ScrollView>
        </>
      ) : (
        renderCategoryDetail()
      )}
      
      {/* Expense Edit Modal */}
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

      {/* Category Manage Modal */}
      <ManageCategoryModal
        visible={isCategoryModalVisible}
        category={editingCategory}
        groupId={groupId}
        onClose={() => {
          setIsCategoryModalVisible(false);
          setEditingCategory(null);
        }}
        onSave={handleCategorySave}
        onDelete={handleCategoryDelete}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
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
    backgroundColor: '#ffffff',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2e2e2e',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  gridContainer: {
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2e2e2e',
    marginBottom: 15,
  },
  categorySelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  categoryCard: {
    width: '48%',
    backgroundColor: '#ffffff',
    paddingVertical: 20,
    paddingHorizontal: 15,
    borderRadius: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 2,
    marginBottom: 15,
  },
  categoryIconBox: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryEmoji: {
    fontSize: 24,
  },
  categoryName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2e2e2e',
    marginBottom: 4,
  },
  categoryTotal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#888888',
  },
  statsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 15,
  },
  statsTitleText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2e2e2e',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 25,
  },
  statCard: {
    width: '48%',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 2,
  },
  statLabel: {
    fontSize: 13,
    color: '#888888',
    fontWeight: '500',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#2e2e2e',
  },
  chartSection: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 15,
    elevation: 3,
    marginBottom: 25,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2e2e2e',
  },
  periodTabs: {
    flexDirection: 'row',
    backgroundColor: '#FAFAFA',
    borderRadius: 20,
    padding: 4,
  },
  periodTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  periodTabActive: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#2e2e2e',
    borderRadius: 16,
  },
  periodTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#888888',
  },
  periodTabTextActive: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  tableSection: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 2,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    paddingBottom: 10,
    marginBottom: 10,
  },
  tableHeaderCell: {
    fontSize: 12,
    fontWeight: '600',
    color: '#888888',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f9f9f9',
  },
  tableCellDate: {
    fontSize: 13,
    color: '#888888',
  },
  tableCellReason: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2e2e2e',
  },
  tableCellAmount: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2e2e2e',
  },
  dateRangeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 15,
  },
  datePickerWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  dateRangeTo: {
    marginHorizontal: 10,
    color: '#888',
    fontSize: 14,
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2e2e2e',
    paddingVertical: 15,
    borderRadius: 16,
    marginTop: 20,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 4,
  },
  exportBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});
