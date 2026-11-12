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
});

