// utils/userAndFeedbackUtils.js
// Null-safe user search filtering and bounded feedback payload validation [BUG-016]

export const MAX_FEEDBACK_LENGTH = 2000;

export function filterUsersSafely(users = [], rawQuery = '', currentUid = null) {
  if (!Array.isArray(users)) return [];
  const q = String(rawQuery ?? '').trim().replace(/^@+/, '').toLowerCase();
  if (!q) return [];

  const seenUids = new Set();
  return users.filter((u) => {
    if (!u || typeof u !== 'object') return false;
    const uid = u.id ?? u.uid;
    if (currentUid && uid === currentUid) return false;
    if (uid && seenUids.has(uid)) return false;

    const username = String(u.username ?? '').toLowerCase();
    const displayName = String(u.displayName ?? u.name ?? '').toLowerCase();
    const email = String(u.email ?? '').toLowerCase();

    const matched = username.includes(q) || displayName.includes(q) || email.includes(q);
    if (matched && uid) {
      seenUids.add(uid);
    }
    return matched;
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

export function buildModerationReportPayload({
  reporterUid,
  targetUid,
  targetUsername = 'User',
  reason = 'Inappropriate Content / Spam',
  alsoBlock = false,
} = {}) {
  const cleanReporter = String(reporterUid ?? '').trim();
  const cleanTarget = String(targetUid ?? '').trim();
  if (!cleanReporter || !cleanTarget || cleanReporter === cleanTarget) {
    return { ok: false, error: 'Invalid reporter or target user.', report: null };
  }
  return {
    ok: true,
    error: null,
    report: {
      reportedUid: cleanTarget,
      reportedUsername: String(targetUsername || 'User').trim(),
      reporterUid: cleanReporter,
      reason: String(reason || 'Inappropriate Content / Spam').trim(),
      blocked: Boolean(alsoBlock),
      timestamp: new Date().toISOString(),
    },
  };
}

