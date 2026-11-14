// ThemeDetails.js - Updated to store image paths as strings
import { db } from './firebaseConfig';
import { collection, setDoc, doc } from 'firebase/firestore';
import { createAsyncActionLock } from './utils/actionLockUtils';
import Pickerchoosers from './Pickerchoosers';

const populateLock = createAsyncActionLock();

export const THEMES_CATALOG = [
  { id: 'child_of_the_80s', name: "I'm a child of the 80s" },
  { id: 'childhood_favorites', name: 'My Favorite Songs from My Childhood' },
  { id: 'ex_girlfriends_club', name: 'The Ex Girlfriends Club' },
  { id: 'funny_rap', name: 'Funny Rap Songs On Repeat' },
  { id: 'yaaassss_girl', name: 'Yaaasssss Girl Yaaassss' },
  { id: 'laughing_crying', name: "I'm Laughing 'Til I'm Crying 😭" },
  { id: 'unfiltered', name: 'Unfiltered and Unapologetic' },
  { id: 'criminally_overlooked', name: 'Criminally Overlooked Tracks' },
  { id: 'bad_day', name: 'I’m having a Bad Day 🙄😡' },
  { id: 'not_friday', name: 'It’s rude it isn’t Friday' },
  { id: 'margarita_time', name: 'This senorita needs a margarita' },
  { id: 'half_good_music', name: 'Half good music' },
  { id: 'best_of_worst', name: 'The best of the worst' },
  { id: 'airplane_mode', name: 'Airplane Mode' }
];

export const resolveThemeTitle = (themeId, explicitTheme) => {
  const cleanExplicit = typeof explicitTheme === 'string' ? explicitTheme.trim() : '';
  if (cleanExplicit) return cleanExplicit;
  const matched = THEMES_CATALOG.find((item) => item.id === themeId);
  if (matched?.name) return matched.name;
  if (!themeId) return 'Collective Shelf';
  return String(themeId)
    .split('_')
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : ''))
    .join(' ');
};

export const populateThemes = async () => {
  return populateLock(async () => {
    try {
      const collectionRef = collection(db, 'collective');
      for (let theme of THEMES_CATALOG) {
        const themeDocRef = doc(collectionRef, theme.id);
        await setDoc(themeDocRef, { name: theme.name, imagePath: theme.imagePath, createdAt: new Date() });
      }
      console.log('Themes have been added to Firestore');
    } catch (error) {
      console.error('Error adding themes to Firestore:', error);
    }
  });
};

export default Pickerchoosers;
