// __tests__/charts.test.js
import { aggregateCommunity13Charts } from '../utils/chartUtils';
import { sanitizeGraphLayout, computeRadialPosition } from '../utils/graphLayoutUtils';

describe('TuneHub Community Charts Engine (13 Songs Model)', () => {
  const user1 = {
    username: 'alice',
    songs: [
      { trackId: 101, trackName: 'Song A', artistName: 'Artist One', primaryGenreName: 'Pop' },
      { trackId: 102, trackName: 'Song B', artistName: 'Artist Two', primaryGenreName: 'R&B/Soul' },
      { trackId: 103, trackName: 'Song C', artistName: 'Artist Three', primaryGenreName: 'Hip-Hop/Rap' },
    ],
  };

  const user2 = {
    username: 'bob',
    songs: [
      { trackId: 102, trackName: 'Song B', artistName: 'Artist Two', primaryGenreName: 'R&B/Soul' },
      { trackId: 103, trackName: 'Song C', artistName: 'Artist Three', primaryGenreName: 'Hip-Hop/Rap' },
      { trackId: 104, trackName: 'Song D', artistName: 'Artist Four', primaryGenreName: 'Rock' },
    ],
  };

  const user3 = {
    username: 'charlie',
    songs: [
      { trackId: 102, trackName: 'Song B', artistName: 'Artist Two', primaryGenreName: 'R&B/Soul' },
      { trackId: 105, trackName: 'Song E', artistName: 'Artist One', primaryGenreName: 'Pop' },
    ],
  };

  test('1. Determines top songs based on each user\'s selections instead of a single daily choice', () => {
    const result = aggregateCommunity13Charts([user1, user2, user3]);

    expect(result.totalCurators).toBe(3);
    expect(result.totalPicks).toBe(8);

    // Song B was chosen by all 3 users -> rank #1 with 3 picks
    expect(result.rankedSongs[0].trackName).toBe('Song B');
    expect(result.rankedSongs[0].count).toBe(3);
    expect(result.rankedSongs[0].curators).toEqual(expect.arrayContaining(['alice', 'bob', 'charlie']));

    // Song C was chosen by 2 users -> rank #2 with 2 picks
    expect(result.rankedSongs[1].trackName).toBe('Song C');
    expect(result.rankedSongs[1].count).toBe(2);

    // Other songs have 1 pick
    const otherSongs = result.rankedSongs.slice(2);
    otherSongs.forEach((song) => {
      expect(song.count).toBe(1);
    });
  });

  test('2. Strictly caps each user\'s contribution to their top 13 songs', () => {
    // Generate 16 songs for a single user
    const excessiveSongs = Array.from({ length: 16 }, (_, i) => ({
      trackId: 1000 + i,
      trackName: `Track ${i + 1}`,
      artistName: 'Artist X',
      primaryGenreName: 'Electronic',
    }));

    const superUser = {
      username: 'heavy_curator',
      songs: excessiveSongs,
    };

    const result = aggregateCommunity13Charts([superUser]);

    // Should only have taken the first 13 songs
    expect(result.totalPicks).toBe(13);
    expect(result.rankedSongs).toHaveLength(13);
    // Song 14, 15, 16 should NOT be in the chart
    expect(result.rankedSongs.find((s) => s.trackId === 1014)).toBeUndefined();
    expect(result.rankedSongs.find((s) => s.trackId === 1015)).toBeUndefined();
  });

  test('3. Prevents duplicate song votes from a single user\'s 13', () => {
    const userWithDuplicates = {
      username: 'repeat_listener',
      songs: [
        { trackId: 201, trackName: 'Same Song', artistName: 'Same Artist', primaryGenreName: 'Pop' },
        { trackId: 201, trackName: 'Same Song', artistName: 'Same Artist', primaryGenreName: 'Pop' },
        { trackId: 202, trackName: 'Other Song', artistName: 'Other Artist', primaryGenreName: 'Pop' },
      ],
    };

    const result = aggregateCommunity13Charts([userWithDuplicates]);
    expect(result.totalPicks).toBe(2);
    const sameSong = result.rankedSongs.find((s) => s.trackName === 'Same Song');
    expect(sameSong.count).toBe(1);
  });

  test('4. Correctly aggregates top artists and genres from users\' 13 choices', () => {
    const result = aggregateCommunity13Charts([user1, user2, user3]);

    // Artist Two appears in Song B (3 picks)
    // Artist One appears in Song A (1 pick) + Song E (1 pick) = 2 picks
    expect(result.rankedArtists[0].name).toBe('Artist Two');
    expect(result.rankedArtists[0].count).toBe(3);

    expect(result.rankedArtists[1].name).toBe('Artist One');
    expect(result.rankedArtists[1].count).toBe(2);

    // Genres: R&B/Soul (3 picks), Pop (2 picks), Hip-Hop/Rap (2 picks), Rock (1 pick)
    expect(result.rankedGenres[0].name).toBe('R&B/Soul');
    expect(result.rankedGenres[0].count).toBe(3);
  });

  test('5. Handles edge cases: null, empty lists, and malformed track entries without errors', () => {
    const emptyResult = aggregateCommunity13Charts([]);
    expect(emptyResult.rankedSongs).toEqual([]);
    expect(emptyResult.totalCurators).toBe(0);
    expect(emptyResult.totalPicks).toBe(0);

    const nullResult = aggregateCommunity13Charts(null);
    expect(nullResult.rankedSongs).toEqual([]);

    const malformedPlaylists = [
      null,
      undefined,
      { username: 'broken1', songs: null },
      { username: 'broken2', songs: [{}] },
      { username: 'broken3', songs: [{ trackName: '', artistName: '' }] },
      { username: 'broken4', songs: [{ trackName: 'Unknown Track', artistName: 'Someone' }] },
      {
        username: 'valid_user',
        songs: {
          0: { trackId: 999, trackName: 'Real Track', artistName: 'Real Artist', primaryGenreName: 'Indie' },
        },
      },
    ];

    const result = aggregateCommunity13Charts(malformedPlaylists);
    expect(result.totalCurators).toBe(1);
    expect(result.rankedSongs).toHaveLength(1);
    expect(result.rankedSongs[0].trackName).toBe('Real Track');
  });
});

describe('Affinity Graph Math & NaN Resilience [BUG-002]', () => {
  test('returns finite center coordinates when playlist or compatibility score is empty/NaN', () => {
    const posEmpty = computeRadialPosition({ score: NaN, index: 0, total: 0, width: 400, height: 400 });
    expect(Number.isFinite(posEmpty.x)).toBe(true);
    expect(Number.isFinite(posEmpty.y)).toBe(true);
    expect(posEmpty).toEqual({ x: 200, y: 200 });
  });

  test('sanitizes d3-force nodes and links with NaN, null, or Infinity coordinates', () => {
    const rawNodes = [
      { id: 'me', x: undefined, y: NaN, radius: NaN },
      { id: 'twin-1', x: Infinity, y: -Infinity, radius: 0 },
    ];
    const rawLinks = [
      { source: { x: NaN, y: 100 }, target: { x: 200, y: undefined } },
    ];

    const { nodes, links } = sanitizeGraphLayout(rawNodes, rawLinks, 360, 640);
    nodes.forEach((n) => {
      expect(Number.isFinite(n.x)).toBe(true);
      expect(Number.isFinite(n.y)).toBe(true);
      expect(n.radius).toBeGreaterThan(0);
    });
    links.forEach((l) => {
      expect(Number.isFinite(l.x1)).toBe(true);
      expect(Number.isFinite(l.y1)).toBe(true);
      expect(Number.isFinite(l.x2)).toBe(true);
      expect(Number.isFinite(l.y2)).toBe(true);
    });
  });
});
