# LLM Task & Implementation Spec: Production Viability for TuneHub (TubeApp / Chorus)

> **Instructions for the AI Assistant / Senior Engineer:**
> You are acting as a Senior Full-Stack Mobile Engineer, Security Auditor, and Cloud Solutions Architect.
> Your task is to execute the remaining engineering requirements to bring **TuneHub (TubeApp / Chorus)** to full commercial viability.
> Read the entire specification before writing code.
> 
> **CRITICAL RULE**: Do NOT rewrite or regress existing completed components (`WebTestingWrapper.js`, `UserGraph.js`, `Your13.js`, `utils/algorithmUtils.js`, `services/musicApi.js`, `scripts/seedData.js`, `SecuritySettings.js`).

---

## 1. Project Context & Current Foundation

- **Framework**: React Native `0.75.4` with Expo SDK `51.0.17` (Managed Workflow / Expo Go & EAS).
- **Web Runtime**: Enabled via `@expo/metro-runtime` and `WebTestingWrapper.js` (with 420px Mobile, 720px Tablet, and 100% Full-Width viewports; 1-click test login for `hihicad881@chainds.com`).
- **Backend**: Firebase v10 Modular Web SDK (`firebase/app`, `firebase/auth`, `firebase/firestore`, `firebase/storage`, `firebase/database`).
- **Audio Engine**: `expo-av` (30-second AAC `.m4a` streaming previews from iTunes Search API).
- **State & Theming**: React Native Paper Dark Theme (`#0A0C10`, `#161922`, accent `#FF8C00`), `LockContext.js` backed by `@react-native-async-storage/async-storage`.
- **Unit Testing**: Jest + `jest-expo` (`npm test` passes 5/5 algorithm test suites in <0.3s).

### What Is Already Completed & Verified (DO NOT REVERT OR BREAK):
1. **Web Responsiveness**: `WebTestingWrapper.js` wraps `App.js`, constraining layout widths (480px max-width) and providing 1-click test login for `hihicad881@chainds.com`.
2. **Affinity Constellation Radar**: `UserGraph.js` has centered coordinate geometry (`CENTER = 360`), 4 concentric orbit rings, connection rays, percentage badges, interactive node modal inspector, mutual musical DNA, zoom/pan controls, and `Math.max(..., 0.01)` empty-state guards.
3. **Music Identity**: `Your13.js` features a 13-slot tray, `X / 13 Selected` progress bar, normalized 8-property track schema, cooldown locking, and $O(1)$ fast-path precomputed ranking cache checks.
4. **Audio Playback**: `SongDetailsScreen.js` streams 30-second samples with `expo-av`, provides audio error fallback banners, external streaming buttons ("Listen on Apple Music / Spotify"), and safe audio unloading on unmount.
5. **Decoupled Compatibility Math & Unit Tests**: `utils/algorithmUtils.js` contains pure mathematical affinity functions (`jaccardSimilarity`, `cosineSimilarity`, `levenshteinDistance`, `calculateGenreDistributionSimilarity`, `calculateReleaseYearAffinity`, `computePairwiseAffinity`, `computeSimilarityMatrix`). `__tests__/algorithm.test.js` passes 100% of test suites.
6. **Centralized Music API**: `services/musicApi.js` provides 380ms debounced iTunes search, 5-minute TTL caching, and `normalizeTrack`.
7. **Mock Seeding Engine**: `scripts/seedData.js` populates 5 realistic mock users (`mock_alice`, `mock_bob`, `mock_charlie`, `mock_diana`, `mock_evan`) with full playlists, daily logs, and Collective shelves.
8. **In-App Account Deletion (Apple Guideline 5.1.1(v))**: `SecuritySettings.js` features a Danger Zone that deletes user records across `users`, `playlists`, `memoirs`, `ranking`, and `requests`, purges avatars in `profileImages/{uid}` via Firebase Storage, and calls `deleteUser(user)`.
9. **User Reporting & Blocking (UGC Compliance)**: `UserProfileScreen.js` and `ChatScreen.js` provide report logging (`reports` collection) and user blocking (`blockedUsers`).
10. **Native App Identity & EAS Configuration**: `app.json` is configured with `com.tunehub.chorus`, camera/photo permissions, and `eas.json` build profiles are active.

---

## 2. Universal Song Contract Reference

All components, algorithms, and services must strictly consume and produce this exact track shape:
```typescript
interface CanonicalTrack {
  trackId: number;          // Unique iTunes track identifier (e.g. 1440857781)
  trackName: string;        // Song title (e.g. "Blinding Lights")
  artistName: string;       // Artist name (e.g. "The Weeknd")
  collectionName: string;   // Album name (e.g. "After Hours")
  artworkUrl100: string;    // 100x100 art URL (upscaled to 400x400 via getHighResImage)
  previewUrl: string;       // 30-second AAC .m4a stream URL
  primaryGenreName: string; // Genre string (e.g. "R&B/Soul", "Pop", "Rock")
  releaseDate: string;      // ISO string (e.g. "2019-11-29T08:00:00Z")
}
```

---

## 3. What Remains to Be Done for Full Commercial Viability

The remaining tasks focus on live cloud deployment, legal compliance, store submission assets, and push retention.

```
┌────────────────────────────────────────────────────────────────────────┐
│                   TUNEHUB REMAINING VIABILITY SPRINT                   │
├──────────────────┬──────────────────┬──────────────────┬───────────────┤
│    Pillar 1:     │    Pillar 2:     │    Pillar 3:     │   Pillar 4:   │
│   Legal & Store  │  Cloud Backend   │ Production Build │ Notifications │
│    Compliance    │    Deployment    │  & Store Assets  │ & Retention   │
├──────────────────┼──────────────────┼──────────────────┼───────────────┤
│ • Privacy Policy │ • Rules Deploy   │ • EAS Production │ • APNs Key    │
│ • Terms of Serv. │ • Cloud Function │ • Store Icons    │ • FCM Key     │
│ • Consent Banner │ • Blaze Check    │ • TestFlight V1  │ • Notif Test  │
└──────────────────┴──────────────────┴──────────────────┴───────────────┘
```

---

### Pillar 1: Store Compliance & Legal Documentation (P0)

#### Task 1.1: Privacy Policy & Terms of Service in `SettingsScreen.js`
- **Target File**: `SettingsScreen.js`
- **Objective**: Provide accessible legal policies inside the app to satisfy Apple Guideline 5.1.1 and Google Play requirements.
- **Requirements**:
  1. Add a `"LEGAL & ABOUT"` section to the settings menu.
  2. Add two actionable list items:
     - **"Privacy Policy"**: Opens a dark modal or external URL detailing data handling (account authentication, music playlists, daily song logs, user avatars, and permanent deletion rights).
     - **"Terms of Service"**: Opens a dark modal or external URL detailing zero tolerance for abusive UGC, content reporting mechanisms, and Apple Music / iTunes API attribution.
     - Display app version label: `TuneHub v1.0.0 (Build 1)`.

#### Task 1.2: Legal Consent on `WelcomeScreen.js`
- **Target File**: `WelcomeScreen.js`
- **Objective**: Ensure express consent prior to account creation.
- **Requirements**:
  1. Add fine print below the sign-up form:
     `"By continuing, you agree to TuneHub's Terms of Service and Privacy Policy."`
  2. Allow tapping the links to inspect the terms.

---

### Pillar 2: Live Firebase Backend Deployment Protocol (P0)

#### Task 2.1: Deploy Security Rules
- **Target Files**: `firestore.rules`, `storage.rules`
- **Commands**:
  ```bash
  firebase deploy --only firestore:rules
  firebase deploy --only storage:rules
  ```
- **Requirements**:
  1. Verify rules are active on the live Firebase project.
  2. Ensure non-owners cannot write to other users' profiles, playlists, or private memoirs.

#### Task 2.2: Deploy Background Affinity Cloud Function
- **Target Files**: `functions/index.js`, `functions/package.json`
- **Commands**:
  ```bash
  cd functions && npm install && cd ..
  firebase deploy --only functions
  ```
- **Notes**:
  - Cloud Functions require Firebase Blaze plan.
  - If project is on Spark plan, the client-side O(1) ranking cache fallback in `Your13.js` handles calculation on-device.

---

### Pillar 3: Production Store Builds & Identity (P1)

#### Task 3.1: EAS Production Build Generation
- **Target Files**: `app.json`, `eas.json`
- **Commands**:
  ```bash
  # Android App Bundle for Google Play
  npx eas-cli build --platform android --profile production

  # iOS IPA for App Store TestFlight
  npx eas-cli build --platform ios --profile production
  ```

#### Task 3.2: Store Assets Audit
- Ensure `assets/icon.png` is 1024x1024 px PNG with no alpha transparency.
- Ensure `assets/adaptive-icon.png` is 1024x1024 px PNG with centered logo.
- Prepare store screenshots (iPhone 6.7" & 5.5", Android Phone).

---

### Pillar 4: Push Notifications & User Retention (P2)

#### Task 4.1: APNs & FCM Production Keys
- In Expo EAS Dashboard:
  - Configure Apple Push Notification key (`.p8`) under iOS credentials.
  - Configure Google Cloud Messaging / FCM V1 credentials under Android credentials.
- Test sending push notifications for friend requests and direct messages using `sendExpoPushNotification` in `ChatScreen.js` and `HandlingFriends.js`.

---

## 4. Verification Protocol for the AI Agent

Run the following commands to ensure no regressions:
```bash
# 1. Run algorithm test suite
npm test

# 2. Check web bundle integrity
npx expo export --platform web --clear

# 3. Syntax check
node -c SettingsScreen.js WelcomeScreen.js SecuritySettings.js
```
