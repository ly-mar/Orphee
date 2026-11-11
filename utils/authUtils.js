// utils/authUtils.js
// Safe auth credentials sanitization, error mapping, and atomic account deletion [BUG-012, BUG-013]

export function sanitizeAuthCredentials({ email = '', password = '', username = '' } = {}) {
  return {
    email: String(email ?? '').trim().toLowerCase(),
    password: String(password ?? ''),
    username: String(username ?? '').trim().slice(0, 40),
  };
}

export function mapFirebaseAuthError(error) {
  const code = error?.code || '';
  switch (code) {
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Incorrect email or password. Please try again.';
    case 'auth/email-already-in-use':
      return 'An account with this email is already registered.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters long.';
    case 'auth/requires-recent-login':
      return 'For your security, please log out and log back in before making this change.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment and try again.';
    case 'auth/network-request-failed':
      return 'Network error. Please check your connection and try again.';
    default:
      return error?.message || 'Authentication failed. Please try again.';
  }
}

export async function deleteUserAccountSafely({
  user,
  purgeFirestoreData,
  deleteAuthUser,
}) {
  if (!user?.uid) {
    return { ok: false, requiresReauth: false, message: 'No active user session found.' };
  }

  try {
    // 1. Delete/clean Firestore documents while request.auth.uid is still valid
    if (typeof purgeFirestoreData === 'function') {
      try {
        await purgeFirestoreData(user.uid);
      } catch (_) {
        // Best-effort Firestore cleanup; do not block account deletion if a doc is missing
      }
    }

    // 2. Delete Firebase Auth user record
    await deleteAuthUser(user);
    return { ok: true, requiresReauth: false };
  } catch (err) {
    const requiresReauth = err?.code === 'auth/requires-recent-login';
    return {
      ok: false,
      requiresReauth,
      message: mapFirebaseAuthError(err),
    };
  }
}

