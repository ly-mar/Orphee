// utils/memoirUtils.js — Dual-source memoir reader & deduplication [BUG-007, WS-03]

export const LISTENING_CONTEXT_TAGS = [
  'Late Night',
  'On Repeat',
  'Core Memory',
  'Headphones Only',
  'Vinyl Crate',
];

export function sanitizeStandoutLine(raw) {
  if (typeof raw !== 'string') return '';
  return raw.trim().slice(0, 80);
}

export async function loadUserMemoirHistory({ uid, fetchUserDoc, fetchRootCollection }) {
  if (!uid) return [];
  const collected = [];

  // 1. Primary read: per-user document `memoirs/{uid}` (matches production isOwner rule & BUG-001 fallback)
  if (typeof fetchUserDoc === 'function') {
    try {
      const snap = await fetchUserDoc(uid);
      if (snap && (typeof snap.exists === 'function' ? snap.exists() : snap.exists)) {
        const data = typeof snap.data === 'function' ? snap.data() : snap.data;
        if (Array.isArray(data?.pastMemoirs)) {
          collected.push(...data.pastMemoirs);
        } else if (Array.isArray(data?.entries)) {
          collected.push(...data.entries);
        } else if (Array.isArray(data?.memoirs)) {
          collected.push(...data.memoirs);
        } else if (data && (data.trackName || data.songTitle || data.note || data.text)) {
          collected.push({ id: snap.id || uid, ...data });
        }
      }
    } catch (_) {
      // Fall through to secondary source
    }
  }

  // 2. Secondary read: root collection query (gracefully ignored if rules reject with permission-denied)
  if (typeof fetchRootCollection === 'function') {
    try {
      const rootDocs = await fetchRootCollection(uid);
      if (Array.isArray(rootDocs)) {
        collected.push(...rootDocs);
      }
    } catch (_) {
      // Ignore permission-denied on root collection until Firebase CLI rules are deployed
    }
  }

  // 3. Deduplicate and sort newest-first
  const seen = new Set();
  return collected
    .filter((item) => {
      if (!item || typeof item !== 'object') return false;
      const key = item.id || `${item.trackId || item.item?.trackId || item.trackName || ''}_${item.createdAt || item.timestamp?.seconds || item.timestamp || ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => {
      const getMillis = (val) => {
        if (!val) return 0;
        if (typeof val.toMillis === 'function') return val.toMillis();
        if (val.seconds != null) return val.seconds * 1000;
        const parsed = new Date(val).getTime();
        return Number.isFinite(parsed) ? parsed : 0;
      };
      const tA = getMillis(a.createdAt ?? a.timestamp);
      const tB = getMillis(b.createdAt ?? b.timestamp);
      return (Number.isFinite(tB) ? tB : 0) - (Number.isFinite(tA) ? tA : 0);
    });
}

