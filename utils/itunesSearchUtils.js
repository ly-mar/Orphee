// utils/itunesSearchUtils.js
// URL encoding, stale-token / AbortController cancellation, and non-200 / malformed JSON resilience [BUG-014]

export function sanitizeItunesTrack(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const trackId = raw.trackId ?? raw.collectionId ?? `${raw.trackName || 'track'}_${raw.artistName || 'artist'}`;
  return {
    ...raw,
    trackId: String(trackId),
    trackName: String(raw.trackName ?? raw.collectionName ?? 'Unknown Track').trim(),
    artistName: String(raw.artistName ?? 'Unknown Artist').trim(),
    artworkUrl100: typeof raw.artworkUrl100 === 'string' ? raw.artworkUrl100 : null,
    previewUrl: typeof raw.previewUrl === 'string' && /^https?:\/\//i.test(raw.previewUrl) ? raw.previewUrl : null,
  };
}

export function deduplicateTracks(tracks = []) {
  if (!Array.isArray(tracks)) return [];
  const seenIds = new Set();
  const seenSignatures = new Set();
  const unique = [];

  for (const track of tracks) {
    if (!track || typeof track !== 'object') continue;
    const idKey = track.trackId != null ? String(track.trackId) : '';
    const title = String(track.trackName ?? track.title ?? '').trim().toLowerCase();
    const artist = String(track.artistName ?? track.artist ?? '').trim().toLowerCase();
    const sigKey = title && artist ? `${title}::${artist}` : '';

    if ((idKey && seenIds.has(idKey)) || (sigKey && seenSignatures.has(sigKey))) {
      continue;
    }

    if (idKey) seenIds.add(idKey);
    if (sigKey) seenSignatures.add(sigKey);
    unique.push(track);
  }

  return unique;
}

export function createItunesSearchClient({ fetchFn = global.fetch, limit = 25 } = {}) {
  let latestToken = 0;
  let activeController = null;

  async function search(rawQuery) {
    const cleaned = String(rawQuery ?? '').trim();
    if (!cleaned) {
      activeController?.abort?.();
      return [];
    }

    const myToken = ++latestToken;
    activeController?.abort?.();
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    activeController = controller;

    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(cleaned)}&entity=song&limit=${limit}`;

    try {
      const response = await fetchFn(url, controller ? { signal: controller.signal } : {});
      if (myToken !== latestToken) return null;
      if (!response || !response.ok) return [];

      const data = await response.json();
      if (myToken !== latestToken) return null;

      const list = Array.isArray(data?.results) ? data.results : [];
      return deduplicateTracks(list.map(sanitizeItunesTrack).filter(Boolean));
    } catch (err) {
      if (err?.name === 'AbortError' || myToken !== latestToken) return null;
      return [];
    }
  }

  function cancel() {
    latestToken++;
    activeController?.abort?.();
  }

  return { search, cancel };
}

