// __tests__/searchAndFeedbackSafety.test.js
import { filterUsersSafely, validateFeedbackPayload } from '../utils/userAndFeedbackUtils';

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
});

describe('Feedback Input Validation & Bounds [BUG-016]', () => {
  test('rejects empty or whitespace-only feedback and bounds oversized input', () => {
    expect(validateFeedbackPayload('   ').ok).toBe(false);
    const huge = 'x'.repeat(5000);
    const valid = validateFeedbackPayload(huge);
    expect(valid.ok).toBe(true);
    expect(valid.text.length).toBeLessThanOrEqual(2000);
  });
});

