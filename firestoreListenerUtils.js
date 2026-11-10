// firestoreListenerUtils.js
// Synchronous subscription wrapper ensuring deterministic teardown across rapid navigation [BUG-004]

export function subscribeSafeSnapshot({
  isReady,
  buildQuery,
  onSnapshotFn,
  onNext,
  onError,
}) {
  if (!isReady) return () => {};
  let isActive = true;
  let unsubscribe = null;

  try {
    const queryRef = buildQuery();
    unsubscribe = onSnapshotFn(
      queryRef,
      (snapshot) => {
        if (isActive) onNext(snapshot);
      },
      (error) => {
        if (isActive) onError?.(error);
      }
    );
  } catch (err) {
    onError?.(err);
  }

  return () => {
    isActive = false;
    if (typeof unsubscribe === 'function') {
      try {
        unsubscribe();
      } catch (_) {}
      unsubscribe = null;
    }
  };
}

