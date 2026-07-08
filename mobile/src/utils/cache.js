import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = 'mezgeb_cache_';

/**
 * Store data in the local cache
 * @param {string} key - Cache key
 * @param {any} value - Data to be cached
 */
export const storeCache = async (key, value) => {
  try {
    const jsonValue = JSON.stringify(value);
    await AsyncStorage.setItem(`${PREFIX}${key}`, jsonValue);
  } catch (e) {
    console.warn('Error storing cache:', e);
  }
};

/**
 * Retrieve data from the local cache
 * @param {string} key - Cache key
 * @returns {any} - Parsed data from cache or null if not found
 */
export const getCache = async (key) => {
  try {
    const jsonValue = await AsyncStorage.getItem(`${PREFIX}${key}`);
    return jsonValue != null ? JSON.parse(jsonValue) : null;
  } catch (e) {
    console.warn('Error reading cache:', e);
    return null;
  }
};

/**
 * Clear all cached data
 */
export const clearAllCache = async () => {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter(key => key.startsWith(PREFIX));
    await AsyncStorage.multiRemove(cacheKeys);
  } catch (e) {
    console.warn('Error clearing cache:', e);
  }
};
