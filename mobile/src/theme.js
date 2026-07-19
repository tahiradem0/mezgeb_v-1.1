import { DefaultTheme } from 'react-native-paper';

export const lightTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#333333',
    primaryLight: '#555555',
    background: '#FAFAFA',
    surface: '#FFFFFF',
    surfaceElevated: '#FFFFFF',
    border: '#EEEEEE',
    textPrimary: '#2e2e2e',
    textSecondary: '#888888',
    textMuted: '#a0a0a0',
    success: '#4CAF50',
    warning: '#FF9800',
    error: '#F44336',
    info: '#2196F3',
    chartPositive: '#8BC34A',
    chartNegative: '#FF7043',
  },
  roundness: 8,
};

export const darkTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#FFFFFF',
    primaryLight: '#E0E0E0',
    background: '#121212',
    surface: '#1E1E1E',
    surfaceElevated: '#2A2A2A',
    border: '#444444',
    textPrimary: '#FFFFFF',
    textSecondary: '#AAAAAA',
    textMuted: '#666666',
    success: '#4CAF50',
    warning: '#FF9800',
    error: '#F44336',
    info: '#2196F3',
    chartPositive: '#8BC34A',
    chartNegative: '#FF7043',
  },
  roundness: 8,
};
