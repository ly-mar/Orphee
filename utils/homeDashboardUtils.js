// utils/homeDashboardUtils.js
// Guards HomeScreen dashboard state derivation against null user docs and sparse playlists [BUG-017]
import {
  computeLockStateForPlaylist,
  normalizeYour13List,
  REQUIRED_YOUR13_COUNT,
  canAccessVibeFeatures,
} from './playlistUtils';
import { getCachedUserProfile } from './sessionCache';

export function deriveHomeDashboardState(user, userDoc, playlistDoc = null) {
  const uid = user?.uid ?? null;
  const isHydrated = Boolean(userDoc !== null && userDoc !== undefined);
  if (!uid) {
    return {
      isAuthenticated: false,
      isHydrated: false,
      uid: null,
      displayName: 'Listener',
      your13: [],
      isLocked: true,
      progressCount: 0,
      requiredCount: REQUIRED_YOUR13_COUNT,
    };
  }

  const rawList =
    playlistDoc?.songs ??
    playlistDoc?.your13 ??
    userDoc?.your13 ??
    userDoc?.songs ??
    userDoc?.playlist ??
    [];
  const your13 = normalizeYour13List(rawList);
  const lockState = computeLockStateForPlaylist(your13, uid);
  const rawName = String(
    userDoc?.displayName ??
    userDoc?.username ??
    playlistDoc?.username ??
    user?.displayName ??
    ''
  ).trim();

  const isConfirmed = Boolean(
    playlistDoc?.your13Confirmed === true ||
    userDoc?.your13Confirmed === true ||
    userDoc?.isLocked === true ||
    playlistDoc?.isLocked === true
  );
  const canAccessVibe = canAccessVibeFeatures(your13, isConfirmed);

  return {
    isAuthenticated: true,
    isHydrated,
    uid,
    displayName: rawName || 'Listener',
    your13,
    isLocked: lockState.isLocked,
    your13Confirmed: isConfirmed,
    canAccessVibe,
    progressCount: lockState.count,
    requiredCount: lockState.required,
  };
}

export function deriveVibeMatchPreview(rankedUsers = [], currentUserId = null) {
  if (!Array.isArray(rankedUsers) || rankedUsers.length === 0) {
    return 'Compare your signature 13 tracks to find your top Vibe Match';
  }

  const cleanCurrentUid = String(currentUserId || '').trim();

  // Find the top match that is not self
  const top =
    rankedUsers.find((u) => {
      if (!u || typeof u !== 'object') return false;
      if (u.isSelf) return false;
      const uKey = String(u.uid || u.uname || '').trim();
      if (cleanCurrentUid && (uKey === cleanCurrentUid || uKey === 'current_user')) {
        return false;
      }
      return true;
    }) || null;

  if (!top) {
    return 'Compare your signature 13 tracks to find your top Vibe Match';
  }

  const candidateKey = String(top.uid || top.uname || '').trim();
  if (top.isSelf || (cleanCurrentUid && candidateKey === cleanCurrentUid)) {
    return 'Compare your signature 13 tracks to find your top Vibe Match';
  }

  const cached = candidateKey ? getCachedUserProfile(candidateKey) : null;
  let rawName =
    top.displayName ||
    top.username ||
    cached?.displayName ||
    cached?.username ||
    top.name ||
    top.uname ||
    '';

  let cleanName = String(rawName).trim().replace(/^@+/, '');

  if (cleanName.startsWith('mock_')) {
    cleanName = cleanName
      .replace(/^mock_/, '')
      .replace(/[_-]+/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .replace(/\s+/g, '');
  } else if (!cleanName || /^[A-Za-z0-9_-]{20,}$/.test(cleanName)) {
    cleanName = 'Listener';
  }

  const scoreVal = top.similarityScore ?? top.score ?? top.totalScore ?? 0.88;
  const pct = Math.round(Number(scoreVal) * (Number(scoreVal) <= 1 ? 100 : 1));
  return `Top Match: @${cleanName} • ${pct}% Vibe Match`;
}

export function deriveTodayMemoirStatus(memoirs = [], now = new Date()) {
  if (!Array.isArray(memoirs) || memoirs.length === 0) {
    return { hasLoggedToday: false, todayMemoir: null };
  }
  const todayStr = now.toISOString().split('T')[0];
  const found = memoirs.find((m) => {
    const rawDate = m?.createdAt || m?.timestamp || m?.date;
    if (!rawDate) return false;
    const str = typeof rawDate === 'string' ? rawDate : new Date(rawDate?.seconds ? rawDate.seconds * 1000 : rawDate).toISOString();
    return str.startsWith(todayStr);
  });
  return {
    hasLoggedToday: Boolean(found),
    todayMemoir: found || null,
  };
}

