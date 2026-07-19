import { DeviceEventEmitter } from 'react-native';



class CustomAlertAPI {
  /**
   * Mimics the React Native Alert.alert API
   * @param {string} title - The title of the alert
   * @param {string} message - The message body
   * @param {Array} buttons - Array of button objects [{ text, onPress, style }]
   */
  static alert(title, message, buttons) {
    DeviceEventEmitter.emit('show_apple_alert', { title, message, buttons });
  }
}

export default CustomAlertAPI;
