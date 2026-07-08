import { DefaultTheme } from 'react-native-paper';

export const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#333333',
    primaryLight: '#555555',
    background: '#FFFFFF',
    surface: '#FFFFFF',
    surfaceElevated: '#FAFAFA',
    border: '#EEEEEE',
    textPrimary: '#333333',
    textSecondary: '#888888',
    textMuted: '#AAAAAA',
    success: '#4CAF50',
    warning: '#FF9800',
    error: '#F44336',
    info: '#2196F3',
    chartPositive: '#8BC34A',
    chartNegative: '#FF7043',
  },
  roundness: 8,
};
