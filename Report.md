# Actionable Engineering Specification for Gemini 3.8 Flash (Antigravity IDE)

## 0. Execution Guardrails & Verification Gate

* **Characterization-First Workflow:** This codebase is fragile. Before modifying logic in any module, add or update Jest characterization tests to lock in current behavior. For visual changes, capture before/after screenshots.
* **Atomic Work Packages:** Execute one Work Package (WP) per branch/commit using the smallest diff that satisfies all acceptance criteria. Do not perform unrelated refactors, file renames, or dependency changes.
* **No Destructive Side Effects:** Never delete or weaken existing tests. Do not modify `.env`, secrets, signing keys, or production Firebase rules/data without explicit human approval.
* **Standard Verification Gate (Run After Every WP):**
```bash
npx jest --ci --no-watchman   # Expect all 14 suites (61+ tests) to pass with 0 failures
npm run lint                  # Or: npx eslint . -> expect 0 errors
npx expo export --platform web --output-dir /tmp/tubeapp-web-check # Expect exit code 0

```

---

## 1. Scoped Findings Catalog (6 Focus Areas)

### Aspect 1: Your13 Lock Flow Contradicts Itself (`VR-004`)

* **Severity & Confidence:** P1 | Behavior: HIGH | Cause: MEDIUM | Area: Core Journey (`Your13.js`, `ViewChoicesScreen.js`, `LockContext.js`)


* **Observed Behavior (from Recording):**
* `00:29–00:33` (`Your13`): Tapping `"+ Slot #13"` triggers a native alert in ~1s: `"Your13 Complete! Your collection is now locked for 60 seconds."` At `00:33`, a banner appears reading `"All 13 choices finalized! Locked for 60s"`, yet the primary CTA button simultaneously reads `"Lock & Submit (13/13)"`.
* `00:36` (`Your13`): Search result rows still display an active `"✕ Slot #13"` remove button while the collection is supposedly locked.
* `00:42–01:00` (`Your Choices` / `ViewChoicesScreen.js`): The banner reads `"Selections locked for 51s"`, but red trash icons remain visible and interactive on every track row. Tapping a trash icon at `00:52` fires a `"Selection Locked"` alert. Tapping submit/save at `01:00` fires a fourth message (`"Saved & Locked"`) and restarts the 60s timer. By `02:08`, the lock expires.


* **Root Problem:** Four separate lock notifications fire within 30 seconds (`00:30–01:00`), and the UI contradicts itself over what `"locked"`, `"finalized"`, and `"submitted"` mean.

### Aspect 2: Native Browser Alerts for Almost All Feedback (`VR-003`)

* **Severity & Confidence:** P2 (Systemic) | Confidence: HIGH | Area: Interaction Feedback (`crossPlatformAlert.js`, `ProfileScreen.js`, `ThemeDetails.js`, `Pickerchoosers.js`, `UpdateProfileScreen.js`, `RankedUsers.js`)


* **Observed Behavior (from Recording):**
* Blocking browser dialogs headed `"localhost:8081 says"` fire across 9 interactions: `00:30` (Your13 complete), `00:52` (Selection locked), `01:00` (Saved & locked), `01:08` (`"Success / Friend request sent to Sam."`), `01:38` (`"Report Submitted"`), `02:28` (`"Vote Already Cast"`), `04:32` (`"Delete Song Memoir?"`), `05:22` (`"Profile Saved"`), and `05:43` (Avatar update).
* Only `03:48` (`Memoir.js` — `"Memoir Published"`) uses a styled in-app toast.


* At `04:32` (`ProfileScreen.js`), the destructive confirmation dialog `"Delete Song Memoir?"` offers `"Cancel"` and `"OK"` instead of an explicit destructive `"Delete"` action.


* At `02:28` (`Pickerchoosers.js` / `ThemeDetails.js`), tapping an already-voted `"Voted"` button fires a blocking `"Vote Already Cast"` alert instead of rendering the button in a disabled state.





### Aspect 3: Blank Black Screens on Back-Navigation & Wrong-Content Flash on Login (`VR-005`)

* **Severity & Confidence:** P2 | Confidence: MEDIUM | Area: Perceived Performance & First Impression (`HomeScreen.js`, `App.js`, `SongDetailsScreen.js`, `Pickerchoosers.js`, `ThemeDetails.js`, `TheCollective.js`)


* **Observed Behavior (from Recording):**
* **Login Wrong-Content Flash (`00:03.5`):** Immediately after login (`00:01–00:03.5`), `HomeScreen.js` flashes `"Welcome, Listener • 0/13 Your13 tracks ready"`, white image placeholder blocks, and an empty tab bar before hydrating to `"Welcome, Sigma • 12/13"` at `00:04.0`.


* **Back-Navigation Black Frames:**
* `02:43.5–02:44.5` (1–2s): Navigating back from `SongDetailsScreen.js` ("Track Details") produces a solid black screen for 1–2 seconds.


* `03:17.5`, `03:20.0`, and `03:25.0` ($\le 1\text{s}$ each): Stepping back through `SongDetailsScreen.js` $\rightarrow$ Shelf (`Pickerchoosers.js` / `ThemeDetails.js`) $\rightarrow$ `TheCollective.js` $\rightarrow$ `HomeScreen.js` flashes blank black frames at each pop transition.







### Aspect 4: Inconsistent Social Vocabulary, Naming, Avatars & DM Data (`VR-008`, `VR-009`)

* **Severity & Confidence:** P2 (Systemic) | Confidence: HIGH (`VR-008`), MEDIUM (`VR-009`) | Area: IA, Copy & Data Coherence (`HomeScreen.js`, `ProfileScreen.js`, `RankedUsers.js`, `UserGraph.js`, `FriendsScreen.js`, `MainChatScreen.js`, `UserSearchScreen.js`)


* **Observed Behavior (from Recording):**
* **Brand Split (`VR-008`):** `WelcomeScreen.js` (`00:00`) and legal modals use `"TuneHub"`, whereas `HomeScreen.js` (`00:04`) reads `"Shape Your Community with Chorus"`.


* **Feature Naming Sprawl (`VR-008`):** Eight different names are used for the twin/graph features: `"Music Twins"`, `"Sonic Twin"`, `"Sonic Soulmate"`, `"Sonic Twin Engine"`, `"Launch Affinity Graph →"`, `"Music Affinity Radar"`, `"Sonic Affinity Radar"`, and `"Launch Interactive Affinity Radar"`.
* **Relationship Vocabulary Mismatch (`VR-008`):** `ProfileScreen.js` (`06:40`) displays `"1 Friends"`. Tapping it opens `FriendsScreen.js` with tabs `"Followers | Following | Sent | Received"`. `"Followers"` lists `Fifth` with a symmetric `"Unfriend"` button (`06:41`), while `"Following"` reads `"Not Following Anyone Yet"` (`06:43`).


* **DM List Coherence (`VR-008`):** `MainChatScreen.js` (`06:29`) displays 5 threads, including non-connected users (`Evan_Afrobeats`, `Alpha`, `Admin`). Every row displays the static placeholder `"Tap to open conversation"` with no message preview or timestamp—even though `Sam`'s thread contains `"Hello"` (`06:30`).


* **Stock Avatar vs. Initials Mismatch (`VR-009`):** `Fifth`, `Sam`, `Alpha`, `Marl`, and `Beta` all share the exact same stock portrait photo in `RankedUsers.js` (`01:04`), `MainChatScreen.js` (`06:29`), and `FriendsScreen.js` (`06:41`), whereas `UserSearchScreen.js` (`06:04`) renders colored initials circles for those same users.





### Aspect 5: Legal Copy Leaks a Dev Annotation & Gives a Wrong Menu Path (`VR-011`)

* **Severity & Confidence:** P2 | Confidence: HIGH | Area: Trust & Store Readiness (`SettingsScreen.js`)


* **Observed Behavior (from Recording):**
* At `07:09` (`SettingsScreen.js` Privacy Policy modal), Section 3 reads:


* Heading: `"3. Your Rights & Account Deletion (Apple Guideline 5.1.1(v))"` (leaking an internal compliance note to end users).
* Body: `"Navigate to Settings → Security & Privacy → Delete Account"`, whereas the actual row on `SettingsScreen.js` (`06:52`) is labeled `"Security & Account Deletion"`.







### Aspect 6: Inconsistent Navigation, Back Labels, and Button Styles (`VR-013`, `VR-014`, `VR-018`)

* **Severity & Confidence:** P2 (Systemic) | Confidence: MEDIUM-HIGH | Area: Navigation & Visual Consistency (`Taskbar.js`, `ProfileScreen.js`, `SettingsScreen.js`, `RankedMusicList.js`, `UploadProfilePicture.js`, `GlobalStyles.js`)


* **Observed Behavior (from Recording):**
* **Navigation & Back Labels (`VR-013`):**
* On `TheCollective.js` ("Collective Groove"), no bottom tab is highlighted at `02:45` and `03:24`, yet `Home` is highlighted at `02:16`.


* Back labels vary across 5 formats: `"Back"`, `"‹ Your13"`, `"Back to Your13"`, `"Back to Profile"`, and `"Back to Search"` (`00:42`, `02:04`, `06:00`, `06:52`).
* On `ProfileScreen.js`, the `"Sonic Twin"` chip stays highlighted while scrolled to the top of the page (`04:49–04:51`), the 4th chip is clipped on the right edge (`"T"` at `03:48`), and the chip row mixes in-page scroll anchors with a full-screen navigation link (`"Top Charts →"`).




* **Button Styles & Visual Consistency (`VR-014`, `VR-018`):**
* Six competing button colors are used across screens: Orange (`Create Account`, `Save`), Sage Green (`"Explore The Collective"` at `00:04`), Lime (`"Publish Song Memoir"`, `"Change Profile Photo"`), Green (`"+ Connect"`), Blue (`"Connected"`), and full-width solid Red (`"Logout"` at `06:52`, which visually competes with destructive actions like `"Block & Report"` and `"Unfriend"`).
* `"Community Charts"` (`RankedMusicList.js`, `04:52`) is the only screen title with an orange glow, and its counter badge reads `"115 / 13 PICKS"` (`04:53`).


* On `UploadProfilePicture.js` (`05:32`), the disabled `"Save Profile Portrait"` button is olive-green and visually too close to the enabled lime button.







---

## 2. Actionable Work Packages (Execute One Per Commit)

### WP-01: Unify Your13 Lock State Machine & Controls (`VR-004`)

* **Goal:** Establish a single coherent lock state (`open` vs. `locked`) with one notification per transition and disabled removal controls while locked.
* **Grep Anchors:** `"locked for 60 seconds"`, `"Lock & Submit"`, `"Selection Locked"`, `"Saved & Locked"`
* **Files to Touch:** `LockContext.js`, `Your13.js`, `ViewChoicesScreen.js`, `utils/playlistUtils.js`, `__tests__/lockAndPlaylistSafety.test.js`


* **Implementation Steps:**
1. Characterization Tests (`__tests__/lockAndPlaylistSafety.test.js`): Using `jest.useFakeTimers()`, write tests verifying:


* Selecting the 13th track transitions state from `open` to `locked` (or `ready_to_lock` if manual submit is required).
* While `isLocked === true`, countdown ticks down to `0` and transitions back to `open`.
* Attempting to remove a track while `isLocked === true` is blocked without mutating the playlist.


2. State Machine Consolidation (`LockContext.js`, `Your13.js`, `ViewChoicesScreen.js`):


* Model the state cleanly: when all 13 slots are filled and locked, set `isLocked = true` with `remainingSeconds`.
* Emit **at most one** in-app toast/banner when the lock engages (remove duplicate alerts across `Your13.js` and `ViewChoicesScreen.js`).


3. **Disable Conflicting Controls While Locked:**
* When `isLocked === true`, update the primary CTA in `Your13.js` to a disabled pill reading `"Locked (${remainingSeconds}s)"` (never show an enabled `"Lock & Submit (13/13)"` button while the banner says `"All 13 choices finalized! Locked for 60s"`).


* In `Your13.js` (`"✕ Slot #..."`) and `ViewChoicesScreen.js` (row trash icons), set `disabled={isLocked}` with muted opacity (`0.35`) and hide/disable the tap handler so users cannot trigger a `"Selection Locked"` error popup.






* **Acceptance Criteria:**
* Completing `13/13` triggers at most one toast/banner.
* While locked, no enabled button reads `"Lock & Submit"`, and all remove/trash controls are visually disabled and non-interactive.
* Countdown stays within `±1s` of wall clock over 60 seconds.



---

### WP-02: Shared In-App `Toast` & `ConfirmDialog` (`VR-003`)

* **Goal:** Eliminate `"localhost:8081 says"` browser-native `window.alert` / `window.confirm` popups across all user flows and enforce explicit destructive button labels.
* **Grep Anchors:** `"Delete Song Memoir"`, `"Vote Already Cast"`, `"Profile Saved"`, `"Friend request sent"`, `"Report Submitted"`
* **Files to Touch:** `crossPlatformAlert.js`, `ProfileScreen.js`, `ThemeDetails.js`, `Pickerchoosers.js`, `UpdateProfileScreen.js`, `RankedUsers.js`, `UserModerationModal.js`, `__tests__/crossPlatformAlert.test.js`


* **Implementation Steps:**
1. Component & API Implementation (`crossPlatformAlert.js`):


* Implement a shared, dependency-free dark-mode `Toast` and `ConfirmDialog` host (mounted once in `App.js`) exposing:


```js
toast.show({ kind: 'success' | 'error' | 'info', message: string, durationMs?: 3000 });
confirm({ title, message, confirmLabel: 'Delete', cancelLabel: 'Cancel', destructive: true }): Promise<boolean>;

```


* Style `Toast` with `bg: '#151821'`, `border: '#242936'`, accent indicator (`#10B981` for success, `#FF8C00` for info, `#EF4444` for error), auto-dismissing after `3000ms` with `accessibilityLiveRegion="polite"`.
* Style `ConfirmDialog` as an Obsidian modal (`#151821` card, `#FFFFFF` title, `#94A3B8` body) where `destructive: true` renders the confirm button in `#EF4444` with the exact `confirmLabel` (`"Delete"` or `"Unfriend"`), never `"OK"`.


2. **Migrate Call Sites:**
* Memoir Delete (`ProfileScreen.js`, `04:32`): Use `ConfirmDialog` with `confirmLabel: 'Delete'`, `cancelLabel: 'Cancel'`, `destructive: true`.


* Already Voted (`ThemeDetails.js`, `Pickerchoosers.js`, `02:28`): Set `disabled={hasVoted}` on the `"Voted"` pill so tapping an already-voted track is a no-op and never triggers `"Vote Already Cast"`.


* **Status Notifications:** Route `"Profile Saved"` (`UpdateProfileScreen.js`, `05:22`), `"Friend request sent"` (`RankedUsers.js`, `01:08`), `"Report Submitted"` (`UserModerationModal.js`, `01:38`), and Your13 lock notices (`00:30`, `01:00`) through `toast.show(...)`.






* **Acceptance Criteria:**
* Zero `"localhost:8081 says"` native browser alerts appear across Your13, RankedUsers, Safety Report, Collective voting, Memoir delete, or Edit Profile.
* The Memoir delete dialog confirm button reads `"Delete"` (not `"OK"`).
* Tapping `"Voted"` on a shelf track does not fire any alert.



---

### WP-03: Eliminate Login Wrong-Content Flash & Back-Navigation Black Frames (`VR-005`)

* **Goal:** Prevent `"Welcome, Listener • 0/13"` and white image blocks from flashing on login, and eliminate black screens during back-navigation across Track Details and Collective shelves.
* **Grep Anchors:** `"Welcome, Listener"`, `"Could not stream audio preview"`, `detachInactiveScreens`
* **Files to Touch:** `HomeScreen.js`, `utils/homeDashboardUtils.js`, `App.js`, `TheCollective.js`, `ThemeDetails.js`, `Pickerchoosers.js`, `SongDetailsScreen.js`, `__tests__/homeAndUiSafety.test.js`


* **Implementation Steps:**
1. Hydration Gate on `HomeScreen.js` (`00:03.5`):


* In `utils/homeDashboardUtils.js` and `HomeScreen.js`, add `isHydrated: boolean` to the dashboard state (false until the first `users/{uid}` snapshot arrives).


* While `!isHydrated`, render dark skeleton pills (`backgroundColor: '#151821'`) in place of the greeting text instead of flashing `"Welcome, Listener • 0/13 Your13 tracks ready"`.
* Set `backgroundColor: '#151821'` on all hero card image containers in `HomeScreen.js` so image loading never shows white blocks.




2. **Back-Navigation Continuity (`02:43.5`, `03:17.5–03:25.0`):**
* In `App.js`, ensure `<Stack.Navigator>` sets `detachInactiveScreens={false}` (or keeps previous stack cards painted with `cardStyle: { backgroundColor: '#0A0C10' }`) so popping `SongDetailsScreen` $\rightarrow$ `Pickerchoosers` / `ThemeDetails` $\rightarrow$ `TheCollective` $\rightarrow$ `HomeScreen` does not blank out the underlying screen.


* In `Pickerchoosers.js`, `ThemeDetails.js`, and `TheCollective.js`, do not reset existing track/shelf arrays to `[]` on focus re-entry (`useFocusEffect`); keep cached items rendered while refreshing silently in the background.






* **Acceptance Criteria:**
* Logging in never renders `"Welcome, Listener"`, `"0/13"`, or white image blocks prior to profile hydration.
* Navigating back from `SongDetailsScreen` $\rightarrow$ `Shelf` $\rightarrow$ `TheCollective` $\rightarrow$ `HomeScreen` produces zero black frames $>0.3\text{s}$.



---

### WP-04: Unify Social Vocabulary, Feature Naming, Avatars & DM Previews (`VR-008`, `VR-009`)

* **Goal:** Enforce one brand name (`TuneHub`), consistent feature names (`Music Twins`, `Affinity Radar`), a unified `Friends` relationship model, consistent initials/custom avatars (no shared stock photo), and real last-message previews in Direct Messages.
* **Grep Anchors:** `"Shape Your Community with Chorus"`, `"Sonic Twin Engine"`, `"Tap to open conversation"`, `"Not Following Anyone Yet"`, `pravatar`, `unsplash`
* **Files to Touch:** `utils/avatarUtils.js`, `HomeScreen.js`, `ProfileScreen.js`, `RankedUsers.js`, `UserGraph.js`, `FriendsScreen.js`, `HandlingFriends.js`, `MainChatScreen.js`, `ChatScreen.js`, `UserSearchScreen.js`, `utils/chatMessageUtils.js`, `__tests__/chatMessageSafety.test.js`


* **Implementation Steps:**
1. **WP-04a — Shared `UserAvatar` & Stock Photo Removal (`VR-009`):**
* In `utils/avatarUtils.js`, add a helper `isGenericStockAvatar(url)` that detects shared placeholder/stock URLs and treats them as empty so the user falls back to their deterministic colored initials badge.


* Render the same `UserAvatar` component across `RankedUsers.js`, `MainChatScreen.js`, `FriendsScreen.js`, `UserSearchScreen.js`, and `UserProfileScreen.js` so `Fifth`, `Sam`, `Alpha`, `Marl`, and `Beta` display the exact same avatar on every screen.




2. **WP-04b — Brand, Feature & Relationship Vocabulary (`VR-008`):**
* **Brand Name:** In `HomeScreen.js` (`00:04`), change `"Shape Your Community with Chorus"` to `"Shape Your Community with TuneHub"`.


* **Feature Naming:** Standardize all headers, pills, and CTAs on **`"Music Twins"`** (for `RankedUsers.js`) and **`"Affinity Radar"`** (for `UserGraph.js`), replacing `"Sonic Twin"`, `"Sonic Soulmate"`, `"Sonic Twin Engine"`, `"Music Affinity Radar"`, and `"Sonic Affinity Radar"`.


* Friends Model (`ProfileScreen.js` & `FriendsScreen.js`): Rename the first tab in `FriendsScreen.js` from `"Followers"` to `"Friends"` (listing accepted mutual friends, matching the `"1 Friends"` counter on `ProfileScreen.js` and the `"Unfriend"` button), and ensure accepting a friend request in `HandlingFriends.js` updates both users' connected lists symmetrically.




3. WP-04c — DM Thread Previews & Filtering (`MainChatScreen.js`, `ChatScreen.js`):


* In `ChatScreen.js` and `utils/chatMessageUtils.js`, ensure sending a message updates `lastMessageText`, `lastMessageAt`, and `lastSenderId` on the parent `chats/{chatId}` document.


* In `MainChatScreen.js` (`06:29`), display `chat.lastMessageText || 'No messages yet'` and the formatted timestamp (`moment(chat.lastMessageAt).fromNow()`) instead of static `"Tap to open conversation"` on every row, and only show threads that have at least one message or were explicitly opened by the user.






* **Acceptance Criteria:**
* The same user displays the exact same avatar across Music Twins, DMs, Friends, and Find Listeners (zero shared stock photos).
* `ProfileScreen.js` `"Friends"` count equals the number of rows in the `"Friends"` tab of `FriendsScreen.js`.


* `Sam`'s row in `MainChatScreen.js` (`06:29`) displays the `"Hello"` message snippet and timestamp.


* `"Chorus"` and the 6 redundant twin/radar name variants no longer appear in the UI.



---

### WP-05: Fix Legal Copy Dev Annotation Leak & Menu Path (`VR-011`)

* **Goal:** Remove `"(Apple Guideline 5.1.1(v))"` from user-visible legal text and synchronize the account deletion menu path with the actual `SettingsScreen.js` row label.
* **Grep Anchors:** `"Apple Guideline"`, `"Security & Privacy"`
* **Files to Touch:** `SettingsScreen.js`, `__tests__/homeAndUiSafety.test.js`


* **Implementation Steps:**
1. In `SettingsScreen.js`, export `export const SECURITY_ROW_LABEL = 'Security & Account Deletion';` and use it for the Settings menu row (`06:52`).


2. In the Privacy Policy modal (`07:09` in `SettingsScreen.js`):


* Change `"3. Your Rights & Account Deletion (Apple Guideline 5.1.1(v))"` to `"3. Your Rights & Account Deletion"`.
* Change `"Navigate to Settings → Security & Privacy → Delete Account"` to `"Navigate to Settings → ${SECURITY_ROW_LABEL} → Delete Account"`.


3. Add a Jest test in `__tests__/homeAndUiSafety.test.js` asserting that the Privacy Policy text does not contain `"Apple Guideline"` and includes `SECURITY_ROW_LABEL`.




* **Acceptance Criteria:**
* `grep -rn "Apple Guideline"` across user-visible strings returns `0`.
* Privacy Policy Section 3 path reads `"Settings → Security & Account Deletion → Delete Account"`.



---

### WP-06: Standardize Navigation, Back Labels & Button Variants (`VR-013`, `VR-014`, `VR-018`)

* **Goal:** Enforce one `"← Back"` header label, consistent bottom-tab highlighting on `TheCollective.js`, unclipped `ProfileScreen.js` section chips, and semantic button variants across all screens.
* **Grep Anchors:** `"Back to Profile"`, `"Back to Search"`, `"Back to Your13"`, `"Save Profile Portrait"`, `"115 / 13 PICKS"`
* **Files to Touch:** `GlobalStyles.js`, `Taskbar.js`, `ProfileScreen.js`, `SettingsScreen.js`, `ViewChoicesScreen.js`, `UserSearchScreen.js`, `UpdateProfileScreen.js`, `RankedMusicList.js`, `UploadProfilePicture.js`, `HomeScreen.js`


* **Implementation Steps:**
1. **Standardize Back Labels (`VR-013`):**
* Replace `"‹ Your13"`, `"Back to Your13"`, `"Back to Profile"`, and `"Back to Search"` across `ViewChoicesScreen.js`, `SettingsScreen.js`, `UpdateProfileScreen.js`, and `UserSearchScreen.js` with a uniform `"← Back"` button (`minHeight: 44, minWidth: 44`).




2. **Fix Bottom-Tab Highlighting on Collective (`VR-013`):**
* In `Taskbar.js`, map `TheCollective` route names to highlight the `Home` tab consistently so the active indicator never disappears at `02:45` and `03:24`.




3. Fix `ProfileScreen.js` Chips (`VR-013`):


* Wrap the section chips in a horizontal `<ScrollView 16, 8 contentContainerStyle="{{" gap: horizontal paddingHorizontal: showsHorizontalScrollIndicator="{false}" }}>` with a right-edge fade/padding so the 4th chip is never clipped (`"T"` at `03:48`).
* Default `activeSection` to `'your13'` when scrolled to the top (`scrollY < 120`) so `"Sonic Twin"` does not stay highlighted at the top of the page (`04:49–04:51`).
* Separate `"Top Charts →"` visually (outlined link chip with `↗` icon or move to header action) from the in-page scroll anchor chips (`Your 13`, `Memoirs`, `Music Twins`).


4. **Enforce Semantic Button Variants (`VR-014`, `VR-018`):**
* Adopt the shared `Button` variants in `GlobalStyles.js` (see Section 3 below):


* Change `"Explore The Collective"` on `HomeScreen.js` (`00:04`) from sage green (`#6E8D82`) to `primary` (`#FF8C00`) or `secondary` (`#151821` + `#FF8C00` border).


* Change `"Logout"` on `SettingsScreen.js` (`06:52`) from full-width solid red to an outlined `secondary` button with a confirmation prompt (`ConfirmDialog`), reserving solid `danger` red (`#EF4444`) strictly for data-destructive actions (`Delete Account`, `Delete Memoir`, `Block & Report`).


* On `UploadProfilePicture.js` (`05:32`), style the disabled `"Save Profile Portrait"` button with `backgroundColor: '#1E2430'`, `borderColor: '#242936'`, and `color: '#64748B'` so it is unmistakably disabled compared to the active `#D4F458` lime state.






5. **Community Charts Header Polish (`VR-014`):**
* In `RankedMusicList.js` (`04:52–04:53`), remove the orange `textShadow` glow from the `"Community Charts"` title and change `"115 / 13 PICKS"` to `"115 TOTAL PICKS"`.






* **Acceptance Criteria:**
* Every drill-down screen header uses `"← Back"`.
* `TheCollective.js` keeps the `Home` tab highlighted in `Taskbar.js`.


* `ProfileScreen.js` chips do not clip at `375px–420px` width, and `"Sonic Twin"` is not highlighted at the top of the page.


* `"Logout"` on `SettingsScreen.js` is outlined (not solid red) and prompts for confirmation.


* Disabled `"Save Profile Portrait"` (`05:32`) has a distinct dark-slate disabled appearance (`#1E2430` surface / `#64748B` text).
* `"Community Charts"` title has no orange glow, and the stat pill reads `"115 TOTAL PICKS"`.



---

## 3. Reference Design Tokens & Component Contracts

```javascript
// GlobalStyles.js / theme tokens
export const color = {
  bg: '#0A0C10',
  surface: '#151821',
  surfaceDisabled: '#1E2430',
  border: '#242936',
  text: '#FFFFFF',
  textSecondary: '#94A3B8', // ~7.6:1 contrast on bg
  textTertiary: '#64748B',  // Disabled / decorative / large text only
  accent: '#FF8C00',        // Primary brand action
  lime: '#D4F458',          // Memoir & profile creation actions
  success: '#10B981',       // "+ Connect" / positive status
  danger: '#EF4444',        // Data-destructive actions ONLY (Delete, Block, Unfriend)
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };
export const radius = { sm: 8, md: 12, lg: 16, pill: 999 };
export const type = { title: 24, heading: 18, body: 15, caption: 12 };
export const hit = { min: 44 };

```

**Button Variant Rules (Max 1 Primary CTA Per Screen):**

* **`primary` (`#FF8C00` fill, `#0A0C10` or `#FFFFFF` bold text):** Main screen CTA (`Save`, `Create Account`, `Explore The Collective`).
* **`secondary` (`#151821` fill, `#242936` border, `#FFFFFF` text):** Secondary actions (`Connected`, `Pending`, `Cancel`, `Logout`).
* **`lime` (`#D4F458` fill, `#0A0C10` bold text):** Memoir publish & profile photo actions (`Publish Song Memoir`, `Change Profile Photo`).
* **`positive` (`#10B981` fill/border):** Social connection initiation (`+ Connect`).
* **`danger` (`#EF4444` fill/border):** Data-destructive actions only (`Delete`, `Block & Report`, `Unfriend`).
* **`disabled` (`#1E2430` fill, `#242936` border, `#64748B` text):** Applied whenever `disabled={true}` across any button variant.