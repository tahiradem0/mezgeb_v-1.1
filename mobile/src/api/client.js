import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { DeviceEventEmitter, Platform } from 'react-native';

// Default development fallback: 10.0.2.2 for Android emulator, localhost for iOS/web
const DEFAULT_URL = Platform.OS === 'android' ? 'http://10.0.2.2:5000/api' : 'http://localhost:5000/api';
export const API_BASE_URL = DEFAULT_URL;

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// Intercept requests to dynamically add custom baseURL and auth token
apiClient.interceptors.request.use(
  async (config) => {
    try {
      const customUrl = await AsyncStorage.getItem('custom_api_url');
      if (customUrl) {
        config.baseURL = customUrl;
      }
      const token = await AsyncStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (e) {
      console.warn('Error reading stored config/token', e);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Intercept responses for auth errors
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response && error.response.status === 401) {
      console.warn('Session expired or invalid. Logging out.');
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('currentUser');
      DeviceEventEmitter.emit('logout');
    }
    return Promise.reject(error);
  }
);

/* ===================================
   OFFLINE SYNC & STORAGE 
   =================================== */

const OFFLINE_QUEUE_KEY = 'offline_queue';

export const addToOfflineQueue = async (action) => {
  try {
    const queue = JSON.parse(await AsyncStorage.getItem(OFFLINE_QUEUE_KEY)) || [];
    queue.push(action);
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.error('Failed to add to offline queue', e);
  }
};

export const syncOfflineData = async () => {
  const netInfo = await NetInfo.fetch();
  if (!netInfo.isConnected) return;

  try {
    const queue = JSON.parse(await AsyncStorage.getItem(OFFLINE_QUEUE_KEY)) || [];
    if (queue.length === 0) return;

    console.log(`Syncing ${queue.length} offline actions...`);

    const remainingQueue = [];
    for (let action of queue) {
      try {
        await apiClient.request({
          method: action.method,
          url: action.url,
          data: action.data,
        });
      } catch (err) {
        console.error('Failed to sync action', action, err.message);
        if (!err.response || err.response.status >= 500) {
          remainingQueue.push(action); 
        }
      }
    }

    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remainingQueue));
    if (remainingQueue.length === 0) {
      console.log('Offline queue synced successfully!');
    }
  } catch (e) {
    console.error('Sync error', e);
  }
};

/* ===================================
   E-COMMERCE & STORE ADMIN APIS
   =================================== */

// Orders
export const fetchOrders = async (params = {}) => {
  const response = await apiClient.get('/orders', { params });
  return response.data;
};

export const updateOrderStatus = async (orderId, status) => {
  const response = await apiClient.put(`/orders/${orderId}/status`, { status });
  return response.data;
};

export const updateOrderPayment = async (orderId, isPaid) => {
  const response = await apiClient.put(`/orders/${orderId}/pay`, { isPaid });
  return response.data;
};

// Store & Stock Inventory
export const fetchStoreOverview = async () => {
  const response = await apiClient.get('/store/overview');
  return response.data;
};

export const restockStock = async (data) => {
  const response = await apiClient.post('/store/restock', data);
  return response.data;
};

export const adjustStock = async (data) => {
  const response = await apiClient.post('/store/adjust', data);
  return response.data;
};

// Debts & Credits
export const fetchDebts = async (params = {}) => {
  const response = await apiClient.get('/debts', { params });
  return response.data;
};

export const createDebt = async (data) => {
  const response = await apiClient.post('/debts', data);
  return response.data;
};

export const recordDebtPayment = async (id, data) => {
  const response = await apiClient.post(`/debts/${id}/pay`, data);
  return response.data;
};

export const deleteDebt = async (id) => {
  const response = await apiClient.delete(`/debts/${id}`);
  return response.data;
};

// Capital Treasury
export const fetchCapitalOverview = async () => {
  const response = await apiClient.get('/capital/overview');
  return response.data;
};

export const fetchCapitalTransactions = async (params = {}) => {
  const response = await apiClient.get('/capital/transactions', { params });
  return response.data;
};

// Groups & Partners
export const createGroup = async (name, connectionId) => {
  const response = await apiClient.post('/groups/create', { name, connectionId });
  return response.data;
};

export const joinGroup = async (partnerPhone, connectionId) => {
  const response = await apiClient.post('/groups/join', { partnerPhone, connectionId });
  return response.data;
};

export const fetchGroups = async () => {
  const response = await apiClient.get('/groups');
  return response.data;
};
