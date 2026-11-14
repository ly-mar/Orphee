// LockContext.js
import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from './firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';
import {
  calculateRemainingLockSeconds,
  isYour13Confirmed,
  canAccessVibeFeatures,
} from './utils/playlistUtils';

export { isYour13Confirmed, canAccessVibeFeatures };

export const LockContext = createContext({
  isLocked: false,
  lockTime: 0,
  lockChoices: async () => { },
  setLockTime: () => { },
  your13Confirmed: false,
  setYour13Confirmed: () => { },
});

export const useLock = () => useContext(LockContext) || {};

const LOCK_TIME_KEY = 'lockTime';
const LOCK_TIMESTAMP_KEY = 'lockTimestamp';

export const LockProvider = ({ children }) => {
  const [isLocked, setIsLocked] = useState(false);
  const [lockTime, setLockTime] = useState(0);
  const [your13Confirmed, setYour13Confirmed] = useState(false);
  const appState = useRef(AppState.currentState);

  const clearStoredLock = useCallback(async () => {
    try {
      await AsyncStorage.multiRemove([LOCK_TIME_KEY, LOCK_TIMESTAMP_KEY]);
      setYour13Confirmed(false);
    } catch (error) {
      console.error('Error clearing lock state:', error);
    }
  }, []);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setIsLocked(false);
        setLockTime(0);
        setYour13Confirmed(false);
        clearStoredLock();
      }
    });
    return () => unsubscribeAuth();
  }, [clearStoredLock]);

  const syncLockState = useCallback(async () => {
    try {
      const [[, storedDuration], [, storedTimestamp]] = await AsyncStorage.multiGet([
        LOCK_TIME_KEY,
        LOCK_TIMESTAMP_KEY,
      ]);

      if (storedDuration && storedTimestamp) {
        const durationSec = parseInt(storedDuration, 10);
        const startMs = parseInt(storedTimestamp, 10);
        const remainingSec = calculateRemainingLockSeconds(startMs, durationSec);

        if (remainingSec > 0) {
          setLockTime(remainingSec);
          setIsLocked(true);
          setYour13Confirmed(true);
        } else {
          setLockTime(0);
          setIsLocked(false);
          setYour13Confirmed(false);
          await clearStoredLock();
        }
      } else {
        setLockTime(0);
        setIsLocked(false);
        setYour13Confirmed(false);
      }
    } catch (error) {
      console.error('Error loading lock state:', error);
    }
  }, [clearStoredLock]);

  useEffect(() => {
    syncLockState();

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        syncLockState();
      }
      appState.current = nextAppState;
    });

    return () => subscription.remove();
  }, [syncLockState]);

  useEffect(() => {
    if (!isLocked || lockTime <= 0) return;

    const intervalId = setInterval(() => {
      setLockTime((prev) => {
        if (prev <= 1) {
          clearInterval(intervalId);
          setIsLocked(false);
          setYour13Confirmed(false);
          clearStoredLock();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(intervalId);
  }, [isLocked, lockTime > 0, clearStoredLock]);

  const lockChoices = async (duration = 60) => {
    try {
      const timestamp = Date.now();
      await AsyncStorage.multiSet([
        [LOCK_TIME_KEY, duration.toString()],
        [LOCK_TIMESTAMP_KEY, timestamp.toString()],
      ]);
      setLockTime(duration);
      setIsLocked(true);
      setYour13Confirmed(true);
    } catch (error) {
      console.error('Error persisting lock state:', error);
    }
  };

  return (
    <LockContext.Provider
      value={{
        isLocked,
        lockTime,
        lockChoices,
        setLockTime,
        your13Confirmed,
        setYour13Confirmed,
      }}
    >
      {children}
    </LockContext.Provider>
  );
};

export default LockContext;
