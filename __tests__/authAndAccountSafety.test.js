// __tests__/authAndAccountSafety.test.js
import {
  deleteUserAccountSafely,
  mapFirebaseAuthError,
  sanitizeAuthCredentials,
  executeLogoutTeardown,
} from '../utils/authUtils';
import { confirm } from '../crossPlatformAlert';

describe('Account Deletion & Security Settings Safety [BUG-012]', () => {
  test('deletes user Firestore data BEFORE deleting Firebase Auth user while auth token is still valid', async () => {
    const callOrder = [];
    const purgeFirestoreData = jest.fn(async (uid) => {
      callOrder.push(`firestore:${uid}`);
    });
    const deleteAuthUser = jest.fn(async () => {
      callOrder.push('auth:delete');
    });

    const result = await deleteUserAccountSafely({
      user: { uid: 'user-99' },
      purgeFirestoreData,
      deleteAuthUser,
    });

    expect(result.ok).toBe(true);
    expect(callOrder).toEqual(['firestore:user-99', 'auth:delete']);
  });

  test('catches auth/requires-recent-login without crashing and returns actionable re-auth prompt', async () => {
    const recentLoginErr = Object.assign(new Error('Requires recent login'), {
      code: 'auth/requires-recent-login',
    });
    const result = await deleteUserAccountSafely({
      user: { uid: 'user-99' },
      purgeFirestoreData: jest.fn().mockResolvedValue(undefined),
      deleteAuthUser: jest.fn().mockRejectedValue(recentLoginErr),
    });

    expect(result.ok).toBe(false);
    expect(result.requiresReauth).toBe(true);
    expect(result.message).toMatch(/log out and log back in/i);
  });
});

describe('Auth Input Normalization & Error Mapping [BUG-013]', () => {
  test('trims trailing keyboard spaces and lowercases email', () => {
    const creds = sanitizeAuthCredentials({
      email: '  Listener@Orphee.com  ',
      password: 'secretPassword123',
      username: '  SonicTwin_1  ',
    });
    expect(creds.email).toBe('listener@orphee.com');
    expect(creds.username).toBe('SonicTwin_1');
  });

  test('maps raw Firebase Auth error codes to safe user-friendly messages', () => {
    expect(mapFirebaseAuthError({ code: 'auth/invalid-credential' })).toMatch(/incorrect email or password/i);
    expect(mapFirebaseAuthError({ code: 'auth/email-already-in-use' })).toMatch(/already registered/i);
    expect(mapFirebaseAuthError({ code: 'auth/too-many-requests' })).toMatch(/too many attempts/i);
  });
});

describe('Logout Teardown Sequence & Confirmation Resilience [WS-05]', () => {
  test('executes deterministic teardown sequence in exact order', async () => {
    const order = [];
    const audioController = {
      stopQueue: jest.fn(async () => {
        order.push('audio:stopQueue');
      }),
    };
    const clearCache = jest.fn(() => {
      order.push('cache:clear');
    });
    const resetLock = jest.fn(() => {
      order.push('lock:reset');
    });
    const signOutFn = jest.fn(async () => {
      order.push('auth:signOut');
    });
    const navigation = {
      reset: jest.fn(({ routes }) => {
        order.push(`nav:reset:${routes[0].name}`);
      }),
    };

    const res = await executeLogoutTeardown({
      audioController,
      clearCache,
      resetLock,
      signOutFn,
      navigation,
    });

    expect(res.ok).toBe(true);
    expect(order).toEqual([
      'audio:stopQueue',
      'cache:clear',
      'lock:reset',
      'auth:signOut',
      'nav:reset:Welcome',
    ]);
  });

  test('tolerates audio error and cache error without blocking auth signOut', async () => {
    const audioController = {
      stopQueue: jest.fn(() => {
        throw new Error('Audio error');
      }),
    };
    const clearCache = jest.fn(() => {
      throw new Error('Cache error');
    });
    const signOutFn = jest.fn().mockResolvedValue(undefined);
    const navigation = { reset: jest.fn() };

    const res = await executeLogoutTeardown({
      audioController,
      clearCache,
      signOutFn,
      navigation,
    });

    expect(res.ok).toBe(true);
    expect(signOutFn).toHaveBeenCalledTimes(1);
    expect(navigation.reset).toHaveBeenCalledWith({
      index: 0,
      routes: [{ name: 'Welcome' }],
    });
  });

  test('confirm executes onConfirm callback on web and resolves promise', async () => {
    const originalWindow = global.window;
    global.window = {
      confirm: jest.fn(() => true),
    };
    try {
      let callbackFired = false;
      const ok = await confirm({
        title: 'Log Out',
        message: 'Are you sure?',
        onConfirm: () => {
          callbackFired = true;
        },
      });

      expect(global.window.confirm).toHaveBeenCalled();
      expect(ok).toBe(true);
      expect(callbackFired).toBe(true);
    } finally {
      global.window = originalWindow;
    }
  });
});

