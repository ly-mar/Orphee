// Import the functions you need from the SDKs you need
//import { initializeApp } from "firebase/app";
//import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries
import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getFirestore } from "firebase/firestore";
import { getStorage } from 'firebase/storage';
import { Platform } from 'react-native';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import { getAuth, initializeAuth } from 'firebase/auth';

// Your web app's Firebase configuration
const _fbPrefix = 'tune';
const _fbProjectId = `${_fbPrefix}hub-86837`;
const firebaseConfig = {
    apiKey: "AIzaSyA1Cp9xJpMSuuIoe8fqT5o9F5uXbgktB2k",
    authDomain: `${_fbProjectId}.firebaseapp.com`,
    databaseURL: `https://${_fbProjectId}-default-rtdb.europe-west1.firebasedatabase.app`,
    projectId: _fbProjectId,
    storageBucket: `${_fbProjectId}.appspot.com`,
    messagingSenderId: "1060288602509",
    appId: "1:1060288602509:web:9f501f03c6d2bc9295ddc4",
    measurementId: "G-JV5FBMNDBQ"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Platform-aware Authentication persistence
let auth;
if (Platform.OS === 'web') {
  auth = getAuth(app);
} else {
  try {
    const { getReactNativePersistence } = require('firebase/auth');
    if (typeof getReactNativePersistence === 'function') {
      auth = initializeAuth(app, {
        persistence: getReactNativePersistence(ReactNativeAsyncStorage)
      });
    } else {
      auth = getAuth(app);
    }
  } catch (e) {
    auth = getAuth(app);
  }
}

export { app, database, auth, db, storage };
