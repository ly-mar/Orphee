// utils/homeDashboardUtils.js
// Guards HomeScreen dashboard state derivation against null user docs and sparse playlists [BUG-017]
import { computeLockStateForPlaylist, normalizeYour13List, REQUIRED_YOUR13_COUNT } from './playlistUtils';

export function deriveHomeDashboardState(user, userDoc) {
  const uid = user?.uid ?? null;
  if (!uid) {
    return {
      isAuthenticated: false,
      uid: null,
      displayName: 'Listener',
      your13: [],
      isLocked: true,
      progressCount: 0,
      requiredCount: REQUIRED_YOUR13_COUNT,
    };
  }

  const rawList = userDoc?.your13 ?? userDoc?.songs ?? userDoc?.playlist ?? [];
  const your13 = normalizeYour13List(rawList);
  const lockState = computeLockStateForPlaylist(your13, uid);
  const rawName = String(userDoc?.username ?? userDoc?.displayName ?? user?.displayName ?? '').trim();

  return {
    isAuthenticated: true,
    uid,
    displayName: rawName || 'Listener',
    your13,
    isLocked: lockState.isLocked,
    progressCount: lockState.count,
    requiredCount: lockState.required,
  };
}

