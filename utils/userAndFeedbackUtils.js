// utils/userAndFeedbackUtils.js
// Null-safe user search filtering and bounded feedback payload validation [BUG-016]

export const MAX_FEEDBACK_LENGTH = 2000;

export function filterUsersSafely(users = [], rawQuery = '', currentUid = null) {
  if (!Array.isArray(users)) return [];
  const q = String(rawQuery ?? '').trim().toLowerCase();
  if (!q) return [];

  return users.filter((u) => {
    if (!u || typeof u !== 'object') return false;
    const uid = u.id ?? u.uid;
    if (currentUid && uid === currentUid) return false;

    const username = String(u.username ?? '').toLowerCase();
    const displayName = String(u.displayName ?? u.name ?? '').toLowerCase();
    const email = String(u.email ?? '').toLowerCase();

    return username.includes(q) || displayName.includes(q) || email.includes(q);
  });
}

export function validateFeedbackPayload(rawText = '') {
  const trimmed = String(rawText ?? '').trim();
  if (!trimmed) {
    return { ok: false, text: '', error: 'Please enter your feedback before submitting.' };
  }
  return {
    ok: true,
    text: trimmed.slice(0, MAX_FEEDBACK_LENGTH),
    error: null,
  };
}

