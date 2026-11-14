// utils/homeDashboardUtils.js
// Guards HomeScreen dashboard state derivation against null user docs and sparse playlists [BUG-017]
import { computeLockStateForPlaylist, normalizeYour13List, REQUIRED_YOUR13_COUNT } from './playlistUtils';

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

  return {
    isAuthenticated: true,
    isHydrated,
    uid,
    displayName: rawName || 'Listener',
    your13,
    isLocked: lockState.isLocked,
    progressCount: lockState.count,
    requiredCount: lockState.required,
  };
}

export function deriveVibeMatchPreview(rankedUsers = []) {
  if (Array.isArray(rankedUsers) && rankedUsers.length > 0) {
    const top = rankedUsers[0];
    const rawName = top.username || top.displayName || top.uname;
    if (rawName) {
      const cleanName = String(rawName).replace(/^@/, '');
      const scoreVal = top.similarityScore ?? top.score ?? top.totalScore ?? 0.88;
      const pct = Math.round(Number(scoreVal) * (Number(scoreVal) <= 1 ? 100 : 1));
      return `Top Match: @${cleanName} • ${pct}% Vibe Match`;
    }
  }
  return 'Compare your signature 13 tracks to find your top Vibe Match';
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

