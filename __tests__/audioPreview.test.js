// __tests__/audioPreview.test.js
import { createAudioPreviewController, resolveFreshPreviewUrl } from '../audioPreviewController';

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

  test('falls back to HTML5 window.Audio on web when expo-av playback throws and resolves fresh iTunes preview URLs [VR-022]', async () => {
    const originalWindow = global.window;
    const mockPlay = jest.fn(() => Promise.resolve());
    const mockPause = jest.fn();
    global.window = {
      Audio: jest.fn(() => ({ play: mockPlay, pause: mockPause, src: '', onended: null })),
    };
    mockCreateAsync.mockRejectedValueOnce(new Error('expo-av unsupported codec'));

    const controller = createAudioPreviewController();
    const started = await controller.play('https://audio-ssl.itunes.apple.com/track-fallback.m4a');
    expect(started).toBe(true);
    expect(mockPlay).toHaveBeenCalledTimes(1);

    await controller.dispose();
    expect(mockPause).toHaveBeenCalledTimes(1);
    global.window = originalWindow;

    const fresh = await resolveFreshPreviewUrl(
      { trackId: 42, trackName: 'Blinding Lights', artistName: 'The Weeknd' },
      async () => [{ trackId: 42, trackName: 'Blinding Lights', previewUrl: 'https://fresh.m4a' }]
    );
    expect(fresh).toBe('https://fresh.m4a');
  });
});

describe('Crate Radio Queue Playback [WP-03]', () => {
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

  test('playQueue starts playing track #1 and emits progress updates', async () => {
    const queue = [
      { id: 't1', trackName: 'Song 1', previewUrl: 'https://audio.com/1.m4a' },
      { id: 't2', trackName: 'Song 2', previewUrl: 'https://audio.com/2.m4a' },
    ];
    const onProgress = jest.fn();
    const controller = createAudioPreviewController();
    controller.onProgress(onProgress);

    const started = await controller.playQueue(queue, 0);
    expect(started).toBe(true);
    expect(mockCreateAsync).toHaveBeenCalledTimes(1);
    expect(onProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        queueIndex: 0,
        queueLength: 2,
        activeTrackId: 't1',
        isPlaying: true,
      })
    );

    const state = controller.getQueueState();
    expect(state.queueIndex).toBe(0);
    expect(state.queueLength).toBe(2);
    expect(state.activeTrack.id).toBe('t1');

    await controller.dispose();
  });

  test('skipNext advances to next track and stopQueue halts playback', async () => {
    const queue = [
      { id: 't1', trackName: 'Song 1', previewUrl: 'https://audio.com/1.m4a' },
      { id: 't2', trackName: 'Song 2', previewUrl: 'https://audio.com/2.m4a' },
    ];
    const controller = createAudioPreviewController();
    await controller.playQueue(queue, 0);
    expect(mockCreateAsync).toHaveBeenCalledTimes(1);

    await controller.skipNext();
    expect(mockCreateAsync).toHaveBeenCalledTimes(2);
    expect(controller.getQueueState().queueIndex).toBe(1);

    controller.stopQueue();
    expect(controller.getQueueState().isPlaying).toBe(false);
    await controller.dispose();
  });
});


