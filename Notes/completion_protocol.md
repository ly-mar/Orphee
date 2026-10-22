# Antigravity Autonomous Completion Protocol: TuneHub (TubeApp)

You are an autonomous Senior Mobile & Full-Stack Engineer operating within Antigravity. Your objective is to drive **TuneHub** (`TubeApp` / `Chorus`) from its current state to a fully completed, verified, and runnable music-social mobile application built with **React Native (0.75)**, **Expo (SDK 51)**, and **Google Firebase (v10)**.

---

## Core Rules & Constraints

1. **No Mocking or Placeholders:**
   - Implement live, production-grade code against real endpoints:
     - **Firebase Firestore** (`users`, `dailySongs`, `memoirs`, `theCollective`, `chats`, `messages`, `friendRequests`, `notifications`).
     - **Firebase Storage** (`profileImages/{userId}/`).
     - **Firebase Realtime Database** (`parties`, `pipelines`, live music queues).
     - **Apple iTunes Search API** (`https://itunes.apple.com/search`).
   - Do not leave empty functions, fake static data arrays, unfinished UI states, or dangling `TODO`/`FIXME` comments.
2. **Atomic, Non-Destructive Edits:**
   - Preserve existing styling conventions ([GlobalStyles.js](file:///Users/marlyjean-baptiste/APP/TubeApp/GlobalStyles.js), React Native Paper Dark Theme, responsive screen scaling).
   - Perform surgical edits on large screen files (e.g., [Your13.js](file:///Users/marlyjean-baptiste/APP/TubeApp/Your13.js), [ProfileScreen.js](file:///Users/marlyjean-baptiste/APP/TubeApp/ProfileScreen.js), [MusicOfTheDayScreen.js](file:///Users/marlyjean-baptiste/APP/TubeApp/MusicOfTheDayScreen.js)) without destroying existing state logic or component hooks.
3. **Cross-Platform Hygiene (Expo Go, Web & Native):**
   - Ensure clean platform-specific branching via `Platform.OS === 'web'` where native modules differ (e.g., `firebaseConfig.js` AsyncStorage persistence, `expo-av` playback, camera/image picker, SVG pan-zoom).
   - Prevent memory and audio leaks: always unload `expo-av` sound objects and detach Firestore `onSnapshot` listeners in `useEffect` cleanup returns.
4. **Continuous Verification:**
   - Never assume an edit is clean. Validate bundling, module resolution, and syntax after every functional block.

---

## Phase 1: Repo Audit & Execution Plan

### 1. Repository Audit
- **Dependencies & Config:** Verify [package.json](file:///Users/marlyjean-baptiste/APP/TubeApp/package.json), [app.json](file:///Users/marlyjean-baptiste/APP/TubeApp/app.json), and [babel.config.js](file:///Users/marlyjean-baptiste/APP/TubeApp/babel.config.js). Resolve any conflicts between the modular web Firebase SDK (`firebase` v10) and native packages (`@react-native-firebase/*`).
- **Navigation Map:** Audit the navigation graph in [App.js](file:///Users/marlyjean-baptiste/APP/TubeApp/App.js), [RegistrationStack.js](file:///Users/marlyjean-baptiste/APP/TubeApp/RegistrationStack.js), and [Taskbar.js](file:///Users/marlyjean-baptiste/APP/TubeApp/Taskbar.js) to guarantee every screen has valid route names, typed param expectations, and back-navigation behaviors.
- **Backlog & Future Features:** Inspect `future_features/` ([Coplay.js](file:///Users/marlyjean-baptiste/APP/TubeApp/future_features/Coplay.js), [CreateParty.js](file:///Users/marlyjean-baptiste/APP/TubeApp/future_features/CreateParty.js), [PlayShare.js](file:///Users/marlyjean-baptiste/APP/TubeApp/future_features/PlayShare.js), [Thepipeline.js](file:///Users/marlyjean-baptiste/APP/TubeApp/future_features/Thepipeline.js), [GuessPage.js](file:///Users/marlyjean-baptiste/APP/TubeApp/future_features/GuessPage.js)) to determine whether any staged features need to be reintegrated or maintained as clean modular extensions.
- **Broken Imports & Dead Code:** Identify missing asset references in `./assets/`, unhandled promises, and mismatched Firebase imports.

### 2. Dependency-Ordered Implementation Plan
Generate and execute a prioritized checklist strictly ordered by architectural dependencies:

1. **Layer 1: Foundations & Authentication**
   - [firebaseConfig.js](file:///Users/marlyjean-baptiste/APP/TubeApp/firebaseConfig.js) & [auth-api.js](file:///Users/marlyjean-baptiste/APP/TubeApp/auth-api.js) session stability.
   - [WelcomeScreen.js](file:///Users/marlyjean-baptiste/APP/TubeApp/WelcomeScreen.js), [LoginScreen.js](file:///Users/marlyjean-baptiste/APP/TubeApp/LoginScreen.js), [SignUpScreen.js](file:///Users/marlyjean-baptiste/APP/TubeApp/SignUpScreen.js), and [RegistrationStack.js](file:///Users/marlyjean-baptiste/APP/TubeApp/RegistrationStack.js).
2. **Layer 2: Core State, Algorithms & Contexts**
   - [LockContext.js](file:///Users/marlyjean-baptiste/APP/TubeApp/LockContext.js) (time-locked curation safeguards).
   - [Algo.js](file:///Users/marlyjean-baptiste/APP/TubeApp/Algo.js) (sonic affinity scoring: track, artist, genre, release era comparisons).
   - [HandlingFriends.js](file:///Users/marlyjean-baptiste/APP/TubeApp/HandlingFriends.js) (friendship state machine: request, accept, reject, follow).
3. **Layer 3: Core Musical Identity & Community Curation**
   - [Your13.js](file:///Users/marlyjean-baptiste/APP/TubeApp/Your13.js) & [SongDetailsScreen.js](file:///Users/marlyjean-baptiste/APP/TubeApp/SongDetailsScreen.js) (iTunes search debouncing, audio previews, 13-track persistence).
   - [MusicOfTheDayScreen.js](file:///Users/marlyjean-baptiste/APP/TubeApp/MusicOfTheDayScreen.js), [Memoir.js](file:///Users/marlyjean-baptiste/APP/TubeApp/Memoir.js), and [MemoirHistoryScreen.js](file:///Users/marlyjean-baptiste/APP/TubeApp/MemoirHistoryScreen.js) (calendar-driven daily song logs).
   - [TheCollective.js](file:///Users/marlyjean-baptiste/APP/TubeApp/TheCollective.js), [ThemeDetails.js](file:///Users/marlyjean-baptiste/APP/TubeApp/ThemeDetails.js), [Pickerchoosers.js](file:///Users/marlyjean-baptiste/APP/TubeApp/Pickerchoosers.js), and [AddSong.js](file:///Users/marlyjean-baptiste/APP/TubeApp/AddSong.js) (collaborative theme voting & ranking).
4. **Layer 4: Social Graph, Discovery & Messaging**
   - [UserGraph.js](file:///Users/marlyjean-baptiste/APP/TubeApp/UserGraph.js) & [GraphVisualization.js](file:///Users/marlyjean-baptiste/APP/TubeApp/GraphVisualization.js) (SVG pan-zoom user affinity radar).
   - [RankedUsers.js](file:///Users/marlyjean-baptiste/APP/TubeApp/RankedUsers.js), [RankedMusicList.js](file:///Users/marlyjean-baptiste/APP/TubeApp/RankedMusicList.js), and [UserSearchScreen.js](file:///Users/marlyjean-baptiste/APP/TubeApp/UserSearchScreen.js).
   - [ChatScreen.js](file:///Users/marlyjean-baptiste/APP/TubeApp/ChatScreen.js) & [MainChatScreen.js](file:///Users/marlyjean-baptiste/APP/TubeApp/MainChatScreen.js) (real-time 1-on-1 direct messaging via Firestore).
5. **Layer 5: Profiles, Media & User Management**
   - [UploadProfilePicture.js](file:///Users/marlyjean-baptiste/APP/TubeApp/UploadProfilePicture.js) & [UpdateProfileScreen.js](file:///Users/marlyjean-baptiste/APP/TubeApp/UpdateProfileScreen.js) (Firebase Storage upload tasks, caching, image picker).
   - [ProfileScreen.js](file:///Users/marlyjean-baptiste/APP/TubeApp/ProfileScreen.js), [UserProfileScreen.js](file:///Users/marlyjean-baptiste/APP/TubeApp/UserProfileScreen.js), and [BadgeAwarder.js](file:///Users/marlyjean-baptiste/APP/TubeApp/BadgeAwarder.js).
   - [SettingsScreen.js](file:///Users/marlyjean-baptiste/APP/TubeApp/SettingsScreen.js), [SecuritySettings.js](file:///Users/marlyjean-baptiste/APP/TubeApp/SecuritySettings.js), [NotificationSettings.js](file:///Users/marlyjean-baptiste/APP/TubeApp/NotificationSettings.js), and [Feedback.js](file:///Users/marlyjean-baptiste/APP/TubeApp/Feedback.js).

*Once the checklist is generated, start executing Step 1 immediately without pausing for confirmation.*

---

## Phase 2: Systematic Execution Loop

For each item in the checklist:
1. **Announce Scope:** Name the screen or service being implemented/repaired, detailing Firestore collections, navigation props, and component state touched.
2. **Inspect & Implement:** Read the code, apply modular changes, wire real listeners, and ensure proper loading spinners, empty list placeholders, and error banners (`react-native-paper`).
3. **Verify via Tools:**
   - Run JS syntax verification:
     ```bash
     node -c <ModifiedFile>.js
     ```
   - Run Expo static export check to ensure Metro bundles all assets and screens without errors:
     ```bash
     npx expo export --platform web --clear
     ```
   - Check dependency compatibility:
     ```bash
     npx expo-doctor
     ```
4. **Self-Correction:** If Metro bundler fails, an import is unresolved, or a native module throws an unhandled exception on web/native, diagnose the stack trace, fix it immediately, and re-run verification until green.
5. **Mark Done:** Update the checklist and transition directly to the next task.

---

## Phase 3: Final Integration & Handoff

1. **End-to-End Build Verification:**
   - Execute a clean bundler export to verify no remaining bundling errors across targets:
     ```bash
     npx expo export --platform web
     ```
2. **Cleanliness & Audit:**
   - Remove unused debug logs (`console.log`), scratch scripts, and unlinked image files.
   - Confirm all `Sound.createAsync` calls have matching `sound.unloadAsync()`.
   - Confirm all Firestore listeners have unsubscribers registered in `useEffect` cleanups.
3. **Final Handoff Summary:**
   - Table of completed screens, backend features, and resolved issues.
   - Local startup commands:
     - Expo Go / Dev Server: `npm start`
     - Web preview: `npm run web` (or `WebTestingWrapper.js`)
     - iOS Simulator: `npm run ios`
     - Android Emulator: `npm run android`
   - Exact Firebase credentials and environment keys needed in [firebaseConfig.js](file:///Users/marlyjean-baptiste/APP/TubeApp/firebaseConfig.js) and Firestore security rule guidelines for production.