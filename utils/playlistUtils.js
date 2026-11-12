// utils/playlistUtils.js
// Safe playlist normalization and lock state calculation [BUG-015]

export const REQUIRED_YOUR13_COUNT = 13;

export function normalizeYour13List(rawList) {
  if (!Array.isArray(rawList)) return [];
  const seenKeys = new Set();
  const deduped = [];

  for (let i = 0; i < rawList.length; i++) {
    const item = rawList[i];
    if (!item || typeof item !== 'object' || !(item.trackId || item.trackName || item.title)) {
      continue;
    }

    const trackName = String(item.trackName ?? item.title ?? 'Unknown Track').trim();
    const artistName = String(item.artistName ?? item.artist ?? 'Unknown Artist').trim();
    const rawId = item.trackId ?? item.id;
    const idKey = rawId ? `id_${String(rawId)}` : '';
    const hasNamedTrack =
      trackName &&
      trackName !== 'Unknown Track' &&
      artistName &&
      artistName !== 'Unknown Artist';
    const sigKey = hasNamedTrack
      ? `sig_${trackName.toLowerCase()}::${artistName.toLowerCase()}`
      : `${trackName.toLowerCase()}::${artistName.toLowerCase()}`;

    if ((idKey && seenKeys.has(idKey)) || (hasNamedTrack && seenKeys.has(sigKey)) || (!idKey && seenKeys.has(sigKey))) {
      continue;
    }
    if (idKey) seenKeys.add(idKey);
    seenKeys.add(sigKey);

    deduped.push({
      ...item,
      trackId: String(rawId ?? `track-${deduped.length}`),
      trackName,
      artistName,
      rank: Number.isFinite(item.rank) ? item.rank : deduped.length + 1,
    });

    if (deduped.length >= REQUIRED_YOUR13_COUNT) {
      break;
    }
  }

  return deduped;
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

