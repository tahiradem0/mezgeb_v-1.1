import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { DeviceEventEmitter } from 'react-native';
export const API_BASE_URL = 'http://192.168.111.230:5000/api'; // Point to local network backend for Expo Go

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Intercept requests to add token
apiClient.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
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

// We will store pending actions in AsyncStorage 
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

    // Process queue
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
        // Retry later if it wasn't a 4xx error (e.g. keep for 5xx or network failures)
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

export const createGroup = async (name, connectionId) => {
  const response = await apiClient.post('/groups/create', { name, connectionId });
  return response.data;
};

export const joinGroup = async (partnerPhone, connectionId) => {
  const response = await apiClient.post('/groups/join', { partnerPhone, connectionId });
  return response.data;
};
