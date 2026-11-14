// utils/collectiveGrooveUtils.js — Scarcity engine, liner notes, and Crate Radio queue helpers [VR-001, VR-004]

export const MAX_SUBMISSIONS_PER_DROP = 1;
export const MAX_COSIGNS_PER_DROP = 3;
export const MAX_LINER_NOTE_LENGTH = 140;
export const CRATE_RADIO_LIMIT = 13;

/**
 * Validates and sanitizes the optional 1-line "Liner Note" pitch (<= 140 chars).
 * Collapses line breaks, tabs, and excess whitespace into single spaces.
 */
export function sanitizeLinerNote(input = '') {
  if (typeof input !== 'string') return '';
  const collapsed = input.replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
  if (collapsed.length <= MAX_LINER_NOTE_LENGTH) {
    return collapsed;
  }
  return collapsed.slice(0, MAX_LINER_NOTE_LENGTH).trim();
}

/**
 * Normalizes a single track entry inside a Collective theme document,
 * preserving backward compatibility with legacy anonymous song entries.
 */
export function normalizeCollectiveTrack(rawTrack = {}, index = 0) {
  if (!rawTrack || typeof rawTrack !== 'object') {
    return {
      id: `track_${index}`,
      trackId: index,
      trackName: 'Unknown Track',
      artistName: 'Unknown Artist',
      artworkUrl100: null,
      previewUrl: '',
      score: 0,
      curatorUid: null,
      curatorName: 'Community',
      curatorAvatar: null,
      linerNote: '',
      voters: [],
      coSigners: [],
      createdAt: 0,
    };
  }

  const title = String(rawTrack.trackName || rawTrack.title || 'Unknown Track').trim();
  const artist = String(rawTrack.artistName || rawTrack.artist || 'Unknown Artist').trim();
  const rawId = rawTrack.id || rawTrack.trackId || (rawTrack.trackName ? `${title}::${artist}` : `track_${index}`);
  const curatorUid = rawTrack.curatorUid || rawTrack.addedBy || rawTrack.userId || null;
  const rawCuratorName = String(rawTrack.curatorName || rawTrack.curatorUsername || '').trim();
  const curatorName = rawCuratorName || (curatorUid ? 'Listener' : 'Community');
  const score = Math.max(0, Number(rawTrack.score) || 0);

  // Normalize voters array
  let voters = [];
  if (Array.isArray(rawTrack.voters)) {
    voters = Array.from(new Set(rawTrack.voters.map((v) => String(v || '').trim()).filter(Boolean)));
  } else if (rawTrack.userId) {
    voters = [String(rawTrack.userId).trim()];
  }

  // Normalize coSigners array: [{ uid, username, avatar }]
  let coSigners = [];
  if (Array.isArray(rawTrack.coSigners)) {
    coSigners = rawTrack.coSigners
      .map((cs) => {
        if (!cs) return null;
        if (typeof cs === 'string') {
          return { uid: cs, username: cs === curatorUid ? curatorName : 'Listener', avatar: null };
        }
        return {
          uid: cs.uid || cs.id || null,
          username: cs.username || cs.displayName || 'Listener',
          avatar: cs.avatar || cs.avatarUrl || null,
        };
      })
      .filter((cs) => Boolean(cs?.uid));
  } else if (voters.length > 0) {
    coSigners = voters.map((vUid) => ({
      uid: vUid,
      username: vUid === curatorUid ? curatorName : 'Listener',
      avatar: vUid === curatorUid ? rawTrack.curatorAvatar || null : null,
    }));
  }

  return {
    ...rawTrack,
    id: String(rawId),
    trackId: rawTrack.trackId != null ? Number(rawTrack.trackId) || rawTrack.trackId : rawId,
    trackName: title,
    artistName: artist,
    artworkUrl100: rawTrack.artworkUrl100 || rawTrack.imageUrl || null,
    previewUrl: rawTrack.previewUrl || '',
    score,
    curatorUid,
    curatorName,
    curatorAvatar: rawTrack.curatorAvatar || null,
    linerNote: sanitizeLinerNote(rawTrack.linerNote || ''),
    voters,
    coSigners,
    createdAt: rawTrack.createdAt || 0,
  };
}

/**
 * Computes the current user's remaining submission and Co-Sign quotas for a theme.
 * Returns:
 * {
 *   submissionsUsed: number,       // 0 or 1
 *   submissionsRemaining: number,  // 1 or 0
 *   canSubmit: boolean,
 *   coSignsUsed: number,           // 0..3
 *   coSignsRemaining: number,      // 3..0
 *   canCoSign: boolean,
 * }
 */
export function deriveUserDropQuota(tracks = [], currentUid = null) {
  if (!currentUid) {
    return {
      submissionsUsed: 0,
      submissionsRemaining: MAX_SUBMISSIONS_PER_DROP,
      canSubmit: false,
      coSignsUsed: 0,
      coSignsRemaining: MAX_COSIGNS_PER_DROP,
      canCoSign: false,
    };
  }

  const cleanUid = String(currentUid).trim();
  let submissionsUsed = 0;
  let coSignsUsed = 0;

  for (const track of tracks) {
    if (!track) continue;
    const curatorUid = track.curatorUid || track.addedBy || track.userId;
    if (curatorUid && String(curatorUid).trim() === cleanUid) {
      submissionsUsed++;
    }

    const hasVoted =
      (Array.isArray(track.voters) && track.voters.some((v) => String(v).trim() === cleanUid)) ||
      (Array.isArray(track.coSigners) &&
        track.coSigners.some((cs) => {
          const csUid = typeof cs === 'string' ? cs : cs?.uid;
          return csUid && String(csUid).trim() === cleanUid;
        }));

    if (hasVoted) {
      coSignsUsed++;
    }
  }

  const clampedSubmissionsUsed = Math.min(MAX_SUBMISSIONS_PER_DROP, submissionsUsed);
  const submissionsRemaining = Math.max(0, MAX_SUBMISSIONS_PER_DROP - clampedSubmissionsUsed);
  const clampedCoSignsUsed = Math.min(MAX_COSIGNS_PER_DROP, coSignsUsed);
  const coSignsRemaining = Math.max(0, MAX_COSIGNS_PER_DROP - clampedCoSignsUsed);

  return {
    submissionsUsed: clampedSubmissionsUsed,
    submissionsRemaining,
    canSubmit: submissionsRemaining > 0,
    coSignsUsed: clampedCoSignsUsed,
    coSignsRemaining,
    canCoSign: coSignsRemaining > 0,
  };
}

/**
 * Validates whether currentUid can Co-Sign a specific track.
 * Blocks if: !currentUid, already co-signed this track, or coSignsRemaining <= 0.
 */
export function validateCoSignAction(tracks = [], targetTrackKey, currentUid) {
  if (!currentUid) {
    return { allowed: false, reason: 'auth_required' };
  }

  const cleanUid = String(currentUid).trim();
  const cleanKey = String(targetTrackKey ?? '').trim();

  const targetTrack = tracks.find((t) => {
    if (!t) return false;
    const tId = String(t.id ?? '').trim();
    const tTrackId = t.trackId != null ? String(t.trackId).trim() : '';
    return tId === cleanKey || (tTrackId && tTrackId === cleanKey);
  });

  if (targetTrack) {
    const alreadyVoted =
      (Array.isArray(targetTrack.voters) && targetTrack.voters.some((v) => String(v).trim() === cleanUid)) ||
      (Array.isArray(targetTrack.coSigners) &&
        targetTrack.coSigners.some((cs) => {
          const csUid = typeof cs === 'string' ? cs : cs?.uid;
          return csUid && String(csUid).trim() === cleanUid;
        }));

    if (alreadyVoted) {
      return { allowed: false, reason: 'already_cosigned' };
    }
  }

  const quota = deriveUserDropQuota(tracks, cleanUid);
  if (!quota.canCoSign) {
    return { allowed: false, reason: 'quota_reached' };
  }

  return { allowed: true };
}

/**
 * Builds the ordered Top 13 playable queue for "Crate Radio", sorted by score descending.
 */
export function buildCrateRadioQueue(tracks = [], limit = CRATE_RADIO_LIMIT) {
  if (!Array.isArray(tracks)) return [];
  const normalized = tracks.map((t, idx) => normalizeCollectiveTrack(t, idx));
  return normalized
    .sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0))
    .slice(0, Math.max(1, limit));
}

/**
 * Resolves social attribution for a track, including formatted curator handle and
 * stacked mini-avatar profiles of listeners who co-signed it [WP-02].
 */
export function resolveTrackSocialAttribution(track = {}, usersByIdMap = {}) {
  const normalized = normalizeCollectiveTrack(track);
  const curatorUid = normalized.curatorUid;

  let rawCuratorName = normalized.curatorName;
  if (curatorUid && usersByIdMap && usersByIdMap[curatorUid]) {
    const userProfile = usersByIdMap[curatorUid];
    rawCuratorName = userProfile.username || userProfile.displayName || rawCuratorName;
  }

  const cleanName = String(rawCuratorName || '').replace(/^@+/, '').trim() || (curatorUid ? 'Listener' : 'Community');
  const curatorHandle = `@${cleanName}`;

  // Co-signers normalization
  const seenUids = new Set();
  const allCoSigners = [];

  for (const cs of normalized.coSigners) {
    if (!cs?.uid || seenUids.has(cs.uid)) continue;
    seenUids.add(cs.uid);
    const profile = usersByIdMap?.[cs.uid];
    const username = profile?.username || profile?.displayName || cs.username || 'Listener';
    const avatar = profile?.photoURL || profile?.avatar || cs.avatar || null;
    allCoSigners.push({
      uid: cs.uid,
      username: String(username).replace(/^@+/, '').trim(),
      avatar,
    });
  }

  // Also include any voters not in coSigners
  for (const vUid of normalized.voters) {
    if (!vUid || seenUids.has(vUid)) continue;
    seenUids.add(vUid);
    const profile = usersByIdMap?.[vUid];
    const username = profile?.username || profile?.displayName || (vUid === curatorUid ? cleanName : 'Listener');
    const avatar = profile?.photoURL || profile?.avatar || null;
    allCoSigners.push({
      uid: vUid,
      username: String(username).replace(/^@+/, '').trim(),
      avatar,
    });
  }

  const coSignerAvatars = allCoSigners.slice(0, 3);
  const overflowCount = Math.max(0, allCoSigners.length - 3);

  return {
    curatorUid,
    curatorUsername: cleanName,
    curatorHandle,
    coSignerAvatars,
    totalCoSigners: allCoSigners.length,
    overflowCount,
  };
}
