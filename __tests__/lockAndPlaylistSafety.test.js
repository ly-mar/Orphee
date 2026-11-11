// __tests__/lockAndPlaylistSafety.test.js
import { computeLockStateForPlaylist, normalizeYour13List } from '../utils/playlistUtils';

describe('LockContext & Your13 Playlist Normalization [BUG-015]', () => {
  test('locks features when user is null, logged out, or has fewer than 13 valid songs', () => {
    expect(computeLockStateForPlaylist(null, 'user-1')).toEqual({ isLocked: true, count: 0, required: 13 });
    expect(computeLockStateForPlaylist(Array(13).fill({ trackId: '1' }), null)).toEqual({
      isLocked: true,
      count: 0,
      required: 13,
    });
    expect(computeLockStateForPlaylist(Array(5).fill({ trackId: '1' }), 'user-1')).toEqual({
      isLocked: true,
      count: 5,
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
});

