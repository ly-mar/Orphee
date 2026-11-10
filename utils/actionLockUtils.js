// utils/actionLockUtils.js
// Synchronous mutex lock to guard against rapid double-taps on async mutations [BUG-011]

export function createAsyncActionLock() {
  let locked = false;
  return async function runExclusive(fn) {
    if (locked) return undefined;
    locked = true;
    try {
      return await fn();
    } finally {
      locked = false;
    }
  };
}

