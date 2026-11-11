// utils/playlistUtils.js
// Safe playlist normalization and lock state calculation [BUG-015]

export const REQUIRED_YOUR13_COUNT = 13;

export function normalizeYour13List(rawList) {
  if (!Array.isArray(rawList)) return [];
  return rawList
    .filter((item) => item && typeof item === 'object' && (item.trackId || item.trackName || item.title))
    .slice(0, REQUIRED_YOUR13_COUNT)
    .map((item, index) => ({
      ...item,
      trackId: String(item.trackId ?? item.id ?? `track-${index}`),
      trackName: String(item.trackName ?? item.title ?? 'Unknown Track'),
      artistName: String(item.artistName ?? item.artist ?? 'Unknown Artist'),
      rank: Number.isFinite(item.rank) ? item.rank : index + 1,
    }));
}

export function computeLockStateForPlaylist(rawList, uid, requiredCount = REQUIRED_YOUR13_COUNT) {
  if (!uid) {
    return { isLocked: true, count: 0, required: requiredCount };
  }
  const normalized = normalizeYour13List(rawList);
  return {
    isLocked: normalized.length < requiredCount,
    count: normalized.length,
    required: requiredCount,
  };
}

