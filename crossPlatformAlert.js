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

export function showNonBlockingNotice(title, message, { platformOS = Platform.OS, durationMs = 2800 } = {}) {
  if (platformOS !== 'web') {
    return Alert.alert(title, message);
  }
  if (typeof document !== 'undefined' && document.body && typeof document.createElement === 'function') {
    const existing = document.getElementById('tunehub-toast-banner');
    if (existing && existing.parentNode) {
      existing.parentNode.removeChild(existing);
    }
    const el = document.createElement('div');
    el.id = 'tunehub-toast-banner';
    el.setAttribute('role', 'status');
    Object.assign(el.style, {
      position: 'fixed',
      bottom: '96px',
      left: '50%',
      transform: 'translateX(-50%)',
      backgroundColor: '#151821',
      color: '#F8FAFC',
      border: '1px solid #FF8C00',
      borderRadius: '14px',
      padding: '12px 18px',
      maxWidth: '340px',
      width: 'calc(100% - 40px)',
      zIndex: '99999',
      boxShadow: '0 10px 28px rgba(0,0,0,0.45)',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      pointerEvents: 'none',
    });
    const heading = document.createElement('div');
    heading.textContent = title || 'Notice';
    Object.assign(heading.style, { fontWeight: '700', fontSize: '14px', color: '#FF8C00', marginBottom: '2px' });
    const body = document.createElement('div');
    body.textContent = message || '';
    Object.assign(body.style, { fontSize: '13px', color: '#E2E8F0', lineHeight: '1.35' });
    el.appendChild(heading);
    if (message) el.appendChild(body);
    document.body.appendChild(el);
    setTimeout(() => {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, durationMs);
    return;
  }
  return showAlert(title, message, undefined, platformOS);
}

export function installWebAlertPolyfill() {
  if (Platform.OS === 'web') {
    Alert.alert = (title, message, buttons) => showAlert(title, message, buttons, 'web');
  }
}

