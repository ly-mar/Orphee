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

---

## 🔄 How to Restore These Features to the App
1. Move the desired `.js` file(s) back to the root directory:
   ```bash
   mv future_features/<filename>.js ./
   ```
2. Re-import and register the screen(s) in `App.js` inside `<Stack.Navigator>`.
3. Add navigation cards/buttons to `HomeScreen.js` or `Taskbar.js`.
