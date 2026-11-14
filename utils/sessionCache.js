// utils/sessionCache.js — In-memory synchronous stale-while-revalidate cache [WP-01]

const cache = {
  userProfilesByUid: new Map(),
  userPlaylistsByUid: new Map(),
  memoirsByUid: new Map(),
  collectiveThemes: null,
  homeDashboardByUid: new Map(),
};

export function getCachedUserProfile(uid) {
  if (!uid) return null;
  return cache.userProfilesByUid.get(String(uid)) || null;
}

export function setCachedUserProfile(uid, data) {
  if (!uid || !data) return;
  const existing = cache.userProfilesByUid.get(String(uid)) || {};
  cache.userProfilesByUid.set(String(uid), {
    ...existing,
    ...data,
    updatedAt: Date.now(),
  });
}

export function getCachedUserPlaylist(uid) {
  if (!uid) return null;
  return cache.userPlaylistsByUid.get(String(uid)) || null;
}

export function setCachedUserPlaylist(uid, data) {
  if (!uid || !data) return;
  cache.userPlaylistsByUid.set(String(uid), {
    ...(data || {}),
    updatedAt: Date.now(),
  });
}

export function getCachedMemoirs(uid) {
  if (!uid) return null;
  return cache.memoirsByUid.get(String(uid)) || null;
}

export function setCachedMemoirs(uid, memoirs) {
  if (!uid || !Array.isArray(memoirs)) return;
  cache.memoirsByUid.set(String(uid), [...memoirs]);
}

export function getCachedThemes() {
  return cache.collectiveThemes ? [...cache.collectiveThemes] : null;
}

export function setCachedThemes(themes) {
  if (!Array.isArray(themes)) return;
  cache.collectiveThemes = [...themes];
}

export function getCachedHomeDashboard(uid) {
  if (!uid) return null;
  return cache.homeDashboardByUid.get(String(uid)) || null;
}

export function setCachedHomeDashboard(uid, data) {
  if (!uid || !data) return;
  cache.homeDashboardByUid.set(String(uid), {
    ...(data || {}),
    updatedAt: Date.now(),
  });
}

export function clearSessionCache() {
  cache.userProfilesByUid.clear();
  cache.userPlaylistsByUid.clear();
  cache.memoirsByUid.clear();
  cache.collectiveThemes = null;
  cache.homeDashboardByUid.clear();
}
