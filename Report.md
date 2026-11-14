# Actionable Engineering Specification: "The Collective Groove" Upgrade (Antigravity IDE)

This specification upgrades **The Collective** (`TheCollective.js`, `ThemeDetails.js`, `Pickerchoosers.js`, `AddSong.js`) from an anonymous, unbounded playlist list into a scarce, socially attributable, and continuously playable curation loop.

---

## 0. Execution Guardrails & Verification Gate

* **Characterization-First Workflow:** Before modifying screen components, implement and unit-test pure state/validation helpers in `utils/collectiveGrooveUtils.js` and `__tests__/collectiveGroove.test.js`.
* **Dual-Shelf Parity:** The codebase routes Collective themes through both `ThemeDetails.js` and `Pickerchoosers.js`. Every UI and data-model upgrade below must be applied consistently to both screens (or extracted into a shared sub-component imported by both) so behavior never diverges based on entry route.


* **Backward Compatibility:** Existing Firestore `themes/{themeId}` track entries lack `curatorUid`, `curatorName`, `linerNote`, and `coSigners`. All helpers must gracefully fall back for legacy tracks (`curatorName: 'Community'`, `linerNote: ''`, `coSigners: []`).
* **Standard Verification Gate (Run After Every WP):**
```bash
npx jest --ci --no-watchman   # Expect 15/15 suites passing with 0 failures
npx expo export --platform web --output-dir /tmp/tubeapp-web-check # Expect exit code 0

```



---

## 1. Shared Data Schema & Pure Helpers (`utils/collectiveGrooveUtils.js`)

Create `utils/collectiveGrooveUtils.js` to centralize constants, quota validation, liner-note sanitization, and Crate Radio queue logic:

```javascript
export const MAX_SUBMISSIONS_PER_DROP = 1;
export const MAX_COSIGNS_PER_DROP = 3;
export const MAX_LINER_NOTE_LENGTH = 140;
export const CRATE_RADIO_LIMIT = 13;

/**
 * Normalizes a single track entry inside a Collective theme document,
 * preserving backward compatibility with legacy anonymous song entries.
 */
export function normalizeCollectiveTrack(rawTrack, index = 0) { ... }

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
export function deriveUserDropQuota(tracks = [], currentUid = null) { ... }

/**
 * Validates and sanitizes the optional 1-line "Liner Note" pitch (<= 140 chars).
 * Strips line breaks and trims excess whitespace.
 */
export function sanitizeLinerNote(input = '') { ... }

/**
 * Validates whether currentUid can Co-Sign a specific track.
 * Blocks if: !currentUid, already co-signed this track, or coSignsRemaining <= 0.
 */
export function validateCoSignAction(tracks = [], targetTrackKey, currentUid) { ... }

/**
 * Builds the ordered Top 13 playable queue for "Crate Radio", sorted by votes descending.
 */
export function buildCrateRadioQueue(tracks = [], limit = CRATE_RADIO_LIMIT) { ... }

```

---

## 2. Atomic Work Packages (Execute One Per Commit)

### WP-01: Scarcity Engine (1 Submission + 3 Co-Signs Quota) & 140-Char "Liner Note" Pitch

* **Goal:** Enforce a strict per-theme budget of **1 track nomination** and **3 upvotes ("Co-Signs")** per user, and let nominators attach a 140-character "Liner Note" pitch in `AddSong.js` that renders under the track title in `ThemeDetails.js` and `Pickerchoosers.js`.


* **Files to Touch:**
* `utils/collectiveGrooveUtils.js` *(new)*
* `AddSong.js`


* `ThemeDetails.js`


* `Pickerchoosers.js`


* `__tests__/collectiveGroove.test.js` *(new)*


* **Implementation Steps:**
1. **Unit Tests (`__tests__/collectiveGroove.test.js`):**
* Verify `deriveUserDropQuota` counts tracks where `track.curatorUid === currentUid` (max 1) and tracks where `track.voters` / `track.coSigners` includes `currentUid` (max 3).
* Verify `sanitizeLinerNote` collapses newlines to spaces, trims whitespace, and clamps length to `140` characters.
* Verify `validateCoSignAction` returns `{ allowed: false, reason: 'quota_reached' }` when the user has already used all 3 Co-Signs on a theme, and `{ allowed: false, reason: 'already_cosigned' }` on duplicate taps.


2. Liner Note Input & 1-Submission Guard in `AddSong.js`:


* Above the search/results list (or in a confirmation bar when a song is selected), render a dark input field (`backgroundColor: '#151821'`, `borderColor: '#242936'`):
* Placeholder: `"Add a liner note pitch (e.g., 'Wait for the bassline switch at 1:42')..."`
* `maxLength={140}` with a live counter pill (`"${linerNote.length}/140"`).


* Before writing the track to Firestore `themes/{themeId}`, check `deriveUserDropQuota(themeTracks, currentUid)`:
* If `!canSubmit`, block the write and trigger `toast.show({ kind: 'info', message: 'You already nominated 1 track for this drop.' })`.


* Persist metadata on the newly nominated track object:
```javascript
{
  ...songData,
  curatorUid: currentUid,
  curatorName: currentUserDisplayName, // e.g., 'Sigma'
  curatorAvatar: currentUserAvatarUrl || null,
  linerNote: sanitizeLinerNote(linerNote),
  voters: [currentUid], // Nominator automatically co-signs or starts at 1
  coSigners: [{ uid: currentUid, username: currentUserDisplayName, avatar: currentUserAvatarUrl || null }],
  createdAt: Date.now(),
}

```




3. Quota Header Pill & Co-Sign Enforcement in `ThemeDetails.js` & `Pickerchoosers.js`:


* In the shelf header, display a compact scarcity status bar:
* **`Nominations: ${submissionsRemaining}/1 left`** • **`Co-Signs: ${coSignsRemaining}/3 left`**


* When `submissionsRemaining === 0`, change the bottom CTA from `"+ Nominate a Track"` to a disabled pill reading `"✓ Nomination Used (1/1)"`.
* Replace the `+1` vote button label with **`▲ Co-Sign (${score})`** (unvoted) and **`✓ Co-Signed (${score})`** (voted, `#D4F458` lime accent, `disabled={true}`).
* If `coSignsRemaining === 0` on unvoted rows, style the button as disabled (`#1E2430`) and show an in-app toast if tapped (`"All 3 Co-Signs used for this drop."`).
* Render `item.linerNote` (when non-empty) directly beneath the artist name in italicized `#94A3B8` text (`"“${item.linerNote}”"`).




* **Acceptance Criteria:**
* A user can nominate at most 1 song and cast at most 3 Co-Signs per theme.
* Nominating a track with a Liner Note saves and renders `"“Wait for the bassline switch at 1:42”"` beneath the track title in both `ThemeDetails.js` and `Pickerchoosers.js`.





---

### WP-02: Social Attribution (`Curated by @username` Pill + Stacked Co-Signer Avatars)

* **Goal:** Eliminate anonymous tracks by displaying a clickable **`Curated by @username`** pill and a stacked mini-avatar row of listeners who co-signed the track, routing to `UserProfileScreen.js`.


* **Files to Touch:**
* `ThemeDetails.js`


* `Pickerchoosers.js`


* `utils/collectiveGrooveUtils.js`
* `utils/avatarUtils.js`
* `__tests__/collectiveGroove.test.js`


* **Implementation Steps:**
1. **Attribution Normalization (`utils/collectiveGrooveUtils.js`):**
* Add `resolveTrackSocialAttribution(track, usersByIdMap)` that returns:
* `curatorUid`: `track.curatorUid || track.addedBy || track.userId || null`
* `curatorHandle`: formatted `@username` (falling back to `@Community` for legacy anonymous seed tracks)
* `coSignerAvatars`: up to 3 deduplicated voter profile objects (`{ uid, username, avatar }`) plus `overflowCount` (`Math.max(0, totalVoters - 3)`).




2. Curator Pill & Profile Routing (`ThemeDetails.js`, `Pickerchoosers.js`):


* On each track row, render a compact interactive pill (`backgroundColor: '#1E2430'`, `borderRadius: 999`, `paddingHorizontal: 8, paddingVertical: 3`):
* Text: **`Curated by @${curatorUsername}`** (`color: '#FF8C00'` for `@username`).
* `onPress`: If `curatorUid` is present and `curatorUid !== auth.currentUser?.uid`, call `navigation.navigate('UserProfileScreen', { userId: curatorUid, username: curatorUsername })` (or navigate to `ProfileScreen` if it is the current user).






3. **Stacked Mini-Avatars of Co-Signers:**
* Next to the curator pill (or beneath the Liner Note), render up to 3 overlapping `20×20` mini-avatars (`marginLeft: -6` after index 0, `borderWidth: 1.5, borderColor: '#151821'`) using the shared `UserAvatar` / initials fallback logic from `utils/avatarUtils.js`.
* If more than 3 users co-signed, append a `+${overflowCount}` badge (`fontSize: 11, color: '#94A3B8'`).




* **Acceptance Criteria:**
* Every track row displays `Curated by @<username>` and stacked `20×20` avatars of its Co-Signers.
* Tapping `Curated by @Sigma` navigates directly to `UserProfileScreen.js` (or `ProfileScreen.js` if self).


* Legacy tracks without `curatorUid` render `Curated by @Community` cleanly without crashing.



---

### WP-03: Continuous "Crate Radio" Sequential Preview Player (Top 13)

* **Goal:** Add a **`▶ Play Crate (Top 13)`** header button and sticky/inline mini-player in `ThemeDetails.js` and `Pickerchoosers.js` that chains 30-second track previews sequentially through `audioPreviewController.js` with an inline progress bar and a 1-tap **`▲ Co-Sign`** button.


* **Files to Touch:**
* `audioPreviewController.js`
* `ThemeDetails.js`


* `Pickerchoosers.js`


* `utils/collectiveGrooveUtils.js`
* `__tests__/audioPreview.test.js`




* **Implementation Steps:**
1. **Extend `createAudioPreviewController` (`audioPreviewController.js`):**
* Add queue & progress support while keeping existing `playPreview(trackId, previewUrl)` callers 100% backward-compatible:
* `playQueue(tracksQueue, startIndex = 0)`: Resolves missing/expired `previewUrl`s on-demand via `resolveFreshPreviewUrl(track)`, plays track `startIndex`, and automatically advances to `startIndex + 1` when the 30s preview finishes (`didJustFinish` on `expo-av` / `onended` on Web `window.Audio`).
* `skipNext()` / `skipPrev()` / `stopQueue()`.
* `onProgress((state) => ...)`: Emits `{ activeTrackId, activeTrack, queueIndex, queueLength, progressRatio, isPlaying }` every `250ms` so the UI can render a smooth `0.0 -> 1.0` progress bar.




2. Header CTA & Inline Crate Radio Deck (`ThemeDetails.js`, `Pickerchoosers.js`):


* In the shelf header, add a primary `#FF8C00` button: **`▶ Play Crate (Top 13)`** (toggles to **`■ Stop Crate Radio`** when active).
* When Crate Radio is playing, display an Obsidian mini-player card (`backgroundColor: '#151821'`, `borderColor: '#FF8C00'`, `borderWidth: 1`) pinned just below the header:
* Shows: `"CRATE RADIO • #${queueIndex + 1} OF ${queueLength}"`, current track title & artist, `"⏭ Next"` button, and a 1-tap **`▲ Co-Sign`** pill for the currently playing track (wired to the same 3-Co-Sign quota handler from WP-01).
* Bottom edge of the mini-player renders a `3px` animated progress bar (`width: '${Math.round(progressRatio * 100)}%'`, `backgroundColor: '#D4F458'`).


* Highlight the currently playing track row in the `FlatList` with a `#D4F458` left border indicator.
* Ensure `navigation.addListener('blur', ...)` and component unmount call `stopQueue()` so audio never leaks across screens.




* **Acceptance Criteria:**
* Tapping `▶ Play Crate (Top 13)` plays the #1 track's 30s preview, updates the progress bar, and automatically advances to #2 when #1 finishes (or when `⏭ Next` is tapped).
* Tapping `▲ Co-Sign` on the Crate Radio mini-player increments the currently playing track's score and updates the user's remaining Co-Sign quota.
* Navigating away from the screen stops Crate Radio playback immediately.



---

### WP-04: 1-Tap Curation Bridge (`+ Your13` & `📖 Write Memoir` Overflow Actions)

* **Goal:** Let users bridge any track discovered in The Collective straight into their personal **`Your13`** hit list or **`Song Memoir`** reflection in 1 tap.
* **Files to Touch:**
* `ThemeDetails.js`


* `Pickerchoosers.js`


* `utils/playlistUtils.js`
* `__tests__/collectiveGroove.test.js`


* **Implementation Steps:**
1. **Helper for 1-Tap `Your13` Addition (`utils/playlistUtils.js`):**
* Add `appendTrackToYour13Safely({ currentList, candidateTrack, isLocked })`:
* Checks `isLocked` (from `LockContext.js`)—if locked, returns `{ ok: false, reason: 'locked' }`.


* Checks if the track is already in `currentList` (via `deduplicateTracks` / `normalizeYour13List`)—if duplicate, returns `{ ok: false, reason: 'duplicate' }`.
* Checks if `currentList.length >= 13`—if full, returns `{ ok: false, reason: 'full' }`.
* Otherwise appends the normalized track and returns `{ ok: true, nextList, slotNumber: nextList.length }`.




2. Row Quick-Action Menu (`ThemeDetails.js`, `Pickerchoosers.js`):


* Next to the `▲ Co-Sign` pill on each track row, add a `⋯` (or `+`) quick-action button (`minWidth: 40, minHeight: 44`) that opens a compact dark action sheet/popover for that track with two actions:
1. **`+ Add to Your13`**:
* Reads the user's `users/{uid}` playlist and `LockContext` state.


* Calls `appendTrackToYour13Safely`. On success, writes the updated list to `users/{uid}` and shows `toast.show({ kind: 'success', message: 'Added "${track.title}" to Your13 (Slot #${slotNumber})!' })`.
* If full (`13/13`) or locked, shows an informative toast (`"Your13 is currently locked"` or `"Your13 is full (13/13) — edit your slots in Your13"`).


2. **`📖 Write Song Memoir`**:
* Calls `navigation.navigate('Memoir', { song: normalizedItunesTrack, preselectedTrack: normalizedItunesTrack })` so `Memoir.js` opens with the track's title, artist, artwork, and `previewUrl` pre-selected.










* **Acceptance Criteria:**
* Tapping `⋯` $\rightarrow$ `+ Add to Your13` on a Collective track adds it to the user's next open `Your13` slot and shows a non-blocking toast.
* Tapping `⋯` $\rightarrow$ `📖 Write Song Memoir` navigates to `Memoir.js` with that song already attached.





---

## 3. Visual Layout & Token Contract for Track Rows

```
┌────────────────────────────────────────────────────────────────────────┐
│ [50x50 Art]  1. Blinding Lights                        [▲ Co-Sign (5)] │
│              The Weeknd                                          [ ⋯ ] │
│              “Wait for the synth drop at 0:58”                         │
│              (Curated by @Sigma)  [Av1][Av2][Av3] +2                   │
└────────────────────────────────────────────────────────────────────────┘

```

* **Surface & Borders:** Row card `backgroundColor: '#151821'`, `borderColor: '#242936'`, `borderWidth: 1`, `borderRadius: 12`, `padding: 12`, `marginBottom: 10`. Active Crate Radio row uses `borderColor: '#D4F458'`.
* **Typography:**
* Track Title: `15px` bold `#FFFFFF`
* Artist Name: `13px` medium `#94A3B8`
* Liner Note Pitch: `12px` italic `#E2E8F0` (`marginTop: 4`, `numberOfLines: 2`)
* Curator Pill: `11px` semi-bold `#94A3B8` with `@username` in `#FF8C00` (`backgroundColor: '#1E2430'`, `borderRadius: 999`, `paddingHorizontal: 8, paddingVertical: 3`)


* **Touch Targets:** `▲ Co-Sign` pill, `⋯` overflow trigger, and `Curated by @username` pill must all maintain `minHeight: 36` (with `hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}` to meet the `44×44pt` accessibility standard).