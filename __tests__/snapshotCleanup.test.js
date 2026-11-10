// __tests__/snapshotCleanup.test.js
import { subscribeSafeSnapshot } from '../firestoreListenerUtils';

describe('Real-Time Snapshot Listener Safety [BUG-004]', () => {
  test('does not subscribe if path dependencies are missing and always invokes unsubscribe on cleanup', () => {
    const mockUnsub = jest.fn();
    const mockOnSnapshot = jest.fn(() => mockUnsub);

    // Missing chatId should be a safe no-op
    const noopCleanup = subscribeSafeSnapshot({
      isReady: false,
      buildQuery: () => 'query',
      onSnapshotFn: mockOnSnapshot,
      onNext: jest.fn(),
    });
    expect(mockOnSnapshot).not.toHaveBeenCalled();
    noopCleanup();

    // Valid subscription tears down cleanly
    const cleanup = subscribeSafeSnapshot({
      isReady: true,
      buildQuery: () => 'chats/123/messages',
      onSnapshotFn: mockOnSnapshot,
      onNext: jest.fn(),
    });
    expect(mockOnSnapshot).toHaveBeenCalledTimes(1);
    cleanup();
    expect(mockUnsub).toHaveBeenCalledTimes(1);
  });

  test('catches error callback when listener throws or receives permission-denied', () => {
    const mockError = new Error('Permission denied');
    let capturedErrorCallback = null;
    const mockOnSnapshot = jest.fn((query, onNext, onError) => {
      capturedErrorCallback = onError;
      return jest.fn();
    });

    const onError = jest.fn();
    const cleanup = subscribeSafeSnapshot({
      isReady: true,
      buildQuery: () => 'chats/secret',
      onSnapshotFn: mockOnSnapshot,
      onNext: jest.fn(),
      onError,
    });

    capturedErrorCallback(mockError);
    expect(onError).toHaveBeenCalledWith(mockError);
    cleanup();
  });
});

