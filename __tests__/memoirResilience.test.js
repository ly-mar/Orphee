// __tests__/memoirResilience.test.js — Characterization test for Memoir normalization and storage compatibility [BUG-001, BUG-007]
import { normalizeTrack, getHighResImage } from '../services/musicApi';
import { loadUserMemoirHistory } from '../utils/memoirUtils';

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

describe('MemoirHistoryScreen Dual-Read Resilience [BUG-007]', () => {
  test('merges per-user doc(db, "memoirs", uid) fallback entries when root collection query fails with permission-denied', async () => {
    const permError = Object.assign(new Error('Permission denied'), { code: 'permission-denied' });
    const fetchUserDoc = jest.fn().mockResolvedValue({
      exists: () => true,
      id: 'user-123',
      data: () => ({
        entries: [
          { id: 'm1', trackName: 'Nights', artistName: 'Frank Ocean', note: 'Late night', createdAt: 1700000200000 },
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
