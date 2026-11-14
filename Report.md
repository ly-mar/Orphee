# Antigravity IDE Execution Plan — Orphee Round 2 Refinement
Target Baseline: commit `006a58c`
Design Tokens: Canvas `#0A0C10`, Card `#151821`, Border `#242936`, Primary Accent `#FF8C00`, Active/Co-Sign `#D4F458`, Text `#FFFFFF` / `#E2E8F0` / `#94A3B8`.

Execute the following 5 workstreams sequentially. Do NOT introduce any scrolling social feed or timeline screen. Run `npx jest --ci --no-watchman` after each workstream.

---

### Workstream 1: Fix `Your13.js` Auto-Submit Bug & Enforce Explicit Confirmation
**Files:** `Your13.js`, `LockContext.js`, `utils/playlistUtils.js`, `__tests__/lockAndPlaylistSafety.test.js`

**Root Cause:**
Selecting the 13th track currently triggers an automatic Firestore write / lock transition inside a `useEffect` watching `songs.length === 13` or inside the track-selection handler in `Your13.js`.

**Implementation Steps:**
1. **Audit & Remove Auto-Submit:**
   - In `Your13.js`, locate any `useEffect` or callback that auto-saves/locks when `selectedSongs.length === 13`.
   - Remove automatic submission when the 13th song is added. Adding the 13th song must only update local/draft state (`draftSongs` or `your13Confirmed: false` in Firestore) and reveal a prominent `#FF8C00` CTA button: **"Confirm & Lock Your13 (13/13)"**.
2. **Explicit Confirmation State (`your13Confirmed`):**
   - In `LockContext.js` and `utils/playlistUtils.js`, add a pure helper `isYour13Confirmed(userDocOrState)` that returns `true` ONLY when:
     - `Array.isArray(songs) && songs.length === 13`
     - AND `isLocked === true` (or `your13Confirmed === true` persisted on the user document in Firestore).
   - When the user explicitly presses **"Confirm & Lock Your13"**, persist the 13 tracks + `your13Confirmed: true` + `lockedAt` timestamp to Firestore (`users/{uid}`), update `LockContext`, and invalidate/update `sessionCache`.
3. **1-Tap Curation Bridge Compatibility:**
   - Ensure `appendTrackToYour13Safely` in `utils/playlistUtils.js` (used by `Pickerchoosers.js`) appends to the draft list up to 13 tracks without silently flipping `your13Confirmed` to `true` until the user confirms on `Your13.js`.

---

### Workstream 2: Gate Vibe Check & Affinity Graph ("Radar") Until All 13 Tracks Are Confirmed
**Files:** `HomeScreen.js`, `RankedUsers.js`, `UserGraph.js`, `utils/playlistUtils.js`, `__tests__/homeAndUiSafety.test.js`

**Implementation Steps:**
1. **Shared Gate Helper:**
   - Export `canAccessVibeFeatures(songs, isConfirmed)` from `utils/playlistUtils.js` -> returns `Boolean(Array.isArray(songs) && songs.length === 13 && isConfirmed === true)`.
2. **`HomeScreen.js` (Orphee Pulse Hub):**
   - Check `canAccessVibeFeatures` using the current user's cached/hydrated Your13 state and `LockContext`.
   - If `false`, render a locked state badge on the **Vibe Check** and **Affinity Graph** cards (e.g., `"Confirm 13/13 tracks in Your13 to unlock"` with a progress pill `X/13 selected • Unconfirmed`).
   - Pressing either card while unconfirmed must show a clean modal/toast or navigate directly to the `Your13` tab with a banner prompting the user to finish and confirm their 13 selections.
3. **Direct Route Guards in `RankedUsers.js` & `UserGraph.js`:**
   - In both screens' self-hydration logic, verify `canAccessVibeFeatures`. If the user has `< 13` songs or hasn't pressed Confirm, render a dedicated Obsidian Dark gate card (`#151821` surface, `#FF8C00` CTA `"Complete & Confirm Your13"`) instead of computing partial affinity scores or rendering an empty radar/graph.

---

### Workstream 3: Holistic Song Memoir Upgrade (No-Feed Integration)
**Files:** `Memoir.js`, `MemoirHistoryScreen.js`, `ProfileScreen.js`, `UserProfileScreen.js`, `__tests__/memoirResilience.test.js`

**Product Goal:**
Differentiate Song Memoir from a generic tweet without building a public feed. Make each Memoir a structured "artifact" tied to listening context, `Your13`, and `The Collective`.

**Implementation Steps:**
1. **Structured Listening Context ("Moment Stamp" & "Golden Line"):**
   - In `Memoir.js`, add a horizontal selector of 5 canonical **Listening Context** pills (`#1E2430` default, `#D4F458` active border/text):
     - `Late Night` • `On Repeat` • `Core Memory` • `Headphones Only` • `Vinyl Crate`
   - Add an optional single-line **"Standout Lyric or Timestamp"** input (max 80 chars, sanitized) alongside the main memoir reflection.
   - Persist `contextTag` and `standoutLine` in the Firestore `memoirs` document and `users/{uid}` latest memoir summary.
2. **Holistic App Bridges (In `Memoir.js` on Save):**
   - **Bridge 1 — Sync to Your13:** Add a toggle pill `"Also pin track to Your13"` (enabled if the track is already in `Your13` or if `Your13` is unlocked with `< 13` songs). If the track is in `Your13`, attach the Memoir's `standoutLine` or a 📖 badge to that track row on `ProfileScreen.js` / `UserProfileScreen.js`.
   - **Bridge 2 — 1-Tap Audio + Memoir Card in `MemoirHistoryScreen.js` & `UserProfileScreen.js`:** Render the `contextTag` pill and italicized `standoutLine` directly on the Memoir card with an inline 30-second play button (`audioPreviewController.js`) so visitors experience the exact song snippet while reading the memory on the user's profile.

---

### Workstream 4: Clean Up `NotifPage.js` Legacy Remnants ("Activity" / "Liked by Me")
**Files:** `NotifPage.js`, `__tests__/homeAndUiSafety.test.js`

**Implementation Steps:**
1. **Remove "Liked by Me":**
   - Delete the `"Liked by Me"` tab, its state branch, and any dead Firestore queries referencing liked posts/feeds in `NotifPage.js`.
2. **Streamline into Canonical Orphee Notifications:**
   - Replace the old `"Activity"` / `"Liked by Me"` tab bar with a clean header and two purposeful filter pills that match current app features:
     - **`All` (Default):** Displays all real notifications from `notifications` collection.
     - **`Co-Signs & Social`:** Filters for Collective Groove Co-Signs (`type === 'cosign'`), friend/Vibe Match requests (`type === 'friend_request'`), and chat pings.
   - If no filter is needed, remove the tab switcher entirely and render a single unified list with a clear empty state (`"No Co-Signs or Vibe Match alerts yet."` on a `#151821` card).

---

### Workstream 5: Fix Broken Logout Button Across Native & Web
**Files:** `SettingsScreen.js`, `WebTestingWrapper.js`, `App.js`, `utils/sessionCache.js`, `audioPreviewController.js`, `__tests__/authAndAccountSafety.test.js`

**Root Cause:**
1. On Web (`react-native-web`), `Alert.alert('Log Out', ..., [{ text: 'Log Out', onPress: ... }])` does not execute multi-button callbacks reliably unless routed through a cross-platform confirmation helper or direct handler.
2. Navigation after `signOut(auth)` either attempts `navigation.replace('Login')` / `navigation.reset(...)` to a route name not mounted in the current authenticated stack, or `onAuthStateChanged` in `App.js` is blocked by stale cache/state.

**Implementation Steps:**
1. **Cross-Platform Confirmation / Direct Sign-Out Handler:**
   - In `SettingsScreen.js`, inspect the Logout button's `onPress`. If it uses `Alert.alert`, replace it with the codebase's cross-platform alert utility (checked in `__tests__/crossPlatformAlert.test.js`) OR execute a deterministic `handleLogout()` with an inline confirmation modal/state so it never silently no-ops on web or mobile.
2. **Deterministic Teardown Sequence:**
   - Inside `handleLogout()` in `SettingsScreen.js` (and any sign-out trigger in `WebTestingWrapper.js`):
     1. Stop any active audio preview: `await audioPreviewController.stopQueue()` (wrapped in `try/catch`).
     2. Clear in-memory SWR cache: `sessionCache.clear()`.
     3. Reset `LockContext` local state if applicable.
     4. Call `await signOut(auth)` from Firebase Auth.
     5. Reset navigation safely: check if `'WelcomeScreen'` or `'LoginScreen'` is in the navigator, or let `App.js`'s `onAuthStateChanged` listener unmount the authenticated stack and fall back to `WelcomeScreen` / `LoginScreen` using `CommonActions.reset`.
3. **Add Regression Test:**
   - In `__tests__/authAndAccountSafety.test.js`, add a unit/integration test verifying that pressing the Logout button in `SettingsScreen.js` invokes `sessionCache.clear()`, stops audio playback, calls Firebase `signOut`, and transitions out of the authenticated view on both native and web platforms.