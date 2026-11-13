// Your13.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  FlatList,
  Alert,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Text, TextInput, Card } from 'react-native-paper';
import { Audio } from 'expo-av';
import { db, auth } from './firebaseConfig';
import { doc, setDoc, getDoc, getDocs, collection } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import axios from 'axios';
import { FontAwesome5 } from '@expo/vector-icons';
import Taskbar from './Taskbar';
import { computeSimilarityMatrix } from './utils/algorithmUtils';
import { useLock } from './LockContext';
import {
  searchMusic,
  normalizeTrack as normalizeSong,
  getHighResImage,
} from './services/musicApi';
import { createAudioPreviewController } from './audioPreviewController';

/*export const normalizeSong = (item) => ({
  trackId: Number(item.trackId),
  trackName: item.trackName || 'Unknown Track',
  artistName: item.artistName || 'Unknown Artist',
  artistId: Number(item.artistId || 0),
  collectionName: item.collectionName || 'Single',
  artworkUrl100: item.artworkUrl100 || 'https://via.placeholder.com/150',
  previewUrl: item.previewUrl || '',
  primaryGenreName: item.primaryGenreName || 'Music',
  releaseDate: item.releaseDate || new Date().toISOString(),
});*/

// Fallback community playlists used only when Firestore rules block collection-wide reads
const FALLBACK_COMMUNITY_PLAYLISTS = [
  {
    username: 'alex_beats',
    displayName: 'alex_beats',
    trackIds: [1440857781, 1440818584, 1440903625, 111051],
    artistIds: [136975, 485953, 111051, 20044],
    primaryGenres: ['Pop', 'Hip-Hop/Rap', 'R&B/Soul', 'Pop', 'Alternative'],
    releaseDates: ['2020-03-20', '2018-08-03', '2021-05-21', '2019-11-15'],
  },
  {
    username: 'maya_grooves',
    displayName: 'maya_grooves',
    trackIds: [1440857781, 1560802899, 1450330588, 1200456],
    artistIds: [136975, 32940, 159260351, 485953],
    primaryGenres: ['Alternative', 'Rock', 'Indie', 'Pop', 'Electronic'],
    releaseDates: ['2015-07-17', '2017-04-14', '2022-10-21', '2023-02-10'],
  },
  {
    username: 'samy_vinyl',
    displayName: 'samy_vinyl',
    trackIds: [1440903625, 1440783617, 1440833090, 998877],
    artistIds: [111051, 5468295, 271256, 32940],
    primaryGenres: ['Hip-Hop/Rap', 'R&B/Soul', 'Hip-Hop/Rap', 'Pop'],
    releaseDates: ['2016-09-02', '2019-06-12', '2020-12-11', '2021-09-03'],
  },
];

function Your13({ navigation }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [selectedChoices, setSelectedChoices] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userId, setUserId] = useState(auth.currentUser?.uid || null);
  const [username, setUsername] = useState(null);

  const [playingTrackId, setPlayingTrackId] = useState(null);
  const [loadingTrackId, setLoadingTrackId] = useState(null);
  const audioControllerRef = useRef(null);

  const searchInputRef = useRef(null);
  const { isLocked, lockTime, lockChoices } = useLock();

  const stopAndUnloadPreview = useCallback(async () => {
    if (audioControllerRef.current) {
      await audioControllerRef.current.stop();
    }
    setPlayingTrackId(null);
    setLoadingTrackId(null);
  }, []);

  useEffect(() => {
    audioControllerRef.current = createAudioPreviewController({
      onStatusChange: (status) => {
        if (status.isLoaded && status.didJustFinish) {
          setPlayingTrackId(null);
        }
      },
      onError: (msg) => {
        setLoadingTrackId(null);
        setPlayingTrackId(null);
        Alert.alert('Playback Notice', msg);
      },
    });

    const unsubscribeBlur = navigation.addListener('blur', () => {
      stopAndUnloadPreview();
    });

    const unsubscribeFocus = navigation.addListener('focus', () => {
      if (auth.currentUser?.uid) {
        loadStoredChoices(auth.currentUser.uid);
      }
    });

    return () => {
      unsubscribeBlur();
      unsubscribeFocus();
      audioControllerRef.current?.dispose();
    };
  }, [navigation, stopAndUnloadPreview]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid);
        fetchUsername(user.uid);
        loadStoredChoices(user.uid);
      } else {
        setUserId(null);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (searchQuery.trim().length > 1) {
      const timerId = setTimeout(() => {
        setDebouncedQuery(searchQuery.trim());
      }, 380);
      return () => clearTimeout(timerId);
    } else {
      setDebouncedQuery('');
      setSearchResults([]);
    }
  }, [searchQuery]);

  useEffect(() => {
    if (debouncedQuery.length > 1) {
      handleSearch(debouncedQuery);
    }
  }, [debouncedQuery]);

  const fetchUsername = async (uid) => {
    try {
      const userDoc = await getDoc(doc(db, 'users', uid));
      if (userDoc.exists()) {
        setUsername(userDoc.data().username);
      }
    } catch (error) {
      console.warn('Could not fetch username (check Firestore rules):', error.message);
    }
  };

  const loadStoredChoices = async (uid) => {
    try {
      const playlistDoc = await getDoc(doc(db, 'playlists', uid));
      if (playlistDoc.exists()) {
        const rawSongs = playlistDoc.data().songs || [];
        const list = Array.isArray(rawSongs) ? rawSongs : Object.values(rawSongs);
        setSelectedChoices(list.slice(0, 13).map(normalizeSong));
      }
    } catch (error) {
      console.warn('Could not load stored choices from Firestore:', error.message);
    }
  };

  const handleSearch = async (queryTerm) => {
    try {
      setIsSearching(true);
      const results = await searchMusic(queryTerm, { limit: 25, entity: 'song' });
      setSearchResults(results);
    } catch (error) {
      console.error('Error fetching music data:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleTogglePreview = async (song) => {
    if (!song?.previewUrl) {
      Alert.alert('Preview Unavailable', 'No 30-second audio preview found for this track.');
      return;
    }

    try {
      if (playingTrackId === song.trackId) {
        await stopAndUnloadPreview();
        return;
      }

      setLoadingTrackId(song.trackId);
      const started = await audioControllerRef.current?.play(song.previewUrl);
      setLoadingTrackId(null);
      if (started) {
        setPlayingTrackId(song.trackId);
      } else {
        setPlayingTrackId(null);
      }
    } catch (error) {
      console.error('Error playing inline preview:', error);
      setLoadingTrackId(null);
      setPlayingTrackId(null);
      Alert.alert('Playback Error', 'Could not play the audio preview for this song.');
    }
  };

  const persistChoicesToFirestore = async (uid, choicesArray) => {
    if (!uid) return false;
    try {
      const docRef = doc(db, 'playlists', uid);
      await setDoc(
        docRef,
        {
          songs: choicesArray,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
      return true;
    } catch (e) {
      console.warn('Could not persist choices to Firestore:', e.message);
      return false;
    }
  };

  const handleMusicSelection = async (rawMusic) => {
    if (isLocked && selectedChoices.length === 13) {
      return;
    }

    const music = normalizeSong(rawMusic);
    const existingIndex = selectedChoices.findIndex(
      (choice) => choice.trackId === music.trackId
    );

    if (existingIndex !== -1) {
      await removeChoice(music);
      return;
    }

    if (selectedChoices.length >= 13) {
      Alert.alert(
        'Limit Reached (13/13)',
        'You have already filled all 13 slots. Remove a song first to swap.'
      );
      return;
    }

    const newChoices = [...selectedChoices, music];
    setSelectedChoices(newChoices);
    await persistChoicesToFirestore(userId, newChoices);

    if (newChoices.length === 13) {
      await lockChoices(60);
    }
  };

  const removeChoice = async (music) => {
    if (isLocked && selectedChoices.length === 13) {
      return;
    }

    const updatedChoices = selectedChoices.filter(
      (choice) => choice.trackId !== music.trackId
    );
    setSelectedChoices(updatedChoices);
    await persistChoicesToFirestore(userId, updatedChoices);
  };

  const storeChoices = async () => {
    try {
      setIsSubmitting(true);
      if (userId) {
        await persistChoicesToFirestore(userId, selectedChoices);
      }
      setIsSubmitting(false);

      if (selectedChoices.length === 13) {
        if (!isLocked) {
          await lockChoices(60);
        }
      } else {
        const remaining = Math.max(0, 13 - selectedChoices.length);
        Alert.alert(
          'Saved',
          `${selectedChoices.length} of 13 choices saved. Pick ${remaining} ${
            remaining === 1 ? 'more song' : 'more songs'
          } to complete Your13.`
        );
      }
    } catch (error) {
      console.error('Error storing choices:', error);
      setIsSubmitting(false);
    }
  };

  const buildPlaylistEntry = (id, songsList) => ({
    username: id,
    trackIds: songsList.map((song) => Number(song.trackId)),
    artistIds: songsList.map((song) => Number(song.artistId || 0)),
    primaryGenres: songsList.map((song) => song.primaryGenreName || 'Unknown'),
    releaseDates: songsList.map((song) => song.releaseDate || ''),
  });

  const loadAllPlaylists = async (effectiveUserId) => {
    const playlists = [];

    try {
      const querySnapshot = await getDocs(collection(db, 'playlists'));
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (!data || !data.songs) return;

        const rawSongs = Array.isArray(data.songs)
          ? data.songs
          : Object.values(data.songs || {});
        const validSongs = rawSongs.filter((s) => s && s.trackId);

        if (validSongs.length === 0) return;
        playlists.push(buildPlaylistEntry(docSnap.id, validSongs));
      });
    } catch (error) {
      console.warn(
        'Firestore permission restricted on collection(db, "playlists"). Using local & fallback community pool:',
        error.message
      );
      playlists.push(...FALLBACK_COMMUNITY_PLAYLISTS);
    }

    // Ensure the current user's active selections are always present & up to date
    const currentEntry = buildPlaylistEntry(effectiveUserId, selectedChoices);
    const existingIdx = playlists.findIndex(
      (p) => p.username === effectiveUserId || (username && p.username === username)
    );

    if (existingIdx !== -1) {
      playlists[existingIdx] = currentEntry;
    } else {
      playlists.unshift(currentEntry);
    }

    return playlists;
  };

  const rankUsers = async () => {
    if (selectedChoices.length === 0) {
      Alert.alert('Info', 'Please select at least 1 track before finding music twins.');
      return;
    }

    try {
      await stopAndUnloadPreview();
      const effectiveUserId = userId || auth.currentUser?.uid || 'current_user';

      // 1. O(1) Fast-Path: Check precomputed ranking/{userId} first
      if (userId) {
        try {
          const cachedRankSnap = await getDoc(doc(db, 'ranking', userId));
          if (cachedRankSnap.exists()) {
            const cachedData = cachedRankSnap.data();
            const updatedAtMs = cachedData.updatedAt
              ? new Date(cachedData.updatedAt).getTime()
              : 0;
            const isFresh = Date.now() - updatedAtMs < 5 * 60 * 1000;

            if (
              isFresh &&
              Array.isArray(cachedData.rankings) &&
              cachedData.rankings.length > 1
            ) {
              navigation.navigate('RankedUsers', {
                rankedUsers: cachedData.rankings,
                userId: effectiveUserId,
              });
              return;
            }
          }
        } catch (_) { }
      }

      // 2. Fallback: Compute matrix and update ranking/{userId} cache
      if (userId) {
        await persistChoicesToFirestore(userId, selectedChoices);
      }

      const playlists = await loadAllPlaylists(effectiveUserId);
      const weights = [0.5, 0.35, 0.075, 0.075];
      const matrix = computeSimilarityMatrix(playlists, weights);

      const currentUserIndex = playlists.findIndex(
        (p) => p.username === effectiveUserId || (username && p.username === username)
      );

      if (currentUserIndex === -1) {
        Alert.alert('Info', 'Please select at least 1 track before ranking connections.');
        return;
      }

      const userScores = playlists
        .map((userPlaylist, index) => ({
          uid: userPlaylist.username,
          uname: userPlaylist.username,
          totalScore: Number(matrix[currentUserIndex][index]) || 0,
        }))
        .sort((a, b) => b.totalScore - a.totalScore)
        .slice(0, 50);

      if (userId) {
        try {
          await setDoc(doc(db, 'ranking', userId), {
            rankings: userScores,
            updatedAt: new Date().toISOString(),
          });
        } catch (_) { }
      }

      navigation.navigate('RankedUsers', {
        rankedUsers: userScores,
        userId: effectiveUserId,
      });
    } catch (error) {
      console.error('Error ranking users:', error);
      Alert.alert('Error', 'Unable to compute compatibility rankings right now.');
    }
  };

  const getHighResImage = (imageUrl) => {
    if (!imageUrl) return 'https://via.placeholder.com/150';
    return imageUrl.replace('100x100', '400x400');
  };

  const renderResultCard = ({ item }) => {
    const existingIndex = selectedChoices.findIndex(
      (choice) => choice.trackId === item.trackId
    );
    const isSelected = existingIndex !== -1;
    const isFull = selectedChoices.length >= 13;
    const isThisPlaying = playingTrackId === item.trackId;
    const isThisLoading = loadingTrackId === item.trackId;
    const releaseYear = item.releaseDate
      ? new Date(item.releaseDate).getFullYear()
      : '';

    return (
      <Card style={[styles.resultCard, isSelected && styles.selectedCard]}>
        <View style={styles.cardRow}>
          <TouchableOpacity
            onPress={() => navigation.navigate('SongDetails', { song: item })}
            activeOpacity={0.85}
          >
            <Image
              source={{ uri: getHighResImage(item.artworkUrl100) }}
              style={styles.resultCover}
            />
          </TouchableOpacity>

          <View style={styles.resultInfo}>
            <TouchableOpacity
              onPress={() => navigation.navigate('SongDetails', { song: item })}
            >
              <Text style={styles.cardTitle} numberOfLines={1}>
                {item.trackName}
              </Text>
              <Text style={styles.cardSubtitle} numberOfLines={1}>
                {item.artistName} • {item.collectionName}
              </Text>
              <Text style={styles.cardGenre} numberOfLines={1}>
                {item.primaryGenreName}
                {releaseYear ? ` • ${releaseYear}` : ''}
              </Text>
            </TouchableOpacity>

            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[
                  styles.previewBtn,
                  isThisPlaying && styles.previewBtnActive,
                ]}
                onPress={() => handleTogglePreview(item)}
              >
                {isThisLoading ? (
                  <ActivityIndicator size={12} color="#FF8C00" />
                ) : (
                  <>
                    <FontAwesome5
                      name={isThisPlaying ? 'stop' : 'play'}
                      size={10}
                      color={isThisPlaying ? '#000' : '#FF8C00'}
                      style={{ marginRight: 5 }}
                    />
                    <Text
                      style={[
                        styles.previewBtnText,
                        isThisPlaying && styles.previewBtnTextActive,
                      ]}
                    >
                      {isThisPlaying ? 'Stop' : 'Preview'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              {isSelected ? (
                <TouchableOpacity
                  style={[
                    styles.removeActionBtn,
                    isLocked && selectedChoices.length === 13 && { opacity: 0.35 },
                  ]}
                  onPress={() => {
                    if (isLocked && selectedChoices.length === 13) return;
                    removeChoice(item);
                  }}
                  disabled={isLocked && selectedChoices.length === 13}
                  accessibilityState={{ disabled: isLocked && selectedChoices.length === 13 }}
                >
                  <Text style={styles.removeActionText}>
                    ✕ Slot #{existingIndex + 1}
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[
                    styles.addActionBtn,
                    (isFull || (isLocked && selectedChoices.length === 13)) && styles.disabledActionBtn,
                  ]}
                  onPress={() => handleMusicSelection(item)}
                  disabled={isFull || (isLocked && selectedChoices.length === 13)}
                >
                  <Text style={styles.addActionText}>
                    {isFull ? '13/13 Full' : `+ Slot #${selectedChoices.length + 1}`}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Card>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerContainer}>
        <Text style={styles.headerText}>Your13</Text>
        <Text style={styles.subHeaderText}>Curate Your 13 Signature Tracks</Text>

        <View style={styles.counterRow}>
          <View
            style={[
              styles.counterBadge,
              selectedChoices.length === 13 && styles.counterBadgeComplete,
            ]}
          >
            <Text style={styles.counterBadgeText}>
              {selectedChoices.length} / 13 Selected
            </Text>
          </View>
          <View style={styles.progressBarBackground}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${Math.min((selectedChoices.length / 13) * 100, 100)}%` },
                selectedChoices.length === 13 && styles.progressBarComplete,
              ]}
            />
          </View>
        </View>

        {isLocked && selectedChoices.length === 13 && (
          <View style={styles.lockBanner}>
            <FontAwesome5
              name="lock"
              size={14}
              color="#FFD700"
              style={{ marginRight: 6 }}
            />
            <Text style={styles.lockBannerText}>
              All 13 choices finalized! Locked for {lockTime}s
            </Text>
          </View>
        )}
      </View>

      {/* Horizontal Tray of Numbered 1 to 13 Slots */}
      <View style={styles.slotsSection}>
        <View style={styles.slotsHeaderRow}>
          <Text style={styles.slotsTitle}>Your 13 Slots (1 to 13)</Text>
          <TouchableOpacity
            onPress={() =>
              navigation.navigate('ViewChoicesScreen', {
                selectedChoices,
                removeChoice,
                userId,
              })
            }
          >
            <Text style={styles.viewAllText}>
              View All ({selectedChoices.length}) →
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.slotsScrollContent}
        >
          {Array.from({ length: 13 }).map((_, index) => {
            const slotNumber = index + 1;
            const song = selectedChoices[index];

            return (
              <TouchableOpacity
                key={slotNumber}
                activeOpacity={0.85}
                onPress={() => {
                  if (song) {
                    navigation.navigate('SongDetails', { song });
                  } else if (searchInputRef.current) {
                    searchInputRef.current.focus();
                  }
                }}
                style={[
                  styles.slotCard,
                  song ? styles.filledSlotCard : styles.emptySlotCard,
                ]}
              >
                <View style={styles.slotBadge}>
                  <Text style={styles.slotBadgeText}>#{slotNumber}</Text>
                </View>

                {song ? (
                  <>
                    <Image
                      source={{ uri: getHighResImage(song.artworkUrl100) }}
                      style={styles.slotImage}
                    />
                    <Text style={styles.slotSongTitle} numberOfLines={1}>
                      {song.trackName}
                    </Text>
                    <Text style={styles.slotArtist} numberOfLines={1}>
                      {song.artistName}
                    </Text>
                    {!(isLocked && selectedChoices.length === 13) && (
                      <TouchableOpacity
                        style={styles.slotRemoveBtn}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        onPress={() => removeChoice(song)}
                      >
                        <Text style={styles.slotRemoveText}>✕</Text>
                      </TouchableOpacity>
                    )}
                  </>
                ) : (
                  <View style={styles.emptySlotContent}>
                    <FontAwesome5
                      name="music"
                      size={18}
                      color="#555"
                      style={{ marginBottom: 6 }}
                    />
                    <Text style={styles.emptySlotLabel}>Slot #{slotNumber}</Text>
                    <Text style={styles.emptySlotSub}>Tap to Search</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Music Search Box */}
      <View style={styles.searchContainer}>
        <TextInput
          ref={searchInputRef}
          style={styles.searchInput}
          placeholder="Search iTunes by song name or artist..."
          placeholderTextColor="#888"
          textColor="#FFFFFF"
          value={searchQuery}
          onChangeText={(text) => setSearchQuery(text)}
          left={<TextInput.Icon icon="magnify" color="#FF8C00" />}
          right={
            searchQuery.length > 0 ? (
              <TextInput.Icon
                icon="close-circle"
                color="#718096"
                onPress={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                }}
              />
            ) : null
          }
        />
      </View>

      {/* Search Results List */}
      <FlatList
        data={searchResults}
        keyExtractor={(item) => item.trackId.toString()}
        renderItem={renderResultCard}
        contentContainerStyle={styles.resultsList}
        ListEmptyComponent={
          isSearching ? (
            <View style={styles.searchTipBox}>
              <ActivityIndicator size="small" color="#FF8C00" />
              <Text style={styles.emptySearchText}>Searching iTunes catalog...</Text>
            </View>
          ) : searchQuery.trim().length > 1 ? (
            <Text style={styles.emptySearchText}>No matching tracks found.</Text>
          ) : (
            <View style={styles.searchTipBox}>
              <FontAwesome5
                name="search"
                size={24}
                color="#666"
                style={{ marginBottom: 8 }}
              />
              <Text style={styles.searchTipTitle}>Find your signature songs</Text>
              <Text style={styles.searchTipText}>
                Type an artist or track above to populate your 13 slots
              </Text>
            </View>
          )
        }
      />

      {/* Action Buttons Bar */}
      <View style={styles.bottomActionBar}>
        <TouchableOpacity
          onPress={storeChoices}
          style={[
            styles.actionSaveButton,
            isLocked && selectedChoices.length === 13 && styles.disabledSaveButton,
          ]}
          disabled={isSubmitting || (isLocked && selectedChoices.length === 13)}
        >
          <FontAwesome5
            name={isLocked && selectedChoices.length === 13 ? 'lock' : 'check'}
            size={16}
            color={isLocked && selectedChoices.length === 13 ? '#64748B' : '#000'}
            style={{ marginRight: 6 }}
          />
          <Text
            style={[
              styles.actionSaveText,
              isLocked && selectedChoices.length === 13 && styles.disabledSaveText,
            ]}
          >
            {isLocked && selectedChoices.length === 13
              ? `Locked (${lockTime}s)`
              : selectedChoices.length === 13
              ? 'Lock & Submit (13/13)'
              : `Save (${selectedChoices.length}/13)`}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={rankUsers} style={styles.actionRankButton}>
          <FontAwesome5
            name="users"
            size={16}
            color="#FFF"
            style={{ marginRight: 6 }}
          />
          <Text style={styles.actionRankText}>Find Music Twins</Text>
        </TouchableOpacity>
      </View>

      <Taskbar navigation={navigation} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0E12',
  },
  headerContainer: {
    alignItems: 'center',
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  headerText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  subHeaderText: {
    fontSize: 14,
    color: '#A0AEC0',
    marginTop: 2,
    marginBottom: 8,
  },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    maxWidth: 460,
    marginTop: 4,
  },
  counterBadge: {
    backgroundColor: '#FF8C00',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    marginRight: 10,
  },
  counterBadgeComplete: {
    backgroundColor: '#10B981',
  },
  counterBadgeText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '800',
  },
  progressBarBackground: {
    flex: 1,
    height: 8,
    backgroundColor: '#23262F',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#FF8C00',
    borderRadius: 4,
  },
  progressBarComplete: {
    backgroundColor: '#10B981',
  },
  lockBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    borderColor: '#FFD700',
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
    marginTop: 8,
  },
  lockBannerText: {
    color: '#FFD700',
    fontSize: 13,
    fontWeight: '700',
  },
  slotsSection: {
    marginTop: 8,
    marginBottom: 10,
  },
  slotsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 6,
  },
  slotsTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  viewAllText: {
    color: '#FF8C00',
    fontSize: 13,
    fontWeight: '600',
  },
  slotsScrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  slotCard: {
    width: 95,
    height: 128,
    borderRadius: 10,
    marginRight: 8,
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  filledSlotCard: {
    backgroundColor: '#1A1D24',
    borderWidth: 1.5,
    borderColor: '#FF8C00',
  },
  emptySlotCard: {
    backgroundColor: '#13151B',
    borderWidth: 1.5,
    borderColor: '#2D323E',
    borderStyle: 'dashed',
  },
  slotBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingVertical: 2,
    paddingHorizontal: 5,
    borderRadius: 6,
    zIndex: 2,
  },
  slotBadgeText: {
    color: '#FF8C00',
    fontSize: 10,
    fontWeight: '800',
  },
  slotImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginTop: 10,
    marginBottom: 4,
  },
  slotSongTitle: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    width: '100%',
    textAlign: 'center',
  },
  slotArtist: {
    color: '#A0AEC0',
    fontSize: 9,
    width: '100%',
    textAlign: 'center',
  },
  slotRemoveBtn: {
    position: 'absolute',
    top: 3,
    right: 3,
    backgroundColor: '#E53E3E',
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  slotRemoveText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
    lineHeight: 12,
  },
  emptySlotContent: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  emptySlotLabel: {
    color: '#718096',
    fontSize: 11,
    fontWeight: '700',
  },
  emptySlotSub: {
    color: '#4A5568',
    fontSize: 9,
  },
  searchContainer: {
    paddingHorizontal: 16,
    marginBottom: 8,
    width: '100%',
    maxWidth: 500,
    alignSelf: 'center',
  },
  searchInput: {
    backgroundColor: '#1A1D24',
    borderRadius: 10,
    fontSize: 14,
    height: 44,
  },
  resultsList: {
    paddingHorizontal: 16,
    paddingBottom: 28,
  },
  resultCard: {
    backgroundColor: '#16181F',
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#242834',
    width: '100%',
    maxWidth: 500,
    alignSelf: 'center',
    overflow: 'hidden',
  },
  selectedCard: {
    borderColor: '#FF8C00',
    backgroundColor: '#1F222B',
  },
  cardRow: {
    flexDirection: 'row',
    padding: 10,
    alignItems: 'center',
  },
  resultCover: {
    width: 68,
    height: 68,
    borderRadius: 8,
    marginRight: 12,
    backgroundColor: '#23262F',
  },
  resultInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  cardTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  cardSubtitle: {
    color: '#CBD5E1',
    fontSize: 12,
    marginBottom: 2,
  },
  cardGenre: {
    color: '#718096',
    fontSize: 11,
    marginBottom: 6,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  previewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FF8C00',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  previewBtnActive: {
    backgroundColor: '#FF8C00',
  },
  previewBtnText: {
    color: '#FF8C00',
    fontSize: 11,
    fontWeight: '700',
  },
  previewBtnTextActive: {
    color: '#000000',
  },
  addActionBtn: {
    backgroundColor: '#FF8C00',
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  addActionText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '700',
  },
  disabledActionBtn: {
    backgroundColor: '#2D323E',
  },
  removeActionBtn: {
    backgroundColor: '#2D323E',
    borderColor: '#E53E3E',
    borderWidth: 1,
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  removeActionText: {
    color: '#FC8181',
    fontSize: 12,
    fontWeight: '700',
  },
  emptySearchText: {
    color: '#A0AEC0',
    textAlign: 'center',
    marginTop: 12,
    fontSize: 14,
  },
  searchTipBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
  },
  searchTipTitle: {
    color: '#E2E8F0',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  searchTipText: {
    color: '#718096',
    fontSize: 13,
    textAlign: 'center',
    maxWidth: 280,
  },
  bottomActionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 94, // Lifts Save & Find Music Twins cleanly above floating Taskbar dock
    backgroundColor: '#12141A',
    borderTopWidth: 1,
    borderTopColor: '#20242E',
    width: '100%',
    maxWidth: 500,
    alignSelf: 'center',
  },
  actionSaveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF8C00',
    paddingVertical: 10,
    borderRadius: 8,
    marginRight: 8,
  },
  disabledSaveButton: {
    backgroundColor: '#1E2430',
    borderColor: '#242936',
    borderWidth: 1,
  },
  actionSaveText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '700',
  },
  disabledSaveText: {
    color: '#64748B',
  },
  actionRankButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2B3142',
    paddingVertical: 10,
    borderRadius: 8,
  },
  actionRankText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});

export default Your13;