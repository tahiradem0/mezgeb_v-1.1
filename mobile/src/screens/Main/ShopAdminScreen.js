import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Modal,
  Alert,
  Platform,
  Linking
} from 'react-native';
import { Text, useTheme, ActivityIndicator } from 'react-native-paper';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import {
  fetchStoreOverview,
  restockStock,
  adjustStock,
  fetchDebts,
  recordDebtPayment,
  createDebt,
  fetchCapitalOverview
} from '../../api/client';
import { getCache, storeCache } from '../../utils/cache';

export default function ShopAdminScreen() {
  const theme = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  // Section Selector: 'inventory' | 'debts' | 'capital'
  const [activeSection, setActiveSection] = useState('inventory');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Data states
  const [storeData, setStoreData] = useState(null);
  const [debts, setDebts] = useState([]);
  const [capital, setCapital] = useState(null);

  // Modals
  const [restockModalVisible, setRestockModalVisible] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [restockQty, setRestockQty] = useState('');
  const [restockCost, setRestockCost] = useState('');

  const [payModalVisible, setPayModalVisible] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('Cash');

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    try {
      // 1. Instant Cache Load
      const [cachedStore, cachedDebts, cachedCapital] = await Promise.all([
        getCache('shop_store_cache'),
        getCache('shop_debts_cache'),
        getCache('shop_capital_cache'),
      ]);

      if (cachedStore && !storeData) setStoreData(cachedStore);
      if (cachedDebts && debts.length === 0) setDebts(cachedDebts);
      if (cachedCapital && !capital) setCapital(cachedCapital);

      // 2. Network Fetch
      const [storeRes, debtsRes, capitalRes] = await Promise.all([
        fetchStoreOverview().catch(() => null),
        fetchDebts().catch(() => []),
        fetchCapitalOverview().catch(() => null),
      ]);

      if (storeRes) {
        setStoreData(storeRes);
        storeCache('shop_store_cache', storeRes);
      }
      if (debtsRes) {
        setDebts(debtsRes);
        storeCache('shop_debts_cache', debtsRes);
      }
      if (capitalRes) {
        setCapital(capitalRes);
        storeCache('shop_capital_cache', capitalRes);
      }
    } catch (e) {
      console.warn('Error loading shop admin data', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadAllData();
  };

  const handleRestockSubmit = async () => {
    if (!selectedProduct || !restockQty || Number(restockQty) <= 0) {
      Alert.alert('Error', 'Please enter a valid restock quantity');
      return;
    }
    try {
      await restockStock({
        productId: selectedProduct._id,
        quantityAdded: Number(restockQty),
        unitCostPrice: Number(restockCost) || selectedProduct.costPrice || 0,
        syncCapital: true,
      });
      Alert.alert('Success', `Restocked ${restockQty} units of ${selectedProduct.name}`);
      setRestockModalVisible(false);
      setRestockQty('');
      setRestockCost('');
      loadAllData();
    } catch (e) {
      Alert.alert('Error', e.response?.data?.message || 'Failed to restock');
    }
  };

  const handleRecordRepayment = async () => {
    if (!selectedDebt || !payAmount || Number(payAmount) <= 0) {
      Alert.alert('Error', 'Please enter a valid repayment amount');
      return;
    }
    try {
      await recordDebtPayment(selectedDebt._id, {
        amount: Number(payAmount),
        paymentMethod: payMethod,
        syncCapital: true,
      });
      Alert.alert('Success', 'Payment recorded successfully!');
      setPayModalVisible(false);
      setPayAmount('');
      loadAllData();
    } catch (e) {
      Alert.alert('Error', e.response?.data?.message || 'Failed to record repayment');
    }
  };

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Shop Management</Text>
        <Text style={styles.subtitle}>Gondar Tele-Suk Merchant Hub</Text>
      </View>

      {/* Segment Selector Tabs */}
      <View style={styles.segmentContainer}>
        <TouchableOpacity
          style={[styles.segmentBtn, activeSection === 'inventory' && styles.segmentBtnActive]}
          onPress={() => setActiveSection('inventory')}
        >
          <Feather
            name="box"
            size={14}
            color={activeSection === 'inventory' ? '#fff' : theme.colors.textSecondary}
          />
          <Text style={[styles.segmentText, activeSection === 'inventory' && styles.segmentTextActive]}>
            Stock & Inventory
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.segmentBtn, activeSection === 'debts' && styles.segmentBtnActive]}
          onPress={() => setActiveSection('debts')}
        >
          <Feather
            name="book-open"
            size={14}
            color={activeSection === 'debts' ? '#fff' : theme.colors.textSecondary}
          />
          <Text style={[styles.segmentText, activeSection === 'debts' && styles.segmentTextActive]}>
            Debts & Credit
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.segmentBtn, activeSection === 'capital' && styles.segmentBtnActive]}
          onPress={() => setActiveSection('capital')}
        >
          <Feather
            name="dollar-sign"
            size={14}
            color={activeSection === 'capital' ? '#fff' : theme.colors.textSecondary}
          />
          <Text style={[styles.segmentText, activeSection === 'capital' && styles.segmentTextActive]}>
            Capital
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#06b6d4" />}
      >
        {/* =========================================================
            SECTION 1: STOCK & INVENTORY
            ========================================================= */}
        {activeSection === 'inventory' && (
          <View>
            {/* KPI Cards */}
            <View style={styles.statsGrid}>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>Stock Units</Text>
                <Text style={styles.kpiValue}>
                  {storeData?.summary?.totalStockUnits || 0}
                </Text>
                <Text style={styles.kpiSub}>Across catalog</Text>
              </View>

              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>Cost Valuation</Text>
                <Text style={[styles.kpiValue, { color: '#06b6d4' }]}>
                  ETB {(storeData?.summary?.totalCostValuation || 0).toLocaleString()}
                </Text>
                <Text style={styles.kpiSub}>Capital tied in store</Text>
              </View>

              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>Retail Value</Text>
                <Text style={[styles.kpiValue, { color: '#10b981' }]}>
                  ETB {(storeData?.summary?.totalRetailValuation || 0).toLocaleString()}
                </Text>
                <Text style={styles.kpiSub}>Expected revenue</Text>
              </View>

              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>Stock Alerts</Text>
                <Text
                  style={[
                    styles.kpiValue,
                    { color: (storeData?.summary?.lowStockCount || 0) > 0 ? '#fa5252' : '#10b981' },
                  ]}
                >
                  {storeData?.summary?.lowStockCount || 0}
                </Text>
                <Text style={styles.kpiSub}>Low or out of stock</Text>
              </View>
            </View>

            {/* Inventory Items List */}
            <Text style={styles.sectionHeading}>Product Inventory Catalog</Text>

            {(storeData?.inventory || []).map(item => {
              const isOut = item.currentStock <= 0;
              const isLow = item.currentStock > 0 && item.currentStock <= 3;

              return (
                <View key={item._id} style={styles.card}>
                  <View style={styles.itemRow}>
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemName}>{item.name}</Text>
                      <Text style={styles.itemCategory}>{item.category || 'Retail'}</Text>
                      <View style={styles.itemPricing}>
                        <Text style={styles.itemPrice}>ETB {item.retailPrice?.toLocaleString()}</Text>
                        <Text style={styles.itemCost}>Cost: ETB {item.costPrice || 0}</Text>
                      </View>
                    </View>

                    <View style={styles.itemStockCol}>
                      <View
                        style={[
                          styles.stockBadge,
                          isOut ? styles.badgeOut : isLow ? styles.badgeLow : styles.badgeOk,
                        ]}
                      >
                        <Text
                          style={[
                            styles.stockBadgeText,
                            isOut
                              ? { color: '#fa5252' }
                              : isLow
                              ? { color: '#f59f00' }
                              : { color: '#10b981' },
                          ]}
                        >
                          {item.currentStock} in stock
                        </Text>
                      </View>

                      <TouchableOpacity
                        style={styles.restockBtn}
                        onPress={() => {
                          setSelectedProduct(item);
                          setRestockCost((item.costPrice || '').toString());
                          setRestockModalVisible(true);
                        }}
                      >
                        <Feather name="plus-circle" size={14} color="#06b6d4" />
                        <Text style={styles.restockBtnText}>Restock</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* =========================================================
            SECTION 2: DEBTS & CREDITS
            ========================================================= */}
        {activeSection === 'debts' && (
          <View>
            <View style={styles.statsGrid}>
              <View style={[styles.kpiCard, { borderLeftWidth: 4, borderLeftColor: '#10b981' }]}>
                <Text style={styles.kpiLabel}>Customer Credit</Text>
                <Text style={[styles.kpiValue, { color: '#10b981' }]}>
                  ETB{' '}
                  {debts
                    .filter(d => d.type === 'receivable' && d.status !== 'settled')
                    .reduce((s, d) => s + (d.balance || 0), 0)
                    .toLocaleString()}
                </Text>
                <Text style={styles.kpiSub}>Owed to our shop</Text>
              </View>

              <View style={[styles.kpiCard, { borderLeftWidth: 4, borderLeftColor: '#fa5252' }]}>
                <Text style={styles.kpiLabel}>Store Payables</Text>
                <Text style={[styles.kpiValue, { color: '#fa5252' }]}>
                  ETB{' '}
                  {debts
                    .filter(d => d.type === 'payable' && d.status !== 'settled')
                    .reduce((s, d) => s + (d.balance || 0), 0)
                    .toLocaleString()}
                </Text>
                <Text style={styles.kpiSub}>We owe to suppliers</Text>
              </View>
            </View>

            <Text style={styles.sectionHeading}>Active Ledger Records ({debts.length})</Text>

            {debts.map(debt => {
              const isReceivable = debt.type === 'receivable';
              return (
                <View key={debt._id} style={styles.card}>
                  <View style={styles.debtHeader}>
                    <View>
                      <Text style={styles.debtName}>{debt.personName}</Text>
                      <Text style={styles.debtDetail}>{debt.title || 'General Account'}</Text>
                    </View>
                    <View
                      style={[
                        styles.badge,
                        isReceivable
                          ? { backgroundColor: 'rgba(16, 185, 129, 0.15)' }
                          : { backgroundColor: 'rgba(244, 63, 94, 0.15)' },
                      ]}
                    >
                      <Text
                        style={[
                          styles.badgeText,
                          isReceivable ? { color: '#10b981' } : { color: '#fa5252' },
                        ]}
                      >
                        {isReceivable ? 'CUSTOMER CREDIT' : 'SUPPLIER DEBT'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.debtBalanceRow}>
                    <View>
                      <Text style={styles.debtSubLabel}>Remaining Balance</Text>
                      <Text
                        style={[
                          styles.debtBalance,
                          isReceivable ? { color: '#10b981' } : { color: '#fa5252' },
                        ]}
                      >
                        ETB {debt.balance?.toLocaleString()}
                      </Text>
                    </View>

                    {debt.phone ? (
                      <TouchableOpacity
                        style={styles.callIconBtn}
                        onPress={() => Linking.openURL(`tel:${debt.phone}`)}
                      >
                        <Feather name="phone-call" size={16} color="#10b981" />
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  {debt.balance > 0 && (
                    <TouchableOpacity
                      style={styles.repayBtn}
                      onPress={() => {
                        setSelectedDebt(debt);
                        setPayAmount(debt.balance.toString());
                        setPayModalVisible(true);
                      }}
                    >
                      <Feather name="check-circle" size={14} color="#fff" />
                      <Text style={styles.repayBtnText}>Record Repayment</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* =========================================================
            SECTION 3: CAPITAL TREASURY
            ========================================================= */}
        {activeSection === 'capital' && (
          <View>
            <View style={styles.card}>
              <Text style={styles.kpiLabel}>Current Available Treasury</Text>
              <Text style={[styles.bigCapital, { color: (capital?.netCapital || 0) >= 0 ? '#10b981' : '#fa5252' }]}>
                ETB {(capital?.netCapital || 0).toLocaleString()}
              </Text>
              <Text style={styles.kpiSub}>Liquid working capital after all orders & expenses</Text>
            </View>

            <View style={styles.statsGrid}>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>Total Inflows</Text>
                <Text style={[styles.kpiValue, { color: '#10b981' }]}>
                  +ETB {(capital?.totalInflow || 0).toLocaleString()}
                </Text>
                <Text style={styles.kpiSub}>Sales & deposits</Text>
              </View>

              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>Total Outflows</Text>
                <Text style={[styles.kpiValue, { color: '#fa5252' }]}>
                  -ETB {(capital?.totalOutflow || 0).toLocaleString()}
                </Text>
                <Text style={styles.kpiSub}>Expenses & restocks</Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* RESTOCK MODAL */}
      <Modal visible={restockModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Restock: {selectedProduct?.name}</Text>

            <Text style={styles.inputLabel}>Units to Add *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 10"
              keyboardType="numeric"
              value={restockQty}
              onChangeText={setRestockQty}
            />

            <Text style={styles.inputLabel}>Unit Cost Price (ETB)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 250"
              keyboardType="numeric"
              value={restockCost}
              onChangeText={setRestockCost}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setRestockModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSubmit} onPress={handleRestockSubmit}>
                <Text style={styles.modalSubmitText}>Confirm Restock</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* REPAYMENT MODAL */}
      <Modal visible={payModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Record Payment: {selectedDebt?.personName}</Text>

            <Text style={styles.inputLabel}>Amount to Pay (ETB) *</Text>
            <TextInput
              style={styles.input}
              placeholder="0.00"
              keyboardType="numeric"
              value={payAmount}
              onChangeText={setPayAmount}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setPayModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSubmit, { backgroundColor: '#10b981' }]}
                onPress={handleRecordRepayment}
              >
                <Text style={styles.modalSubmitText}>Confirm Payment</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = theme =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      paddingHorizontal: 20,
      paddingTop: Platform.OS === 'ios' ? 60 : 45,
      paddingBottom: 12,
    },
    title: {
      fontSize: 26,
      fontWeight: '800',
      color: theme.colors.textPrimary,
    },
    subtitle: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
    segmentContainer: {
      flexDirection: 'row',
      backgroundColor: theme.colors.surface,
      marginHorizontal: 16,
      marginBottom: 14,
      borderRadius: 14,
      padding: 4,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    segmentBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 8,
      borderRadius: 10,
      gap: 5,
    },
    segmentBtnActive: {
      backgroundColor: '#06b6d4',
    },
    segmentText: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.colors.textSecondary,
    },
    segmentTextActive: {
      color: '#fff',
    },
    scrollContent: {
      paddingHorizontal: 16,
      paddingBottom: 100,
    },
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      marginBottom: 16,
    },
    kpiCard: {
      flex: 1,
      minWidth: '46%',
      backgroundColor: theme.colors.surface,
      borderRadius: 16,
      padding: 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    kpiLabel: {
      fontSize: 11,
      color: theme.colors.textMuted,
      fontWeight: '600',
    },
    kpiValue: {
      fontSize: 18,
      fontWeight: '800',
      color: theme.colors.textPrimary,
      marginTop: 3,
    },
    kpiSub: {
      fontSize: 10,
      color: theme.colors.textMuted,
      marginTop: 2,
    },
    bigCapital: {
      fontSize: 28,
      fontWeight: '800',
      marginTop: 4,
    },
    sectionHeading: {
      fontSize: 15,
      fontWeight: '800',
      color: theme.colors.textPrimary,
      marginVertical: 10,
    },
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    itemRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    itemInfo: {
      flex: 1,
      marginRight: 10,
    },
    itemName: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.colors.textPrimary,
    },
    itemCategory: {
      fontSize: 11,
      color: theme.colors.textMuted,
      marginTop: 2,
    },
    itemPricing: {
      flexDirection: 'row',
      gap: 8,
      alignItems: 'center',
      marginTop: 4,
    },
    itemPrice: {
      fontSize: 13,
      fontWeight: '700',
      color: '#10b981',
    },
    itemCost: {
      fontSize: 11,
      color: theme.colors.textMuted,
    },
    itemStockCol: {
      alignItems: 'flex-end',
      gap: 6,
    },
    stockBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
    },
    badgeOk: {
      backgroundColor: 'rgba(16, 185, 129, 0.1)',
    },
    badgeLow: {
      backgroundColor: 'rgba(245, 159, 0, 0.1)',
    },
    badgeOut: {
      backgroundColor: 'rgba(244, 63, 94, 0.1)',
    },
    stockBadgeText: {
      fontSize: 11,
      fontWeight: '700',
    },
    restockBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 4,
      paddingHorizontal: 8,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: 'rgba(6, 182, 212, 0.3)',
      backgroundColor: 'rgba(6, 182, 212, 0.08)',
    },
    restockBtnText: {
      fontSize: 11,
      fontWeight: '700',
      color: '#06b6d4',
    },
    debtHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 10,
    },
    debtName: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.colors.textPrimary,
    },
    debtDetail: {
      fontSize: 12,
      color: theme.colors.textMuted,
      marginTop: 2,
    },
    badge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
    },
    badgeText: {
      fontSize: 10,
      fontWeight: '800',
    },
    debtBalanceRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 8,
      borderTopWidth: 1,
      borderColor: theme.colors.border,
      marginBottom: 10,
    },
    debtSubLabel: {
      fontSize: 11,
      color: theme.colors.textMuted,
    },
    debtBalance: {
      fontSize: 18,
      fontWeight: '800',
      marginTop: 2,
    },
    callIconBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      borderWidth: 1,
      borderColor: 'rgba(16, 185, 129, 0.3)',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(16, 185, 129, 0.1)',
    },
    repayBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: '#10b981',
      gap: 6,
    },
    repayBtnText: {
      color: '#fff',
      fontWeight: '700',
      fontSize: 12,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    modalContent: {
      width: '100%',
      maxWidth: 360,
      backgroundColor: theme.colors.surface,
      borderRadius: 18,
      padding: 20,
    },
    modalTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: theme.colors.textPrimary,
      marginBottom: 14,
    },
    inputLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.textSecondary,
      marginBottom: 4,
    },
    input: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 10,
      padding: 10,
      marginBottom: 12,
      fontSize: 14,
      color: theme.colors.textPrimary,
    },
    modalButtons: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 6,
    },
    modalCancel: {
      flex: 1,
      padding: 10,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: 'center',
    },
    modalCancelText: {
      color: theme.colors.textMuted,
      fontWeight: '600',
    },
    modalSubmit: {
      flex: 1,
      padding: 10,
      borderRadius: 10,
      backgroundColor: '#06b6d4',
      alignItems: 'center',
    },
    modalSubmitText: {
      color: '#fff',
      fontWeight: '700',
    },
  });
