// audioPreviewController.js — serialized expo-av sound controller [BUG-003]
import { Audio } from 'expo-av';

export function createAudioPreviewController({ onStatusChange, onError } = {}) {
  let currentSound = null;
  let requestToken = 0;
  let isDisposed = false;

  async function unloadCurrent() {
    const soundToUnload = currentSound;
    currentSound = null;
    if (soundToUnload) {
      try {
        await soundToUnload.stopAsync();
      } catch (_) {}
      try {
        await soundToUnload.unloadAsync();
      } catch (_) {}
    }
  }

  async function play(previewUrl) {
    if (isDisposed) return false;
    if (!previewUrl || typeof previewUrl !== 'string' || !/^https?:\/\//i.test(previewUrl.trim())) {
      onError?.('Preview unavailable for this track.');
      return false;
    }

    const myToken = ++requestToken;
    await unloadCurrent();

    try {
      if (Audio?.setAudioModeAsync) {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      }
      const { sound } = await Audio.Sound.createAsync(
        { uri: previewUrl.trim() },
        { shouldPlay: true },
        (status) => {
          if (myToken === requestToken && !isDisposed) {
            onStatusChange?.(status);
            if (status.didJustFinish) {
              unloadCurrent();
            }
          }
        }
      );

      // If another tap or unmount happened while createAsync was in flight, unload immediately
      if (isDisposed || myToken !== requestToken) {
        await sound.unloadAsync();
        return false;
      }

      currentSound = sound;
      return true;
    } catch (err) {
      onError?.(
        err?.name === 'NotAllowedError'
          ? 'Browser blocked autoplay. Tap again to play preview.'
          : 'Could not stream audio preview.'
      );
      return false;
    }
  }

  async function dispose() {
    isDisposed = true;
    requestToken++;
    await unloadCurrent();
  }

  return { play, stop: unloadCurrent, dispose };
}

