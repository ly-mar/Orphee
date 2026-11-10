// __tests__/audioPreview.test.js
import { createAudioPreviewController } from '../audioPreviewController';

const mockUnloadAsync = jest.fn(() => Promise.resolve());
const mockStopAsync = jest.fn(() => Promise.resolve());
const mockCreateAsync = jest.fn();

jest.mock('expo-av', () => ({
  Audio: {
    setAudioModeAsync: jest.fn(() => Promise.resolve()),
    Sound: {
      createAsync: (...args) => mockCreateAsync(...args),
    },
  },
}));

describe('Audio Preview Controller Resilience [BUG-003]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateAsync.mockResolvedValue({
      sound: {
        unloadAsync: mockUnloadAsync,
        stopAsync: mockStopAsync,
        setOnPlaybackStatusUpdate: jest.fn(),
      },
    });
  });

  test('rejects null or non-http previewUrl gracefully without calling Audio.Sound.createAsync', async () => {
    const onError = jest.fn();
    const controller = createAudioPreviewController({ onError });
    const started = await controller.play(null);
    expect(started).toBe(false);
    expect(mockCreateAsync).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith('Preview unavailable for this track.');
  });

  test('rejects invalid URL string gracefully', async () => {
    const onError = jest.fn();
    const controller = createAudioPreviewController({ onError });
    const started = await controller.play('not-a-valid-url');
    expect(started).toBe(false);
    expect(mockCreateAsync).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith('Preview unavailable for this track.');
  });

  test('unloads previous sound on rapid double-tap and cleans up on unmount', async () => {
    const controller = createAudioPreviewController();
    await controller.play('https://audio-ssl.itunes.apple.com/track1.m4a');
    await controller.play('https://audio-ssl.itunes.apple.com/track2.m4a');
    expect(mockUnloadAsync).toHaveBeenCalledTimes(1);

    await controller.dispose();
    expect(mockUnloadAsync).toHaveBeenCalledTimes(2);
  });
});

describe('AddSong & Memoir Screen Blur/Unmount Audio Cleanup [BUG-008]', () => {
  test('stops active preview when navigating away from AddSong to SongDetailsScreen', async () => {
    const controller = createAudioPreviewController();
    await controller.play('https://audio-ssl.itunes.apple.com/addsong-preview.m4a');
    // Simulate React Navigation blur / unmount cleanup
    await controller.dispose();
    const playAfterDispose = await controller.play('https://audio-ssl.itunes.apple.com/after-unmount.m4a');
    expect(playAfterDispose).toBe(false);
  });
});


