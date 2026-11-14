// utils/playlistUtils.js
// Safe playlist normalization and lock state calculation [BUG-015, VR-004]

export const REQUIRED_YOUR13_COUNT = 13;

export function canModifyYour13(isLocked, choicesCount) {
  return !(isLocked && choicesCount >= REQUIRED_YOUR13_COUNT);
}

export function attemptRemoveTrack(playlist, trackId, isLocked) {
  if (isLocked && (playlist?.length ?? 0) >= REQUIRED_YOUR13_COUNT) {
    return { modified: false, playlist: [...(playlist || [])] };
  }
  const filtered = (playlist || []).filter((item) => String(item.trackId) !== String(trackId));
  return { modified: filtered.length !== (playlist?.length ?? 0), playlist: filtered };
}

export function calculateRemainingLockSeconds(startTimeMs, durationSec = 60, nowMs = Date.now()) {
  if (!startTimeMs) return 0;
  const elapsedSec = Math.floor((nowMs - startTimeMs) / 1000);
  const remaining = durationSec - elapsedSec;
  return remaining > 0 ? remaining : 0;
}

export class Your13LockManager {
  constructor({ durationSec = 60, onTick, onExpire } = {}) {
    this.durationSec = durationSec;
    this.isLocked = false;
    this.remainingSeconds = 0;
    this.startTimeMs = null;
    this.intervalId = null;
    this.onTick = onTick;
    this.onExpire = onExpire;
  }

  lock(duration = this.durationSec, nowMs = Date.now()) {
    this.durationSec = duration;
    this.startTimeMs = nowMs;
    this.remainingSeconds = duration;
    this.isLocked = true;
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    this.intervalId = setInterval(() => {
      this.tick();
    }, 1000);
    this.onTick?.(this.remainingSeconds);
  }

  tick(nowMs = Date.now()) {
    if (!this.isLocked) return;
    const remaining = calculateRemainingLockSeconds(this.startTimeMs, this.durationSec, nowMs);
    this.remainingSeconds = remaining;
    if (remaining <= 0) {
      this.isLocked = false;
      if (this.intervalId) {
        clearInterval(this.intervalId);
        this.intervalId = null;
      }
      this.onExpire?.();
    } else {
      this.onTick?.(remaining);
    }
  }

  unlock() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isLocked = false;
    this.remainingSeconds = 0;
    this.startTimeMs = null;
  }
}

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

export function isYour13Confirmed(userDocOrState) {
  if (!userDocOrState || typeof userDocOrState !== 'object') return false;
  const rawList =
    userDocOrState.songs ??
    userDocOrState.your13 ??
    userDocOrState.playlist ??
    (Array.isArray(userDocOrState) ? userDocOrState : []);
  const songs = normalizeYour13List(rawList);
  if (songs.length !== REQUIRED_YOUR13_COUNT) return false;

  return Boolean(
    userDocOrState.your13Confirmed === true ||
    userDocOrState.isLocked === true ||
    userDocOrState.confirmed === true
  );
}

export function canAccessVibeFeatures(songs, isConfirmed) {
  const list = normalizeYour13List(songs);
  return Boolean(list.length === REQUIRED_YOUR13_COUNT && isConfirmed === true);
}

/**
 * Safely appends a candidate track to a user's Your13 playlist [WP-04].
 * Validates lock state, duplicates, and 13-track cap.
 */
export function appendTrackToYour13Safely({ currentList = [], candidateTrack = {}, isLocked = false }) {
  if (isLocked) {
    return { ok: false, reason: 'locked' };
  }

  const normalizedCurrent = normalizeYour13List(currentList);
  if (normalizedCurrent.length >= REQUIRED_YOUR13_COUNT) {
    return { ok: false, reason: 'full' };
  }

  if (!candidateTrack || typeof candidateTrack !== 'object') {
    return { ok: false, reason: 'invalid_track' };
  }

  const candTitle = String(candidateTrack.trackName || candidateTrack.title || '').trim().toLowerCase();
  const candArtist = String(candidateTrack.artistName || candidateTrack.artist || '').trim().toLowerCase();
  const candId = candidateTrack.trackId != null ? String(candidateTrack.trackId).trim() : candidateTrack.id ? String(candidateTrack.id).trim() : null;

  const alreadyExists = normalizedCurrent.some((existing) => {
    const exId = String(existing.trackId || existing.id || '').trim();
    if (candId && exId && exId === candId) return true;
    const exTitle = String(existing.trackName || existing.title || '').trim().toLowerCase();
    const exArtist = String(existing.artistName || existing.artist || '').trim().toLowerCase();
    return exTitle && exArtist && candTitle && candArtist && exTitle === candTitle && exArtist === candArtist;
  });

  if (alreadyExists) {
    return { ok: false, reason: 'duplicate' };
  }

  const newTrack = {
    ...candidateTrack,
    trackId: candId || `track_${Date.now()}`,
    trackName: String(candidateTrack.trackName || candidateTrack.title || 'Unknown Track').trim(),
    artistName: String(candidateTrack.artistName || candidateTrack.artist || 'Unknown Artist').trim(),
    artworkUrl100: candidateTrack.artworkUrl100 || candidateTrack.imageUrl || '',
    previewUrl: candidateTrack.previewUrl || '',
    primaryGenreName: candidateTrack.primaryGenreName || candidateTrack.genre || 'Music',
    rank: normalizedCurrent.length + 1,
  };

  const nextList = [...normalizedCurrent, newTrack];
  return {
    ok: true,
    nextList,
    slotNumber: nextList.length,
    track: newTrack,
  };
}

