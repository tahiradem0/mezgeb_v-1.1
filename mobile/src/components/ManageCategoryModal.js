import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, Alert, Platform, TextInput, Modal, KeyboardAvoidingView } from 'react-native';
import { Text, ActivityIndicator , useTheme } from 'react-native-paper';
import { Feather } from '@expo/vector-icons';
import { apiClient, addToOfflineQueue } from '../api/client';
import { generateObjectId } from '../utils/cache';
import NetInfo from '@react-native-community/netinfo';

export default function ManageCategoryModal({ visible, category, groupId, onClose, onSave, onDelete }) {
  const theme = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('📦');
  const [color, setColor] = useState('#4CAF50');
  const [isLoading, setIsLoading] = useState(false);

  const colors = ['#4CAF50', '#F44336', '#2196F3', '#FFEB3B', '#9C27B0', '#FF9800', '#795548', '#607D8B'];
  const emojis = ['📦', '🍔', '🚗', '🏥', '✈️', '🎮', '👕', '📱', '📚', '☕', '🏠', '🎁', '🛒', '🎬', '🧾', '🔌'];

  useEffect(() => {
    if (category) {
      setName(category.name || '');
      setIcon(category.icon || '📦');
      setColor(category.color || '#4CAF50');
    } else {
      setName('');
      setIcon('📦');
      setColor('#4CAF50');
    }
  }, [category, visible]);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Category name is required');
      return;
    }

    setIsLoading(true);
    try {
      const payload = { name, icon, color };
      if (groupId) payload.groupId = groupId;

      const netInfo = await NetInfo.fetch();
      if (netInfo.isConnected) {
        let res;
        if (category && category._id) {
          res = await apiClient.patch(`/categories/${category._id}`, payload);
        } else {
          // If we are online, generate ID so the backend uses it immediately
          const newId = generateObjectId();
          payload._id = newId;
          res = await apiClient.post('/categories', payload);
        }
        onSave(res.data);
      } else {
        // OFFLINE MODE
        if (category && category._id) {
          await addToOfflineQueue({ method: 'PATCH', url: `/categories/${category._id}`, data: payload });
          onSave({ ...category, ...payload }); // Optimistic update
        } else {
          const tempId = generateObjectId();
          const newCategory = { _id: tempId, ...payload, isVisible: true, lastUpdated: new Date().toISOString() };
          await addToOfflineQueue({ method: 'POST', url: '/categories', data: newCategory });
          onSave(newCategory); // Optimistic update
        }
        Alert.alert('Offline', 'Changes saved offline. Will sync when connected.');
      }
    } catch (e) {
      console.error('Error saving category', e);
      Alert.alert('Error', 'Failed to save category');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!category || !category._id) return;
    
    const executeDelete = async () => {
      setIsLoading(true);
      try {
        const netInfo = await NetInfo.fetch();
        if (netInfo.isConnected) {
          await apiClient.delete(`/categories/${category._id}`);
        } else {
          await addToOfflineQueue({ method: 'DELETE', url: `/categories/${category._id}` });
          Alert.alert('Offline', 'Delete saved offline. Will sync when connected.');
        }
        onDelete(category._id);
      } catch (e) {
        console.error('Error deleting category', e);
        Alert.alert('Error', 'Failed to delete category');
      } finally {
        setIsLoading(false);
      }
    };

    if (Platform.OS === 'web') {
      const confirm = window.confirm('Are you sure you want to delete this category?');
      if (confirm) {
        executeDelete();
      }
    } else {
      Alert.alert('Delete Category', 'Are you sure you want to delete this category?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: executeDelete }
      ]);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{category ? 'Edit Category' : 'New Category'}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Feather name="x" size={24} color="#2e2e2e" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Emoji Options */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Emoji Icon</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.emojiContainer}>
                {emojis.map(e => (
                  <TouchableOpacity 
                    key={e} 
                    style={[styles.emojiCircle, icon === e && styles.emojiCircleActive]} 
                    onPress={() => setIcon(e)}
                  >
                    <Text style={styles.emojiText}>{e}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Category Name</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="e.g. Groceries"
              />
            </View>

            {/* Colors */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Theme Color</Text>
              <View style={styles.colorContainer}>
                {colors.map(c => (
                  <TouchableOpacity 
                    key={c} 
                    style={[styles.colorCircle, { backgroundColor: c }, color === c && styles.colorCircleActive]} 
                    onPress={() => setColor(c)}
                  />
                ))}
              </View>
            </View>

          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            {category && category._id && (
              <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete} disabled={isLoading}>
                <Text style={styles.deleteBtnText}>Delete</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={isLoading}>
              <Text style={styles.saveBtnText}>{isLoading ? 'Saving...' : 'Save Category'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const createStyles = (theme) => StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 25,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 25,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  closeBtn: {
    padding: 5,
    backgroundColor: theme.colors.background,
    borderRadius: 20,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: '#4a4a4a',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 16,
    padding: 16,
    fontSize: 16,
    backgroundColor: theme.colors.background,
    color: theme.colors.textPrimary,
  },
  emojiContainer: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 5,
  },
  emojiCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  emojiCircleActive: {
    borderColor: theme.colors.textPrimary,
    backgroundColor: theme.colors.surface,
  },
  emojiText: {
    fontSize: 24,
  },
  colorContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 5,
  },
  colorCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorCircleActive: {
    borderColor: theme.colors.textPrimary,
  },
  actionButtons: {
    flexDirection: 'row',
    marginTop: 10,
    marginBottom: 20,
    gap: 15,
  },
  saveBtn: {
    flex: 1,
    backgroundColor: '#4CAF50',
    padding: 18,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveBtnText: {
    color: theme.colors.surface,
    fontSize: 16,
    fontWeight: '700',
  },
  deleteBtn: {
    flex: 1,
    backgroundColor: '#ffebe9',
    padding: 18,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ff3b30',
  },
  deleteBtnText: {
    color: '#ff3b30',
    fontSize: 16,
    fontWeight: '600',
  }
});
