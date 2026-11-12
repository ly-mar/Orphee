// __tests__/searchAndFeedbackSafety.test.js
import {
  filterUsersSafely,
  validateFeedbackPayload,
  buildModerationReportPayload,
} from '../utils/userAndFeedbackUtils';

describe('UserSearchScreen Null-Field & Self-Exclusion Safety [BUG-016]', () => {
  test('does not crash when Firestore user docs have null/undefined username or displayName', () => {
    const users = [
      { id: 'u1', username: null, displayName: undefined },
      { id: 'u2', username: 'OrpheeLover', displayName: 'Marly' },
      { id: 'me', username: 'OrpheeAdmin', displayName: 'Admin' },
    ];

    const matches = filterUsersSafely(users, 'orphee', 'me');
    expect(matches).toHaveLength(1);
    expect(matches[0].id).toBe('u2');
  });

  test('supports case-insensitive lookup, leading @ handles, whitespace reset, and duplicate UIDs [VR-005]', () => {
    const users = [
      { id: 'u1', username: 'Alpha', displayName: 'Alpha Beats' },
      { id: 'u1', username: 'Alpha', displayName: 'Alpha Beats' },
      { id: 'u2', username: 'beta_vibe', displayName: 'Beta' },
    ];

    expect(filterUsersSafely(users, 'alpha')).toHaveLength(1);
    expect(filterUsersSafely(users, '@ALPHA')).toHaveLength(1);
    expect(filterUsersSafely(users, '   ')).toEqual([]);
  });
});

describe('Feedback Input Validation & Bounds [BUG-016]', () => {
  test('rejects empty or whitespace-only feedback and bounds oversized input', () => {
    expect(validateFeedbackPayload('   ').ok).toBe(false);
    const huge = 'x'.repeat(5000);
    const valid = validateFeedbackPayload(huge);
    expect(valid.ok).toBe(true);
    expect(valid.text.length).toBeLessThanOrEqual(2000);
  });

  test('buildModerationReportPayload rejects invalid/self reports and formats valid block reports [VR-011]', () => {
    expect(buildModerationReportPayload({ reporterUid: 'u1', targetUid: 'u1' }).ok).toBe(false);
    expect(buildModerationReportPayload({ reporterUid: '', targetUid: 'u2' }).ok).toBe(false);

    const res = buildModerationReportPayload({
      reporterUid: 'u1',
      targetUid: 'u2',
      targetUsername: 'Spammer',
      reason: 'Harassment',
      alsoBlock: true,
    });
    expect(res.ok).toBe(true);
    expect(res.report).toEqual(
      expect.objectContaining({
        reporterUid: 'u1',
        reportedUid: 'u2',
        reportedUsername: 'Spammer',
        reason: 'Harassment',
        blocked: true,
      })
    );
  });
});

