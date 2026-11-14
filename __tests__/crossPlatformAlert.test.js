// __tests__/crossPlatformAlert.test.js
import { showAlert } from '../crossPlatformAlert';

describe('Cross-Platform Web Alert Bridge [BUG-006]', () => {
  const originalWindow = global.window;

  afterEach(() => {
    global.window = originalWindow;
  });

  test('uses window.confirm on web when two buttons (Cancel/Confirm) are provided', () => {
    const onCancel = jest.fn();
    const onConfirm = jest.fn();
    global.window = {
      confirm: jest.fn(() => true),
      alert: jest.fn(),
    };

    showAlert(
      'Delete Account',
      'Are you sure?',
      [
        { text: 'Cancel', style: 'cancel', onPress: onCancel },
        { text: 'Delete', style: 'destructive', onPress: onConfirm },
      ],
      'web'
    );

    expect(global.window.confirm).toHaveBeenCalledWith('Delete Account\n\nAre you sure?');
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  test('executes cancel callback when window.confirm is rejected', () => {
    const onCancel = jest.fn();
    const onConfirm = jest.fn();
    global.window = {
      confirm: jest.fn(() => false),
      alert: jest.fn(),
    };

    showAlert(
      'Logout',
      'Do you wish to log out?',
      [
        { text: 'Cancel', style: 'cancel', onPress: onCancel },
        { text: 'Logout', onPress: onConfirm },
      ],
      'web'
    );

    expect(global.window.confirm).toHaveBeenCalledWith('Logout\n\nDo you wish to log out?');
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  test('uses window.alert on web for single button alerts and executes callback', () => {
    const onOk = jest.fn();
    global.window = {
      confirm: jest.fn(),
      alert: jest.fn(),
    };

    showAlert(
      'Success',
      'Saved successfully!',
      [{ text: 'OK', onPress: onOk }],
      'web'
    );

    expect(global.window.alert).toHaveBeenCalledWith('Success\n\nSaved successfully!');
    expect(onOk).toHaveBeenCalledTimes(1);
  });

  test('uses window.alert for message-only alerts', () => {
    global.window = {
      confirm: jest.fn(),
      alert: jest.fn(),
    };

    showAlert('Notice', 'Information note', null, 'web');
    expect(global.window.alert).toHaveBeenCalledWith('Notice\n\nInformation note');
  });

  describe('WP-02: In-App Toast & ConfirmDialog DOM Host [VR-003]', () => {
    let originalDocument;
    let mockBody;
    let elements;

    beforeEach(() => {
      originalDocument = global.document;
      elements = new Map();
      mockBody = {
        appendChild: jest.fn((el) => {
          if (el.id) elements.set(el.id, el);
          el.parentNode = mockBody;
        }),
        removeChild: jest.fn((el) => {
          if (el.id) elements.delete(el.id);
          el.parentNode = null;
        }),
      };
      global.document = {
        body: mockBody,
        createElement: jest.fn((tag) => {
          const el = {
            tagName: tag.toUpperCase(),
            style: {},
            attributes: {},
            children: [],
            textContent: '',
            setAttribute: (k, v) => {
              el.attributes[k] = v;
            },
            getAttribute: (k) => el.attributes[k] || null,
            appendChild: (child) => {
              el.children.push(child);
              child.parentNode = el;
              if (child.id) elements.set(child.id, child);
            },
            removeChild: (child) => {
              el.children = el.children.filter((c) => c !== child);
              child.parentNode = null;
              if (child.id) elements.delete(child.id);
            },
            click: () => {
              el.onclick?.();
            },
          };
          return el;
        }),
        getElementById: jest.fn((id) => elements.get(id) || null),
      };
    });

    afterEach(() => {
      global.document = originalDocument;
    });

    test('toast.show renders an in-app banner with status role and polite live region', () => {
      const { toast } = require('../crossPlatformAlert');
      toast.show({ kind: 'success', message: 'Friend request sent to Sam.' });

      const toastEl = global.document.getElementById('orphee-toast-banner');
      expect(toastEl).not.toBeNull();
      expect(toastEl.getAttribute('role')).toBe('status');
      expect(toastEl.getAttribute('aria-live')).toBe('polite');
      expect(toastEl.textContent).toContain('Friend request sent to Sam.');
      expect(toastEl.style.backgroundColor).toBe('#151821');
    });

    test('confirm renders an obsidian modal with explicit Delete confirmLabel and resolves true on click', async () => {
      const { confirm } = require('../crossPlatformAlert');
      const promise = confirm({
        title: 'Delete Song Memoir?',
        message: 'This will permanently remove this memoir from your profile.',
        confirmLabel: 'Delete',
        cancelLabel: 'Cancel',
        destructive: true,
      });

      const backdrop = global.document.getElementById('orphee-confirm-dialog-backdrop');
      expect(backdrop).not.toBeNull();
      expect(backdrop.getAttribute('role')).toBe('dialog');

      const confirmBtn = global.document.getElementById('orphee-confirm-accept-btn');
      expect(confirmBtn).not.toBeNull();
      expect(confirmBtn.textContent).toBe('Delete');
      expect(confirmBtn.textContent).not.toBe('OK');

      const cancelBtn = global.document.getElementById('orphee-confirm-cancel-btn');
      expect(cancelBtn.textContent).toBe('Cancel');

      // Click confirm
      confirmBtn.click();
      const result = await promise;
      expect(result).toBe(true);
      expect(global.document.getElementById('orphee-confirm-dialog-backdrop')).toBeNull();
    });

    test('confirm resolves false when cancel button is clicked', async () => {
      const { confirm } = require('../crossPlatformAlert');
      const promise = confirm({
        title: 'Delete Song Memoir?',
        message: 'Are you sure?',
        confirmLabel: 'Delete',
        cancelLabel: 'Cancel',
      });

      const cancelBtn = global.document.getElementById('orphee-confirm-cancel-btn');
      cancelBtn.click();
      const result = await promise;
      expect(result).toBe(false);
      expect(global.document.getElementById('orphee-confirm-dialog-backdrop')).toBeNull();
    });
  });
});

