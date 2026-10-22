# LLM Task & Implementation Spec: What Remains for Full Commercial Viability
## TuneHub / TubeApp (Chorus) — Production Readiness & Store Launch Prompt

> **Instructions for the AI Assistant / Senior Engineer:**
> You are acting as a Principal Mobile Architect, App Store Compliance Specialist, and Cloud Solutions Engineer.
> This document specifies **Part 2: What Remains to Be Done for Full Commercial Viability** of TuneHub (TubeApp / Chorus).
> The architectural foundation, runtime bug fixes, test automation, and local security configurations have already been implemented and verified.
> Your task is to execute the remaining steps necessary to transition the app from local development to App Store / Google Play submission, live Firebase cloud deployment, and commercial operations.
> 
> **CRITICAL RULE**: Do NOT rewrite or regress existing completed components (WebTestingWrapper.js, UserGraph.js, Your13.js, utils/algorithmUtils.js, services/musicApi.js, scripts/seedData.js).

---

## 1. System Baseline & Technology Stack

- **Framework**: React Native `0.75.4` on Expo SDK `51.0.17` (Managed Workflow with EAS).
- **Web QA Runtime**: `@expo/metro-runtime` running on `http://localhost:8081` with `WebTestingWrapper.js` (Viewport simulator: 420px Mobile, 720px Tablet, 100% Full-Width; 1-click test login for `hihicad881@chainds.com`).
- **Backend**: Firebase v10 Modular Web SDK (`firebase/app`, `firebase/auth`, `firebase/firestore`, `firebase/storage`, `firebase/database`).
- **Audio Engine**: `expo-av` streaming 30-second AAC `.m4a` audio previews from the iTunes Search API.
- **Unit Testing**: `jest` + `jest-expo` (`npm test` passes 5/5 algorithm test suites in <0.3s).
- **Production App Identity**: `com.tunehub.chorus` in `app.json` with EAS build configurations in `eas.json`.

---

## 2. Inventory of Completed Work (DO NOT REWRITE OR OVERWRITE)

The following components are **100% complete, tested, and passing**:
1. **Multi-Platform Responsiveness**: `WebTestingWrapper.js` constrains screens to 480px max-width, centers layouts, and eliminates mobile-on-web visual breakage.
2. **Automated Auth Persistence**: `App.js` has an `onAuthStateChanged` gate with a branded dark splash screen auto-booting authenticated sessions to `HomeScreen`.
3. **Affinity Constellation Radar**: `UserGraph.js` centered at coordinate `(360, 360)` with 4 concentric orbit rings, connection rays, normalized percentage badges, interactive SVG node modal inspector, mutual musical DNA, zoom/pan controls, and `Math.max(..., 0.01)` empty-state guards.
4. **Music Identity (Your 13)**: `Your13.js` features a 13-slot tray, `X / 13 Selected` progress bar, 8-property track normalization, `LockContext.js` cooldown locking, and $O(1)$ fast-path precomputed ranking cache checks.
5. **Decoupled Math & Jest Tests**: `utils/algorithmUtils.js` exports pure mathematical functions (`jaccardSimilarity`, `cosineSimilarity`, `levenshteinDistance`, `calculateGenreDistributionSimilarity`, `calculateReleaseYearAffinity`, `computePairwiseAffinity`, `computeSimilarityMatrix`) with zero React/Firebase dependencies. `__tests__/algorithm.test.js` passes 100% of tests.
6. **Centralized Music API**: `services/musicApi.js` provides 380ms debounced iTunes search, 5-minute TTL caching, and `normalizeTrack`.
7. **Mock Seeding Engine**: `scripts/seedData.js` populates 5 realistic mock users (`mock_alice`, `mock_bob`, `mock_charlie`, `mock_diana`, `mock_evan`) with full playlists, daily logs, and Collective shelves.
8. **In-App Account Deletion (Apple Guideline 5.1.1(v))**: `SecuritySettings.js` provides a dedicated Danger Zone with full user data deletion across Firestore, Storage, and Firebase Auth.
9. **User Reporting & Blocking (UGC Compliance)**: `UserProfileScreen.js` and `ChatScreen.js` provide report logging (`reports` collection) and user blocking (`blockedUsers`).
10. **Authored Rules & Cloud Functions**: `firestore.rules`, `storage.rules`, and `functions/index.js` are written and structured.

---

## 3. Data Contracts & Collection Schemas

All backend operations and component states must respect these exact data shapes:

### 3.1 Universal Song Contract (`CanonicalTrack`)
```typescript
interface CanonicalTrack {
  trackId: number;          // Unique iTunes track ID (e.g. 1440857781)
  trackName: string;        // Title (e.g. "Blinding Lights")
  artistName: string;       // Artist (e.g. "The Weeknd")
  collectionName: string;   // Album name (e.g. "After Hours")
  artworkUrl100: string;    // Album art URL (upscaled via getHighResImage)
  previewUrl: string;       // 30-second AAC .m4a stream URL
  primaryGenreName: string; // Genre (e.g. "R&B/Soul", "Pop", "Rock")
  releaseDate: string;      // ISO 8601 string (e.g. "2019-11-29T08:00:00Z")
}
```

### 3.2 Precomputed Ranking Cache Document (`ranking/{userId}`)
```typescript
interface UserRankingCache {
  rankings: Array<{
    uid: string;
    uname: string;
    totalScore: number;     // Float 0.0000 to 1.0000
  }>;
  playlistUpdatedAt: string;
  updatedAt: string;
}
```

### 3.3 User Moderation Report Document (`reports/{reportId}`)
```typescript
interface ModerationReport {
  reportedUid: string;
  reporterUid: string;
  reason: string;
  timestamp: string;
}
```

---

## 4. What Remains to Be Done (The Viability Execution Tasks)

The following four areas represent the exact remaining work to achieve full commercial viability:

```
┌────────────────────────────────────────────────────────────────────────┐
│             REMAINING TASKS FOR COMMERCIAL VIABILITY                   │
├──────────────────┬──────────────────┬──────────────────┬───────────────┤
│     Area 1:      │     Area 2:      │     Area 3:      │    Area 4:    │
│  Legal & Policy  │  Cloud Backend   │ Native Builds &  │ Notifications │
│    Compliance    │    Deployment    │  Store Assets    │ & Retention   │
├──────────────────┼──────────────────┼──────────────────┼───────────────┤
│ • Privacy Policy │ • Rules Deploy   │ • EAS Production │ • APNs Key    │
│ • Terms of Serv. │ • Cloud Function │ • Store Icons    │ • FCM Key     │
│ • In-App Modals  │ • Blaze Check    │ • Metadata & V1  │ • Notif Test  │
└──────────────────┴──────────────────┴──────────────────┴───────────────┘
```

---

### Area 1: Legal Compliance, Privacy Policy & Terms of Service (P0)

**Context**: Apple App Store Guideline 5.1.1 and Google Play User Data policies mandate that any app collecting personal data (user avatars, emails, music taste, chat logs) must provide an accessible Privacy Policy and Terms of Service both inside the app and on the store listing.

#### Subtask 1.1: Add Legal & About Section in `SettingsScreen.js`
1. Add a `"LEGAL & ABOUT"` section to the settings menu.
2. Add two list items:
   - **"Privacy Policy"**: Opens a readable, styled dark modal containing the TuneHub Privacy Policy (or opens an external hosted URL via `Linking.openURL`).
   - **"Terms of Service"**: Opens a readable, styled dark modal containing user agreement terms (addressing user-generated content, music preview rights, and community standards).
   - Display the current App Version (`v1.0.0 (Build 1)`).
3. The Privacy Policy text must explicitly cover:
   - Collection of email and profile image for account authentication.
   - Music playlist and daily song preferences for compatibility calculations.
   - User-generated messages and collective shelf contributions.
   - User rights to delete account and all associated data at any time via Security Settings.
4. The Terms of Service text must explicitly cover:
   - Zero tolerance for objectionable content, harassment, or abusive behavior (Apple UGC requirement).
   - Clarification that 30-second music previews are provided via Apple iTunes API for promotional identification purposes.

#### Subtask 1.2: Add Legal Consent in `WelcomeScreen.js`
1. Add subtle, legible legal text at the bottom of the sign-up/welcome card:
   `"By continuing, you agree to TuneHub's Terms of Service and Privacy Policy."`
2. Make `"Terms of Service"` and `"Privacy Policy"` tappable links that open the respective document modal or URL.

---

### Area 2: Live Firebase Backend Deployment Protocol (P0)

**Context**: Security rules and cloud functions are written locally but must be deployed to the live Firebase project to protect production user data and enable cloud-side similarity matrix calculations.

#### Subtask 2.1: Verify Firebase CLI Authentication & Project Linking
1. Check current Firebase CLI login status:
   ```bash
   firebase login:list
   ```
2. Link the active workspace project:
   ```bash
   firebase use <your-firebase-project-id>
   ```
   *(Verify against `projectId` in `firebaseConfig.js`).*

#### Subtask 2.2: Deploy Security Rules
1. Deploy Firestore Security Rules:
   ```bash
   firebase deploy --only firestore:rules
   ```
2. Deploy Firebase Storage Security Rules:
   ```bash
   firebase deploy --only storage:rules
   ```
3. **Verification**: Attempt an unauthorized read/write using an unauthenticated client or verify in the Firebase Console Rules Simulator that non-owners cannot write to `users/{userId}` or `playlists/{userId}`.

#### Subtask 2.3: Deploy Affinity Matrix Cloud Function
1. Navigate to `functions/`:
   ```bash
   cd functions && npm install && cd ..
   ```
2. Verify `functions/package.json` specifies `"node": "18"` or `"node": "20"` engine.
3. Deploy the Cloud Function:
   ```bash
   firebase deploy --only functions
   ```
   > **Note on Firebase Plan**: Cloud Functions require the Firebase **Blaze (Pay-As-You-Go)** plan. If the project is currently on the free **Spark** plan:
   > - The client-side fallback in `Your13.js` will continue computing pairwise matches on demand.
   > - Document this in deployment notes for the client when upgrading their Firebase plan.

---

### Area 3: Production Builds & Native Store Configuration (P1)

**Context**: Expo standalone apps require native app metadata, icons, and automated build pipeline configuration via EAS Build.

#### Subtask 3.1: Finalize `app.json` Configuration
Verify the following configuration is present:
```json
{
  "expo": {
    "name": "TuneHub",
    "slug": "tunehub",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "dark",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#0A0C10"
    },
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.tunehub.chorus",
      "infoPlist": {
        "NSPhotoLibraryUsageDescription": "TuneHub accesses your photo library so you can upload a profile avatar and share musical memories.",
        "NSCameraUsageDescription": "TuneHub uses your camera so you can capture profile photos and live music moments."
      }
    },
    "android": {
      "package": "com.tunehub.chorus",
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#0A0C10"
      },
      "permissions": [
        "CAMERA",
        "READ_EXTERNAL_STORAGE",
        "WRITE_EXTERNAL_STORAGE"
      ]
    }
  }
}
```

#### Subtask 3.2: Configure EAS Build & Trigger Production Artifacts
1. Login to Expo EAS:
   ```bash
   npx eas-cli login
   ```
2. Verify project linkage:
   ```bash
   npx eas-cli project:init
   ```
3. Trigger build for Android App Bundle (`.aab`) for Google Play:
   ```bash
   npx eas-cli build --platform android --profile production
   ```
4. Trigger build for iOS IPA (`.ipa`) for App Store TestFlight:
   ```bash
   npx eas-cli build --platform ios --profile production
   ```

#### Subtask 3.3: Production Asset Verification
Ensure the following asset files in `assets/` meet minimum store dimensions:
- `assets/icon.png`: 1024 × 1024 px PNG (no alpha transparency for iOS).
- `assets/adaptive-icon.png`: 1024 × 1024 px PNG with foreground centered.
- `assets/splash.png`: High-resolution dark branding image.

---

### Area 4: Push Notifications & User Retention (P2)

**Context**: Social features (friend requests, direct chat messages, daily music drops) require reliable push notifications to sustain active user engagement.

#### Subtask 4.1: Register Device Token & Storage
1. Ensure `registerForPushNotificationsAsync()` in `App.js` captures the Expo Push Token:
   ```javascript
   const token = (await Notifications.getExpoPushTokenAsync()).data;
   ```
2. Update the user document in Firestore:
   ```javascript
   await setDoc(doc(db, 'users', uid), { pushToken: token }, { merge: true });
   ```

#### Subtask 4.2: Upload Production Notification Credentials
In the Expo Dashboard (or via EAS CLI):
1. **iOS**: Generate an Apple Push Notifications service (APNs) Key (`.p8`) in your Apple Developer account and upload it via:
   ```bash
   npx eas-cli credentials
   ```
2. **Android**: Download `google-services.json` from the Firebase Console and configure FCM V1 credentials in EAS.

---

## 5. Verification & Acceptance Checklist

Before considering TuneHub commercially viable, run through this comprehensive verification checklist:

1. **JavaScript Syntax & Compilation**:
   ```bash
   node -c SecuritySettings.js SettingsScreen.js WelcomeScreen.js
   ```
2. **Unit Test Pass Rate**:
   ```bash
   npm test
   ```
   *(Must pass all 5 test suites for compatibility algorithms).*
3. **Web Production Export**:
   ```bash
   npx expo export --platform web --clear
   ```
   *(Must bundle 1,500+ modules with 0 errors).*
4. **End-to-End Account Deletion Validation**:
   - Create a test account or log in with test credentials.
   - Navigate to `Settings` -> `Security` -> `Delete Account`.
   - Confirm deletion alert.
   - Verify all Firestore documents (`users`, `playlists`, `memoirs`, `ranking`) are deleted.
   - Verify the user is routed to `WelcomeScreen` and cannot log in with previous credentials.
5. **App Store Review Safety Checks**:
   - [x] In-app account deletion mechanism functional (Apple Guideline 5.1.1(v)).
   - [x] User reporting and blocking functional on all UGC surfaces (Chat, Profile).
   - [x] Camera and Photo Library usage descriptions in `app.json` are descriptive and user-friendly.
   - [x] Audio streams unload cleanly without memory leaks or background battery drain.
   - [ ] Hosted Privacy Policy and Terms of Service URLs accessible publicly.

---

## 6. Execution Command Summary for the Agent

When ready to apply the remaining code changes and test:
```bash
# 1. Verify tests
npm test

# 2. Check web bundle
npx expo export --platform web --clear

# 3. Test deploy security rules (dry run)
firebase deploy --only firestore:rules,storage:rules --dry-run
```
