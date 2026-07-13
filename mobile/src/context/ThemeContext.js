import React, { createContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { lightTheme, darkTheme } from '../theme';

export const ThemeContext = createContext({
  isDarkMode: false,
  toggleDarkMode: () => {},
  theme: lightTheme,
});

export const ThemeProvider = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const loadTheme = async () => {
      try {
        const u = await AsyncStorage.getItem('currentUser');
        if (u) {
          const parsed = JSON.parse(u);
          if (parsed.settings && parsed.settings.darkMode !== undefined) {
            setIsDarkMode(parsed.settings.darkMode);
          }
        }
      } catch (e) {
        console.error('Error loading theme:', e);
      } finally {
        setIsLoaded(true);
      }
    };
    loadTheme();
  }, []);

  const toggleDarkMode = async (value) => {
    setIsDarkMode(value);
    // Note: the actual saving to backend and currentUser AsyncStorage is handled in SettingsScreen.js.
    // We just maintain the immediate UI state here.
  };

  const theme = isDarkMode ? darkTheme : lightTheme;

  if (!isLoaded) return null; // Prevent initial flash of incorrect theme

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleDarkMode, theme }}>
      {children}
    </ThemeContext.Provider>
  );
};
