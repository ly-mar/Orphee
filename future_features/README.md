# 📦 Future Features Backlog

This directory preserves completed features and components that are temporarily staged out of the active application.

## 📁 Archived Modules

### 1. Coplay & Party Hub ("M.C. or Patron?")
- **`Coplay.js`**: Main hub screen allowing users to choose between being an M.C. (hosting a party) or a Patron (joining a party).
- **`CreateParty.js`**: Comprehensive party creator with:
  - Theme selection (Hollywood Glamour, 80s Throwback, Casino Night, etc.)
  - Public/Private toggles, date/time pickers, and venue location.
  - Interactive custom invitation designer (font families, font sizes, text color slider, background color slider, emoji stickers).
  - Track selection from iTunes Search API.
- **`JoinParty.js`**: Browser and RSVP manager for existing public/accessible parties.
- **`PlayShare.js`**: Real-time collaborative queue and party playlist synchronized via Firebase Realtime Database.

### 2. The Pipeline & Artist Trivia
- **`Thepipeline.js`**: Pipeline landing screen with carousel of featured artists (Dua Lipa, Dr. Dre, Manno Charlemagne, Tropicana d'Haiti).
- **`GuessPage.js`**: Interactive artist trivia game where guessing songs progressively reveals album artwork.
- **`CreatePipeline.js`**: Collaborative track pipeline creation with 6-character shortcode generation.
### 3. Daily Tune / Music of the Day
- **`MusicOfTheDayScreen.js`**: Daily track picker and interactive calendar song log.
  - Allows users to search iTunes for a single track representing their daily mood or discovery.
  - Integrates with Firestore collection `daily` (`${uid}_${date}`) with calendar overview and inspection modal.
  - Staged into future features while community charts are determined directly by the 13 songs chosen by each user (Your13).

### 4. AI Similarity Finder & Calculator
- **`SimilarityFinderWidget.js`**: Dual-tab AI musical similarity interface:
  - **Top 10 Sonic Matches**: Identifies the 10 closest sounding tracks to any catalog seed or iTunes search result using 68-D Librosa audio feature embeddings and 384-D multilingual lyric embeddings.
  - **Comparative Calculator**: Side-by-side song comparison breaking down match percentage across 68-D Librosa audio features (60%), 384-D ONNX lyric embeddings (30%), and metadata (10%), featuring radar-style component scores and audio previews.
- **`similarityEngine.js`**: Client-side mathematical similarity calculation engine:
  - 68-D audio vector processing (MFCCs, spectral contrast, chroma, tempo, energy) and 384-D text embeddings.
  - Embedded 194-track catalog embeddings fallback.
  - Live embedding API calls to the local ML service with FAISS fallback.
- **`ml_service/`**: Python FastAPI microservice & FAISS index:
  - `server.py`: FastAPI application serving `/catalog`, `/top10`, and `/embed` endpoints.
  - `ingest_catalog.py`: Pipeline for audio extraction and sentence-transformer lyric embeddings.
  - `artifacts/`: Precomputed FAISS index files (`audio.index`, `lyric.index`), Z-score scaler parameters (`scaler.npz`), and catalog embeddings JSON (`catalog_embeddings.json`).
- **`similarityEngine.test.js`**: Test suite covering cosine similarity math, vector normalization, and ranking order.
- **`test_user_scenarios.py`**: Automated verification script for similarity comparisons and recommendation scenarios.

### 5. Your Badges & Achievements
- **`BadgeAwarder.js`**: Achievement badge evaluator and awarder screen:
  - Evaluates user upload milestones in Firestore (`daily` collection): "First Upload Badge", "Hip-Hop Lover Badge", "Triple Upload Badge", "Prolific Uploader Badge", "Legendary Uploader Badge".
  - Renders earned badge badges with custom badge iconography from `assets/`.
  - Staged out of active application.

---

## 🔄 How to Restore These Features to the App
1. **To restore a screen module (e.g. Coplay, ThePipeline, MusicOfTheDay, BadgeAwarder)**:
   - Move the desired `.js` file(s) back to the root directory:
     ```bash
     mv future_features/<filename>.js ./
     ```
   - Re-import and register the screen(s) in `App.js` inside `<Stack.Navigator>`.
   - Add navigation cards/buttons to `HomeScreen.js`, `Taskbar.js`, or `ProfileScreen.js`.

2. **To restore the AI Similarity Finder & Calculator**:
   - Move the widget back to `components/`:
     ```bash
     mkdir -p components
     mv future_features/SimilarityFinderWidget.js components/SimilarityFinderWidget.js
     ```
   - Move the similarity engine back to `utils/`:
     ```bash
     mv future_features/similarityEngine.js utils/similarityEngine.js
     ```
   - Move the ML service and test files back:
     ```bash
     mv future_features/ml_service ml_service
     mv future_features/similarityEngine.test.js __tests__/similarityEngine.test.js
     mv future_features/test_user_scenarios.py scripts/test_user_scenarios.py
     ```
   - Update imports in `components/SimilarityFinderWidget.js` (`../utils/similarityEngine`) and `utils/similarityEngine.js` (`../ml_service/artifacts/catalog_embeddings.json`).
   - Uncomment the import and `<Stack.Screen name="SimilarityFinder" ... />` in `App.js`.
   - Uncomment the `AI Similarity Finder & Calculator` card in `HomeScreen.js`.
   - Restore `package.json` scripts (`"ml:ingest"` and `"ml:server"`).
