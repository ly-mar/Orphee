// __tests__/authAndAccountSafety.test.js
import {
  deleteUserAccountSafely,
  mapFirebaseAuthError,
  sanitizeAuthCredentials,
} from '../utils/authUtils';

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
      email: '  Listener@TuneHub.com  ',
      password: 'secretPassword123',
      username: '  SonicTwin_1  ',
    });
    expect(creds.email).toBe('listener@tunehub.com');
    expect(creds.username).toBe('SonicTwin_1');
  });

  test('maps raw Firebase Auth error codes to safe user-friendly messages', () => {
    expect(mapFirebaseAuthError({ code: 'auth/invalid-credential' })).toMatch(/incorrect email or password/i);
    expect(mapFirebaseAuthError({ code: 'auth/email-already-in-use' })).toMatch(/already registered/i);
    expect(mapFirebaseAuthError({ code: 'auth/too-many-requests' })).toMatch(/too many attempts/i);
  });
});

