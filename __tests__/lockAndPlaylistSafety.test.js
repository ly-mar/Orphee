// __tests__/lockAndPlaylistSafety.test.js
import {
  computeLockStateForPlaylist,
  normalizeYour13List,
  canModifyYour13,
  attemptRemoveTrack,
  calculateRemainingLockSeconds,
  Your13LockManager,
} from '../utils/playlistUtils';

describe('LockContext & Your13 Playlist Normalization [BUG-015]', () => {
  test('locks features when user is null, logged out, or has fewer than 13 valid songs', () => {
    expect(computeLockStateForPlaylist(null, 'user-1')).toEqual({ isLocked: true, count: 0, required: 13 });
    expect(computeLockStateForPlaylist(Array(13).fill({ trackId: '1' }), null)).toEqual({
      isLocked: true,
      count: 0,
      required: 13,
    });
    const fiveDistinct = Array.from({ length: 5 }, (_, i) => ({ trackId: `t-${i}`, trackName: `Song ${i}` }));
    expect(computeLockStateForPlaylist(fiveDistinct, 'user-1')).toEqual({
      isLocked: true,
      count: 5,
      required: 13,
    });
    expect(computeLockStateForPlaylist(Array(13).fill({ trackId: '1' }), 'user-1')).toEqual({
      isLocked: true,
      count: 1,
      required: 13,
    });
  });

  test('unlocks features when authenticated user has 13 valid songs and deduplicates/filters nulls', () => {
    const valid13 = Array.from({ length: 13 }, (_, i) => ({
      trackId: `id-${i}`,
      trackName: `Song ${i}`,
      artistName: 'Artist',
    }));
    expect(computeLockStateForPlaylist(valid13, 'user-1')).toEqual({
      isLocked: false,
      count: 13,
      required: 13,
    });

    const withNulls = normalizeYour13List([null, undefined, { trackName: 'Track A' }]);
    expect(withNulls).toHaveLength(1);
    expect(withNulls[0].trackName).toBe('Track A');
  });

  test('deduplicates repeated tracks sharing trackId or normalized trackName+artistName [VR-006]', () => {
    const cleaned = normalizeYour13List([
      { trackId: '101', trackName: 'Blinding Lights', artistName: 'The Weeknd' },
      { trackId: '101', trackName: 'Blinding Lights', artistName: 'The Weeknd' },
      { trackId: '999', trackName: 'blinding lights', artistName: 'the weeknd' },
      { trackName: 'NoId Song', artistName: 'Artist X' },
      { trackName: 'noid song', artistName: 'artist x' },
    ]);

    expect(cleaned).toHaveLength(2);
    expect(cleaned[0].trackName).toBe('Blinding Lights');
    expect(cleaned[1].trackName).toBe('NoId Song');
  });

  describe('WP-01: Lock State Machine & Countdown Characterization [VR-004]', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('selecting the 13th track transitions state from open to locked', () => {
      const manager = new Your13LockManager({ durationSec: 60 });
      expect(manager.isLocked).toBe(false);
      expect(canModifyYour13(manager.isLocked, 12)).toBe(true);

      // Transition to locked when 13th track is completed
      manager.lock(60);
      expect(manager.isLocked).toBe(true);
      expect(manager.remainingSeconds).toBe(60);
      expect(canModifyYour13(manager.isLocked, 13)).toBe(false);
    });

    test('while isLocked === true, countdown ticks down to 0 and transitions back to open within ±1s of wall clock', () => {
      const onTick = jest.fn();
      const onExpire = jest.fn();
      const startMs = 1700000000000;
      jest.setSystemTime(startMs);

      const manager = new Your13LockManager({ durationSec: 60, onTick, onExpire });
      manager.lock(60, startMs);

      // Advance by 30 seconds
      jest.advanceTimersByTime(30000);
      expect(manager.isLocked).toBe(true);
      expect(manager.remainingSeconds).toBe(30);
      expect(calculateRemainingLockSeconds(startMs, 60, Date.now())).toBe(30);

      // Advance remaining 30 seconds to expiration
      jest.advanceTimersByTime(30000);
      expect(manager.isLocked).toBe(false);
      expect(manager.remainingSeconds).toBe(0);
      expect(onExpire).toHaveBeenCalledTimes(1);
    });

    test('attempting to remove a track while isLocked === true is blocked without mutating the playlist', () => {
      const playlist = Array.from({ length: 13 }, (_, i) => ({
        trackId: `song-${i}`,
        trackName: `Song ${i}`,
      }));

      // While locked
      const blockedResult = attemptRemoveTrack(playlist, 'song-0', true);
      expect(blockedResult.modified).toBe(false);
      expect(blockedResult.playlist).toHaveLength(13);
      expect(blockedResult.playlist[0].trackId).toBe('song-0');

      // When open / unlocked
      const allowedResult = attemptRemoveTrack(playlist, 'song-0', false);
      expect(allowedResult.modified).toBe(true);
      expect(allowedResult.playlist).toHaveLength(12);
      expect(allowedResult.playlist.find((t) => t.trackId === 'song-0')).toBeUndefined();
    });
  });
});

