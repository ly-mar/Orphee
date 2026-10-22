# Antigravity Autonomous Completion Protocol: Your13 Feature

You are an autonomous Senior Mobile & Audio Engineer operating within Antigravity. Your objective is to drive the **Your13** music identity feature of **TuneHub (TubeApp / Chorus)** from its current state to a fully completed, tested, robust, and delightful state built with **React Native (0.75)**, **Expo (SDK 51)**, **Expo-AV**, and **Firebase Firestore (v10)**.

---

## Feature Scope & Core Modules

The **Your13** ecosystem spans the following tightly coupled components:
- **[Your13.js](file:///Users/marlyjean-baptiste/APP/TubeApp/Your13.js)**: Main 13-slot curation dashboard, debounced iTunes search, slot tray, progress tracking, and affinity launch.
- **[LockContext.js](file:///Users/marlyjean-baptiste/APP/TubeApp/LockContext.js)**: Cooldown state machine backed by AsyncStorage to prevent rapid track flipping.
- **[SongDetailsScreen.js](file:///Users/marlyjean-baptiste/APP/TubeApp/SongDetailsScreen.js)**: Deep song inspection card with real 30-second audio preview.
- **[ViewChoicesScreen.js](file:///Users/marlyjean-baptiste/APP/TubeApp/ViewChoicesScreen.js)**: Full-fidelity list of chosen tracks with deletion confirmations and Firestore sync.
- **[Algo.js](file:///Users/marlyjean-baptiste/APP/TubeApp/Algo.js)**: Mathematical compatibility engine comparing a user's 13 signature tracks with other community members.
- **[RankedUsers.js](file:///Users/marlyjean-baptiste/APP/TubeApp/RankedUsers.js)**: Music twin discovery screen fed directly by Your13 similarity matrices.

---

## Core Rules & Constraints for Your13

1. **No Mocking or Placeholders:**
   - **Real iTunes Catalog:** Search live against `https://itunes.apple.com/search?term=...&entity=song&limit=25`. Debounce requests (350–400ms) to prevent rate limiting.
   - **Real Audio Previews:** Implement real 30-second sample playback using `expo-av` (`Audio.Sound`). Remove all placeholder `alert('Playing...')` calls. Ensure only one song plays at a time and audio unloads on route change or component unmount.
   - **Real Firestore Sync:** Persist track arrays directly to `playlists/{userId}` in Firestore with valid timestamping.
2. **Standardized Song Model Contract:**
   All components must consume and serialize the exact same track object schema:
   ```javascript
   {
     trackId: number,            // iTunes unique track ID
     trackName: string,          // Song title
     artistName: string,         // Artist / Band name
     collectionName: string,     // Album name
     artworkUrl100: string,      // 100x100 art URL (upscaled to 400x400 for covers)
     previewUrl: string,         // 30-second AAC/MP3 preview stream URL
     primaryGenreName: string,   // Genre (used in Algo.js)
     releaseDate: string         // ISO date string (used in Algo.js chronological scoring)
   }
   ```
   *Eliminate legacy mismatches (e.g. `song.imageUrl`, `song.title`, `song.artist` in [SongDetailsScreen.js](file:///Users/marlyjean-baptiste/APP/TubeApp/SongDetailsScreen.js)).*
3. **Strict 1 to 13 Slot Rules:**
   - Hard cap of 13 tracks. Users cannot add a 14th track without removing or swapping an existing slot.
   - No duplicate tracks: prevent adding a `trackId` already present in `selectedChoices`.
   - Empty slots (1 through 13) must render clean placeholder states with slot numbers.
4. **Resilient Lockout State Machine ([LockContext.js](file:///Users/marlyjean-baptiste/APP/TubeApp/LockContext.js)):**
   - Automatically trigger lockout (e.g., 60-second cooldown) when all 13 slots are filled and saved.
   - Persist lock start time and duration to `@react-native-async-storage/async-storage` so locks persist through app kill/restart.
   - Disable removal and swap actions while locked, providing informative countdown toast/banner feedback.
5. **Database Path & User ID Consistency:**
   - Consistently use `user.uid` as the document ID in `playlists/{userId}` across **both** [Your13.js](file:///Users/marlyjean-baptiste/APP/TubeApp/Your13.js) and [ViewChoicesScreen.js](file:///Users/marlyjean-baptiste/APP/TubeApp/ViewChoicesScreen.js) (fixing the bug where `ViewChoicesScreen` referenced `username` / `displayName` instead of `uid`).

---

## Phase 1: Feature Audit & Prioritized Execution Plan

### 1. Audit Gaps in the Current Implementation
- [ ] **Data Schema Discrepancy:** [SongDetailsScreen.js](file:///Users/marlyjean-baptiste/APP/TubeApp/SongDetailsScreen.js) expects `title`, `artist`, `imageUrl` instead of `trackName`, `artistName`, `artworkUrl100`.
- [ ] **Audio Playback Gap:** [SongDetailsScreen.js](file:///Users/marlyjean-baptiste/APP/TubeApp/SongDetailsScreen.js) uses `alert(...)` instead of `expo-av` Sound player; [Your13.js](file:///Users/marlyjean-baptiste/APP/TubeApp/Your13.js) search cards lack inline audio previews.
- [ ] **Firestore Document ID Mismatch:** [ViewChoicesScreen.js](file:///Users/marlyjean-baptiste/APP/TubeApp/ViewChoicesScreen.js) attempts to update `playlists/{username}` rather than `playlists/{userId}`.
- [ ] **Audio Leak Hazard:** Audio instances in `expo-av` are not safely unloaded on screen blur/unmount.
- [ ] **Slot Interaction Polish:** Tapping an existing filled slot should allow direct audio preview or deep inspection via [SongDetailsScreen.js](file:///Users/marlyjean-baptiste/APP/TubeApp/SongDetailsScreen.js).

### 2. Dependency-Ordered Task Checklist

1. **Task 1: Unify Data Contract & Fix Firestore Sync**
   - Standardize track dictionary keys across [Your13.js](file:///Users/marlyjean-baptiste/APP/TubeApp/Your13.js), [ViewChoicesScreen.js](file:///Users/marlyjean-baptiste/APP/TubeApp/ViewChoicesScreen.js), and [SongDetailsScreen.js](file:///Users/marlyjean-baptiste/APP/TubeApp/SongDetailsScreen.js).
   - Ensure `ViewChoicesScreen.js` receives `userId` in `route.params` and persists changes to `playlists/{userId}`.
   - Implement optimistic local state updates with silent background Firestore synchronization.

2. **Task 2: Audio Preview Engine (`expo-av`)**
   - Implement audio playback controller in [SongDetailsScreen.js](file:///Users/marlyjean-baptiste/APP/TubeApp/SongDetailsScreen.js) and optionally inline play/stop icons in [Your13.js](file:///Users/marlyjean-baptiste/APP/TubeApp/Your13.js) search results.
   - Configure audio mode (`setAudioModeAsync`) for ambient playback.
   - Register unmount and navigation focus listener cleanups (`sound.unloadAsync()`) to guarantee zero audio leaks.

3. **Task 3: 13-Slot UI & Curation Flow ([Your13.js](file:///Users/marlyjean-baptiste/APP/TubeApp/Your13.js))**
   - Refine the horizontal tray (Slots #1 to #13) to render high-res album covers (`artworkUrl100.replace('100x100', '400x400')`), track titles, artist names, and quick-remove buttons.
   - Wire slot tap events: tapping an empty slot scrolls to or focuses the search bar; tapping a filled slot opens [SongDetailsScreen.js](file:///Users/marlyjean-baptiste/APP/TubeApp/SongDetailsScreen.js).
   - Smooth progress bar transition (`X/13 Selected`) with distinct visual celebration when 13/13 is achieved.

4. **Task 4: Cooldown & Lockout Safeguards ([LockContext.js](file:///Users/marlyjean-baptiste/APP/TubeApp/LockContext.js))**
   - Verify `AsyncStorage` read/write of lock timestamps.
   - Ensure lock timer counts down accurately in the background and restores correctly when returning to the app.
   - Safeguard removal buttons in both [Your13.js](file:///Users/marlyjean-baptiste/APP/TubeApp/Your13.js) and [ViewChoicesScreen.js](file:///Users/marlyjean-baptiste/APP/TubeApp/ViewChoicesScreen.js) when `isLocked === true`.

5. **Task 5: Music Twin Matching Pipeline ([Algo.js](file:///Users/marlyjean-baptiste/APP/TubeApp/Algo.js) + [RankedUsers.js](file:///Users/marlyjean-baptiste/APP/TubeApp/RankedUsers.js))**
   - Audit `loadAllPlaylists()` in [Your13.js](file:///Users/marlyjean-baptiste/APP/TubeApp/Your13.js): handle empty playlists, malformed documents, or users with fewer than 13 tracks without throwing exceptions.
   - Ensure weights `[0.50, 0.35, 0.075, 0.075]` produce normalized affinity percentages (0%–100%).
   - Seamlessly navigate to [RankedUsers.js](file:///Users/marlyjean-baptiste/APP/TubeApp/RankedUsers.js) passing authenticated user affinity rankings.

---

## Phase 2: Systematic Execution Loop

For each task in the checklist:
1. **Announce Scope:** State the file(s) being updated, the schema properties touched, and the audio/state lifecycle involved.
2. **Inspect & Implement:** Apply surgical replacements. Retain existing styling, Paper dark theme tokens (`#0D0E12`, `#FF8C00`), and responsiveness.
3. **Run Verification:**
   - Syntax validation:
     ```bash
     node -c Your13.js SongDetailsScreen.js ViewChoicesScreen.js LockContext.js Algo.js
     ```
   - Metro bundle compilation check:
     ```bash
     npx expo export --platform web --clear
     ```
4. **Self-Correction:** If audio fails to load, `previewUrl` is null/expired for an iTunes track, or Metro reports missing modules, handle the edge case immediately (e.g. fallback banner for missing preview audio) and re-verify until clean.
5. **Mark Done:** Transition to the next task until the entire Your13 suite is verified.

---

## Phase 3: Final Integration & Verification

1. **End-to-End User Journey Verification:**
   - [ ] Type an artist name into the search bar → debounced query triggers and renders live iTunes results.
   - [ ] Tap play on a track → real 30-second audio preview plays cleanly.
   - [ ] Tap "Add as Track #X" → slot fills, progress bar increments, and changes auto-persist to Firestore.
   - [ ] Fill all 13 slots → confirmation triggers, lock banner activates with countdown, and removal is disabled.
   - [ ] Tap "View All" → navigates to [ViewChoicesScreen.js](file:///Users/marlyjean-baptiste/APP/TubeApp/ViewChoicesScreen.js) with accurate slot list and proper delete confirmation dialogs.
   - [ ] Tap a track card → opens [SongDetailsScreen.js](file:///Users/marlyjean-baptiste/APP/TubeApp/SongDetailsScreen.js) showing full metadata, cover art, and functional audio preview button.
   - [ ] Tap "Find Music Twins" → [Algo.js](file:///Users/marlyjean-baptiste/APP/TubeApp/Algo.js) computes scores across all community playlists and opens [RankedUsers.js](file:///Users/marlyjean-baptiste/APP/TubeApp/RankedUsers.js) without errors.
   - [ ] Exit screen → all audio instances immediately stop and unload without memory leaks.
2. **Cleanliness:**
   - Remove temporary `console.log` statements and unused variables.
3. **Handoff Report:**
   - Output a summary of fixes made across Your13 screens, Firestore payload structures, audio lifecycle handlers, and instructions to test the feature locally.
