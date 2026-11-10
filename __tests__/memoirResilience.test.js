// __tests__/memoirResilience.test.js — Characterization test for Memoir normalization and storage compatibility [BUG-001]
import { normalizeTrack, getHighResImage } from '../services/musicApi';

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
