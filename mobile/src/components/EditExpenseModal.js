import { useTheme } from 'react-native-paper';
import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, Modal, TouchableOpacity, 
  TextInput, ScrollView, Platform, KeyboardAvoidingView, Image, ActivityIndicator
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { apiClient } from '../api/client';

export default function EditExpenseModal({ visible, expense, categories, onClose, onSave, onDelete }) {
  const theme = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [date, setDate] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [receiptUrl, setReceiptUrl] = useState(null);
  const [isReceiptLoading, setIsReceiptLoading] = useState(false);

  useEffect(() => {
    if (expense && visible) {
      setAmount(expense.amount ? expense.amount.toString() : '');
      setReason(expense.reason || '');
      setSelectedCategoryId(expense.categoryId?._id || expense.categoryId || null);
      
      const fetchReceipt = async () => {
        setIsReceiptLoading(true);
        try {
          const res = await apiClient.get(`/expenses/${expense._id}/receipt`);
          setReceiptUrl(res.data.receiptUrl || null);
        } catch (e) {
          console.log("No receipt found or error", e);
          setReceiptUrl(null);
        } finally {
          setIsReceiptLoading(false);
        }
      };
      
      if (expense._id) fetchReceipt();
      else setReceiptUrl(null);
      
      if (expense.date) {
        const d = new Date(expense.date);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        setDate(`${yyyy}-${mm}-${dd}`);
      } else {
        setDate('');
      }
    }
  }, [expense, visible]);

  const handleSave = () => {
    if (!amount || !selectedCategoryId || !date) {
      alert("Please fill all required fields");
      return;
    }
    
    onSave({
      _id: expense._id,
      amount: parseFloat(amount),
      reason,
      categoryId: selectedCategoryId,
      date: new Date(date).toISOString(),
      receiptUrl
    });
  };

  const handleDownloadReceipt = async () => {
    if (!receiptUrl) return;

    try {
      if (Platform.OS === 'web') {
        const link = document.createElement('a');
        link.href = receiptUrl;
        link.download = `receipt_${expense._id}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        const base64Data = receiptUrl.split(',')[1];
        if (!base64Data) {
          alert("Invalid image format.");
          return;
        }
        
        const fileUri = FileSystem.documentDirectory + `receipt_${expense._id}.jpg`;
        await FileSystem.writeAsStringAsync(fileUri, base64Data, {
          encoding: FileSystem.EncodingType.Base64,
        });

        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'image/jpeg',
            dialogTitle: 'Save Receipt',
            UTI: 'public.jpeg',
          });
        } else {
          alert("Sharing is not available on this device.");
        }
      }
    } catch (error) {
      console.error("Error downloading receipt:", error);
      alert("Failed to save receipt.");
    }
  };

  if (!visible) return null;

  return (
    <Modal
      transparent={true}
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView 
        style={styles.overlay} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Edit Expense</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Feather name="x" size={24} color="#888" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom: 20}}>
            
            {/* Added By Section */}
            {/* Added By Section */}
            {expense?.userId?.username && (
              <View style={{ marginBottom: 5 }}>
                <Text style={styles.label}>Recorded By</Text>
                <View style={[styles.input, {flexDirection: 'row', alignItems: 'center', padding: 12}]}>
                  <View style={{
                    width: 36, 
                    height: 36, 
                    borderRadius: 18, 
                    backgroundColor: '#e8f5e9', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    marginRight: 12
                  }}>
                    <Feather name="user" size={18} color="#2e7d32" />
                  </View>
                  <Text style={{fontSize: 16, color: theme.colors.textPrimary, fontWeight: '600'}} numberOfLines={1}>
                    {expense.userId.username}
                  </Text>
                </View>
              </View>
            )}

            {/* Amount */}
            <Text style={styles.label}>Amount</Text>
            <TextInput
              style={styles.input}
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              placeholder="0.00"
              placeholderTextColor="#aaa"
            />

            {/* Category */}
            <Text style={styles.label}>Category</Text>
            <View style={styles.categoryGrid}>
              {categories.map((cat) => (
                <TouchableOpacity 
                  key={cat._id}
                  style={[
                    styles.categoryItem, 
                    selectedCategoryId === cat._id && styles.categoryItemActive
                  ]}
                  onPress={() => setSelectedCategoryId(cat._id)}
                >
                  <Text style={styles.categoryEmoji}>{cat.icon || '📦'}</Text>
                  <Text style={[
                    styles.categoryName,
                    selectedCategoryId === cat._id && {color: '#fff'}
                  ]} numberOfLines={1}>{cat.name}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Reason */}
            <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 15, marginBottom: 8}}>
              <Text style={[styles.label, {marginTop: 0, marginBottom: 0}]}>Reason</Text>
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

            {isReceiptLoading ? (
              <View style={{ marginBottom: 15, alignItems: 'center', padding: 20 }}>
                <ActivityIndicator size="small" color="#4CAF50" />
                <Text style={{ fontSize: 12, color: '#888', marginTop: 8 }}>Loading receipt...</Text>
              </View>
            ) : receiptUrl ? (
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
                <TouchableOpacity 
                  style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, paddingVertical: 8, paddingHorizontal: 16, backgroundColor: '#2e2e2e', borderRadius: 20 }}
                  onPress={handleDownloadReceipt}
                >
                  <Feather name="download" size={16} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>Save Receipt</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            <TextInput
              style={styles.input}
              value={reason}
              onChangeText={setReason}
              placeholder="What was this for?"
              placeholderTextColor="#aaa"
            />

            {/* Date */}
            <Text style={styles.label}>Date</Text>
            {Platform.OS === 'web' ? (
              React.createElement('input', {
                type: 'date',
                style: { 
                  width: '100%', 
                  padding: '12px 15px', 
                  borderRadius: '12px', 
                  border: '1px solid #eee',
                  backgroundColor: '#f9f9f9',
                  outline: 'none', 
                  color: '#2e2e2e', 
                  fontFamily: 'inherit',
                  fontSize: '16px',
                  marginBottom: '20px',
                  boxSizing: 'border-box',
                  cursor: 'pointer'
                },
                value: date,
                onChange: e => setDate(e.target.value)
              })
            ) : (
              <TextInput
                style={styles.input}
                value={date}
                onChangeText={setDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#aaa"
              />
            )}

            {/* Actions */}
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
              <Text style={styles.saveBtnText}>Save Changes</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.deleteBtn} onPress={() => onDelete(expense._id)}>
              <Text style={styles.deleteBtnText}>Delete Expense</Text>
            </TouchableOpacity>

          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const createStyles = (theme) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    width: '100%',
    maxWidth: 500,
    borderRadius: 24,
    padding: 24,
    maxHeight: '90%',
    shadowColor: theme.colors.textPrimary,
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  closeBtn: {
    padding: 5,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: '#4a4a4a',
    marginBottom: 8,
    marginTop: 15,
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
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -5,
  },
  categoryItem: {
    width: '25%',
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
  },
  categoryItemActive: {
    backgroundColor: theme.colors.textSecondary,
  },
  categoryEmoji: {
    fontSize: 24,
    marginBottom: 5,
  },
  categoryName: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  saveBtn: {
    backgroundColor: '#4CAF50',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 30,
    shadowColor: '#4CAF50',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 4,
  },
  saveBtnText: {
    color: theme.colors.surface,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  deleteBtn: {
    marginTop: 20,
    alignItems: 'center',
    paddingVertical: 14,
    backgroundColor: '#fff0f0',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ffcdd2',
  },
  deleteBtnText: {
    color: '#e53935',
    fontSize: 15,
    fontWeight: '700',
  }
});
