// __tests__/homeAndUiSafety.test.js
import { deriveHomeDashboardState } from '../utils/homeDashboardUtils';
import { sanitizeNotificationPrefs } from '../utils/notificationPrefsUtils';

describe('HomeScreen Dashboard State Resilience [BUG-017]', () => {
  test('returns safe locked default state when user or userDoc is null/undefined', () => {
    const state = deriveHomeDashboardState(null, null);
    expect(state).toEqual({
      isAuthenticated: false,
      uid: null,
      displayName: 'Listener',
      your13: [],
      isLocked: true,
      progressCount: 0,
      requiredCount: 13,
    });
  });

  test('normalizes partial userDoc and computes accurate unlock progress', () => {
    const rawDoc = {
      username: '  SonicCurator ',
      your13: [
        { trackId: '101', trackName: 'Track 1', artistName: 'Artist 1' },
        null,
        undefined,
      ],
    };
    const state = deriveHomeDashboardState({ uid: 'u-1' }, rawDoc);
    expect(state.isAuthenticated).toBe(true);
    expect(state.displayName).toBe('SonicCurator');
    expect(state.your13).toHaveLength(1);
    expect(state.isLocked).toBe(true);
    expect(state.progressCount).toBe(1);
  });
});

describe('NotificationSettings Preference Normalization [BUG-018]', () => {
  test('coerces missing or non-boolean notification flags to safe boolean defaults', () => {
    const prefs = sanitizeNotificationPrefs({
      friendRequests: 'yes',
      chatMessages: 0,
      dailyMemoirReminder: null,
    });
    expect(prefs).toEqual({
      friendRequests: true,
      chatMessages: false,
      dailyMemoirReminder: false,
      collectiveUpdates: true,
    });
  });
});

