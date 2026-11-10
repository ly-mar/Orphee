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
});

