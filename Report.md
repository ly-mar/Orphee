### Video Audit Summary (`video_1.mov`)

Reviewing your screen recording frame-by-frame confirms the three issues you flagged and exposes **four additional UI/navigation regressions** introduced during the previous pass:

1. **`Run Vibe Check` on `HomeScreen.js` leads to an empty dead-end (`00:00` $\rightarrow$ `00:02`):** Tapping `Run Vibe Check` on `HomeScreen` navigates to `RankedUsers.js` without passing compatibility data, causing `RankedUsers.js` to display *"No Ranked Connections Yet"*—even though `Sigma` has `12/13` tracks ready and tapping `Run Vibe Check` from `Your13.js` (`01:02` $\rightarrow$ `01:04`) properly loads all 13 matches (`#1 Sigma`, `#2 Fifth`, `#3 Sam`, etc.). Additionally, the top-left back button on `RankedUsers.js` is hardcoded to say `← Your13` even when entered from `HomeScreen` (`00:02`).
2. **Wrong Icon on `Affinity Graph` on `HomeScreen.js` (`00:00`):** The `Affinity Graph` button uses `<Ionicons name="share-social-outline"/>` (the 3-dot digital share icon) instead of the `iridescentStarCircle` asset used on `ProfileScreen.js` (`01:33`).
3. **Useless `Vibe Check` Pill on `ProfileScreen.js` (`01:39.5` $\rightarrow$ `01:45`):** Tapping the `Vibe Check` pill in the sub-header tab bar under `Hi, Sigma` flashes lime green, scrolls slightly, and snaps back to `Your 13 (12)` because there is no Vibe Check section on `ProfileScreen.js`.
4. **Additional Regressions Spotted in `video_1.mov`:**
* **`UserProfileScreen.js` Tab Switch Trap (`01:58` $\rightarrow$ `02:00`):** On `@Alpha`'s profile, after tapping `Song Memoirs` (`01:58.5`), tapping `Your13 (2)` (`01:59`–`02:00`) fails to switch back to the `Your13` tracklist because the tab state key in `UserProfileScreen.js` became mismatched during the WP-06 rename.
* **Invisible Avatar on `@Alpha`'s Profile (`01:57`):** There is a large empty black gap above `Alpha` where the avatar circle should be (`01:57`) because `UserProfileScreen.js` lacks an `onError` / empty-URI fallback to the initials avatar circle.
* **Blank Dark Screen Flash When Returning to `TheCollective.js` (`01:22`, `01:26`, `01:31.5`):** Navigating back from `Pickerchoosers.js` (`Airplane Mode`, `Child of the 80s`) or switching tabs to `TheCollective.js` still flashes a completely blank `#0A0C10` viewport for ~1s, and several remote theme covers (`Funny Rap`, `Half good music` at `01:14`) render as empty dark boxes before popping in at `01:32`.
* **Residual Naming Typos (`00:00`, `01:33`):** `HomeScreen.js` still says *"Capture Today's **Musical Memoir**"* instead of *"Capture Today's **Song Memoir**"*, and `ProfileScreen.js` has `"Your 13 (12)"` (with a space) in the top pill bar next to `"Your13 (12)"` (no space) in the section header below it.



---

# Actionable Engineering Specification: Post-Implementation Bug & Polish Fixes (Antigravity IDE)

## 0. Verification Gate (Run After Every WP)

```bash
npx jest --ci --no-watchman
npx expo export --platform web --output-dir /tmp/orphee-web-check

```

---

## WP-01: Fix `Run Vibe Check` Navigation from `HomeScreen.js` & Self-Sufficient `RankedUsers.js`

* **Goal:** Make `Run Vibe Check` on `HomeScreen.js` load the full ranked compatibility list immediately (matching `Your13.js`), populate the live top Vibe Match preview on `HomeScreen.js`, and fix the hardcoded `← Your13` back button in `RankedUsers.js`.
* **Files to Touch:**
* `RankedUsers.js`


* `HomeScreen.js`


* `utils/sessionCache.js`
* `__tests__/homeAndUiSafety.test.js`




* **Implementation Steps:**
1. Make `RankedUsers.js` Self-Hydrating When Opened Without Route Params:


* In `RankedUsers.js`, check if `route.params?.rankedUsers` (or `route.params?.selectedSongs`) is missing or empty.
* If missing:
1. Check `getCachedRankedUsers(currentUid)` in `utils/sessionCache.js` for instant `0ms` rendering.
2. Concurrently fetch the current user's `users/{uid}` document (`songs` / `selectedSongs`) and the `users` collection from Firestore, run the compatibility calculation (`Algo.js`), update `rankedUsers` state, and save to `setCachedRankedUsers(currentUid, computedList)`.


* Only display the `"No Ranked Connections Yet"` empty state if Firestore hydration has completed **and** the current user genuinely has `0` tracks in their `Your13`.


2. Fix the Top-Left Back Button Label in `RankedUsers.js`:


* Replace the hardcoded `← Your13` button label and `navigation.navigate('Your13')` handler in `RankedUsers.js` with `← Back` and:
```javascript
onPress={() => {
  if (navigation.canGoBack()) {
    navigation.goBack();
  } else {
    navigation.navigate('Home');
  }
}}

```




3. Pass Cached Songs/Matches from `HomeScreen.js` & Populate Top Match Pill:


* In `HomeScreen.js`, compute or read the user's top Vibe Match in the background and cache `rankedUsers` in `sessionCache`.
* When the user taps **`⚡ Run Vibe Check`** on `HomeScreen.js`, pass `{ rankedUsers: cachedRankedUsers, selectedSongs: userSongs, fromScreen: 'Home' }` into `navigation.navigate('RankedUsers', ...)`.




* **Acceptance Criteria:**
* Clicking `Run Vibe Check` on `HomeScreen.js` immediately displays the ranked community matches (`#1 Sigma`, `#2 Fifth`, `#3 Sam`, etc.) instead of `"No Ranked Connections Yet"`.
* Clicking `← Back` on `RankedUsers.js` returns to `HomeScreen.js` when entered from `HomeScreen.js`, and returns to `Your13.js` when entered from `Your13.js`.



---

## WP-02: Replace `Affinity Graph` Share Icon on `HomeScreen.js` with `iridescentStarCircle`

* **Goal:** Replace the 3-dot digital share icon (`share-social-outline`) on the `HomeScreen.js` `Affinity Graph` button with the same `iridescentStarCircle` logo used on `ProfileScreen.js`.
* **Files to Touch:**
* `HomeScreen.js`


* `ProfileScreen.js` *(reference for exact `iridescentStarCircle` image/component implementation)*




* **Implementation Steps:**
1. Inspect `ProfileScreen.js` to locate how `iridescentStarCircle` is rendered on the profile banner card (either `require('./assets/iridescentStarCircle.png')` or the shared `IridescentStarCircle` component/image).


2. In `HomeScreen.js`, inside the `VIBE CHECK & AFFINITY` hero card, remove `<Ionicons ... name="share-social-outline"/>` from the **`Affinity Graph`** button.


3. Render the `iridescentStarCircle` image (`width: 20, height: 20, borderRadius: 10, marginRight: 8`) inside the `Affinity Graph` button next to the `"Affinity Graph"` label.


* **Acceptance Criteria:**
* The `Affinity Graph` button on `HomeScreen.js` displays the `iridescentStarCircle` logo instead of the 3-dot share icon.



---

## WP-03: Remove the Non-Functional `Vibe Check` Button from `ProfileScreen.js` & Fix Typo Consistency

* **Goal:** Remove the non-functional `Vibe Check` pill button from the horizontal tab bar on `ProfileScreen.js` and unify residual naming typos.
* **Files to Touch:**
* `ProfileScreen.js`


* `HomeScreen.js`




* **Implementation Steps:**
1. Remove `Vibe Check` Pill from `ProfileScreen.js` Sub-Header Bar:


* In `ProfileScreen.js`, locate the horizontal `ScrollView` / pill bar under `"Hi, ${username}"` that currently renders `[Your 13 (12)]`, `[Song Memoirs (2)]`, `[Vibe Check]`, and `[Top Charts ↗]`.
* Delete the **`Vibe Check`** pill button from that bar (and remove any dead `activeSection === 'vibe'` state branch associated with it).
* Also inspect the purple `"V"` circle icon button inside the galaxy banner card on `ProfileScreen.js`: if it is redundant or non-functional, either remove it or ensureonly the working `iridescentStarCircle` Affinity Graph button remains on the banner.


2. Fix Typo Consistency on `ProfileScreen.js` & `HomeScreen.js`:


* In `ProfileScreen.js`: Change `"Your 13 (${count})"` (with a space) in the top pill bar and stats counter label (`"Your 13"` under `12`) to **`"Your13 (${count})"`** and **`"Your13"`** (no space) so it matches `"Your13 (12)"` in the section header below.
* In `HomeScreen.js`: Change `"Capture Today's Musical Memoir"` in the Daily Song Memoir card to **`"Capture Today's Song Memoir"`**.




* **Acceptance Criteria:**
* `ProfileScreen.js` sub-header pill bar only contains functional tabs (`Your13`, `Song Memoirs`, `Top Charts ↗`) with zero dead `Vibe Check` pill.
* `"Your13"` and `"Song Memoir"` are spelled consistently with no `"Your 13"` or `"Musical Memoir"` variants.



---

## WP-04: Fix `UserProfileScreen.js` Tab Switching (`Your13` $\leftrightarrow$ `Song Memoirs`) & Missing Avatar Fallback

* **Goal:** Fix the bug shown at `01:58`–`02:00` in `video_1.mov` where clicking `Your13 (2)` after viewing `Song Memoirs` on `@Alpha`'s profile fails to switch back, and fix the invisible avatar circle on `@Alpha`'s profile (`01:57`).
* **Files to Touch:**
* `UserProfileScreen.js`


* `UserSearchScreen.js`


* `__tests__/homeAndUiSafety.test.js`




* **Implementation Steps:**
1. Fix `selectedTab` State Keys in `UserProfileScreen.js`:


* Audit every reference to `selectedTab` and `setSelectedTab` in `UserProfileScreen.js`.
* Standardize on two exact canonical tab keys (`'your13'` and `'memoirs'`, or `'Your13'` and `'Song Memoirs'`) across:
* `useState(...)` initial value
* Both `<TouchableOpacity onPress="{()"> setSelectedTab(...)}>` tab buttons
* Active tab underline/text styling conditions
* The conditional body rendering (`selectedTab === ... ? <Your13List/> : <MemoirsList/>`).




2. Fix Missing Avatar Fallback & Initial Hydration on `UserProfileScreen.js`:


* Seed `UserProfileScreen.js` initial state (`username`, `profilePicture`, `songs`) from `route.params` and `getCachedUserProfile(targetUid)` so opening `@Alpha` from `UserSearchScreen.js` never flashes `"Profile / Listener / -- Following"` (`01:56`).
* Track `avatarLoadError` state on the profile `<Image>`. Whenever `!profilePicture || avatarLoadError` (or when `profilePicture` is a placeholder string), render the high-contrast `#6366F1` / `#FF8C00` bordered circle with the uppercase first letter of `username` (`"A"` for `Alpha`) so there is never an empty black void above the user's name (`01:57`).




* **Acceptance Criteria:**
* Tapping `Song Memoirs` and then tapping `Your13 (N)` on `UserProfileScreen.js` reliably toggles back and forth between the two tabs on every tap.
* `@Alpha`'s profile renders a visible `"A"` avatar circle immediately on mount.



---

## WP-05: Eliminate Blank Dark Screen Flash on Back-Navigation to `TheCollective.js`

* **Goal:** Eliminate the ~1s blank dark screen shown at `01:22`, `01:26`, and `01:31.5` when returning to `TheCollective.js`, and fix the delayed cover images on `Funny Rap`, `Half good music`, etc. (`01:14`).
* **Files to Touch:**
* `TheCollective.js`


* `utils/imagePreloadUtils.js`


* **Implementation Steps:**
1. Never Blank the Viewport in `TheCollective.js` When Themes Exist:


* In `TheCollective.js`, initialize `themes` state synchronously from `getCachedThemes() || DEFAULT_SEED_THEMES` and set `loading` to `false` whenever `themes.length > 0`.
* Ensure the header (`"The Collective Groove"`), the `FlatList` grid, and `<Taskbar/>` remain mounted at all times—never return an empty `<View '#0A0C10' 1, backgroundColor: flex: style="{{" }}/>` during background Firestore snapshot refreshes.


2. **Preload All Theme Cover URLs (`utils/imagePreloadUtils.js` & `TheCollective.js`):**
* Include all default/seed theme remote URLs (such as the cover images for `Funny Rap`, `Half good music`, `I'm Laughing 'Til I'm Crying`, `It's rude it isn't Friday`) in `preloadCoreThemeAssets()` via `Image.prefetch(url)` at app startup, and cache resolved theme cover URLs in `sessionCache`.




* **Acceptance Criteria:**
* Pressing `← Back` from `Pickerchoosers.js` (`Airplane Mode`, `Child of the 80s`) or tapping the Collective icon in `Taskbar.js` displays `The Collective Groove` grid instantaneously (`0` blank frames).