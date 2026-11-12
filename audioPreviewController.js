// audioPreviewController.js — serialized expo-av sound controller [BUG-003]
import { Audio } from 'expo-av';

export function createAudioPreviewController({ onStatusChange, onError } = {}) {
  let currentSound = null;
  let currentHtmlAudio = null;
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

    const htmlAudioToUnload = currentHtmlAudio;
    currentHtmlAudio = null;
    if (htmlAudioToUnload) {
      try {
        htmlAudioToUnload.pause?.();
        htmlAudioToUnload.onended = null;
        htmlAudioToUnload.src = '';
      } catch (_) {}
    }
  }

  async function play(previewUrl, { silentError = false } = {}) {
    if (isDisposed) return false;
    if (!previewUrl || typeof previewUrl !== 'string' || !/^https?:\/\//i.test(previewUrl.trim())) {
      if (!silentError) {
        onError?.('Preview unavailable for this track.');
      }
      return false;
    }

    const cleanUrl = previewUrl.trim();
    const myToken = ++requestToken;
    await unloadCurrent();

    try {
      if (Audio?.setAudioModeAsync) {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      }
      const { sound } = await Audio.Sound.createAsync(
        { uri: cleanUrl },
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
      // Fallback to native HTML5 Audio on browsers when expo-av web playback fails
      if (typeof window !== 'undefined' && typeof window.Audio === 'function' && !isDisposed && myToken === requestToken) {
        try {
          const webAudio = new window.Audio(cleanUrl);
          webAudio.onended = () => {
            if (myToken === requestToken && !isDisposed) {
              onStatusChange?.({ isLoaded: true, didJustFinish: true });
              unloadCurrent();
            }
          };
          await webAudio.play();
          if (isDisposed || myToken !== requestToken) {
            webAudio.pause?.();
            return false;
          }
          currentHtmlAudio = webAudio;
          return true;
        } catch (webErr) {
          if (!silentError) {
            onError?.(
              webErr?.name === 'NotAllowedError'
                ? 'Browser blocked autoplay. Tap again to play preview.'
                : 'Could not stream audio preview.'
            );
          }
          return false;
        }
      }

      if (!silentError) {
        onError?.(
          err?.name === 'NotAllowedError'
            ? 'Browser blocked autoplay. Tap again to play preview.'
            : 'Could not stream audio preview.'
        );
      }
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

export async function resolveFreshPreviewUrl(song, searchMusicFn) {
  if (!song || typeof searchMusicFn !== 'function') return null;
  const title = String(song.trackName || song.title || '').trim();
  const artist = String(song.artistName || song.artist || '').trim();
  const queryText = [title, artist].filter(Boolean).join(' ');
  if (queryText.length < 2) return null;

  try {
    const candidates = await searchMusicFn(queryText, { limit: 6 });
    if (!Array.isArray(candidates) || candidates.length === 0) return null;

    const cleanId = song.trackId != null ? String(song.trackId) : '';
    const exactIdMatch = cleanId
      ? candidates.find((c) => String(c.trackId) === cleanId && c.previewUrl)
      : null;
    if (exactIdMatch?.previewUrl) return exactIdMatch.previewUrl;

    const lowerTitle = title.toLowerCase();
    const titleMatch = candidates.find(
      (c) =>
        c.previewUrl &&
        String(c.trackName || '').toLowerCase().includes(lowerTitle)
    );
    return titleMatch?.previewUrl || candidates.find((c) => c.previewUrl)?.previewUrl || null;
  } catch (_) {
    return null;
  }
}

