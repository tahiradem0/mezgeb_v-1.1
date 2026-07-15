import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, StyleSheet, ScrollView, Dimensions, TouchableOpacity, Image, RefreshControl, PanResponder, Alert } from 'react-native';
import { Text, Title, useTheme } from 'react-native-paper';
import * as ImagePicker from 'expo-image-picker';
let Notifications = null;
try {
  Notifications = require('expo-notifications');
} catch (e) {
  console.warn('expo-notifications not available:', e.message);
}
import { io } from 'socket.io-client';
import { BarChart } from 'react-native-chart-kit';
import { apiClient, addToOfflineQueue, API_BASE_URL } from '../../api/client';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import EditExpenseModal from '../../components/EditExpenseModal';
import NotificationsModal from '../../components/NotificationsModal';
import { getCache, storeCache } from '../../utils/cache';
import NetInfo from '@react-native-community/netinfo';

const screenWidth = Dimensions.get('window').width;

export default function DashboardScreen() {
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [user, setUser] = useState(null);
  const [groups, setGroups] = useState([]);
  const [currentGroupId, setCurrentGroupId] = useState(null);
  const [analyticsPeriod, setAnalyticsPeriod] = useState('Yearly');
  const [refreshing, setRefreshing] = useState(false);
  const [tooltipData, setTooltipData] = useState(null);
  const theme = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const navigation = useNavigation();
  const activeGroupRef = useRef(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [isNotificationsModalVisible, setIsNotificationsModalVisible] = useState(false);

  const unreadCount = React.useMemo(() => {
    if (!expenses || !user) return 0;
    let count = 0;
    const today = new Date();
    const thisMonthTotal = expenses.filter(e => {
      const d = new Date(e.date);
      return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
    }).reduce((s, e) => s + e.amount, 0);
    
    const limit = user?.settings?.budgetLimit || 10000;
    const alertEnabled = user?.settings?.budgetAlertEnabled !== false;
    
    if (thisMonthTotal > limit && alertEnabled) count++;
    else if (thisMonthTotal > limit * 0.8 && alertEnabled) count++;
    
    if (expenses.length > 0) count++; // Recent activity
    return count;
  }, [expenses, user]);

  useFocusEffect(
    useCallback(() => {
      loadUser();
      fetchDashboardData(currentGroupId);
      AsyncStorage.setItem('activeGroupId', currentGroupId || 'personal');
    }, [currentGroupId])
  );

  useEffect(() => {
    activeGroupRef.current = currentGroupId;
  }, [currentGroupId]);

  useEffect(() => {
    const loadPrivacySetting = async () => {
      try {
        const savedPrivacy = await AsyncStorage.getItem('dashboardIsPrivate');
        if (savedPrivacy !== null) {
          setIsPrivate(savedPrivacy === 'true');
        }
      } catch (e) {}
    };
    loadPrivacySetting();
  }, []);

  const togglePrivacy = async () => {
    try {
      const newValue = !isPrivate;
      setIsPrivate(newValue);
      await AsyncStorage.setItem('dashboardIsPrivate', newValue.toString());
    } catch (e) {}
  };

  const loadUser = async () => {
    try {
      const u = await AsyncStorage.getItem('currentUser');
      if (u) setUser(JSON.parse(u));
    } catch (e) {}
  };

  const fetchDashboardData = async (groupId) => {
    setIsLoading(true);
    try {
      let expensesUrl = '/expenses';
      let categoriesUrl = '/categories';
      
      const contextKey = groupId || 'personal';
      const expensesCacheKey = `dashboard_expenses_${contextKey}`;
      const categoriesCacheKey = `dashboard_categories_${contextKey}`;
      const groupsCacheKey = `groups`;

      // 1. INSTANT LOAD FROM CACHE
      const cachedExpenses = await getCache(expensesCacheKey);
      const cachedCategories = await getCache(categoriesCacheKey);
      const cachedGroups = await getCache(groupsCacheKey);
      
      if (cachedExpenses) setExpenses(cachedExpenses);
      if (cachedCategories) setCategories(cachedCategories);
      if (cachedGroups) setGroups(cachedGroups);
      
      if (cachedExpenses || cachedCategories || cachedGroups) {
        setIsLoading(false); // Stop loading spinner immediately if cache exists
      }

      // 2. BACKGROUND SYNC
      if (groupId) {
        expensesUrl += `?groupId=${groupId}`;
        categoriesUrl += `?groupId=${groupId}`;
      }

      const [expRes, catRes, groupRes] = await Promise.all([
        apiClient.get(expensesUrl),
        apiClient.get(categoriesUrl),
        apiClient.get('/groups')
      ]);
      
      // Prevent race conditions: if user switched groups while fetching, discard this result.
      if (groupId !== activeGroupRef.current) {
        return;
      }
      
      // 3. CACHE UPDATE & RE-RENDER
      setExpenses(expRes.data);
      setCategories(catRes.data);
      setGroups(groupRes.data);
      
      storeCache(expensesCacheKey, expRes.data);
      storeCache(categoriesCacheKey, catRes.data);
      storeCache(groupsCacheKey, groupRes.data);

    } catch (e) {
      console.log('Error refreshing data:', e);
    } finally {
      setRefreshing(false);
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
        await storeCache(`dashboard_expenses_${currentGroupId || 'personal'}`, newExpenses);
      }
      setIsEditModalVisible(false);
      setSelectedExpense(null);
      fetchDashboardData(currentGroupId);
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
        // Optimistic UI update: instantly remove from UI cache
        const newExpenses = expenses.filter(e => e._id !== id);
        setExpenses(newExpenses);
        await storeCache(`dashboard_expenses_${currentGroupId || 'personal'}`, newExpenses);
      }
      setIsEditModalVisible(false);
      setSelectedExpense(null);
      fetchDashboardData(currentGroupId);
    } catch (error) {
      console.error('Error deleting expense:', error);
      Alert.alert('Error', 'Failed to delete expense');
    }
  };

  const allContexts = [null, ...groups.map(g => g._id)];
  
  const switchContext = (direction) => {
    // Optimistically clear data to show immediate UI change
    setExpenses([]);
    setCategories([]);
    
    const currentIndex = allContexts.indexOf(currentGroupId);
    let nextIndex;
    if (direction === 'next') {
      nextIndex = (currentIndex + 1) % allContexts.length;
    } else {
      nextIndex = (currentIndex - 1 + allContexts.length) % allContexts.length;
    }
    const newGroupId = allContexts[nextIndex];
    setCurrentGroupId(newGroupId);
    AsyncStorage.setItem('activeGroupId', newGroupId || 'personal');
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        return Math.abs(gestureState.dx) > 30 && Math.abs(gestureState.dy) < 30;
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (gestureState.dx > 50) {
          switchContext('prev'); // Swiped Right
        } else if (gestureState.dx < -50) {
          switchContext('next'); // Swiped Left
        }
      }
    })
  ).current;


  // Calculate Total
  const totalAmount = expenses.reduce((sum, e) => sum + e.amount, 0);
  
  // Calculate This Month Total
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const thisMonthExpenses = expenses.filter(e => {
    const d = new Date(e.date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });
  const thisMonthTotal = thisMonthExpenses.reduce((sum, e) => sum + e.amount, 0);

  // Calculate Last Month Total
  const lastMonthDate = new Date();
  lastMonthDate.setMonth(currentMonth - 1);
  const lastMonth = lastMonthDate.getMonth();
  const lastMonthYear = lastMonthDate.getFullYear();

  const lastMonthExpenses = expenses.filter(e => {
    const d = new Date(e.date);
    return d.getMonth() === lastMonth && d.getFullYear() === lastMonthYear;
  });
  const lastMonthTotal = lastMonthExpenses.reduce((sum, e) => sum + e.amount, 0);

  let percentChange = 0;
  if (lastMonthTotal === 0) {
    if (thisMonthTotal > 0) percentChange = 100;
  } else {
    percentChange = ((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100;
  }
  
  const isIncrease = percentChange > 0;
  const isNeutral = percentChange === 0;
  const percentChangeText = `${isIncrease ? '↑' : (isNeutral ? '-' : '↓')} ${Math.abs(percentChange).toFixed(1)}%`;
  const badgeColor = isIncrease ? theme.colors.error : theme.colors.success;
  const badgeBgColor = isIncrease ? `${theme.colors.error}40` : `${theme.colors.success}40`;

  // Budget Alert Notification Check
  useEffect(() => {
    const checkBudget = async () => {
      try {
        if (user?.settings?.budgetAlertEnabled && user?.settings?.budgetLimit > 0) {
          if (thisMonthTotal > user.settings.budgetLimit) {
            const key = `budget_alert_sent_${currentMonth}_${currentYear}`;
            const alreadySent = await AsyncStorage.getItem(key);
            if (!alreadySent && Notifications) {
              await Notifications.scheduleNotificationAsync({
                content: {
                  title: "⚠️ Budget Exceeded!",
                  body: `You have spent ${thisMonthTotal.toLocaleString()} ETB this month, exceeding your limit of ${user.settings.budgetLimit.toLocaleString()} ETB.`,
                },
                trigger: null,
              });
              await AsyncStorage.setItem(key, 'true');
            }
          }
        }
      } catch (e) {
        console.log('Error triggering budget alert', e);
      }
    };
    
    if (thisMonthTotal > 0 && user) {
      checkBudget();
    }
  }, [thisMonthTotal, user, currentMonth, currentYear]);

  // Socket.IO Real-Time Sync
  useEffect(() => {
    let socket;
    if (currentGroupId) {
      const socketUrl = API_BASE_URL.replace('/api', '');
      socket = io(socketUrl);
      socket.emit('joinGroup', currentGroupId);
      
      socket.on('expenseUpdated', () => {
        console.log('Real-time update received!');
        fetchDashboardData(currentGroupId);
      });
    }

    return () => {
      if (socket) socket.disconnect();
    };
  }, [currentGroupId]);

  let chartLabels = [];
  let chartData = [];
  const now = new Date();

  if (analyticsPeriod === 'Weekly') {
    chartData = Array(7).fill(0);
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      chartLabels.push(d.toLocaleDateString('en-US', { weekday: 'short' }));
    }
    expenses.forEach(e => {
      const d = new Date(e.date);
      const diffTime = now.getTime() - d.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays >= 0 && diffDays < 7) {
        chartData[6 - diffDays] += e.amount;
      }
    });
  } else if (analyticsPeriod === 'Monthly') {
    chartLabels = ['1-6', '7-12', '13-18', '19-24', '25+'];
    chartData = Array(5).fill(0);
    expenses.forEach(e => {
      const d = new Date(e.date);
      if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) {
        let day = d.getDate();
        if (day <= 6) chartData[0] += e.amount;
        else if (day <= 12) chartData[1] += e.amount;
        else if (day <= 18) chartData[2] += e.amount;
        else if (day <= 24) chartData[3] += e.amount;
        else chartData[4] += e.amount;
      }
    });
  } else if (analyticsPeriod === 'Yearly') {
    chartLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    chartData = Array(12).fill(0);
    expenses.forEach(e => {
      const d = new Date(e.date);
      if (d.getFullYear() === now.getFullYear()) {
        chartData[d.getMonth()] += e.amount;
      }
    });
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{paddingBottom: 150}}>
      
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greetingText}>Good Morning</Text>
          <Title style={styles.usernameText}>{user ? user.username : 'User'}</Title>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity 
            style={{marginRight: 15, position: 'relative', padding: 5}}
            onPress={() => setIsNotificationsModalVisible(true)}
          >
            <MaterialCommunityIcons name="bell-outline" size={26} color="#2e2e2e" />
            {unreadCount > 0 && (
              <View style={styles.notificationBadge}>
                <Text style={styles.badgeText}>{unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          {user?.profileImage ? (
            <Image source={{uri: user.profileImage}} style={styles.avatarImg} />
          ) : (
            <View style={styles.avatarFallback}>
              <MaterialCommunityIcons name="account" size={24} color="#aaa" />
            </View>
          )}
        </View>
      </View>

      {/* Carousel Dots & Context Matcher */}
      <View style={styles.carouselContainer}>
        <View style={styles.dotsRow}>
          {allContexts.map((ctx, i) => (
            <View key={i} style={[styles.dot, i === allContexts.indexOf(currentGroupId) && styles.dotActive]} />
          ))}
        </View>
        <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'center'}}>
          <TouchableOpacity onPress={() => switchContext('prev')} style={{padding: 5}}><Feather name="chevron-left" size={20} color="#888888" /></TouchableOpacity>
          <Text style={styles.carouselText}>
            {currentGroupId ? groups.find(g => g._id === currentGroupId)?.name : 'Personal Expenses'}
          </Text>
          <TouchableOpacity onPress={() => switchContext('next')} style={{padding: 5}}><Feather name="chevron-right" size={20} color="#888888" /></TouchableOpacity>
        </View>
      </View>

      <View {...panResponder.panHandlers}>

      {/* Dark Expense Summary Card */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryCol}>
            <View style={{flexDirection: 'row', alignItems: 'center'}}>
              <Text style={styles.summaryTitle}>Expense Summary</Text>
              <TouchableOpacity onPress={togglePrivacy} style={{marginLeft: 10, paddingBottom: 8}}>
                <Feather name={isPrivate ? "eye-off" : "eye"} size={16} color="#888" />
              </TouchableOpacity>
            </View>
            <Text style={styles.summaryLabel}>Overall Total</Text>
            <Text style={styles.summaryAmount}>
              {isPrivate ? '****' : totalAmount.toLocaleString()} <Text style={styles.summaryCurrency}>ETB</Text>
            </Text>
          </View>
          <View style={[styles.summaryCol, {alignItems: 'flex-end', justifyContent: 'flex-end'}]}>
            <Text style={styles.summaryLabel}>This Month</Text>
            <Text style={[styles.summaryAmount, {fontSize: 22}]}>
              {isPrivate ? '****' : thisMonthTotal.toLocaleString()} <Text style={styles.summaryCurrency}>ETB</Text>
            </Text>
          </View>
        </View>

        <View style={styles.summaryDivider} />

        <View style={styles.summaryFooter}>
          <View style={[styles.pillBadge, { backgroundColor: badgeBgColor }]}>
            <Text style={[styles.pillBadgeText, { color: badgeColor }]}>{percentChangeText}</Text>
          </View>
          <Text style={styles.footerText}>this month vs last month</Text>
        </View>
      </View>

      {/* Analytics Card */}
      <View style={styles.analyticsCard}>
        <Title style={styles.sectionTitle}>Analytics</Title>
        
        <View style={styles.pillContainer}>
          {['Weekly', 'Monthly', 'Yearly'].map(period => (
            <TouchableOpacity 
              key={period} 
              style={[styles.pillButton, analyticsPeriod === period && styles.pillButtonActive]}
              onPress={() => setAnalyticsPeriod(period)}
            >
              <Text style={[styles.pillText, analyticsPeriod === period && styles.pillTextActive]}>
                {period}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        
        <View style={styles.chartArea}>
          {expenses.length > 0 ? (
            <View style={{ position: 'relative', width: screenWidth - 80, height: 240, marginTop: 40 }}>
              {/* Y-Axis & Grid Lines */}
              <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 30, justifyContent: 'space-between' }}>
                {[4, 3, 2, 1, 0].map(step => {
                  const maxVal = Math.max(...chartData, 1);
                  // Round to nice number like frontend (simplified)
                  const magnitude = Math.pow(10, Math.floor(Math.log10(maxVal)));
                  let roundedMax = maxVal;
                  if (maxVal / magnitude <= 1) roundedMax = magnitude;
                  else if (maxVal / magnitude <= 2) roundedMax = 2 * magnitude;
                  else if (maxVal / magnitude <= 5) roundedMax = 5 * magnitude;
                  else roundedMax = 10 * magnitude;
                  
                  const val = (roundedMax / 4) * step;
                  const label = val >= 1000 ? (val / 1000).toFixed(val % 1000 === 0 ? 0 : 1) + 'k' : Math.round(val);
                  
                  return (
                    <View key={step} style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={{ width: 30, fontSize: 10, color: '#888', textAlign: 'right', marginRight: 10 }}>
                        {label}
                      </Text>
                      <View style={{ flex: 1, height: 1, backgroundColor: '#f0f0f0' }} />
                    </View>
                  );
                })}
              </View>

              {/* Bars */}
              <View style={{ position: 'absolute', top: 0, left: 40, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: 10 }}>
                {chartData.map((val, idx) => {
                  const maxVal = Math.max(...chartData, 1);
                  const magnitude = Math.pow(10, Math.floor(Math.log10(maxVal)));
                  let roundedMax = maxVal;
                  if (maxVal / magnitude <= 1) roundedMax = magnitude;
                  else if (maxVal / magnitude <= 2) roundedMax = 2 * magnitude;
                  else if (maxVal / magnitude <= 5) roundedMax = 5 * magnitude;
                  else roundedMax = 10 * magnitude;

                  const heightPct = Math.max((val / roundedMax) * 100, 0);
                  // Ensure minimum visible height for non-zero values
                  const barHeight = val > 0 ? Math.max(heightPct, 2) : 0;
                  
                  const isActive = tooltipData?.index === idx;

                  return (
                    <TouchableOpacity
                      key={idx}
                      activeOpacity={1}
                      onPress={() => {
                        if (isActive) {
                          setTooltipData(null);
                        } else {
                          setTooltipData({ index: idx, value: val });
                        }
                      }}
                      style={{ alignItems: 'center', flex: 1, height: '100%', justifyContent: 'flex-end' }}
                    >
                      {/* Tooltip */}
                      {isActive && val > 0 && (
                        <View style={{
                          position: 'absolute',
                          bottom: `${barHeight}%`,
                          marginBottom: 36,
                          backgroundColor: '#4CAF50',
                          paddingHorizontal: 12,
                          paddingVertical: 6,
                          borderRadius: 10,
                          alignItems: 'center',
                          minWidth: 42,
                          zIndex: 999,
                          shadowColor: '#4CAF50',
                          shadowOffset: { width: 0, height: 4 },
                          shadowOpacity: 0.4,
                          shadowRadius: 8,
                          elevation: 6,
                        }}>
                          <Text style={{color: '#fff', fontSize: 12, fontWeight: '800'}}>
                            {val >= 1000 ? (val / 1000).toFixed(val % 1000 === 0 ? 0 : 1) + 'k' : val}
                          </Text>
                          <View style={{
                            position: 'absolute',
                            bottom: -6,
                            borderLeftWidth: 6,
                            borderRightWidth: 6,
                            borderTopWidth: 6,
                            borderLeftColor: 'transparent',
                            borderRightColor: 'transparent',
                            borderTopColor: '#4CAF50',
                          }} />
                        </View>
                      )}
                      
                      {/* Bar */}
                      <View style={{ 
                        width: Math.min(32, (screenWidth - 120) / chartData.length * 0.8), 
                        height: `${barHeight}%`, 
                        backgroundColor: isActive ? '#4CAF50' : '#333333',
                        borderTopLeftRadius: 6,
                        borderTopRightRadius: 6,
                        marginBottom: 30 
                      }} />
                      
                      {/* X-Axis Label */}
                      <Text style={{ 
                        position: 'absolute', 
                        bottom: 5, 
                        fontSize: 11, 
                        color: isActive ? '#333333' : '#a0a0a0',
                        fontWeight: isActive ? '800' : '600'
                      }}>
                        {chartLabels[idx]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ) : (
            <Text style={{color: '#aaa', marginTop: 20}}>No data for analytics</Text>
          )}
        </View>
      </View>

      {/* Categories Section */}
      <View style={styles.sectionHeaderRow}>
        <Title style={styles.sectionTitle}>Categories</Title>
        <TouchableOpacity onPress={() => navigation.navigate('Categories', { groupId: currentGroupId })}>
          <Text style={styles.seeAllText}>See All</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.categoriesGrid}>
        {categories.slice(0, 4).map((cat, index) => {
          // Calculate category total
          const catTotal = expenses
            .filter(e => (e.categoryId?._id || e.categoryId) === cat._id)
            .reduce((sum, e) => sum + e.amount, 0);

          return (
            <View key={cat._id || index} style={styles.categoryCard}>
              <View style={styles.categoryIconWrap}>
                <Text style={styles.categoryEmoji}>{cat.icon || '📦'}</Text>
              </View>
              <Text style={styles.categoryName} numberOfLines={1}>{cat.name}</Text>
              <Text style={styles.categoryAmount}>{catTotal.toLocaleString()} ETB</Text>
              <Text style={styles.categoryDate}>Updated {new Date(cat.updatedAt || Date.now()).toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'})}</Text>
            </View>
          );
        })}
      </View>

      {/* Recent Expenses Section */}
      <View style={[styles.sectionHeaderRow, {marginTop: 20}]}>
        <Title style={styles.sectionTitle}>Recent Expenses</Title>
        <TouchableOpacity onPress={() => navigation.navigate('Reports', { groupId: currentGroupId })}>
          <Text style={styles.seeAllText}>See All</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.tableContainer}>
        {/* Table Header */}
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderText, {flex: 1.4}]}>Date</Text>
          <Text style={[styles.tableHeaderText, {flex: 2.2}]}>Reason</Text>
          <Text style={[styles.tableHeaderText, {flex: 2.6, textAlign: 'center'}]}>Category</Text>
          <Text style={[styles.tableHeaderText, {flex: 1.8, textAlign: 'right'}]}>Amount</Text>
        </View>

        {/* Table Rows */}
        {expenses.sort((a,b) => new Date(b.date) - new Date(a.date)).slice(0, 5).map((item, index) => {
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
                {currentGroupId && item.userId?.username && (
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
                <Text style={styles.tableCellAmount} numberOfLines={1} adjustsFontSizeToFit>
                  {isPrivate ? '****' : `${item.amount.toLocaleString()} ETB`}
                </Text>
              </View>
            </TouchableOpacity>
          )
        })}
      </View>
      </View>

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

      <NotificationsModal 
        visible={isNotificationsModalVisible}
        onClose={() => setIsNotificationsModalVisible(false)}
        expenses={expenses}
        user={user}
      />
    </ScrollView>
  );
}

const createStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: 20,
    paddingTop: 50,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  greetingText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  usernameText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: theme.colors.textPrimary,
    marginTop: -5,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  notificationBadge: {
    position: 'absolute',
    top: 2,
    right: 12,
    backgroundColor: '#F44336',
    borderRadius: 10,
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  badgeText: {
    color: theme.colors.surface,
    fontSize: 10,
    fontWeight: 'bold',
  },
  avatarImg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: theme.colors.border,
  },
  avatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#eee',
    justifyContent: 'center',
    alignItems: 'center',
  },
  carouselContainer: {
    alignItems: 'center',
    marginVertical: 15,
  },
  dotsRow: {
    flexDirection: 'row',
    marginBottom: 5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.border,
    marginHorizontal: 3,
  },
  dotActive: {
    backgroundColor: theme.colors.textPrimary,
  },
  carouselText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  summaryCard: {
    backgroundColor: theme.colors.textPrimary,
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryCol: {
    flex: 1,
  },
  summaryTitle: {
    color: theme.colors.surface,
    fontSize: 14,
    marginBottom: 15,
  },
  summaryLabel: {
    color: theme.colors.textMuted,
    fontSize: 13,
    marginBottom: 5,
  },
  summaryAmount: {
    color: theme.colors.surface,
    fontSize: 28,
    fontWeight: 'bold',
  },
  summaryCurrency: {
    fontSize: 16,
    fontWeight: 'normal',
    color: '#ddd'
  },
  summaryDivider: {
    height: 1,
    backgroundColor: theme.colors.textSecondary,
    marginVertical: 20,
  },
  summaryFooter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pillBadge: {
    backgroundColor: '#4CAF5040', // Green translucent
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 10,
  },
  pillBadgeText: {
    color: '#4CAF50', // Green text
    fontSize: 11,
    fontWeight: 'bold',
  },
  footerText: {
    color: theme.colors.textMuted,
    fontSize: 12,
  },
  analyticsCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    padding: 20,
    marginBottom: 25,
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: theme.colors.textPrimary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 5,
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 15,
  },
  pillContainer: {
    flexDirection: 'row',
    backgroundColor: theme.colors.background,
    borderRadius: 20,
    padding: 4,
  },
  pillButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 16,
  },
  pillButtonActive: {
    backgroundColor: theme.colors.textPrimary,
  },
  pillText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  pillTextActive: {
    color: theme.colors.surface,
    fontWeight: 'bold',
  },
  chartArea: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 15,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  seeAllText: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  categoryCard: {
    width: '48%',
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: theme.colors.textPrimary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 5,
    elevation: 1,
  },
  categoryIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  categoryEmoji: {
    fontSize: 20,
  },
  recentTransactionReason: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  recentTransactionDate: {
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  recentTransactionAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  categoryName: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: 5,
  },
  categoryAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.textPrimary,
    marginBottom: 10,
  },
  categoryDate: {
    fontSize: 11,
    color: theme.colors.textMuted,
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
  },
  tableCellAmount: {
    fontSize: 13,
    fontWeight: 'bold',
    color: theme.colors.textPrimary,
  }
});
