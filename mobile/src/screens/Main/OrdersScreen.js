import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Linking,
  TextInput,
  Platform,
  Alert
} from 'react-native';
import { Text, useTheme, ActivityIndicator } from 'react-native-paper';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { fetchOrders, updateOrderStatus, updateOrderPayment } from '../../api/client';
import { getCache, storeCache } from '../../utils/cache';

const STATUS_TABS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'out_for_delivery', label: 'In Delivery' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'cancelled', label: 'Cancelled' },
];

export default function OrdersScreen() {
  const theme = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      // 1. Instant Cache Load
      const cached = await getCache('merchant_orders_cache');
      if (cached && orders.length === 0) {
        setOrders(cached);
      }

      // 2. Network Fetch
      const data = await fetchOrders();
      setOrders(data || []);
      storeCache('merchant_orders_cache', data || []);
    } catch (e) {
      console.warn('Could not fetch live orders:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadOrders();
  };

  const handleStatusChange = async (orderId, newStatus) => {
    try {
      await updateOrderStatus(orderId, newStatus);
      setOrders(prev =>
        prev.map(o => (o._id === orderId ? { ...o, orderStatus: newStatus } : o))
      );
      Alert.alert('Success', `Order status updated to ${newStatus}`);
    } catch (e) {
      Alert.alert('Error', 'Failed to update order status');
    }
  };

  const handleTogglePayment = async (orderId, currentPaid) => {
    try {
      await updateOrderPayment(orderId, !currentPaid);
      setOrders(prev =>
        prev.map(o => (o._id === orderId ? { ...o, isPaid: !currentPaid } : o))
      );
    } catch (e) {
      Alert.alert('Error', 'Failed to update payment status');
    }
  };

  const callCustomer = (phone) => {
    if (!phone) return;
    Linking.openURL(`tel:${phone}`);
  };

  const filteredOrders = orders.filter(order => {
    const matchesTab = activeTab === 'all' || order.orderStatus === activeTab;
    const searchLower = searchTerm.toLowerCase();
    const customerName = order.user?.name || order.shippingAddress?.fullName || '';
    const phone = order.shippingAddress?.phoneNumber || '';
    const id = order._id || '';

    const matchesSearch =
      !searchTerm ||
      customerName.toLowerCase().includes(searchLower) ||
      phone.includes(searchLower) ||
      id.toLowerCase().includes(searchLower);

    return matchesTab && matchesSearch;
  });

  const renderOrderItem = ({ item }) => {
    const isPaid = item.isPaid;
    const phone = item.shippingAddress?.phoneNumber;
    const address = item.shippingAddress?.address || item.shippingAddress?.city || 'Gondar';
    const landmark = item.shippingAddress?.postalCode || '';
    const itemsCount = item.orderItems?.reduce((s, i) => s + (i.qty || 1), 0) || 0;
    const totalPrice = item.totalPrice || 0;
    const dateStr = item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '';

    return (
      <View style={styles.card}>
        {/* Top Header */}
        <div style={{ display: 'none' }} />
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.orderNumber}>
              Order #{item._id ? item._id.slice(-6).toUpperCase() : ''}
            </Text>
            <Text style={styles.orderDate}>{dateStr}</Text>
          </View>
          <View style={[styles.badge, getStatusBadgeStyle(item.orderStatus)]}>
            <Text style={[styles.badgeText, getStatusTextStyle(item.orderStatus)]}>
              {(item.orderStatus || 'pending').toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Customer & Delivery Info */}
        <View style={styles.customerRow}>
          <View style={styles.customerInfo}>
            <Text style={styles.customerName}>
              {item.shippingAddress?.fullName || item.user?.name || 'Customer'}
            </Text>
            <View style={styles.addressRow}>
              <Feather name="map-pin" size={13} color="#06b6d4" style={{ marginRight: 4 }} />
              <Text style={styles.addressText} numberOfLines={1}>
                {address} {landmark ? `• ${landmark}` : ''}
              </Text>
            </View>
          </View>

          {phone ? (
            <TouchableOpacity style={styles.callButton} onPress={() => callCustomer(phone)}>
              <Feather name="phone-call" size={16} color="#ffffff" />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Price & Payment Row */}
        <View style={styles.priceRow}>
          <View>
            <Text style={styles.priceLabel}>{itemsCount} items</Text>
            <Text style={styles.priceValue}>ETB {totalPrice.toLocaleString()}</Text>
          </View>
          <TouchableOpacity
            style={[styles.paymentBadge, isPaid ? styles.paidBadge : styles.unpaidBadge]}
            onPress={() => handleTogglePayment(item._id, isPaid)}
          >
            <MaterialCommunityIcons
              name={isPaid ? 'check-circle' : 'clock-outline'}
              size={14}
              color={isPaid ? '#10b981' : '#f59f00'}
            />
            <Text style={[styles.paymentText, { color: isPaid ? '#10b981' : '#f59f00' }]}>
              {isPaid ? 'PAID' : 'PAYMENT PENDING'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Quick Workflow Action Buttons */}
        <View style={styles.actionsRow}>
          {item.orderStatus === 'pending' && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#0284c7' }]}
              onPress={() => handleStatusChange(item._id, 'confirmed')}
            >
              <Feather name="check" size={14} color="#fff" />
              <Text style={styles.actionBtnText}>Confirm Order</Text>
            </TouchableOpacity>
          )}

          {item.orderStatus === 'confirmed' && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#06b6d4' }]}
              onPress={() => handleStatusChange(item._id, 'out_for_delivery')}
            >
              <Feather name="truck" size={14} color="#fff" />
              <Text style={styles.actionBtnText}>Out for Delivery</Text>
            </TouchableOpacity>
          )}

          {item.orderStatus === 'out_for_delivery' && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#10b981' }]}
              onPress={() => handleStatusChange(item._id, 'delivered')}
            >
              <Feather name="check-circle" size={14} color="#fff" />
              <Text style={styles.actionBtnText}>Mark Delivered</Text>
            </TouchableOpacity>
          )}

          {item.orderStatus !== 'cancelled' && item.orderStatus !== 'delivered' && (
            <TouchableOpacity
              style={[styles.actionBtnSecondary]}
              onPress={() => handleStatusChange(item._id, 'cancelled')}
            >
              <Text style={styles.actionBtnSecondaryText}>Cancel</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Store Orders</Text>
        <Text style={styles.subtitle}>Gondar Tele-Suk E-Commerce Orders</Text>
      </View>

      {/* Search Input */}
      <View style={styles.searchWrapper}>
        <Feather name="search" size={18} color={theme.colors.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search customer, phone, or order #..."
          placeholderTextColor={theme.colors.textMuted}
          value={searchTerm}
          onChangeText={setSearchTerm}
        />
        {searchTerm ? (
          <TouchableOpacity onPress={() => setSearchTerm('')}>
            <Feather name="x" size={16} color={theme.colors.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Filter Tabs */}
      <View style={styles.tabsContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={STATUS_TABS}
          keyExtractor={item => item.key}
          renderItem={({ item }) => {
            const active = activeTab === item.key;
            return (
              <TouchableOpacity
                style={[styles.tabButton, active && styles.tabButtonActive]}
                onPress={() => setActiveTab(item.key)}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          }}
          contentContainerStyle={{ paddingHorizontal: 16 }}
        />
      </View>

      {/* Order List */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#06b6d4" />
        </View>
      ) : (
        <FlatList
          data={filteredOrders}
          keyExtractor={item => item._id}
          renderItem={renderOrderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#06b6d4" />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Feather name="inbox" size={48} color={theme.colors.textMuted} />
              <Text style={styles.emptyText}>No orders found in this section</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const getStatusBadgeStyle = status => {
  switch (status) {
    case 'delivered':
      return { backgroundColor: 'rgba(16, 185, 129, 0.15)', borderColor: 'rgba(16, 185, 129, 0.3)' };
    case 'out_for_delivery':
      return { backgroundColor: 'rgba(6, 182, 212, 0.15)', borderColor: 'rgba(6, 182, 212, 0.3)' };
    case 'confirmed':
      return { backgroundColor: 'rgba(2, 132, 199, 0.15)', borderColor: 'rgba(2, 132, 199, 0.3)' };
    case 'cancelled':
      return { backgroundColor: 'rgba(244, 63, 94, 0.15)', borderColor: 'rgba(244, 63, 94, 0.3)' };
    default:
      return { backgroundColor: 'rgba(245, 159, 0, 0.15)', borderColor: 'rgba(245, 159, 0, 0.3)' };
  }
};

const getStatusTextStyle = status => {
  switch (status) {
    case 'delivered':
      return { color: '#10b981' };
    case 'out_for_delivery':
      return { color: '#06b6d4' };
    case 'confirmed':
      return { color: '#0284c7' };
    case 'cancelled':
      return { color: '#fb7185' };
    default:
      return { color: '#f59f00' };
  }
};

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
    searchWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      marginHorizontal: 16,
      marginBottom: 10,
      paddingHorizontal: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
      height: 44,
    },
    searchIcon: {
      marginRight: 8,
    },
    searchInput: {
      flex: 1,
      fontSize: 14,
      color: theme.colors.textPrimary,
      paddingVertical: 0,
    },
    tabsContainer: {
      marginBottom: 10,
    },
    tabButton: {
      paddingVertical: 6,
      paddingHorizontal: 14,
      borderRadius: 20,
      marginRight: 8,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    tabButtonActive: {
      backgroundColor: '#06b6d4',
      borderColor: '#06b6d4',
    },
    tabText: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.colors.textSecondary,
    },
    tabTextActive: {
      color: '#ffffff',
    },
    listContent: {
      paddingHorizontal: 16,
      paddingBottom: 100,
    },
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: 18,
      padding: 16,
      marginBottom: 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.04,
      shadowRadius: 8,
      elevation: 2,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    orderNumber: {
      fontSize: 15,
      fontWeight: '800',
      color: theme.colors.textPrimary,
    },
    orderDate: {
      fontSize: 11,
      color: theme.colors.textMuted,
      marginTop: 2,
    },
    badge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
      borderWidth: 1,
    },
    badgeText: {
      fontSize: 10,
      fontWeight: '800',
    },
    customerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 8,
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: theme.colors.border,
      marginBottom: 12,
    },
    customerInfo: {
      flex: 1,
      marginRight: 10,
    },
    customerName: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.colors.textPrimary,
    },
    addressRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 3,
    },
    addressText: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      flex: 1,
    },
    callButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: '#10b981',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#10b981',
      shadowOpacity: 0.3,
      shadowOffset: { width: 0, height: 2 },
      elevation: 3,
    },
    priceRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 14,
    },
    priceLabel: {
      fontSize: 11,
      color: theme.colors.textMuted,
    },
    priceValue: {
      fontSize: 18,
      fontWeight: '800',
      color: '#10b981',
      marginTop: 1,
    },
    paymentBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
      gap: 4,
    },
    paidBadge: {
      backgroundColor: 'rgba(16, 185, 129, 0.1)',
    },
    unpaidBadge: {
      backgroundColor: 'rgba(245, 159, 0, 0.1)',
    },
    paymentText: {
      fontSize: 10,
      fontWeight: '800',
    },
    actionsRow: {
      flexDirection: 'row',
      gap: 8,
    },
    actionBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 9,
      borderRadius: 10,
      gap: 6,
    },
    actionBtnText: {
      color: '#fff',
      fontWeight: '700',
      fontSize: 12,
    },
    actionBtnSecondary: {
      paddingVertical: 9,
      paddingHorizontal: 14,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionBtnSecondaryText: {
      color: theme.colors.textMuted,
      fontSize: 12,
      fontWeight: '600',
    },
    centerContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: 80,
    },
    emptyText: {
      fontSize: 14,
      color: theme.colors.textMuted,
      marginTop: 10,
    },
  });
