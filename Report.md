# Actionable Engineering Specification: Performance, UI Polish, Architecture & Rebranding (`Orphee`)

This specification is designed for **Gemini 3.8 Flash on Antigravity IDE** to resolve navigation latency, image decoding delays, `HomeScreen` vs. `Taskbar` redundancy, `UserProfileScreen` `Your13` list visibility, `Pickerchoosers` layout collisions, terminology inconsistencies, and the global rebrand from **TuneHub** to **Orphee** and **Music Twins** to **Vibe Check**.

---

## 0. Audit of Features Existing Under Different Names

Before executing code changes, an audit of the repository (`Orphee-e28ab3073af6512d8f3d48ec489e1d8cc2940832`) identified **5 identical features/concepts referred to by conflicting names across screens**. All 5 must be unified in **WP-06**:

| Feature / Concept | Conflicting Names Found in Codebase | Standardized Canonical Name |
| --- | --- | --- |
| **App Brand** | `TuneHub`, `Tunehub`, `TubeApp`, `Orphee` (`WelcomeScreen.js`, `HomeScreen.js`, `app.json`)

 | **`Orphee`** |
| **Compatibility / Matching** | `Find Music Twins`, `Music Twins`, `Your Twins`, `Sonic Twins`, `RankedUsers` (`HomeScreen.js`, `RankedUsers.js`, `UserGraph.js`)

 | **`Vibe Check`** (individual match: **`Vibe Match`**) |
| **13-Track Personal List** | `Your13`, `My 13`, `Top 13`, `Hit List`, `Choices` (`Your13.js`, `HomeScreen.js`, `ProfileScreen.js`, `ViewChoicesScreen.js`)

 | **`Your13`** |
| **Daily Song Reflection** | `Memoir`, `Song Memoir`, `Daily Memoir`, `Musical Memoir` (`Memoir.js`, `MemoirHistoryScreen.js`, `UserProfileScreen.js`, `Pickerchoosers.js`)

 | **`Song Memoir`** (plural tab: **`Song Memoirs`**) |
| **Community Endorsements** | `Co-Signs`, `Community Votes`, `Votes`, `+1` (`Pickerchoosers.js` header says `"Ranked by Community Votes"` while cards say `"Co-Signs"`)

 | **`Co-Signs`** (`"Ranked by Community Co-Signs"`) |

---

## 1. Execution Guardrails & Verification Gate

Run the verification gate after **every** Work Package (`WP-01` through `WP-06`) before committing:

```bash
npx jest --ci --no-watchman
npx expo export --platform web --output-dir /tmp/orphee-web-check

```

---

## 2. Atomic Work Packages

### WP-01: Eliminate Navigation Latency (`Home` $\leftrightarrow$ `ProfileScreen`, `Pickerchoosers` $\rightarrow$ `TheCollective`, and `Any` $\rightarrow$ `Home`)

* **Root Cause Diagnosis:**
1. **`Home` $\rightarrow$ `ProfileScreen` (`"Loading @Sigma..."` delay):** `ProfileScreen.js` initializes with empty state and blocks rendering behind a `"Loading @username..."` full-screen gate while awaiting fresh Firestore snapshots (`users/{uid}` and `memoirs`), even though `HomeScreen.js` already fetched the exact same user document seconds earlier.


2. **`Pickerchoosers` $\rightarrow$ `TheCollective` lag:** Pressing Back in `Pickerchoosers.js` or switching tabs re-mounts `TheCollective.js`, which re-fetches `themes` from Firestore with no in-memory cache and re-decodes large local images.


3. **`Any Screen` $\rightarrow$ `Home` blank screen / lag:** `Taskbar.js` calls `navigation.navigate('Home')`. Whenever `HomeScreen.js` mounts or re-hydrates, its `!isHydrated` skeleton gate blocks rendering until Firestore listeners fire.




* **Files to Touch:**
* `utils/sessionCache.js` *(new)*
* `HomeScreen.js`


* `ProfileScreen.js`


* `TheCollective.js`


* `Pickerchoosers.js`


* `Taskbar.js`


* `__tests__/homeAndUiSafety.test.js`




* **Implementation Steps:**
1. **Create a Synchronous In-Memory Stale-While-Revalidate Cache (`utils/sessionCache.js`):**
* Store keyed snapshots in memory for:
* `userProfilesByUid[uid]` (`{ username, email, bio, profilePicture, songs, following, followers, updatedAt }`)
* `memoirsByUid[uid]` (`Array<Memoir>`)
* `collectiveThemes` (`Array<Theme>` and `themesById[themeId]`)
* `homeDashboardByUid[uid]`


* Export synchronous getters and setters (`getCachedUserProfile(uid)`, `setCachedUserProfile(uid, data)`, `getCachedThemes()`, `setCachedThemes(themes)`, `clearSessionCache()`).
* Call `clearSessionCache()` on sign-out in `ProfileScreen.js` / `SettingsScreen.js`.




2. Instant `ProfileScreen.js` Mount (Zero `"Loading @Sigma..."` Gate):


* Initialize `ProfileScreen.js` state synchronously from `getCachedUserProfile(currentUid)` and `getCachedMemoirs(currentUid)`.
* If cached user data exists (or `auth.currentUser` is available), **render the full `ProfileScreen` layout immediately (0ms)** using `auth.currentUser.displayName` / cached fields while the Firestore `onSnapshot` listener refreshes in the background.
* Never replace the entire screen with `"Loading @Sigma..."` once any profile data or `auth.currentUser` is present.


3. Instant `HomeScreen.js` Mount:


* Seed `HomeScreen.js` state from `getCachedUserProfile(currentUid)` and `setIsHydrated(true)` immediately on mount if cached data exists.
* Whenever `HomeScreen.js` receives a `users/{uid}` snapshot, write it to `setCachedUserProfile(currentUid, docData)` so subsequent visits to `ProfileScreen` or `HomeScreen` are instant.


4. Instant Back-Navigation from `Pickerchoosers.js` to `TheCollective.js`:


* In `TheCollective.js`, initialize the themes list synchronously from `getCachedThemes()` so the grid renders in `0ms` without waiting for Firestore.
* In `Pickerchoosers.js`, ensure the top-left `← Back` button uses:


```javascript
if (navigation.canGoBack()) {
  navigation.goBack();
} else {
  navigation.navigate('TheCollective');
}

```


so React Navigation pops back to the already-mounted `TheCollective` screen instead of pushing a duplicate instance.




* **Acceptance Criteria:**
* Navigating `Home` $\rightarrow$ `ProfileScreen` renders the profile immediately with zero `"Loading @Sigma..."` screen.
* Navigating `Pickerchoosers` $\rightarrow$ `TheCollective` and `Any Screen` $\rightarrow$ `Home` renders in `<50ms` with zero blank frames.



---

### WP-02: Fix Image Loading Delays on `TheCollective.js`

* **Root Cause Diagnosis:**
* `assets/80.jpg`, `assets/Airplanemode.jpg`, and `assets/Coplay.jpg` are multi-megapixel uncompressed JPEGs (~400–600 KB each) that are decoded on the UI thread when `TheCollective.js` mounts, and remote theme cover URLs / iTunes artwork URLs are not preloaded or given a placeholder surface.




* **Files to Touch:**
* `App.js`


* `TheCollective.js`


* `utils/imagePreloadUtils.js` *(new)*


* **Implementation Steps:**
1. Preload Bundled Theme Assets at App Startup (`utils/imagePreloadUtils.js` & `App.js`):


* Create `preloadCoreThemeAssets()` using `expo-asset` (`Asset.loadAsync([require('../assets/Airplanemode.jpg'), require('../assets/80.jpg'), require('../assets/Coplay.jpg')])`) and `Image.prefetch` for any cached remote cover URLs.
* Trigger `preloadCoreThemeAssets()` non-blockingly inside `App.js` `useEffect` on startup so the images are already decoded in memory before the user ever taps `The Collective`.


2. Progressive Card Surface & Decoding Optimization in `TheCollective.js`:


* Wrap every theme card image in a styled placeholder container (`backgroundColor: '#151821'`) with a subtle gradient/accent border so the card structure and title are 100% visible at `0ms` even before the bitmap finishes painting.
* Pass `fadeDuration={150}` (Android) and `resizeMethod="resize"` / explicit `width` and `height` dimensions on `<Image>` in `TheCollective.js` so the browser/native compositor does not perform expensive layout recalculations.




* **Acceptance Criteria:**
* Opening `TheCollective.js` displays all theme cards immediately without popping or delayed image blanking.



---

### WP-03: Redesign `HomeScreen.js` to Eliminate Redundancy with `Taskbar.js`

* **Root Cause Diagnosis:**
* `Taskbar.js` already provides persistent 1-tap navigation to **`Your13`** and **`The Collective`**. Having big navigation cards on `HomeScreen.js` that also just link to `Your13` and `The Collective` makes the homepage a redundant menu rather than a destination.




* **Solution — Transform `HomeScreen.js` into the "Orphee Pulse" Discovery Hub:**
* Keep `Taskbar.js` as the sole navigation bar for **`Home`**, **`Your13`**, **`The Collective`**, **`Chat`**, and **`Profile`**.
* Remove the redundant `"Your13"` and `"The Collective"` navigation link cards from `HomeScreen.js`.


* Repurpose `HomeScreen.js` around the **three high-value social & discovery experiences that do NOT have dedicated Taskbar buttons**:
1. **Primary Hero Card — `Vibe Check` (formerly Find Music Twins) & `Affinity Graph`:**
* Displays the user's live top Vibe Match preview (e.g., `"Top Match: @Alpha • 88% Vibe Match"`) with two action buttons:
* Primary CTA (`#FF8C00`): **`⚡ Run Vibe Check`** $\rightarrow$ routes to `RankedUsers.js`.


* Secondary CTA (`#1E2430`): **`🕸️ View Affinity Graph`** $\rightarrow$ routes to `UserGraph.js`.






2. **Daily `Song Memoir` Prompt & Community Memoir Feed:**
* Displays today's Song Memoir status: if the user hasn't logged today's song reflection, show **`📖 Log Today's Song Memoir`** ($\rightarrow$ `Memoir.js`); if logged, show their current memoir card with a 1-tap `▶ Preview` button and a **`Browse Memoir History`** link ($\rightarrow$ `MemoirHistoryScreen.js`).




3. **People & Notifications Quick Bar:**
* Prominent search bar / card at the top of `HomeScreen.js`: **`🔍 Find Listeners & Friends`** ($\rightarrow$ `UserSearchScreen.js` / `FriendsScreen.js`) + the notification bell ($\rightarrow$ `NotifPage.js`).








* **Files to Touch:**
* `HomeScreen.js`


* `utils/homeDashboardUtils.js`
* `__tests__/homeAndUiSafety.test.js`




* **Acceptance Criteria:**
* `HomeScreen.js` no longer contains duplicate navigation buttons for `Your13` or `The Collective` (which live in `Taskbar.js`).
* `HomeScreen.js` features **Vibe Check + Affinity Graph**, **Song Memoir**, and **Listener Search / Friends** as its primary interactive modules.



---

### WP-04: Fix `UserProfileScreen.js` So All 13 Tracks in `Your13` Are Visible

* Root Cause Diagnosis (From Screenshot 1 - `@Sam`):


* In `UserProfileScreen.js`, selecting the **`Your13 (13)`** tab renders a single horizontal row (`FlatList` with `horizontal={true}`) that only shows 3 cards (`Hands On`, `Runaway`, `FourFiveSecon...`) and clips the remaining 10 tracks off-screen. On Web and mobile, users cannot see the full list of 13 sounds on the page.




* **Files to Touch:**
* `UserProfileScreen.js`


* `ProfileScreen.js` *(apply consistent vertical/grid list option if `ProfileScreen` uses the same clipped horizontal strip)*




* **Implementation Steps:**
1. Replace the Clipped 3-Card Horizontal Strip with a Full 13-Track Vertical List on `UserProfileScreen.js`:


* Under the **`Your13 (13)`** tab on `UserProfileScreen.js`, render all 13 tracks in a **numbered vertical list** (or a 2-column responsive grid / vertical tracklist inside the main `ScrollView`) so every single song (`#1` through `#13`) is visible by scrolling down the page.


* Each track row in `@Sam`'s `Your13` list must display:
* **Rank badge (`#1`–`#13`)** (`width: 28`, `#FF8C00` bold text)
* **Album artwork (`48×48`, `borderRadius: 8`)**
* **Full Track Title & Artist Name** (`flex: 1`, `numberOfLines: 1`)
* **Inline `▶` / `■` 30s Audio Preview button** wired to `audioPreviewController.js` so visitors can actually listen to `@Sam`'s 13 songs right on their profile page.


* Ensure the outer `ScrollView` in `UserProfileScreen.js` has `flex: 1` and `contentContainerStyle={{ paddingBottom: 96 }}` so all 13 rows scroll smoothly on both Web and mobile.




* **Acceptance Criteria:**
* Visiting `@Sam` (or any user) on `UserProfileScreen.js` shows all 13 tracks in a clean, scrollable vertical list with rank numbers (`#1`–`#13`), album art, title, artist, and playable 30s preview buttons.



---

### WP-05: Redesign `Pickerchoosers.js` Track Row & Header Layout

* Root Cause Diagnosis (From Screenshot 2 - `Airplane Mode`):


1. **Severe Button Overlap:** The `✓ ✓ Co-Signed (6)` / `↑ ▲ Co-Sign (3)` button is positioned or sized such that it **collides with and covers** the `Curated by @Community` pill (`Curated by @Com...` is cut off underneath the lime button).


2. **Duplicate Icons in Buttons:**
* Header CTA renders **two play icons**: `▷ ▶ Play Crate (Top 13)` (an `<Ionicons name="play-outline"/>` next to a text `"▶"`).


* Co-Sign button renders **two checkmarks or two arrows**: `✓ ✓ Co-Signed (6)` and `↑ ▲ Co-Sign (3)` (an `<Ionicons/>` icon next to a text `"✓"` or `"▲"`).




3. **Duplicate Co-Sign Count:** Each card shows `(6)` inside `Co-Signed (6)` **and** repeats `6 Co-Signs` in orange text at the bottom of the card.


4. **Missing Artwork Fallbacks:** Legacy tracks without `artworkUrl100` show a generic music note icon instead of resolving artwork via `itunesService.js` or rendering a clean ranked badge.




* **Files to Touch:**
* `Pickerchoosers.js`




* **Implementation Steps:**
1. Remove Duplicate Icons (`Pickerchoosers.js`):


* In the Crate Radio button: keep **only** the `<Ionicons>` icon and set the text to **`Play Crate (Top 13)`** (or **`Stop Crate Radio`**)—remove the literal `▶` and `■` characters from the text string.
* In the Co-Sign button: keep **only** the `<Ionicons "caret-up"} "checkmark-circle" : ? name="{hasVoted"/>` icon and set the label to **`Co-Signed (${score})`** or **`Co-Sign (${score})`**—remove the literal `✓` and `▲` characters from the label string.


2. Fix the Flex Row & Eliminate Overlap (`Pickerchoosers.js`):


* Restructure each track card into a strict **2-zone vertical or non-overlapping flex layout**:
* **Top Row (`flexDirection: 'row', alignItems: 'center'`):**
* Left: Rank Badge (`#1`) + `52×52` Artwork (`marginRight: 12`).
* Center (`flex: 1, minWidth: 0, paddingRight: 8`): Track Title (`fontSize: 16, fontWeight: '700', color: '#FFFFFF'`) + Artist Subtitle (`fontSize: 13, color: '#94A3B8'`) + optional italic Liner Note.
* Right (`flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 6`): Compact Preview button (`36×36` icon button) + `⋯` Overflow button (`36×36` icon button).


* **Bottom Footer Row (`flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#1E2430'`):**
* Left (`flex: 1, flexDirection: 'row', alignItems: 'center', minWidth: 0, marginRight: 8`): **`Curated by @username`** pill (`maxWidth: '70%'`, `numberOfLines: 1`) + stacked Co-Signer mini-avatars (`20×20`).
* Right (`flexShrink: 0`): Compact **`Co-Sign (${score})`** / **`Co-Signed (${score})`** pill (`paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999`).




* **Delete the redundant orange `"6 Co-Signs"` text line** at the bottom of the card since the count is already inside the `Co-Sign (6)` pill.






* **Acceptance Criteria:**
* Zero overlap between `Curated by @...` and the `Co-Sign` button at any mobile/web width.
* No double icons (`▷ ▶`, `✓ ✓`, `↑ ▲`) anywhere in `Pickerchoosers.js`.


* No duplicate Co-Sign counter text on track cards.



---

### WP-06: Global Rebrand (`TuneHub` $\rightarrow$ `Orphee`, `Music Twins` $\rightarrow$ `Vibe Check`) & Terminology Unification

* **Goal:** Execute the app-wide rebrand and unify the 5 inconsistent feature names identified in Section 0.
* **Files to Touch:**
* `app.json`


* `WelcomeScreen.js`


* `LoginScreen.js`


* `SignUpScreen.js`


* `HomeScreen.js`


* `RankedUsers.js`


* `UserGraph.js`


* `ProfileScreen.js`


* `UserProfileScreen.js`


* `TheCollective.js`


* `Pickerchoosers.js`


* `Memoir.js` & `MemoirHistoryScreen.js`


* `Taskbar.js`


* `App.js`


* `__tests__/*.test.js` *(update any test assertions checking old string literals)*




* **Implementation Steps:**
1. **Rebrand `TuneHub` $\rightarrow$ `Orphee`:**
* Search case-insensitively for `tunehub` across all `.js` and `.json` files:
* `app.json`: set `"name": "Orphee"` and `"slug": "orphee"`.
* `WelcomeScreen.js`, `LoginScreen.js`, `SignUpScreen.js`, `HomeScreen.js`, `SettingsScreen.js`, `Feedback.js`: replace every user-facing `"TuneHub"` / `"Tunehub"` string with **`"Orphee"`**.




2. **Rebrand `Find Music Twins` / `Music Twins` $\rightarrow$ `Vibe Check`:**
* Search case-insensitively for `twin` / `music twins` across all `.js` files:
* `HomeScreen.js`: `"Find Music Twins"` $\rightarrow$ **`"Vibe Check"`**.
* `RankedUsers.js`: Header and copy `"Music Twins"` / `"Find Your Music Twins"` $\rightarrow$ **`"Vibe Check"`**; individual match badge `"Music Twin"` $\rightarrow$ **`"Vibe Match"`**.
* `UserGraph.js` & `GraphVisualization.js`: `"Music Twins Graph"` / `"Twins"` $\rightarrow$ **`"Vibe Check Graph"`** / **`"Vibe Matches"`**.
* `App.js`: Update `<Stack.Screen 'Vibe Check' name="RankedUsers" options="{{" title: }}/>`.




3. **Unify the Remaining Feature Names Across Screens:**
* Standardize `"Ranked by Community Votes"` in `Pickerchoosers.js` to **`"Ranked by Community Co-Signs"`**.


* Standardize `"Memoir"` tab label on `ProfileScreen.js` and `UserProfileScreen.js` to **`"Song Memoirs"`**.


* Standardize any `"My 13"` / `"Hit List"` references in `Your13.js` and `ViewChoicesScreen.js` to **`"Your13"`**.




* **Acceptance Criteria:**
* `grep -ri "tunehub" *.js app.json` returns `0` matches.
* `grep -ri "music twin" *.js` returns `0` matches.
* All 15 Jest test suites and `npx expo export --platform web` pass with `0` errors.