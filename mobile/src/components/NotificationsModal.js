import React, { useMemo } from 'react';
import { View, StyleSheet, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { Text, Title, useTheme } from 'react-native-paper';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';

export default function NotificationsModal({ visible, onClose, expenses, user, budgetLimit = 0, periodTotal = 0, period = 'Monthly' }) {
  const theme = useTheme();

  const notifications = useMemo(() => {
    if (!expenses || !user) return [];
    
    const notifs = [];
    const today = new Date();
    const thisMonth = today.getMonth();
    const thisYear = today.getFullYear();

    const monthExpenses = expenses.filter(exp => {
      const d = new Date(exp.date);
      return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
    });
    
    const budgetAlertEnabled = user?.settings?.budgetAlertEnabled !== false;

    // Budget Alerts
    if (periodTotal > budgetLimit && budgetLimit > 0 && budgetAlertEnabled) {
      notifs.push({
        id: 'auto-budget-err',
        type: 'alert',
        icon: 'alert-circle',
        color: theme.colors.error,
        title: 'Budget Exceeded!',
        text: `You've spent ${periodTotal.toLocaleString()} ETB this ${period.toLowerCase()}, exceeding your ${budgetLimit.toLocaleString()} ETB limit.`,
        time: 'Now'
      });
    } else if (periodTotal > budgetLimit * 0.8 && budgetLimit > 0 && budgetAlertEnabled) {
      notifs.push({
        id: 'auto-budget-warn',
        type: 'warning',
        icon: 'alert',
        color: '#ff9800', // Orange warning
        title: 'Budget Warning',
        text: `You've used ${Math.round((periodTotal / budgetLimit) * 100)}% of your ${period.toLowerCase()} budget.`,
        time: 'Now'
      });
    }

    // Recent activity notification
    const recentExpenses = [...expenses].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 3);
    if (recentExpenses.length > 0) {
      const recentTotal = recentExpenses.reduce((sum, exp) => sum + exp.amount, 0);
      notifs.push({
        id: 'auto-recent',
        type: 'info',
        icon: 'information',
        color: theme.colors.primary,
        title: 'Recent Activity',
        text: `You recently spent ${recentTotal.toLocaleString()} ETB across ${recentExpenses.length} transactions.`,
        time: 'Today'
      });
    }

    return notifs;
  }, [expenses, user, budgetLimit, periodTotal, period]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.modalHeader}>
            <Title style={[styles.modalTitle, { color: theme.colors.textPrimary }]}>Notifications</Title>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Feather name="x" size={24} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.listContainer}>
            {notifications.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Feather name="bell-off" size={48} color={theme.colors.textSecondary} />
                <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>No notifications yet</Text>
              </View>
            ) : (
              notifications.map((notif) => (
                <View key={notif.id} style={[styles.notificationItem, { borderBottomColor: theme.colors.border }]}>
                  <View style={[styles.iconContainer, { backgroundColor: `${notif.color}20` }]}>
                    <MaterialCommunityIcons name={notif.icon} size={24} color={notif.color} />
                  </View>
                  <View style={styles.contentContainer}>
                    <Text style={[styles.notifTitle, { color: theme.colors.textPrimary }]}>{notif.title}</Text>
                    <Text style={[styles.notifText, { color: theme.colors.textSecondary }]}>{notif.text}</Text>
                    <Text style={[styles.notifTime, { color: theme.colors.primary }]}>{notif.time}</Text>
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '70%',
    paddingTop: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeBtn: {
    padding: 5,
  },
  listContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  emptyText: {
    marginTop: 15,
    fontSize: 16,
  },
  notificationItem: {
    flexDirection: 'row',
    paddingVertical: 15,
    borderBottomWidth: 1,
  },
  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  notifTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  notifText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 5,
  },
  notifTime: {
    fontSize: 12,
    fontWeight: '500',
  }
});
