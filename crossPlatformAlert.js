// crossPlatformAlert.js — patches Alert.alert on Web at app bootstrap in App.js / WebTestingWrapper.js
import { Alert, Platform } from 'react-native';

export function showAlert(title, message, buttons, platformOS = Platform.OS) {
  if (platformOS !== 'web' || typeof window === 'undefined') {
    return Alert.alert(title, message, buttons);
  }

  const text = [title, message].filter(Boolean).join('\n\n');
  if (!Array.isArray(buttons) || buttons.length === 0) {
    if (typeof window.alert === 'function') {
      window.alert(text);
    }
    return;
  }

  if (buttons.length === 1) {
    if (typeof window.alert === 'function') {
      window.alert(text);
    }
    buttons[0]?.onPress?.();
    return;
  }

  const cancelBtn = buttons.find((b) => b.style === 'cancel') || buttons[0];
  const confirmBtn = buttons.find((b) => b !== cancelBtn) || buttons[1];
  if (typeof window.confirm === 'function' && window.confirm(text)) {
    confirmBtn?.onPress?.();
  } else {
    cancelBtn?.onPress?.();
  }
}

export function installWebAlertPolyfill() {
  if (Platform.OS === 'web') {
    Alert.alert = (title, message, buttons) => showAlert(title, message, buttons, 'web');
  }
}

