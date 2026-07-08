import React, { useState } from 'react';
import { View, StyleSheet, Alert, TouchableOpacity, Text, Dimensions, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { apiClient } from '../../api/client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather } from '@expo/vector-icons';
import { TextInput } from 'react-native';

const screenHeight = Dimensions.get('window').height;

export default function RegisterScreen({ navigation, route }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!name || !phone || !password) {
      Alert.alert('Error', 'Please fill in all fields.');
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.post('/auth/register', { name, phone, password });
      const { token, user } = response.data;
      await AsyncStorage.setItem('token', token);
      await AsyncStorage.setItem('currentUser', JSON.stringify(user));
      // Update app state
      if (route?.params?.setUserToken) {
        route.params.setUserToken(token);
      }
    } catch (error) {
      Alert.alert('Registration Failed', error.response?.data?.error || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        <View style={styles.authHeader}>
          <View style={styles.authLogo}>
            <View style={styles.logoCircleOut}>
              <View style={styles.logoCircleIn} />
            </View>
          </View>
          <Text style={styles.authTitle}>Create Account</Text>
          <Text style={styles.authSubtitle}>Start tracking your expenses today</Text>
        </View>

        <View style={styles.formContainer}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Username</Text>
            <View style={styles.inputWrapper}>
              <Feather name="user" size={20} color="#888888" style={styles.inputIcon} />
              <TextInput
                style={styles.inputElement}
                placeholder="Enter your name"
                placeholderTextColor="#cccccc"
                autoCapitalize="words"
                value={name}
                onChangeText={setName}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Phone Number</Text>
            <View style={styles.inputWrapper}>
              <Feather name="phone" size={20} color="#888888" style={styles.inputIcon} />
              <TextInput
                style={styles.inputElement}
                placeholder="+251 912 345 678"
                placeholderTextColor="#cccccc"
                keyboardType="phone-pad"
                autoCapitalize="none"
                value={phone}
                onChangeText={setPhone}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Password</Text>
            <View style={styles.inputWrapper}>
              <Feather name="lock" size={20} color="#888888" style={styles.inputIcon} />
              <TextInput
                style={styles.inputElement}
                placeholder="Create a password"
                placeholderTextColor="#cccccc"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                <Feather name={showPassword ? "eye" : "eye-off"} size={20} color="#888888" />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity style={[styles.loginBtn, loading && styles.loginBtnDisabled]} onPress={handleRegister} disabled={loading}>
            <Text style={styles.loginBtnText}>{loading ? "Creating Account..." : "Create Account"}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.authFooter}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={styles.footerLink}>Sign In</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollContent: {
    minHeight: screenHeight,
    paddingHorizontal: 25,
    paddingTop: 80,
    paddingBottom: 40,
  },
  authHeader: {
    alignItems: 'center',
    marginBottom: 40,
  },
  authLogo: {
    marginBottom: 20,
  },
  logoCircleOut: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#333333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoCircleIn: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#ffffff',
  },
  authTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#2e2e2e',
    marginBottom: 8,
  },
  authSubtitle: {
    fontSize: 15,
    color: '#888888',
    textAlign: 'center',
  },
  formContainer: {
    marginBottom: 30,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2e2e2e',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: '#f0f0f0',
    borderRadius: 16,
    paddingHorizontal: 15,
    height: 56,
  },
  inputIcon: {
    marginRight: 10,
  },
  inputElement: {
    flex: 1,
    height: '100%',
    fontSize: 16,
    color: '#2e2e2e',
  },
  eyeIcon: {
    padding: 10,
  },
  loginBtn: {
    backgroundColor: '#2e2e2e',
    borderRadius: 16,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  loginBtnDisabled: {
    opacity: 0.7,
  },
  loginBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  authFooter: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 'auto',
    marginBottom: 20,
  },
  footerText: {
    fontSize: 14,
    color: '#888888',
  },
  footerLink: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2e2e2e',
  }
});
