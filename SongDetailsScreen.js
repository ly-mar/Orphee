// SongDetailsScreen.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Linking,
} from 'react-native';
import { Text } from 'react-native-paper';
import { Audio } from 'expo-av';
import { FontAwesome5 } from '@expo/vector-icons';
import Taskbar from './Taskbar';
import { normalizeTrack, getHighResImage } from './services/musicApi';
import { createAudioPreviewController } from './audioPreviewController';

function SongDetailsScreen({ route, navigation }) {
  const rawSong = route?.params?.song || {};
  const song = normalizeTrack(rawSong);

  const audioControllerRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [playbackPosition, setPlaybackPosition] = useState(0);
  const [playbackDuration, setPlaybackDuration] = useState(30000);
  const [audioError, setAudioError] = useState(
    !song.previewUrl ? 'Preview stream expired or unavailable.' : null
  );

  const stopAndUnloadSound = useCallback(async () => {
    if (audioControllerRef.current) {
      await audioControllerRef.current.stop();
    }
    setIsPlaying(false);
    setPlaybackPosition(0);
  }, []);

  useEffect(() => {
    audioControllerRef.current = createAudioPreviewController({
      onStatusChange: (status) => {
        if (status.isLoaded) {
          setIsPlaying(status.isPlaying);
          setPlaybackPosition(status.positionMillis || 0);
          setPlaybackDuration(status.durationMillis || 30000);
          if (status.didJustFinish) {
            setIsPlaying(false);
            setPlaybackPosition(0);
          }
        }
      },
      onError: (msg) => {
        setAudioError(msg);
        setIsPlaying(false);
        setIsLoadingAudio(false);
      },
    });

    const unsubscribeBlur = navigation.addListener('blur', () => {
      stopAndUnloadSound();
    });

    return () => {
      unsubscribeBlur();
      audioControllerRef.current?.dispose();
    };
  }, [navigation, stopAndUnloadSound]);

  const handleTogglePreview = async () => {
    if (!song.previewUrl) {
      setAudioError('Preview stream expired or unavailable.');
      return;
    }

    setAudioError(null);

    if (isPlaying) {
      await stopAndUnloadSound();
    } else {
      setIsLoadingAudio(true);
      const started = await audioControllerRef.current?.play(song.previewUrl);
      setIsLoadingAudio(false);
      setIsPlaying(Boolean(started));
    }
  };

  const openExternalStream = async (platform) => {
    const queryTerm = encodeURIComponent(`${song.trackName} ${song.artistName}`);
    const url =
      platform === 'apple'
        ? `https://music.apple.com/search?term=${queryTerm}`
        : `https://open.spotify.com/search/${queryTerm}`;

    try {
      await Linking.openURL(url);
    } catch (err) {
      console.error('Failed to open external music link:', err);
    }
  };

  const releaseYear = song.releaseDate
    ? new Date(song.releaseDate).getFullYear()
    : 'N/A';

  const progressPercent =
    playbackDuration > 0
      ? Math.min((playbackPosition / playbackDuration) * 100, 100)
      : 0;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topHeader}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <FontAwesome5 name="arrow-left" size={15} color="#FFFFFF" />
          <Text style={styles.backBtnText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Track Details</Text>
        <View style={{ width: 68 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <Image
            source={{ uri: getHighResImage(song.artworkUrl100) }}
            style={styles.coverArt}
          />

          <Text style={styles.trackName}>{song.trackName}</Text>
          <Text style={styles.artistName}>{song.artistName}</Text>
          <Text style={styles.collectionName}>{song.collectionName}</Text>

          <View style={styles.metaRow}>
            <View style={styles.metaBadge}>
              <FontAwesome5 name="compact-disc" size={12} color="#FF8C00" />
              <Text style={styles.metaBadgeText}>{song.primaryGenreName}</Text>
            </View>
            <View style={styles.metaBadge}>
              <FontAwesome5 name="calendar-alt" size={12} color="#FF8C00" />
              <Text style={styles.metaBadgeText}>{releaseYear}</Text>
            </View>
          </View>

          <View style={styles.playerBox}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
            </View>
            <View style={styles.timeRow}>
              <Text style={styles.timeText}>{Math.floor(playbackPosition / 1000)}s</Text>
              <Text style={styles.timeText}>30s Preview</Text>
            </View>

            <TouchableOpacity
              style={[
                styles.playButton,
                (!song.previewUrl || audioError) && styles.disabledPlayButton,
              ]}
              onPress={handleTogglePreview}
              disabled={isLoadingAudio}
            >
              {isLoadingAudio ? (
                <ActivityIndicator size="small" color="#000000" />
              ) : (
                <>
                  <FontAwesome5
                    name={isPlaying ? 'pause' : 'play'}
                    size={16}
                    color="#000000"
                    style={{ marginRight: 8 }}
                  />
                  <Text style={styles.playButtonText}>
                    {!song.previewUrl
                      ? 'Preview Unavailable'
                      : isPlaying
                        ? 'Pause 30s Preview'
                        : 'Play 30s Preview'}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {(audioError || !song.previewUrl) && (
              <View style={styles.errorBanner}>
                <FontAwesome5 name="exclamation-circle" size={13} color="#F87171" />
                <Text style={styles.errorBannerText}>
                  {audioError || 'Preview stream expired or unavailable. Listen via full streaming below:'}
                </Text>
              </View>
            )}

            <View style={styles.externalLinksRow}>
              <TouchableOpacity
                style={styles.appleMusicBtn}
                onPress={() => openExternalStream('apple')}
              >
                <FontAwesome5 name="apple" size={15} color="#FFFFFF" />
                <Text style={styles.externalBtnText}>Listen on Apple Music</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.spotifyBtn}
                onPress={() => openExternalStream('spotify')}
              >
                <FontAwesome5 name="spotify" size={15} color="#000000" />
                <Text style={styles.spotifyBtnText}>Listen on Spotify</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>

      <Taskbar navigation={navigation} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0E12',
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1F2430',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1D24',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  backBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 6,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  scrollContent: {
    padding: 20,
    alignItems: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#16181F',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#242834',
  },
  coverArt: {
    width: 240,
    height: 240,
    borderRadius: 14,
    marginBottom: 18,
    backgroundColor: '#23262F',
  },
  trackName: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 6,
  },
  artistName: {
    color: '#FF8C00',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
  },
  collectionName: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 14,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  metaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F222B',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    gap: 6,
  },
  metaBadgeText: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '600',
  },
  playerBox: {
    width: '100%',
    backgroundColor: '#12141A',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#20242E',
  },
  progressTrack: {
    width: '100%',
    height: 6,
    backgroundColor: '#23262F',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FF8C00',
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
    marginBottom: 12,
  },
  timeText: {
    color: '#718096',
    fontSize: 11,
    fontWeight: '600',
  },
  playButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF8C00',
    paddingVertical: 12,
    borderRadius: 10,
  },
  disabledPlayButton: {
    backgroundColor: '#4A5568',
  },
  playButtonText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '800',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(248, 113, 113, 0.12)',
    borderWidth: 1,
    borderColor: '#F87171',
    padding: 10,
    borderRadius: 8,
    marginTop: 12,
    gap: 8,
  },
  errorBannerText: {
    color: '#FCA5A5',
    fontSize: 12,
    flex: 1,
  },
  externalLinksRow: {
    flexDirection: 'column',
    gap: 8,
    marginTop: 14,
  },
  appleMusicBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FA243C',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 8,
  },
  externalBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  spotifyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1DB954',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 8,
  },
  spotifyBtnText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '800',
  },
});

export default SongDetailsScreen;