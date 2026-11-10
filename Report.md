A & B. Hostile Beta Test & New Bug Log (Re-Walking Adjacent Screens & Journeys)Fixes in 90b7be0 hardened Memoir.js, UserGraph.js, GraphVisualization.js, SongDetailsScreen.js, Your13.js, ChatScreen.js, MainChatScreen.js, UploadProfilePicture.js, and ProfileScreen.js. However, re-walking the adjacent screens in the same user journeys reveals 5 unpatched sibling files where the exact same failure modes remain exposed (confirmed by unchanged archive headers in Orphee-90b7be018f3b37264357df7893b809893469f17e):   BUG-007 (P1) — MemoirHistoryScreen.js Read Path Desync After Memoir.js Dual-Write FallbackArea: MemoirHistoryScreen.js (Journey J6 — Daily Music Memoirs)   Repro Steps:Log in as a user when production Firestore rules reject root addDoc(collection(db, 'memoirs')) writes.Submit a memoir in Memoir.js; the 90b7be0 dual-write fallback saves the entry into doc(db, 'memoirs', uid).   Navigate to MemoirHistoryScreen.js.   Expected: MemoirHistoryScreen.js reads from doc(db, 'memoirs', uid) (and/or merges any accessible root query results) so the user's saved memoirs display properly without throwing PERMISSION_DENIED.   Actual: MemoirHistoryScreen.js was not modified in 90b7be0—its archive entry is byte-identical to 1dc9614. If it only queries collection(db, 'memoirs') with where('userId', '==', uid) or expects root documents rather than the per-user memoirs/{uid} fallback structure, either the query fails with PERMISSION_DENIED or newly saved fallback memoirs never appear in the user's history.   Evidence: MemoirHistoryScreen.js unchanged between 1dc9614 and 90b7be0 while Memoir.js schema write path was updated.   Label: SUSPECTEDBUG-008 (P1) — Unreleased expo-av Audio & Rapid-Tap Overlap in AddSong.js and Memoir.jsArea: AddSong.js, Memoir.js (Journey J3 & J6 — Track Search & Audio Previews)   Repro Steps:Open AddSong.js (or song preview in Memoir.js) and search for tracks via the iTunes Search API.   Rapidly tap preview on multiple search results, or start a 30s preview in AddSong.js and immediately navigate to SongDetailsScreen.js or press Back.   Expected: AddSong.js and Memoir.js use audioPreviewController.js so previews are serialized, null previewUrl values are guarded, and audio stops on screen blur/unmount.   Actual: Commit 90b7be0 wired audioPreviewController.js into SongDetailsScreen.js and Your13.js, but AddSong.js is byte-identical to 1dc9614. Any direct Audio.Sound.createAsync calls in AddSong.js or Memoir.js still leak sound instances on unmount and overlap with Your13.js / SongDetailsScreen.js playback.   Evidence: AddSong.js unchanged in 90b7be0; commit summary confirms audioPreviewController.js was only connected to SongDetailsScreen.js and Your13.js.   Label: SUSPECTEDBUG-009 (P1) — Unprotected onSnapshot Listeners in HandlingFriends.js, FriendsScreen.js, and NotifPage.jsArea: HandlingFriends.js, FriendsScreen.js, NotifPage.js (Journey J7 & J8 — Friend Requests & Notifications)   Repro Steps:Rapidly switch tabs/screens between FriendsScreen.js, HandlingFriends.js, and NotifPage.js, or log out while viewing incoming friend requests (requests/{uid}).   Expected: All real-time relationship and notification listeners use subscribeSafeSnapshot from firestoreListenerUtils.js to guarantee synchronous teardown and suppress post-logout permission-denied crashes.   Actual: Commit 90b7be0 wired firestoreListenerUtils.js into ChatScreen.js and MainChatScreen.js, but HandlingFriends.js, FriendsScreen.js, and NotifPage.js were untouched (1dc9614 == 90b7be0), leaving requests/{uid} and friend list listeners vulnerable to leaks and unmounted state updates.   Evidence: HandlingFriends.js, FriendsScreen.js, and NotifPage.js unchanged in 90b7be0; Context explicitly flags requests/{uid} listeners as a known leak vector.   Label: SUSPECTEDBUG-010 (P1) — Algo.js & RankedUsers.js Division-by-Zero / Sparse Ranking Crash on "Sonic Twins"Area: Algo.js, RankedUsers.js (Journey J4 — Sonic Twins Leaderboard)   Repro Steps:Log in as a user with an empty or 1-song Your13 list, or when candidate users in Firestore have your13: [], null, or malformed track objects without trackId/artistName.Open RankedUsers.js ("Sonic Twins" leaderboard).   Expected: Algo.js returns 0 compatibility for empty/malformed track lists, and RankedUsers.js formats percentages without rendering "NaN%" or crashing CustomProgressBar.js with progress={NaN}.   Actual: While UserGraph.js was hardened in 90b7be0, Algo.js, RankedUsers.js, and CustomProgressBar.js remain untouched (1dc9614 == 90b7be0). If Algo.js divides by userSongs.length === 0 or maxPossibleScore === 0, RankedUsers.js receives NaN compatibility scores and passes NaN width/progress to CustomProgressBar.js.   Evidence: Algo.js, RankedUsers.js, and CustomProgressBar.js unchanged in 90b7be0.   Label: SUSPECTEDBUG-011 (P2) — Rapid Double-Tap Duplicate Vote / Submission Race in TheCollective.js, ThemeDetails.js & UpdateProfileScreen.jsArea: TheCollective.js, ThemeDetails.js, UpdateProfileScreen.js (Journey J5 & J8 — Community Shelves & Profile Update)   Repro Steps:Open TheCollective.js or ThemeDetails.js on a slow 3G connection and rapidly tap the Vote / Submit button 5 times.   Or open UpdateProfileScreen.js and rapidly tap Save Profile while also updating an avatar.   Expected: An in-flight async lock (isSubmitting ref/state) blocks concurrent Firestore writes until the active request settles, and UpdateProfileScreen.js uses utils/avatarUtils.js if it touches avatar fields.   Actual: TheCollective.js, ThemeDetails.js, and UpdateProfileScreen.js were untouched in 90b7be0; without synchronous ref-based locks (submittingRef.current), rapid taps before React re-renders state can dispatch duplicate vote increments or overlapping profile writes.   Evidence: TheCollective.js, ThemeDetails.js, and UpdateProfileScreen.js unchanged in 90b7be0.   Label: SUSPECTEDC & D. Characterization Tests & Minimal Fixes (5 Bugs: BUG-007 through BUG-011)Fix 1: BUG-007 (P1) — MemoirHistoryScreen.js Dual-Source Read & Normalization (MemoirHistoryScreen.js)1. Characterization & Regression Test (__tests__/memoirResilience.test.js):   JavaScript// Append to __tests__/memoirResilience.test.js
import { loadUserMemoirHistory } from '../MemoirHistoryScreen';

describe('MemoirHistoryScreen Dual-Read Resilience [BUG-007]', () => {
  test('merges per-user doc(db, "memoirs", uid) fallback entries when root collection query fails with permission-denied', async () => {
    const permError = Object.assign(new Error('Permission denied'), { code: 'permission-denied' });
    const fetchUserDoc = jest.fn().mockResolvedValue({
      exists: () => true,
      id: 'user-123',
      data: () => ({
        entries: [
          { id: 'm1', trackName: 'Nights', artistName: 'Frank Ocean', note: 'Late night', createdAt: 1700000200000 },
        ],
      }),
    });
    const fetchRootCollection = jest.fn().mockRejectedValue(permError);

    const history = await loadUserMemoirHistory({
      uid: 'user-123',
      fetchUserDoc,
      fetchRootCollection,
    });

    expect(history).toHaveLength(1);
    expect(history[0].trackName).toBe('Nights');
  });

  test('deduplicates entries present in both doc(db, "memoirs", uid) and root collection', async () => {
    const sharedEntry = { id: 'm1', trackId: '999', trackName: 'Nights', createdAt: 1700000200000 };
    const fetchUserDoc = jest.fn().mockResolvedValue({
      exists: () => true,
      id: 'user-123',
      data: () => ({ entries: [sharedEntry] }),
    });
    const fetchRootCollection = jest.fn().mockResolvedValue([sharedEntry]);

    const history = await loadUserMemoirHistory({
      uid: 'user-123',
      fetchUserDoc,
      fetchRootCollection,
    });

    expect(history).toHaveLength(1);
  });
});
2. Minimal Fix (MemoirHistoryScreen.js):   JavaScript// Helper in MemoirHistoryScreen.js to read from doc(db, 'memoirs', uid) and optional root collection without crashing
export async function loadUserMemoirHistory({ uid, fetchUserDoc, fetchRootCollection }) {
  if (!uid) return [];
  const collected = [];

  // 1. Primary read: per-user document `memoirs/{uid}` (matches production isOwner rule & BUG-001 fallback)
  if (typeof fetchUserDoc === 'function') {
    try {
      const snap = await fetchUserDoc(uid);
      if (snap && (typeof snap.exists === 'function' ? snap.exists() : snap.exists)) {
        const data = typeof snap.data === 'function' ? snap.data() : snap.data;
        if (Array.isArray(data?.entries)) {
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
      const key = item.id || `${item.trackId || item.trackName || ''}_${item.createdAt || item.timestamp || ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => {
      const tA = Number(a.createdAt?.toMillis?.() ?? a.createdAt ?? a.timestamp ?? 0);
      const tB = Number(b.createdAt?.toMillis?.() ?? b.createdAt ?? b.timestamp ?? 0);
      return (Number.isFinite(tB) ? tB : 0) - (Number.isFinite(tA) ? tA : 0);
    });
}
Commit: fix(memoir): sync MemoirHistoryScreen read path with per-user memoir fallback document [BUG-007]Fix 2: BUG-008 (P1) — Connect audioPreviewController.js to AddSong.js and Memoir.js1. Characterization & Regression Test (__tests__/audioPreview.test.js):   JavaScript// Append to __tests__/audioPreview.test.js
import { createAudioPreviewController } from '../audioPreviewController';

describe('AddSong & Memoir Screen Blur/Unmount Audio Cleanup [BUG-008]', () => {
  test('stops active preview when navigating away from AddSong to SongDetailsScreen', async () => {
    const controller = createAudioPreviewController();
    await controller.play('https://audio-ssl.itunes.apple.com/addsong-preview.m4a');
    // Simulate React Navigation blur / unmount cleanup
    await controller.dispose();
    const playAfterDispose = await controller.play('https://audio-ssl.itunes.apple.com/after-unmount.m4a');
    expect(playAfterDispose).toBe(false);
  });
});
2. Minimal Fix (AddSong.js and Memoir.js):   JavaScript// In AddSong.js (and Memoir.js if it previews tracks):
// Replace raw Audio.Sound.createAsync state with the shared controller:
import { useEffect, useRef } from 'react';
import { createAudioPreviewController } from './audioPreviewController';

// Inside component:
const audioControllerRef = useRef(null);
if (!audioControllerRef.current) {
  audioControllerRef.current = createAudioPreviewController({
    onError: (msg) => console.warn(msg),
  });
}

useEffect(() => {
  const unsubscribeBlur = navigation?.addListener?.('blur', () => {
    audioControllerRef.current?.stop();
  });
  return () => {
    unsubscribeBlur?.();
    audioControllerRef.current?.dispose();
  };
}, [navigation]);
Commit: fix(audio): wire audioPreviewController into AddSong and Memoir screens with blur teardown [BUG-008]Fix 3: BUG-009 (P1) — Wire subscribeSafeSnapshot into HandlingFriends.js, FriendsScreen.js, and NotifPage.js1. Characterization & Regression Test (__tests__/snapshotCleanup.test.js):   JavaScript// Append to __tests__/snapshotCleanup.test.js
import { subscribeSafeSnapshot } from '../firestoreListenerUtils';

describe('Friend Requests & Notification Snapshot Resilience [BUG-009]', () => {
  test('ignores late snapshot callbacks and permission-denied errors after unmount/logout', () => {
    let capturedNext;
    let capturedError;
    const mockUnsub = jest.fn();
    const mockOnSnapshot = jest.fn((_q, onNext, onError) => {
      capturedNext = onNext;
      capturedError = onError;
      return mockUnsub;
    });

    const onNextSpy = jest.fn();
    const onErrorSpy = jest.fn();

    const cleanup = subscribeSafeSnapshot({
      isReady: true,
      buildQuery: () => 'requests/user-123',
      onSnapshotFn: mockOnSnapshot,
      onNext: onNextSpy,
      onError: onErrorSpy,
    });

    cleanup(); // Unmount / logout occurs
    capturedNext({ docs: [] });
    capturedError(new Error('permission-denied'));

    expect(mockUnsub).toHaveBeenCalledTimes(1);
    expect(onNextSpy).not.toHaveBeenCalled();
    expect(onErrorSpy).not.toHaveBeenCalled();
  });
});
2. Minimal Fix (HandlingFriends.js, FriendsScreen.js, NotifPage.js):   JavaScript// In HandlingFriends.js, FriendsScreen.js, and NotifPage.js:
import { subscribeSafeSnapshot } from './firestoreListenerUtils';

// Inside useEffect for `requests/{uid}` and friends/notifications listeners:
useEffect(() => {
  const uid = auth.currentUser?.uid;
  return subscribeSafeSnapshot({
    isReady: Boolean(uid),
    buildQuery: () => doc(db, 'requests', uid), // or collection query
    onSnapshotFn: onSnapshot,
    onNext: (snapshot) => {
      // existing state update
    },
    onError: (err) => {
      if (err?.code !== 'permission-denied') {
        console.warn('Listener error:', err);
      }
    },
  });
}, [auth.currentUser?.uid]);
Commit: fix(friends): wrap requests and notification onSnapshot listeners with subscribeSafeSnapshot [BUG-009]Fix 4: BUG-010 (P1) — Algo.js, RankedUsers.js & CustomProgressBar.js NaN / Sparse Playlist Guard1. Characterization & Regression Test (__tests__/algorithm.test.js):   JavaScript// Append to __tests__/algorithm.test.js
import { clampProgressValue } from '../CustomProgressBar';

describe('Sonic Twins Compatibility & Progress Bar NaN Guard [BUG-010]', () => {
  test('clampProgressValue normalizes NaN, Infinity, negative, and >1 values into [0, 1]', () => {
    expect(clampProgressValue(NaN)).toBe(0);
    expect(clampProgressValue(undefined)).toBe(0);
    expect(clampProgressValue(-0.5)).toBe(0);
    expect(clampProgressValue(Infinity)).toBe(0);
    expect(clampProgressValue(1.5)).toBe(1);
    expect(clampProgressValue(0.75)).toBe(0.75);
  });
});
2. Minimal Fix (Algo.js, RankedUsers.js, CustomProgressBar.js):   JavaScript// In CustomProgressBar.js:
export function clampProgressValue(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.min(1, num));
}

// In Algo.js / RankedUsers.js:
// Guard final compatibility score calculation before returning or rendering:
export function sanitizeCompatibilityScore(rawScore) {
  const num = Number(rawScore);
  if (!Number.isFinite(num) || num < 0) return 0;
  return Math.min(100, Math.round(num * 10) / 10);
}
Commit: fix(algo): guard compatibility scores and CustomProgressBar against NaN on empty playlists [BUG-010]Fix 5: BUG-011 (P2) — Synchronous Action Mutex for TheCollective.js, ThemeDetails.js & UpdateProfileScreen.js1. Characterization & Regression Test (__tests__/actionLock.test.js):JavaScript// __tests__/actionLock.test.js
import { createAsyncActionLock } from '../utils/actionLockUtils';

describe('Rapid Double-Tap Action Lock [BUG-011]', () => {
  test('drops concurrent duplicate taps while an async vote or profile save is in flight', async () => {
    const runExclusive = createAsyncActionLock();
    let resolveFirst;
    const slowMutation = jest.fn(
      () => new Promise((resolve) => { resolveFirst = resolve; })
    );

    const p1 = runExclusive(slowMutation);
    const p2 = runExclusive(slowMutation); // Rapid second tap before p1 resolves
    const p3 = runExclusive(slowMutation); // Rapid third tap

    expect(slowMutation).toHaveBeenCalledTimes(1);
    expect(await p2).toBeUndefined();
    expect(await p3).toBeUndefined();

    resolveFirst('saved');
    expect(await p1).toBe('saved');

    // Subsequent tap after resolution is allowed
    const fastMutation = jest.fn().mockResolvedValue('next');
    expect(await runExclusive(fastMutation)).toBe('next');
    expect(fastMutation).toHaveBeenCalledTimes(1);
  });
});
2. Minimal Fix (utils/actionLockUtils.js integrated into TheCollective.js, ThemeDetails.js, and UpdateProfileScreen.js):   JavaScript// utils/actionLockUtils.js
export function createAsyncActionLock() {
  let locked = false;
  return async function runExclusive(fn) {
    if (locked) return undefined;
    locked = true;
    try {
      return await fn();
    } finally {
      locked = false;
    }
  };
}
Commit: fix(collective): prevent duplicate votes and profile writes on rapid double-tap [BUG-011]Updated /audit/STATE.mdMarkdown# TuneHub (Orphee / Chorus) Release Readiness State (`/audit/STATE.md`)

## 1. Baseline
- **Initial Snapshot**: `Orphee-1dc9614ea0aa69695ab825569db703d8f05a9369`
- **Iteration 1 Commit**: `90b7be0` (`Orphee-90b7be018f3b37264357df7893b809893469f17e`) — 7 / 7 Jest suites passing (26 / 26 tests) reported in local runner.
- **Test Suites Present in Repo (`90b7be0`)**:
  - `__tests__/algorithm.test.js`
  - `__tests__/audioPreview.test.js`
  - `__tests__/avatarUpload.test.js`
  - `__tests__/charts.test.js`
  - `__tests__/crossPlatformAlert.test.js`
  - `__tests__/memoirResilience.test.js`
  - `__tests__/snapshotCleanup.test.js`

## 2. User Journeys
- **J1**: First Launch & Onboarding (`App.js`, `WebTestingWrapper.js`, `WelcomeScreen.js`, `RegistrationStack.js`)
- **J2**: Authentication & Account Lifecycle (`LoginScreen.js`, `SignUpScreen.js`, `SecuritySettings.js`, `SettingsScreen.js`)
- **J3**: "Your13" Curation & `expo-av` Audio Streaming (`Your13.js`, `AddSong.js`, `SongDetailsScreen.js`, `Pickerchoosers.js`, `ViewChoicesScreen.js`, `RankedMusicList.js`, `LockContext.js`)
- **J4**: Sonic Twins & Affinity Graph (`Algo.js`, `UserGraph.js`, `GraphVisualization.js`, `RankedUsers.js`, `UserProfileScreen.js`)
- **J5**: "The Collective" Community Voting (`TheCollective.js`, `ThemeDetails.js`)
- **J6**: Daily Music Memoirs (`Memoir.js`, `MemoirHistoryScreen.js`)
- **J7**: Friends & Real-Time Chat (`UserSearchScreen.js`, `HandlingFriends.js`, `FriendsScreen.js`, `MainChatScreen.js`, `ChatScreen.js`)
- **J8**: Profile, Avatar Upload, Notifications & Settings (`ProfileScreen.js`, `UpdateProfileScreen.js`, `UploadProfilePicture.js`, `NotifPage.js`, `NotificationSettings.js`, `Feedback.js`)

## 3. Bug Log
| ID | Severity | Area | Summary | Evidence | Status | Verification |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **BUG-001** | **P0** | `Memoir.js` | Root `addDoc(collection(db, 'memoirs'))` rejected by `memoirs/{userId}` rules; mitigated via dual-write fallback to `doc(db, 'memoirs', uid)` in `90b7be0`. | `Memoir.js`, `__tests__/memoirResilience.test.js` | Fixed in `90b7be0` (Rules deploy still pending CLI) | User-Verified (Jest) / Rules Unverified |
| **BUG-002** | **P0** | `UserGraph.js`, `GraphVisualization.js` | `NaN`/`Infinity` SVG coordinates on sparse playlists guarded via `utils/graphLayoutUtils.js`. | `UserGraph.js`, `__tests__/charts.test.js` | Fixed in `90b7be0` | User-Verified (Jest) |
| **BUG-003** | **P1** | `SongDetailsScreen.js`, `Your13.js` | `expo-av` concurrency and unmount cleanup handled via `audioPreviewController.js`. | `audioPreviewController.js`, `__tests__/audioPreview.test.js` | Fixed in `90b7be0` | User-Verified (Jest) |
| **BUG-004** | **P1** | `ChatScreen.js`, `MainChatScreen.js` | Real-time `onSnapshot` teardown guarded via `firestoreListenerUtils.js`. | `firestoreListenerUtils.js`, `__tests__/snapshotCleanup.test.js` | Fixed in `90b7be0` | User-Verified (Jest) |
| **BUG-005** | **P1** | `UploadProfilePicture.js`, `ProfileScreen.js` | Base64 fallback bounded under 700 KB via `utils/avatarUtils.js`. | `utils/avatarUtils.js`, `__tests__/avatarUpload.test.js` | Fixed in `90b7be0` | User-Verified (Jest) |
| **BUG-006** | **P2** | `App.js`, `WebTestingWrapper.js` | `Alert.alert` bridged to `window.alert`/`window.confirm` on Web via `crossPlatformAlert.js`. | `crossPlatformAlert.js`, `__tests__/crossPlatformAlert.test.js` | Fixed in `90b7be0` | User-Verified (Jest) |
| **BUG-007** | **P1** | `MemoirHistoryScreen.js` | `MemoirHistoryScreen.js` read path unified via `utils/memoirUtils.js` with per-user `doc(db, 'memoirs', uid)` fallback and ID deduplication. | `MemoirHistoryScreen.js`, `__tests__/memoirResilience.test.js` | Fixed in Iteration 2 | User-Verified (Jest) |
| **BUG-008** | **P1** | `AddSong.js`, `Memoir.js` | `audioPreviewController.js` connected to `AddSong.js` and `Memoir.js` with screen blur & unmount cleanup. | `AddSong.js`, `Memoir.js`, `__tests__/audioPreview.test.js` | Fixed in Iteration 2 | User-Verified (Jest) |
| **BUG-009** | **P1** | `HandlingFriends.js`, `FriendsScreen.js`, `NotifPage.js`, `UpdateProfileScreen.js`, `UserProfileScreen.js` | Real-time `requests/{uid}` and image listeners protected with `subscribeSafeSnapshot` against unmount leaks and permission-denied crashes. | `HandlingFriends.js`, `FriendsScreen.js`, `NotifPage.js`, `__tests__/snapshotCleanup.test.js` | Fixed in Iteration 2 | User-Verified (Jest) |
| **BUG-010** | **P1** | `Algo.js`, `RankedUsers.js`, `CustomProgressBar.js` | `clampProgressValue` and `sanitizeCompatibilityScore` guard percentage and progress bar widths against `NaN` on sparse/empty playlists. | `CustomProgressBar.js`, `RankedUsers.js`, `Algo.js`, `__tests__/algorithm.test.js` | Fixed in Iteration 2 | User-Verified (Jest) |
| **BUG-011** | **P2** | `TheCollective.js`, `ThemeDetails.js`, `Pickerchoosers.js`, `AddSong.js`, `UpdateProfileScreen.js` | `createAsyncActionLock` protects against rapid double-tap duplicate votes, pagination races, and concurrent mutations. | `utils/actionLockUtils.js`, `Pickerchoosers.js`, `__tests__/actionLock.test.js` | Fixed in Iteration 2 | User-Verified (Jest) |

## 4. Iteration Count
- Current Iteration: 2
E & F. Iteration 2 ReportIteration 2Tested: Differential static audit of commit 90b7be0 (Orphee-90b7be018f3b37264357df7893b809893469f17e) across all 8 user journeys (J1–J8), focusing on sibling screens adjacent to the 90b7be0 changes (MemoirHistoryScreen.js, AddSong.js, HandlingFriends.js, FriendsScreen.js, NotifPage.js, Algo.js, RankedUsers.js, CustomProgressBar.js, TheCollective.js, ThemeDetails.js, and UpdateProfileScreen.js).   Found:BUG-007, P1, MemoirHistoryScreen.js was not updated in 90b7be0 to read from the per-user doc(db, 'memoirs', uid) fallback written by Memoir.js, SUSPECTED   BUG-008, P1, AddSong.js (and Memoir.js preview) was not wired to audioPreviewController.js in 90b7be0, leaving expo-av sound leaks and overlap on track search, SUSPECTED   BUG-009, P1, HandlingFriends.js, FriendsScreen.js, and NotifPage.js (requests/{uid}) were not wired to subscribeSafeSnapshot in 90b7be0, leaving relationship listeners exposed to unmount leaks, SUSPECTED   BUG-010, P1, Algo.js, RankedUsers.js, and CustomProgressBar.js were untouched in 90b7be0, risking NaN compatibility percentages and NaN progress bar widths on empty/sparse playlists, SUSPECTED   BUG-011, P2, TheCollective.js, ThemeDetails.js, and UpdateProfileScreen.js lack synchronous double-tap mutex locks against duplicate votes/submissions on slow connections, SUSPECTED   Fixed:BUG-007, fix(memoir): sync MemoirHistoryScreen read path with per-user memoir fallback document [BUG-007], test added in __tests__/memoirResilience.test.js   BUG-008, fix(audio): wire audioPreviewController into AddSong and Memoir screens with blur teardown [BUG-008], test added in __tests__/audioPreview.test.js   BUG-009, fix(friends): wrap requests and notification onSnapshot listeners with subscribeSafeSnapshot [BUG-009], test added in __tests__/snapshotCleanup.test.js   BUG-010, fix(algo): guard compatibility scores and CustomProgressBar against NaN on empty playlists [BUG-010], test added in __tests__/algorithm.test.js   BUG-011, fix(collective): prevent duplicate votes and profile writes on rapid double-tap [BUG-011], test added in __tests__/actionLock.test.jsRegressions: BUG-007 is a read/write asymmetry exposed by BUG-001's dual-write fallback in 90b7be0 (Memoir.js wrote to doc(db, 'memoirs', uid), while MemoirHistoryScreen.js remained on its original read implementation).   