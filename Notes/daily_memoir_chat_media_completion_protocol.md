# Antigravity Autonomous Completion Protocol: Daily Rhythm, Memoirs, Chat & Media Pipeline

You are an autonomous Senior Mobile Infrastructure, Database & Social Systems Engineer operating within Antigravity. Your objective is to resolve critical runtime exceptions, eliminate query bottlenecks, harmonize fragmented track data contracts, and complete the social and media infrastructure of **TuneHub (TubeApp / Chorus)** across **Daily Rhythm Charts**, **Memoirs**, **Real-Time Direct Messaging**, and the **Media Upload Pipeline**.

---

## 1. Established Schemas & Data Contracts

### A. Daily Rhythm Charts ([RankedMusicList.js](file:///Users/marlyjean-baptiste/APP/TubeApp/RankedMusicList.js) & [MusicOfTheDayScreen.js](file:///Users/marlyjean-baptiste/APP/TubeApp/MusicOfTheDayScreen.js))
* **Collection:** `daily/{docId}` where `docId` is `${userId}_${date}` (format: `YYYY-MM-DD`).
* **Document Schema:**
  ```typescript
  {
    username: string,
    userId?: string,
    date: string, // 'YYYY-MM-DD'
    music: {
      id?: number,
      trackId?: number,
      title: string,        // Canonical trackName
      artist: string,       // Canonical artistName
      genre: string,        // Canonical primaryGenreName
      releaseDate?: string,
      imageUrl: string      // Canonical artworkUrl100
    },
    updatedAt?: string | Timestamp
  }
  ```
* **Aggregation Contract:** Dynamically tallies and sorts three distinct community leaderboards for any selected calendar date:
  1. **Top Songs:** Unique key `${music.title}-${music.artist}`, sorted descending by submission count.
  2. **Top Artists:** Grouped across all user daily selections for that date, sorted descending by count.
  3. **Top Genres:** Aggregated genre frequency for that date, sorted descending by count.

---

### B. Memoir Chronology & Vault ([Memoir.js](file:///Users/marlyjean-baptiste/APP/TubeApp/Memoir.js) & [MemoirHistoryScreen.js](file:///Users/marlyjean-baptiste/APP/TubeApp/MemoirHistoryScreen.js))
* **Collection:** `memoirs/{userId}`
* **Document Schema:**
  ```typescript
  {
    pastMemoirs: Array<{
      id?: string, // Deterministic item ID for safe deletion
      item: {
        trackId: number,
        trackName: string,
        artistName: string,
        artworkUrl100: string,
        releaseDate?: string,
        primaryGenreName?: string
      },
      comment: string,
      timestamp: Timestamp // Firestore server Timestamp
    }>
  }
  ```
* **Contract:** Chronological personal journal preserving musical memories with cover artwork, track titles, artist names, user reflections, and timestamp-resilient array mutations.

---

### C. Real-Time Chat System ([MainChatScreen.js](file:///Users/marlyjean-baptiste/APP/TubeApp/MainChatScreen.js) & [ChatScreen.js](file:///Users/marlyjean-baptiste/APP/TubeApp/ChatScreen.js))
* **Parent Collection:** `chats/{chatDocId}`
* **Parent Schema:**
  ```typescript
  {
    chatId: string,          // Deterministic sorted composite key: `${minUid}_${maxUid}`
    participants: string[],  // Array of 2 UIDs: [uidA, uidB]
    createdAt: number        // Epoch milliseconds: Date.now()
  }
  ```
* **Subcollection:** `chats/{chatDocId}/messages/{messageId}`
* **Message Schema:**
  ```typescript
  {
    userId: string,          // Sender UID
    text: string,            // Message content
    timestamp: number        // Epoch milliseconds: Date.now()
  }
  ```

---

### D. Media Storage & Avatar Pipeline ([UploadProfilePicture.js](file:///Users/marlyjean-baptiste/APP/TubeApp/UploadProfilePicture.js))
* **Firebase Storage Bucket Path:** `profileImages/${userId}/${timestamp}`
* **Gallery Collection:** `images/{docId}`
  ```typescript
  {
    userId: string,
    downloadURL: string,
    uploadedAt: Timestamp | Date
  }
  ```
* **Sync Target:** Updates `users/{userId}.profileImageUrl` with the latest `downloadURL` upon successful upload.

---

### E. Universal Track Normalizer Contract
To eliminate multi-screen schema drift, all modules must use a bidirectional track adapter:
```typescript
interface CanonicalTrack {
  trackId: number;
  trackName: string;
  artistName: string;
  collectionName: string;
  artworkUrl100: string;
  previewUrl: string;
  primaryGenreName: string;
  releaseDate: string;
}
```
* **Legacy Map (`MusicOfTheDay` / `RankedMusicList`):**
  - `title` ⇄ `trackName`
  - `artist` ⇄ `artistName`
  - `genre` ⇄ `primaryGenreName`
  - `imageUrl` ⇄ `artworkUrl100`

---

## 2. Critical Bugs & Vulnerabilities Audit

### 1. Fatal Storage Deletion Crash in [UploadProfilePicture.js](file:///Users/marlyjean-baptiste/APP/TubeApp/UploadProfilePicture.js)
* **Vulnerability:** Line 98 invokes `await deleteField(storageRef);`. `deleteField` is a Firestore FieldValue sentinel, NOT a Firebase Storage function. Calling this on a Storage reference throws an uncaught fatal `TypeError: deleteField is not a function`.
* **Fix:** Replace with `deleteObject(storageRef)` imported directly from `firebase/storage`.

### 2. Route Params Crash in [MemoirHistoryScreen.js](file:///Users/marlyjean-baptiste/APP/TubeApp/MemoirHistoryScreen.js)
* **Vulnerability:** Line 13 executes `const initialMemoirs = route.params.pastMemoirs || [];` without optional chaining. Navigating directly or via deep links throws `TypeError: Cannot read properties of undefined (reading 'pastMemoirs')`.
* **Fix:** Use `route?.params?.pastMemoirs || []` and fallback to fetching live from `memoirs/{userId}` in Firestore when initial memoirs are omitted.

### 3. Silent Deletion Failure via `arrayRemove` in [MemoirHistoryScreen.js](file:///Users/marlyjean-baptiste/APP/TubeApp/MemoirHistoryScreen.js)
* **Vulnerability:** Line 30 attempts deletion using `updateDoc(userRef, { pastMemoirs: arrayRemove(memoirToDelete) })`. Firestore `arrayRemove` requires exact byte-for-byte object equality. When Timestamp instances pass through navigation parameters, they serialize into generic JS objects, causing `arrayRemove` to fail silently and leaving the deleted memoir in the database.
* **Fix:** Fetch the current document array, filter by unique item ID or timestamp seconds, and rewrite the array using `setDoc(userRef, { pastMemoirs: filteredMemoirs }, { merge: true })`.

### 4. Missing Null Guards in [RankedMusicList.js](file:///Users/marlyjean-baptiste/APP/TubeApp/RankedMusicList.js)
* **Vulnerability:** Line 39 directly accesses `music.title`, `music.artist`, and `music.genre` without validating `doc.data().music`. If any user logged an incomplete or empty daily entry, it throws `TypeError: Cannot read properties of undefined (reading 'title')`, breaking the entire charts view.
* **Fix:** Validate that `data?.music?.title && data?.music?.artist` exist before adding to aggregation maps.

### 5. N+1 Query Bottleneck in [MainChatScreen.js](file:///Users/marlyjean-baptiste/APP/TubeApp/MainChatScreen.js)
* **Vulnerability:** Inside the `onSnapshot` listener, `MainChatScreen` fires `Promise.all` calling `getDoc(userDocRef)` AND `loadUserProfilePic(otherParticipantId)` for every single chat thread. `loadUserProfilePic` runs a separate compound Firestore query over `images` ordered by `uploadedAt`, multiplying read costs by 2N+1 on every chat update.
* **Fix:** Read `profileImageUrl` directly from `users/{otherParticipantId}` in a single pass. Cache user records in a local dictionary (`userCache[uid]`) to eliminate redundant queries.

### 6. Missing Composite Index Crash in [UploadProfilePicture.js](file:///Users/marlyjean-baptiste/APP/TubeApp/UploadProfilePicture.js)
* **Vulnerability:** Querying `images` with both `where('userId', '==', userId)` and `orderBy('uploadedAt', 'desc')` requires an index that throws an unhandled error if unprovisioned.
* **Fix:** Read avatars directly from `users/{userId}.profileImageUrl`, or catch index errors with fallback client-side sorting.

### 7. Track Schema Drift Across Features
* **Vulnerability:** Three competing track formats exist simultaneously:
  - `MusicOfTheDayScreen.js` / `RankedMusicList.js`: `{ title, artist, genre, imageUrl }`
  - `Memoir.js` / `MemoirHistoryScreen.js`: `{ trackName, artistName, artworkUrl100 }`
  - `Your13.js` / `SongDetailsScreen.js`: Canonical 8-property schema.
* **Fix:** Implement universal normalization in a shared utility or helper functions so all screens can seamlessly read from and write to any song payload.

---

## 3. Core Rules & Constraints

1. **Production-Ready Implementations:**
   - No mock data, no static returns, and no unhandled error rejections.
   - All Firestore reads must include defensive null guards for missing or malformed documents.
2. **Deterministic Mutation Over Fragile Sentinels:**
   - Avoid `arrayRemove` on complex nested objects with timestamps. Use fetch-filter-set patterns to guarantee reliable removals.
3. **Optimized Read Budget:**
   - Consolidate user profile and avatar reads into `users/{userId}` to prevent N+1 query storms.
4. **Clean Resource Cleanup:**
   - Every `onSnapshot` subscription must return its `unsubscribe` function inside a `useEffect` cleanup return.

---

## 4. Phase 1: Prioritized Execution Plan

- [ ] **Task 1: Fix Fatal Storage & Firestore Mutation Bugs**
  - Fix `deleteImage` in [UploadProfilePicture.js](file:///Users/marlyjean-baptiste/APP/TubeApp/UploadProfilePicture.js): import and call `deleteObject(storageRef)`.
  - Fix [MemoirHistoryScreen.js](file:///Users/marlyjean-baptiste/APP/TubeApp/MemoirHistoryScreen.js): replace `arrayRemove` with robust fetch-filter-set mutation and add `route?.params?.pastMemoirs` guards.
  
- [ ] **Task 2: Harden Daily Rhythm Charts & Aggregations ([RankedMusicList.js](file:///Users/marlyjean-baptiste/APP/TubeApp/RankedMusicList.js))**
  - Add null guards to document iteration in `RankedMusicList.js` so entries missing `music` or `music.title` are gracefully skipped.
  - Standardize aggregation keys using canonical names (`trackName || title`, `artistName || artist`).
  - Add empty-state views for dates without logged songs.

- [ ] **Task 3: Eliminate N+1 Chat Query Storm ([MainChatScreen.js](file:///Users/marlyjean-baptiste/APP/TubeApp/MainChatScreen.js))**
  - Refactor `MainChatScreen.js` to read `profileImageUrl` directly from `users/{otherParticipantId}`.
  - Implement a session memory cache for user profiles so repeated threads do not re-fetch existing users.
  - Ensure [ChatScreen.js](file:///Users/marlyjean-baptiste/APP/TubeApp/ChatScreen.js) orders messages chronologically and correctly unsubs on blur.

- [ ] **Task 4: Universal Track Normalizer & Drift Reconciliation**
  - Add a shared helper `normalizeTrack(item)` across [MusicOfTheDayScreen.js](file:///Users/marlyjean-baptiste/APP/TubeApp/MusicOfTheDayScreen.js), [RankedMusicList.js](file:///Users/marlyjean-baptiste/APP/TubeApp/RankedMusicList.js), and [Memoir.js](file:///Users/marlyjean-baptiste/APP/TubeApp/Memoir.js).
  - Guarantee that clicking a song on `RankedMusicList` or `Memoir` opens [SongDetailsScreen.js](file:///Users/marlyjean-baptiste/APP/TubeApp/SongDetailsScreen.js) with full 30-second audio previews.

- [ ] **Task 5: Media Pipeline & Storage Index Hardening ([UploadProfilePicture.js](file:///Users/marlyjean-baptiste/APP/TubeApp/UploadProfilePicture.js))**
  - Catch composite index errors gracefully on `images` queries.
  - Ensure successful upload writes directly to `users/{userId}.profileImageUrl` and triggers immediate local UI refresh.

---

## 5. Phase 2: Systematic Execution Loop

For each task in the checklist:
1. **Announce Scope:** Name the target component, exact lines modified, and Firestore collection affected.
2. **Implement Atomically:** Perform focused code replacements preserving existing UI styling and Paper dark theme tokens.
3. **Verify via Tools:**
   - Syntax validation:
     ```bash
     node -c UploadProfilePicture.js MemoirHistoryScreen.js Memoir.js RankedMusicList.js MainChatScreen.js ChatScreen.js
     ```
   - Bundler export dry-run:
     ```bash
     npx expo export --platform web --clear
     ```
4. **Self-Correction:** If an unexpected Firestore document shape or undefined property is encountered, add immediate defensive fallbacks and re-verify until green.
5. **Mark Done:** Advance to the next task until all 5 tasks are verified.

---

## 6. Phase 3: Final Integration & Verification

1. **End-to-End Verification Checklist:**
   - [ ] Navigate to **Music of the Day** → select daily track → verifies document saved to `daily/{userId}_{today}`.
   - [ ] Navigate to **Ranked Music List** → verifies Top Songs, Top Artists, and Top Genres aggregate correctly without throwing on empty entries.
   - [ ] Navigate to **Memoir** → save a musical memory with comment → inspect in **Memoir History**.
   - [ ] Delete a memoir in **Memoir History** → verify document updates in Firestore and removes item from UI immediately.
   - [ ] Open **Main Chat Screen** → verify chat list loads with avatars in a single query pass without console warnings.
   - [ ] Send and receive messages in **Chat Screen** → verify real-time snapshot sync.
   - [ ] Upload profile picture in **UploadProfilePicture** → verify upload succeeds and delete button removes file from Storage without `deleteField` crash.
2. **Handoff:**
   - Summarize resolved vulnerabilities, query cost savings, and verified user flows.
