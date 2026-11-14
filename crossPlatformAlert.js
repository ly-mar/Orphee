// crossPlatformAlert.js — shared in-app Toast & ConfirmDialog with Web Alert polyfill [VR-003]
import { Alert, Platform } from 'react-native';

export const toast = {
  show({ kind = 'info', message, durationMs = 3000 }) {
    if (typeof document !== 'undefined' && document.body && typeof document.createElement === 'function') {
      const existing = document.getElementById('orphee-toast-banner');
      if (existing && existing.parentNode) {
        existing.parentNode.removeChild(existing);
      }

      const el = document.createElement('div');
      el.id = 'orphee-toast-banner';
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');

      const accentColor =
        kind === 'success' ? '#10B981' : kind === 'error' ? '#EF4444' : '#FF8C00';

      Object.assign(el.style, {
        position: 'fixed',
        bottom: '96px',
        left: '50%',
        transform: 'translateX(-50%)',
        backgroundColor: '#151821',
        color: '#FFFFFF',
        border: '1px solid #242936',
        borderLeft: `4px solid ${accentColor}`,
        borderRadius: '12px',
        padding: '12px 18px',
        maxWidth: '380px',
        width: 'calc(100% - 40px)',
        zIndex: '99999',
        boxShadow: '0 10px 28px rgba(0,0,0,0.5)',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '14px',
        lineHeight: '1.4',
        boxSizing: 'border-box',
        pointerEvents: 'none',
      });

      el.textContent = message || '';
      document.body.appendChild(el);
      const timer = setTimeout(() => {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, durationMs);
      if (timer && typeof timer.unref === 'function') {
        timer.unref();
      }
      return;
    }

    if (typeof window !== 'undefined' && typeof window.alert === 'function') {
      window.alert(message || '');
      return;
    }
    Alert.alert('', message);
  },
};

export function confirm({
  title,
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  destructive = true,
  onConfirm,
  onCancel,
}) {
  return new Promise((resolve) => {
    if (typeof document !== 'undefined' && document.body && typeof document.createElement === 'function') {
      const existing = document.getElementById('orphee-confirm-dialog-backdrop');
      if (existing && existing.parentNode) {
        existing.parentNode.removeChild(existing);
      }

      const backdrop = document.createElement('div');
      backdrop.id = 'orphee-confirm-dialog-backdrop';
      backdrop.setAttribute('role', 'dialog');
      backdrop.setAttribute('aria-modal', 'true');
      Object.assign(backdrop.style, {
        position: 'fixed',
        top: '0',
        left: '0',
        right: '0',
        bottom: '0',
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        zIndex: '999999',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        boxSizing: 'border-box',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      });

      const card = document.createElement('div');
      card.id = 'orphee-confirm-dialog-card';
      Object.assign(card.style, {
        backgroundColor: '#151821',
        border: '1px solid #242936',
        borderRadius: '16px',
        padding: '24px',
        width: '100%',
        maxWidth: '380px',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)',
        boxSizing: 'border-box',
      });

      const titleEl = document.createElement('div');
      titleEl.id = 'orphee-confirm-title';
      titleEl.textContent = title || 'Confirm Action';
      Object.assign(titleEl.style, {
        color: '#FFFFFF',
        fontSize: '18px',
        fontWeight: '700',
        marginBottom: '8px',
      });

      const bodyEl = document.createElement('div');
      bodyEl.id = 'orphee-confirm-body';
      bodyEl.textContent = message || '';
      Object.assign(bodyEl.style, {
        color: '#94A3B8',
        fontSize: '14px',
        lineHeight: '1.45',
        marginBottom: '20px',
      });

      const actions = document.createElement('div');
      Object.assign(actions.style, {
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '10px',
      });

      const cancelBtn = document.createElement('button');
      cancelBtn.id = 'orphee-confirm-cancel-btn';
      cancelBtn.textContent = cancelLabel;
      cancelBtn.type = 'button';
      Object.assign(cancelBtn.style, {
        backgroundColor: '#1E2430',
        border: '1px solid #242936',
        color: '#FFFFFF',
        borderRadius: '8px',
        padding: '10px 16px',
        fontSize: '14px',
        fontWeight: '600',
        cursor: 'pointer',
        minHeight: '44px',
        minWidth: '70px',
      });

      const confirmBtn = document.createElement('button');
      confirmBtn.id = 'orphee-confirm-accept-btn';
      confirmBtn.textContent = confirmLabel;
      confirmBtn.type = 'button';
      Object.assign(confirmBtn.style, {
        backgroundColor: destructive ? '#EF4444' : '#FF8C00',
        border: 'none',
        color: '#FFFFFF',
        borderRadius: '8px',
        padding: '10px 18px',
        fontSize: '14px',
        fontWeight: '700',
        cursor: 'pointer',
        minHeight: '44px',
        minWidth: '70px',
      });

      const cleanup = (result) => {
        if (backdrop.parentNode) {
          backdrop.parentNode.removeChild(backdrop);
        }
        if (result && typeof onConfirm === 'function') {
          try {
            onConfirm();
          } catch (_) {}
        } else if (!result && typeof onCancel === 'function') {
          try {
            onCancel();
          } catch (_) {}
        }
        resolve(result);
      };

      cancelBtn.onclick = () => cleanup(false);
      confirmBtn.onclick = () => cleanup(true);

      actions.appendChild(cancelBtn);
      actions.appendChild(confirmBtn);

      card.appendChild(titleEl);
      if (message) card.appendChild(bodyEl);
      card.appendChild(actions);

      backdrop.appendChild(card);
      document.body.appendChild(backdrop);
      return;
    }

    const text = [title, message].filter(Boolean).join('\n\n');
    if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
      const res = Boolean(window.confirm(text));
      if (res && typeof onConfirm === 'function') {
        try {
          onConfirm();
        } catch (_) {}
      } else if (!res && typeof onCancel === 'function') {
        try {
          onCancel();
        } catch (_) {}
      }
      return resolve(res);
    }
    Alert.alert(title, message, [
      {
        text: cancelLabel,
        style: 'cancel',
        onPress: () => {
          if (typeof onCancel === 'function') {
            try {
              onCancel();
            } catch (_) {}
          }
          resolve(false);
        },
      },
      {
        text: confirmLabel,
        style: destructive ? 'destructive' : 'default',
        onPress: () => {
          if (typeof onConfirm === 'function') {
            try {
              onConfirm();
            } catch (_) {}
          }
          resolve(true);
        },
      },
    ]);
  });
}

export function showAlert(title, message, buttons, platformOS = Platform.OS) {
  if (platformOS !== 'web') {
    return Alert.alert(title, message, buttons);
  }

  const text = [title, message].filter(Boolean).join('\n\n');

  if (typeof document !== 'undefined' && document.body && typeof document.createElement === 'function') {
    if (!Array.isArray(buttons) || buttons.length <= 1) {
      toast.show({
        kind: 'info',
        message: text,
      });
      if (Array.isArray(buttons) && buttons.length === 1) {
        buttons[0]?.onPress?.();
      }
      return;
    }

    const cancelBtn = buttons.find((b) => b.style === 'cancel') || buttons[0];
    const confirmBtn = buttons.find((b) => b !== cancelBtn) || buttons[1];
    confirm({
      title: title || 'Notice',
      message: message || '',
      confirmLabel: confirmBtn?.text || 'OK',
      cancelLabel: cancelBtn?.text || 'Cancel',
      destructive: confirmBtn?.style === 'destructive',
    }).then((confirmed) => {
      if (confirmed) {
        confirmBtn?.onPress?.();
      } else {
        cancelBtn?.onPress?.();
      }
    });
    return;
  }

  if (!Array.isArray(buttons) || buttons.length === 0) {
    if (typeof window !== 'undefined' && typeof window.alert === 'function') {
      window.alert(text);
    }
    return;
  }

  if (buttons.length === 1) {
    if (typeof window !== 'undefined' && typeof window.alert === 'function') {
      window.alert(text);
    }
    buttons[0]?.onPress?.();
    return;
  }

  const cancelBtn = buttons.find((b) => b.style === 'cancel') || buttons[0];
  const confirmBtn = buttons.find((b) => b !== cancelBtn) || buttons[1];
  if (typeof window !== 'undefined' && typeof window.confirm === 'function' && window.confirm(text)) {
    confirmBtn?.onPress?.();
  } else {
    cancelBtn?.onPress?.();
  }
}

export function showNonBlockingNotice(title, message, { platformOS = Platform.OS, durationMs = 3000 } = {}) {
  const fullMessage = [title, message].filter(Boolean).join(': ');
  if (platformOS === 'web') {
    return toast.show({ kind: 'info', message: fullMessage, durationMs });
  }
  return Alert.alert(title, message);
}

export function installWebAlertPolyfill() {
  if (Platform.OS === 'web') {
    Alert.alert = (title, message, buttons) => showAlert(title, message, buttons, 'web');
  }
}

