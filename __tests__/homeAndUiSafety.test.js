// __tests__/homeAndUiSafety.test.js
import { deriveHomeDashboardState } from '../utils/homeDashboardUtils';
import { sanitizeNotificationPrefs } from '../utils/notificationPrefsUtils';
import { PRIVACY_POLICY_TEXT, SECURITY_ROW_LABEL } from '../utils/legalUtils';
import { getActiveTabName } from '../Taskbar';

describe('HomeScreen Dashboard State Resilience [BUG-017]', () => {
  test('returns safe locked default state when user or userDoc is null/undefined', () => {
    const state = deriveHomeDashboardState(null, null);
    expect(state).toEqual({
      isAuthenticated: false,
      isHydrated: false,
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
    expect(state.isHydrated).toBe(true);
    expect(state.displayName).toBe('SonicCurator');
    expect(state.your13).toHaveLength(1);
    expect(state.isLocked).toBe(true);
    expect(state.progressCount).toBe(1);
  });

  test('marks state unhydrated when user is authenticated but userDoc is null [VR-005]', () => {
    const state = deriveHomeDashboardState({ uid: 'u-pending' }, null);
    expect(state.isAuthenticated).toBe(true);
    expect(state.isHydrated).toBe(false);
  });

  test('accepts playlists/{uid} as 3rd argument and resolves username + unlocked state [VR-004]', () => {
    const playlistSongs = Array.from({ length: 13 }, (_, idx) => ({
      trackId: `t-${idx}`,
      trackName: `Track ${idx}`,
      artistName: `Artist ${idx}`,
    }));
    const state = deriveHomeDashboardState(
      { uid: 'u-2', displayName: 'Fallback' },
      { username: 'Sigma' },
      { songs: playlistSongs }
    );

    expect(state.displayName).toBe('Sigma');
    expect(state.your13).toHaveLength(13);
    expect(state.progressCount).toBe(13);
    expect(state.isLocked).toBe(false);
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

describe('Privacy Policy & Legal Text Cleanliness [VR-011]', () => {
  test('contains zero developer guideline annotations and correctly references security menu row', () => {
    expect(PRIVACY_POLICY_TEXT).not.toMatch(/Apple Guideline/i);
    expect(PRIVACY_POLICY_TEXT).not.toMatch(/5\.1\.1/i);
    expect(PRIVACY_POLICY_TEXT).toContain(SECURITY_ROW_LABEL);
    expect(SECURITY_ROW_LABEL).toBe('Security & Account Deletion');
  });
});

describe('Taskbar Active Tab Mapping [VR-013]', () => {
  test('maps TheCollective and ThemeDetails routes to Home tab', () => {
    expect(getActiveTabName('TheCollective')).toBe('Home');
    expect(getActiveTabName('ThemeDetails')).toBe('Home');
    expect(getActiveTabName('Home')).toBe('Home');
    expect(getActiveTabName('Your13')).toBe('Your13');
    expect(getActiveTabName('ProfileScreen')).toBe('ProfileScreen');
    expect(getActiveTabName('')).toBe('ProfileScreen');
  });
});

