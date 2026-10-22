# Antigravity Autonomous Completion Protocol: Music Twins & Affinity Graph

You are an autonomous Senior Mobile & Data Visualization Engineer operating within Antigravity. Your objective is to drive the **Music Twins & Affinity Graph** feature of **TuneHub (TubeApp / Chorus)** from its current flawed prototype state to a fully completed, interactive, mathematically accurate, and visually stunning radar constellation built with **React Native (0.75)**, **Expo (SDK 51)**, **React Native SVG**, and **Firebase Firestore (v10)**.

---

## Live Audit & Discovered Deficiencies

An end-to-end audit navigating from **Your13** → **Find Music Twins** (`RankedUsers`) → **View Graph** (`UserGraph`) revealed the following critical bugs and missing capabilities:

1. **Center Node & Viewport Offsetting Bug ([UserGraph.js](file:///Users/marlyjean-baptiste/APP/TubeApp/UserGraph.js)):**
   - The central user node ("You") is completely pushed outside the visible screen area due to faulty coordinate math:
     ```javascript
     const offsetX = center.x - minX;
     const offsetY = center.y - minY;
     ```
   - In addition, applying both width/height scaling *and* CSS `transform: [{ scale }]` results in **double-scaling**, throwing the SVG content hundreds of pixels off-center into the bottom-right corner.
2. **Missing User Identity on Nodes:**
   - Graph nodes render generic `"User"` labels instead of actual member names because [UserGraph.js](file:///Users/marlyjean-baptiste/APP/TubeApp/UserGraph.js) looks up `usernames[user.uid]` while `rankedUsers` items use the property `uname`.
3. **Raw Decimal Scores:**
   - Similarity scores are displayed as raw floats (`0.03`, `0.09`) rather than user-friendly percentages (`3%`, `9%`, `100%`).
4. **Completely Non-Interactive Nodes:**
   - SVG `<Circle>` elements lack tap/press handlers. Users cannot tap a node to see who they are, view shared musical DNA (common artists/genres), or navigate to [UserProfileScreen.js](file:///Users/marlyjean-baptiste/APP/TubeApp/UserProfileScreen.js).
5. **Lack of Visual Radar Structure:**
   - The graph lacks concentric orbit rings and radar markings representing affinity tiers (100% Soulmates, 75% High Affinity, 50% Common Ground, 25% Distant Listeners). Nodes float in an empty black void.
6. **Web Zoom & Pan Incompatibility:**
   - `PinchGestureHandler` does not respond to mouse wheel or trackpad pinches on Web. There are no manual on-screen zoom controls (`+`, `-`, `Reset View`) or draggable viewport pan controls.
7. **Severe Text Truncation in Leaderboard ([RankedUsers.js](file:///Users/marlyjean-baptiste/APP/TubeApp/RankedUsers.js)):**
   - Usernames on the ranked leaderboard are aggressively cut off (e.g. `Sig...`, `Al...`, `Ad...`) due to unoptimized flex column widths.
8. **Redundant Navigation Controls:**
   - [UserGraph.js](file:///Users/marlyjean-baptiste/APP/TubeApp/UserGraph.js) contains both a top header `← Back` button and a redundant bottom `Back to Ranked Users` button.
9. **Dead 3D Code Fragment ([GraphVisualization.js](file:///Users/marlyjean-baptiste/APP/TubeApp/GraphVisualization.js)):**
   - Contains a standalone `react-force-graph-3d` snippet referencing undefined `comparePlaylists()`, completely disconnected from the app route graph.

---

## Feature Scope & Core Modules

The Music Twins & Affinity Graph ecosystem encompasses:
- **[Algo.js](file:///Users/marlyjean-baptiste/APP/TubeApp/Algo.js)**: Multi-variable similarity engine computing weighted compatibility vectors (tracks: 50%, artists: 35%, genres: 7.5%, eras: 7.5%).
- **[RankedUsers.js](file:///Users/marlyjean-baptiste/APP/TubeApp/RankedUsers.js)**: Compatibility leaderboard displaying ranked listeners, badges, affinity percentages, and friend request actions.
- **[UserGraph.js](file:///Users/marlyjean-baptiste/APP/TubeApp/UserGraph.js)**: 2D interactive SVG constellation/radar plotting user distance inversely proportional to musical affinity.
- **[GraphVisualization.js](file:///Users/marlyjean-baptiste/APP/TubeApp/GraphVisualization.js)**: Deprecated/unintegrated component to be cleanly archived or unified.
- **[UserProfileScreen.js](file:///Users/marlyjean-baptiste/APP/TubeApp/UserProfileScreen.js)**: Deep-dive profile opened when tapping a ranked user or graph node.

---

## Core Rules & Constraints

1. **Deterministic Center & Centered Viewport:**
   - The current authenticated user must always be pinned squarely in the **center** of the radar (`cx={centerX}`, `cy={centerY}`) highlighted with TuneHub's signature orange theme (`#FF8C00`).
   - All connection lines must radiate outwards from this center to peer nodes.
2. **Radial Orbit Mapping (Affinity Proximity):**
   - High affinity (near 100%) nodes must cluster tightly around the center.
   - Low affinity nodes must sit on outer orbital rings.
   - Distances must be calculated using a normalized inverse formula:
     ```javascript
     const radius = minRadius + (1 - scoreRatio) * (maxRadius - minRadius);
     ```
3. **Interactive Node Inspector (Modal or Bottom Sheet):**
   - Tapping any node on the graph must reveal a clean glassmorphism preview sheet:
     - User Avatar & Username
     - Match Score Percentage (e.g., `87% Match`)
     - Compatibility Breakdown (Shared tracks, Shared favorite artists, Top matching genre)
     - Action Buttons: `View Profile` and `Send Friend Request` / `Message`
4. **Cross-Platform Zoom & Pan (Web + Mobile):**
   - Provide explicit, elegant floating on-screen zoom controls (`+`, `-`, `🎯 Center`) for reliable web/desktop use.
   - Support smooth pan gestures without double-scaling bugs.
5. **Standardized Identity Resolution:**
   - Guarantee consistent user profile hydration (`uid`, `username`, `profileImageUrl`) across [RankedUsers.js](file:///Users/marlyjean-baptiste/APP/TubeApp/RankedUsers.js) and [UserGraph.js](file:///Users/marlyjean-baptiste/APP/TubeApp/UserGraph.js). Never fall back to generic `"User"` when an identifier is present.

---

## Phase 1: Prioritized Execution Plan

### 1. Task Checklist Ordered by Dependency

- [ ] **Task 1: Fix Parameter Passing & Identity Hydration**
  - In [RankedUsers.js](file:///Users/marlyjean-baptiste/APP/TubeApp/RankedUsers.js), pass enriched user objects to [UserGraph.js](file:///Users/marlyjean-baptiste/APP/TubeApp/UserGraph.js):
    ```javascript
    navigation.navigate('UserGraph', {
      rankedUsers: rankedUsers.map(u => ({
        ...u,
        username: usernames[u.uname] || u.uname,
        uid: userIds[u.uname] || u.uname,
        profileImageUrl: userImages[u.uname] || null,
        formattedScore: `${Math.round((Number(u.totalScore) || 0) * 100)}%`
      })),
      userId,
    });
    ```
  - Fix flexbox styles in [RankedUsers.js](file:///Users/marlyjean-baptiste/APP/TubeApp/RankedUsers.js) (`rankText` and `gridColumn`) to eliminate name truncation.

- [ ] **Task 2: Overhaul SVG Coordinate Geometry & Radar Layout ([UserGraph.js](file:///Users/marlyjean-baptiste/APP/TubeApp/UserGraph.js))**
  - Eliminate the `minX/minY` offset bug and double-scaling.
  - Implement a fixed coordinate viewport (e.g. `viewBox="-300 -300 600 600"` or centered `width/height` container).
  - Render 4 styled concentric orbit rings with subtle opacity (`25%`, `50%`, `75%`, `100%`) and dashed stroke styling.
  - Render axis crosshairs or faint radar sweeps for high-end aesthetics.

- [ ] **Task 3: Visual Node Polish & Repulsion**
  - Add collision/angle distribution so nodes with similar scores don't overlap on top of each other.
  - Render user profile pictures inside SVG nodes using `<Image>` or `<Pattern>` clips, with colored stroke rings matching rank (Gold for #1, Silver for #2, Bronze for #3).
  - Display readable text badges showing usernames and percentage badges below each node.

- [ ] **Task 4: Interactive Node Inspector & User Actions**
  - Add `onPress` handlers to SVG nodes.
  - Implement an animated bottom sheet or overlay modal when a node is selected:
    - Display avatar, name, and total compatibility percentage.
    - Fetch and display the user's top matching tracks from Firestore `playlists/{targetUid}`.
    - Include direct buttons: `View Profile` (navigates to `UserProfile`) and `Send Friend Request` (calls `sendFriendRequest`).

- [ ] **Task 5: Cross-Platform Zoom, Pan & Controls**
  - Add on-screen floating zoom buttons (`+`, `-`, `🎯 Re-center`).
  - Ensure zoom scales the SVG `viewBox` or transform group cleanly on both Web and Mobile without clipping.
  - Remove redundant duplicate back buttons; retain a single polished top-bar navigation header.

- [ ] **Task 6: Clean Up Dead Code ([GraphVisualization.js](file:///Users/marlyjean-baptiste/APP/TubeApp/GraphVisualization.js))**
  - Refactor or retire [GraphVisualization.js](file:///Users/marlyjean-baptiste/APP/TubeApp/GraphVisualization.js) so there is no dead, broken code in the project root.

---

## Phase 2: Systematic Execution Loop

For each task in the checklist:
1. **Announce Scope:** Detail the component being refactored, state changes, and coordinate math updated.
2. **Implement Atomically:** Apply surgical updates without breaking existing navigation parameters or Firestore query logic.
3. **Verify via Tools:**
   - Syntax validation:
     ```bash
     node -c UserGraph.js RankedUsers.js Algo.js
     ```
   - Bundling validation:
     ```bash
     npx expo export --platform web --clear
     ```
4. **Self-Correction:** Verify via browser testing that nodes remain centered, zoom operates smoothly, and no nodes clip outside the viewport.
5. **Mark Done:** Proceed directly to the next item in the checklist.

---

## Phase 3: Final Integration & Verification

1. **End-to-End User Journey Verification:**
   - [ ] In `Your13`, tap "Find Music Twins" → navigates to `RankedUsers` with readable, untruncated names.
   - [ ] In `RankedUsers`, tap "View Graph" → navigates to `UserGraph`.
   - [ ] Center node clearly shows "You" with orange glow at the exact dead center of the screen.
   - [ ] Concentric orbit circles (25%, 50%, 75%, 100%) render cleanly in the background.
   - [ ] Peer nodes sit at correct orbital distances according to their similarity score.
   - [ ] Nodes show real usernames (not "User") and percentage labels (e.g., `9%`, `6%`).
   - [ ] Tapping a node opens the User Detail Modal with profile picture, affinity score, and action buttons.
   - [ ] Tapping "View Profile" opens [UserProfileScreen.js](file:///Users/marlyjean-baptiste/APP/TubeApp/UserProfileScreen.js) for that user.
   - [ ] Zoom buttons (`+`, `-`) and Re-center button smoothly adjust the graph scale on both web and mobile.
   - [ ] Tapping back returns smoothly to `RankedUsers`.
2. **Handoff:**
   - Deliver summary of visual enhancements, performance optimizations, and exact steps to test the graph locally.
