// __tests__/memoirResilience.test.js — Characterization test for Memoir normalization and storage compatibility [BUG-001, BUG-007, WS-03]
import { normalizeTrack, getHighResImage } from '../services/musicApi';
import { loadUserMemoirHistory, LISTENING_CONTEXT_TAGS, sanitizeStandoutLine } from '../utils/memoirUtils';
import { appendTrackToYour13Safely } from '../utils/playlistUtils';

describe('Memoir Data Resilience & Normalization [BUG-001]', () => {
  test('normalizes partial iTunes track payloads into canonical memoir track schema', () => {
    const rawTrack = {
      id: 123456,
      title: 'Midnight City',
      artist: 'M83',
      artworkUrl100: 'https://is1-ssl.mzstatic.com/image/thumb/100x100bb.jpg',
      previewUrl: 'https://audio-ssl.itunes.apple.com/preview.m4a',
      genre: 'Electronic',
    };

    const normalized = normalizeTrack(rawTrack);

    expect(normalized.trackId).toBe(123456);
    expect(normalized.trackName).toBe('Midnight City');
    expect(normalized.artistName).toBe('M83');
    expect(getHighResImage(normalized.artworkUrl100)).toContain('400x400');
    expect(normalized.previewUrl).toBe('https://audio-ssl.itunes.apple.com/preview.m4a');
    expect(normalized.primaryGenreName).toBe('Electronic');
  });

  test('falls back safely when track metadata fields are missing', () => {
    const emptyTrack = {};
    const normalized = normalizeTrack(emptyTrack);

    expect(typeof normalized.trackId).toBe('number');
    expect(normalized.trackName).toBe('Unknown Track');
    expect(normalized.artistName).toBe('Unknown Artist');
    expect(normalized.primaryGenreName).toBe('Music');
    expect(normalized.artworkUrl100).toBe('https://via.placeholder.com/150');
  });
});

describe('Memoir Structured Listening Context & Your13 Bridge [WS-03]', () => {
  test('exports canonical 5 listening context tags', () => {
    expect(LISTENING_CONTEXT_TAGS).toEqual([
      'Late Night',
      'On Repeat',
      'Core Memory',
      'Headphones Only',
      'Vinyl Crate',
    ]);
  });

  test('sanitizes standout lyric or timestamp to max 80 characters', () => {
    const longLyric = 'A'.repeat(120);
    const sanitized = sanitizeStandoutLine(longLyric);
    expect(sanitized.length).toBe(80);
    expect(sanitizeStandoutLine(null)).toBe('');
  });

  test('bridges memoir track to Your13 when under 13 tracks and unlocked', () => {
    const currentList = Array.from({ length: 5 }, (_, i) => ({
      trackId: `t-${i}`,
      trackName: `Song ${i}`,
      artistName: 'Artist',
    }));
    const newTrack = {
      trackId: 't-new',
      trackName: 'Memoir Track',
      artistName: 'Artist X',
      previewUrl: 'https://example.com/audio.m4a',
    };

    const res = appendTrackToYour13Safely({
      currentList,
      candidateTrack: newTrack,
      isLocked: false,
    });

    expect(res.ok).toBe(true);
    expect(res.nextList).toHaveLength(6);
    expect(res.nextList[5].trackName).toBe('Memoir Track');
  });

  test('prevents pinning memoir track to Your13 when locked or full', () => {
    const fullList = Array.from({ length: 13 }, (_, i) => ({
      trackId: `t-${i}`,
      trackName: `Song ${i}`,
      artistName: 'Artist',
    }));
    const newTrack = { trackId: 't-14', trackName: 'Extra', artistName: 'Artist' };

    const resLocked = appendTrackToYour13Safely({
      currentList: [],
      candidateTrack: newTrack,
      isLocked: true,
    });
    expect(resLocked.ok).toBe(false);
    expect(resLocked.reason).toBe('locked');

    const resFull = appendTrackToYour13Safely({
      currentList: fullList,
      candidateTrack: newTrack,
      isLocked: false,
    });
    expect(resFull.ok).toBe(false);
    expect(resFull.reason).toBe('full');
  });
});

describe('MemoirHistoryScreen Dual-Read Resilience [BUG-007]', () => {
  test('merges per-user doc(db, "memoirs", uid) fallback entries when root collection query fails with permission-denied', async () => {
    const permError = Object.assign(new Error('Permission denied'), { code: 'permission-denied' });
    const fetchUserDoc = jest.fn().mockResolvedValue({
      exists: () => true,
      id: 'user-123',
      data: () => ({
        entries: [
          {
            id: 'm1',
            trackName: 'Nights',
            artistName: 'Frank Ocean',
            note: 'Late night',
            contextTag: 'Late Night',
            standoutLine: '02:14 New beginnings',
            createdAt: 1700000200000,
          },
        ],
      }),
    });
    const fetchRootCollection = jest.fn().mockRejectedValue(permError);

    const history = await loadUserMemoirHistory({
      uid: 'user-123',
      fetchUserDoc,
      fetchRootCollection,
    });

    expect(history).toHaveLength(1);
    expect(history[0].trackName).toBe('Nights');
    expect(history[0].contextTag).toBe('Late Night');
    expect(history[0].standoutLine).toBe('02:14 New beginnings');
  });

  test('deduplicates entries present in both doc(db, "memoirs", uid) and root collection', async () => {
    const sharedEntry = { id: 'm1', trackId: '999', trackName: 'Nights', createdAt: 1700000200000 };
    const fetchUserDoc = jest.fn().mockResolvedValue({
      exists: () => true,
      id: 'user-123',
      data: () => ({ entries: [sharedEntry] }),
    });
    const fetchRootCollection = jest.fn().mockResolvedValue([sharedEntry]);

    const history = await loadUserMemoirHistory({
      uid: 'user-123',
      fetchUserDoc,
      fetchRootCollection,
    });

    expect(history).toHaveLength(1);
  });
});
