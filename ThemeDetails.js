// ThemeDetails.js - Updated to store image paths as strings
import { db } from './firebaseConfig';
import { collection, setDoc, doc } from 'firebase/firestore';
import { createAsyncActionLock } from './utils/actionLockUtils';
import Pickerchoosers from './Pickerchoosers';
import { THEMES_CATALOG, resolveThemeTitle } from './utils/collectiveGrooveUtils';

export { THEMES_CATALOG, resolveThemeTitle };

const populateLock = createAsyncActionLock();

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

export const ThemeDetails = Pickerchoosers;
export default Pickerchoosers;
