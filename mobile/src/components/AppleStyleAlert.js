import React, { useState, useEffect, useContext } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Dimensions, Animated, Easing, Platform } from 'react-native';
import { DeviceEventEmitter } from 'react-native';
import { ThemeContext } from '../context/ThemeContext';

const { width } = Dimensions.get('window');

export default function AppleStyleAlert() {
  const { theme } = useContext(ThemeContext);
  const [visible, setVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState(null);
  
  // Animation value for scaling the alert box (pop in effect)
  const [scaleValue] = useState(new Animated.Value(0.3));
  const [opacityValue] = useState(new Animated.Value(0));

  useEffect(() => {
    const listener = DeviceEventEmitter.addListener('show_apple_alert', (config) => {
      setAlertConfig(config);
      setVisible(true);
      
      Animated.parallel([
        Animated.timing(scaleValue, {
          toValue: 1,
          duration: 200,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacityValue, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        })
      ]).start();
    });

    return () => {
      listener.remove();
    };
  }, []);

  const closeAlert = () => {
    Animated.parallel([
      Animated.timing(scaleValue, {
        toValue: 0.9,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(opacityValue, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      })
    ]).start(() => {
      setVisible(false);
      setAlertConfig(null);
    });
  };

  const handleButtonPress = (button) => {
    closeAlert();
    if (button && typeof button.onPress === 'function') {
      // Add slight delay so modal closes before action happens
      setTimeout(() => {
        button.onPress();
      }, 150);
    }
  };

  if (!visible || !alertConfig) return null;

  // Default to a simple "OK" button if no buttons provided
  const buttons = alertConfig.buttons && alertConfig.buttons.length > 0 
    ? alertConfig.buttons 
    : [{ text: 'OK', onPress: () => {} }];

  const isDark = theme.dark;
  const backgroundColor = isDark ? '#252525' : '#f2f2f2';
  const textColor = isDark ? '#ffffff' : '#000000';
  const messageColor = isDark ? '#aaaaaa' : '#333333';
  const separatorColor = isDark ? '#3a3a3a' : '#dcdcdc';
  
  // Apple style blue
  const actionColor = '#007aff';
  const destructiveColor = '#ff3b30';

  return (
    <Modal
      transparent={true}
      visible={visible}
      animationType="none"
      onRequestClose={closeAlert}
    >
      <View style={styles.overlay}>
        <Animated.View style={[
          styles.alertBox,
          { 
            backgroundColor,
            opacity: opacityValue,
            transform: [{ scale: scaleValue }]
          }
        ]}>
          <View style={styles.contentContainer}>
            {alertConfig.title ? (
              <Text style={[styles.title, { color: textColor }]}>
                {alertConfig.title}
              </Text>
            ) : null}
            
            {alertConfig.message ? (
              <Text style={[styles.message, { color: messageColor, marginTop: alertConfig.title ? 4 : 0 }]}>
                {alertConfig.message}
              </Text>
            ) : null}
          </View>

          {/* Render horizontal buttons if exactly 2, otherwise vertical stack */}
          <View style={[
            styles.buttonsContainer, 
            buttons.length === 2 ? styles.buttonsHorizontal : styles.buttonsVertical,
            { borderTopColor: separatorColor }
          ]}>
            {buttons.map((btn, index) => {
              const isCancel = btn.style === 'cancel';
              const isDestructive = btn.style === 'destructive';
              const isLast = index === buttons.length - 1;

              return (
                <TouchableOpacity
                  key={index}
                  activeOpacity={0.7}
                  onPress={() => handleButtonPress(btn)}
                  style={[
                    styles.button,
                    buttons.length === 2 && !isLast ? { borderRightWidth: 1, borderRightColor: separatorColor } : {},
                    buttons.length > 2 && !isLast ? { borderBottomWidth: 1, borderBottomColor: separatorColor } : {},
                    buttons.length === 2 ? { flex: 1 } : { width: '100%' }
                  ]}
                >
                  <Text style={[
                    styles.buttonText,
                    { color: isDestructive ? destructiveColor : actionColor },
                    isCancel || (buttons.length === 1) ? styles.buttonTextBold : {}
                  ]}>
                    {btn.text}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertBox: {
    width: width * 0.72,
    maxWidth: 320,
    borderRadius: 14,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  contentContainer: {
    padding: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
  },
  message: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  buttonsContainer: {
    borderTopWidth: 1,
  },
  buttonsHorizontal: {
    flexDirection: 'row',
  },
  buttonsVertical: {
    flexDirection: 'column',
  },
  button: {
    paddingVertical: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  buttonText: {
    fontSize: 17,
  },
  buttonTextBold: {
    fontWeight: '600',
  }
});
