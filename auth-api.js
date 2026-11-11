// auth-api.js
import { auth, db } from './firebaseConfig';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
} from "firebase/auth";
import { doc, setDoc } from 'firebase/firestore';
import { sanitizeAuthCredentials, mapFirebaseAuthError } from './utils/authUtils';

// Login Function
export const loginUser = async (rawEmail, rawPassword) => {
  const { email, password } = sanitizeAuthCredentials({ email: rawEmail, password: rawPassword });
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return { user: userCredential.user };
  } catch (error) {
    return { error: mapFirebaseAuthError(error) };
  }
};

// Sign-Up Function
export const signUpUser = async (rawEmail, rawPassword, rawUsername) => {
  const { email, password, username } = sanitizeAuthCredentials({
    email: rawEmail,
    password: rawPassword,
    username: rawUsername,
  });
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    await setDoc(doc(db, 'users', user.uid), {
      email,
      username,
      createdAt: new Date().toISOString(),
    });
    return { user };
  } catch (error) {
    return { error: mapFirebaseAuthError(error) };
  }
};

// Logout Function
export const logoutUser = async () => {
  try {
    await signOut(auth);
    return { success: true };
  } catch (error) {
    return { error: mapFirebaseAuthError(error) };
  }
};

// Password Reset Function
export const resetPassword = async (rawEmail) => {
  const { email } = sanitizeAuthCredentials({ email: rawEmail });
  try {
    await sendPasswordResetEmail(auth, email);
    return { success: true };
  } catch (error) {
    return { error: mapFirebaseAuthError(error) };
  }
};
