// audioPreviewController.js — serialized expo-av sound controller & Crate Radio queue engine [BUG-003, VR-022, WP-03]
import { Audio } from 'expo-av';

export function createAudioPreviewController({ onStatusChange, onError } = {}) {
  let currentSound = null;
  let currentHtmlAudio = null;
  let requestToken = 0;
  let isDisposed = false;

  // Queue state for Crate Radio
  let tracksQueue = [];
  let queueIndex = 0;
  let isQueueActive = false;
  let progressRatio = 0;
  let progressCallback = null;
  let searchMusicFnRef = null;
  let progressInterval = null;

  function notifyProgress(extra = {}) {
    const activeTrack = tracksQueue[queueIndex] || null;
    const state = {
      isPlaying: isQueueActive && Boolean(currentSound || currentHtmlAudio),
      activeTrackId: activeTrack?.id || activeTrack?.trackId || null,
      activeTrack,
      queueIndex,
      queueLength: tracksQueue.length,
      progressRatio,
      ...extra,
    };
    progressCallback?.(state);
  }

  function clearFallbackInterval() {
    if (progressInterval) {
      clearInterval(progressInterval);
      progressInterval = null;
    }
  }

  async function unloadCurrent() {
    clearFallbackInterval();
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
        htmlAudioToUnload.ontimeupdate = null;
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
        { shouldPlay: true, progressUpdateIntervalMillis: 250 },
        (status) => {
          if (myToken === requestToken && !isDisposed) {
            onStatusChange?.(status);
            if (status.durationMillis && status.positionMillis != null) {
              progressRatio = Math.min(1, Math.max(0, status.positionMillis / status.durationMillis));
              notifyProgress({ progressRatio, isPlaying: Boolean(status.isPlaying) });
            }
            if (status.didJustFinish) {
              unloadCurrent();
              handleTrackDidFinish();
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
      progressRatio = 0;
      notifyProgress({ isPlaying: true, progressRatio: 0 });

      // Fallback simulated progress timer if Sound status doesn't tick duration
      clearFallbackInterval();
      const startMs = Date.now();
      progressInterval = setInterval(() => {
        if (myToken !== requestToken || isDisposed || !currentSound) {
          clearFallbackInterval();
          return;
        }
        const elapsed = (Date.now() - startMs) / 1000;
        const ratio = Math.min(1, elapsed / 30);
        progressRatio = ratio;
        notifyProgress({ progressRatio: ratio, isPlaying: true });
        if (ratio >= 1) {
          clearFallbackInterval();
        }
      }, 250);

      return true;
    } catch (err) {
      // Fallback to native HTML5 Audio on browsers when expo-av web playback fails
      if (typeof window !== 'undefined' && typeof window.Audio === 'function' && !isDisposed && myToken === requestToken) {
        try {
          const webAudio = new window.Audio(cleanUrl);
          webAudio.ontimeupdate = () => {
            if (myToken === requestToken && !isDisposed && webAudio.duration) {
              progressRatio = Math.min(1, Math.max(0, webAudio.currentTime / webAudio.duration));
              notifyProgress({ progressRatio, isPlaying: !webAudio.paused });
            }
          };
          webAudio.onended = () => {
            if (myToken === requestToken && !isDisposed) {
              onStatusChange?.({ isLoaded: true, didJustFinish: true });
              unloadCurrent();
              handleTrackDidFinish();
            }
          };
          await webAudio.play();
          if (isDisposed || myToken !== requestToken) {
            webAudio.pause?.();
            return false;
          }
          currentHtmlAudio = webAudio;
          progressRatio = 0;
          notifyProgress({ isPlaying: true, progressRatio: 0 });
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

  function handleTrackDidFinish() {
    if (isQueueActive && tracksQueue.length > 0) {
      if (queueIndex + 1 < tracksQueue.length) {
        playQueueIndex(queueIndex + 1);
      } else {
        stopQueue();
      }
    }
  }

  async function playQueueIndex(index) {
    if (isDisposed || !isQueueActive || index >= tracksQueue.length || index < 0) {
      stopQueue();
      return false;
    }

    queueIndex = index;
    progressRatio = 0;
    const track = tracksQueue[queueIndex];
    if (!track) {
      stopQueue();
      return false;
    }

    notifyProgress({ queueIndex, activeTrack: track, progressRatio: 0, isPlaying: true });

    let previewUrl = track.previewUrl || '';
    if (!previewUrl && searchMusicFnRef) {
      previewUrl = await resolveFreshPreviewUrl(track, searchMusicFnRef);
    }

    if (!previewUrl) {
      // Auto-advance to next track if preview is missing
      if (queueIndex + 1 < tracksQueue.length) {
        return playQueueIndex(queueIndex + 1);
      }
      stopQueue();
      return false;
    }

    const success = await play(previewUrl, { silentError: true });
    if (!success) {
      if (queueIndex + 1 < tracksQueue.length) {
        return playQueueIndex(queueIndex + 1);
      }
      stopQueue();
      return false;
    }
    return true;
  }

  async function playQueue(queue, startIndex = 0, { searchMusicFn } = {}) {
    if (isDisposed || !Array.isArray(queue) || queue.length === 0) {
      return false;
    }
    tracksQueue = [...queue];
    searchMusicFnRef = searchMusicFn || null;
    isQueueActive = true;
    return await playQueueIndex(startIndex);
  }

  function skipNext() {
    if (!isQueueActive || tracksQueue.length === 0) return false;
    if (queueIndex + 1 < tracksQueue.length) {
      return playQueueIndex(queueIndex + 1);
    }
    stopQueue();
    return false;
  }

  function skipPrev() {
    if (!isQueueActive || tracksQueue.length === 0) return false;
    const prevIdx = Math.max(0, queueIndex - 1);
    return playQueueIndex(prevIdx);
  }

  function stopQueue() {
    isQueueActive = false;
    progressRatio = 0;
    notifyProgress({ isPlaying: false, progressRatio: 0 });
    unloadCurrent();
  }

  function getQueueState() {
    const activeTrack = tracksQueue[queueIndex] || null;
    return {
      isPlaying: isQueueActive && Boolean(currentSound || currentHtmlAudio),
      queueIndex,
      queueLength: tracksQueue.length,
      activeTrack,
      progressRatio,
    };
  }

  function setOnProgress(cb) {
    progressCallback = cb;
    return () => {
      if (progressCallback === cb) progressCallback = null;
    };
  }

  async function dispose() {
    isDisposed = true;
    requestToken++;
    isQueueActive = false;
    clearFallbackInterval();
    await unloadCurrent();
  }

  return {
    play,
    stop: () => {
      if (isQueueActive) {
        stopQueue();
      } else {
        unloadCurrent();
      }
    },
    dispose,
    playQueue,
    skipNext,
    skipPrev,
    stopQueue,
    getQueueState,
    onProgress: setOnProgress,
    setOnProgress,
  };
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
