// __tests__/itunesSearch.test.js
import { createItunesSearchClient, sanitizeItunesTrack } from '../utils/itunesSearchUtils';

describe('iTunes Search API Resilience [BUG-014]', () => {
  test('properly URL-encodes special characters, accents, and ampersands', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [{ trackId: 1, trackName: 'Déjà Vu', artistName: 'Beyoncé & Jay-Z' }] }),
    });

    const client = createItunesSearchClient({ fetchFn: mockFetch });
    const results = await client.search('Beyoncé & Jay-Z #1');

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('term=Beyonc%C3%A9%20%26%20Jay-Z%20%231'),
      expect.any(Object)
    );
    expect(results).toHaveLength(1);
    expect(results[0].trackName).toBe('Déjà Vu');
  });

  test('discards stale out-of-order search responses when user types rapidly', async () => {
    let resolveFirst;
    const firstPromise = new Promise((r) => { resolveFirst = r; });

    const mockFetch = jest
      .fn()
      .mockImplementationOnce(() => firstPromise)
      .mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({ results: [{ trackId: 2, trackName: 'Harder Better Faster Stronger' }] }),
        })
      );

    const client = createItunesSearchClient({ fetchFn: mockFetch });
    const p1 = client.search('da');
    const p2 = client.search('daft punk');

    const latest = await p2;
    expect(latest[0].trackName).toBe('Harder Better Faster Stronger');

    // Now resolve the slower earlier request
    resolveFirst({
      ok: true,
      json: async () => ({ results: [{ trackId: 1, trackName: 'Stale Result' }] }),
    });
    const stale = await p1;
    expect(stale).toBeNull(); // Explicitly marked superseded
  });

  test('returns empty array instead of crashing on HTTP 503 or malformed non-JSON response', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => { throw new SyntaxError('Unexpected token <'); },
    });

    const client = createItunesSearchClient({ fetchFn: mockFetch });
    const results = await client.search('test');
    expect(results).toEqual([]);
  });
});

