import React, { useState, useEffect, useContext } from 'react';
import { View, StyleSheet, TouchableOpacity, ActivityIndicator, DeviceEventEmitter } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemeContext } from '../context/ThemeContext';

import LoginScreen from '../screens/Auth/LoginScreen';
import RegisterScreen from '../screens/Auth/RegisterScreen';
import DashboardScreen from '../screens/Main/DashboardScreen';
import ExpensesScreen from '../screens/Main/ExpensesScreen';
import GroupsScreen from '../screens/Main/GroupsScreen';
import SettingsScreen from '../screens/Main/SettingsScreen';
import ReportScreen from '../screens/Main/ReportScreen';
import OrdersScreen from '../screens/Main/OrdersScreen';
import ShopAdminScreen from '../screens/Main/ShopAdminScreen';

const MockScreen = () => <View style={{flex:1, backgroundColor:'#FAFAFA'}} />

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

import { Feather } from '@expo/vector-icons';

const CustomTabBarButton = ({ children, onPress, theme }) => (
  <TouchableOpacity
    style={{
      top: -10, // Match translateY(-10px)
      justifyContent: 'center',
      alignItems: 'center',
    }}
    onPress={onPress}
  >
    <View style={{
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: theme.colors.primary,
      elevation: 5,
      shadowColor: '#000',
      shadowOpacity: 0.1,
      shadowOffset: { width: 0, height: 4 },
      shadowRadius: 10,
      justifyContent: 'center',
      alignItems: 'center',
    }}>
      {children}
    </View>
  </TouchableOpacity>
);

function MainTabNavigator() {
  const insets = useSafeAreaInsets();
  const { theme } = useContext(ThemeContext);
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          elevation: 0,
          backgroundColor: theme.colors.surface,
          height: 70 + insets.bottom,
          paddingBottom: insets.bottom,
          borderTopWidth: 1,
          borderTopColor: theme.colors.border,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.05,
          shadowRadius: 20,
        }
      }}
    >
      <Tab.Screen 
        name="Dashboard" 
        component={DashboardScreen} 
        options={{
          tabBarIcon: ({ focused }) => (
            <Feather name="home" color={focused ? theme.colors.textPrimary : theme.colors.textMuted} size={24} />
          ),
        }}
      />
      <Tab.Screen 
        name="Orders" 
        component={OrdersScreen} 
        options={{
          tabBarIcon: ({ focused }) => (
            <Feather name="shopping-bag" color={focused ? theme.colors.textPrimary : theme.colors.textMuted} size={24} />
          ),
        }}
      />
      <Tab.Screen 
        name="Add" 
        component={ExpensesScreen} 
        options={{
          tabBarIcon: ({ focused }) => (
            <Feather name="plus" color={theme.colors.surface} size={28} />
          ),
          tabBarButton: (props) => (
            <CustomTabBarButton {...props} theme={theme} />
          )
        }}
      />
      <Tab.Screen 
        name="Shop" 
        component={ShopAdminScreen} 
        options={{
          tabBarIcon: ({ focused }) => (
            <Feather name="package" color={focused ? theme.colors.textPrimary : theme.colors.textMuted} size={24} />
          ),
        }}
      />
      <Tab.Screen 
        name="Settings" 
        component={SettingsScreen} 
        options={{
          tabBarIcon: ({ focused }) => (
            <Feather name="settings" color={focused ? theme.colors.textPrimary : theme.colors.textMuted} size={24} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const [isLoading, setIsLoading] = useState(true);
  const [userToken, setUserToken] = useState(null);

  useEffect(() => {
    const bootstrapAsync = async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        setUserToken(token);
      } catch (e) {
        setUserToken(null);
      }
      setIsLoading(false);
    };
    bootstrapAsync();

    const logoutListener = DeviceEventEmitter.addListener('logout', () => {
      setUserToken(null);
    });

    const loginListener = DeviceEventEmitter.addListener('login', (token) => {
      setUserToken(token);
    });

    return () => {
      logoutListener.remove();
      loginListener.remove();
    };
  }, []);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {userToken == null ? (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="Main" component={MainTabNavigator} />
            <Stack.Screen name="Reports" component={ReportScreen} />
            <Stack.Screen name="Categories" component={GroupsScreen} />
            <Stack.Screen name="Orders" component={OrdersScreen} />
            <Stack.Screen name="Shop" component={ShopAdminScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
