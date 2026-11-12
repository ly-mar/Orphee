// Pickerchoosers.js — Collective Theme Music List & Voting [VR-001, VR-004, VR-006, VR-021]
import React, { useState, useCallback, useRef } from 'react';
import {
  ScrollView,
  StyleSheet,
  SafeAreaView,
  View,
  Alert,
  Image,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Text } from 'react-native-paper';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import { FontAwesome5, Feather } from '@expo/vector-icons';
import { db, auth } from './firebaseConfig';
import {
  collection,
  getDocs,
  updateDoc,
  doc,
  setDoc,
  getDoc,
  query,
  orderBy,
  increment,
} from 'firebase/firestore';
import { createAsyncActionLock } from './utils/actionLockUtils';
import { resolveThemeTitle } from './ThemeDetails';
import { normalizeTrack } from './services/musicApi';

const isUsableArtworkUrl = (url) =>
  typeof url === 'string' &&
  /^https?:\/\//i.test(url) &&
  !url.includes('example.com') &&
  !url.includes('via.placeholder.com');

function Pickerchoosers() {
  const route = useRoute();
  const navigation = useNavigation();
  const themeId = route?.params?.themeId || 'child_of_the_80s';
  const themeTitle = resolveThemeTitle(themeId, route?.params?.theme);

  const [songs, setSongs] = useState([]);
  const [votedIds, setVotedIds] = useState({});
  const [failedArtIds, setFailedArtIds] = useState({});
  const [loading, setLoading] = useState(true);
  const userId = auth.currentUser?.uid;
  const actionLockRef = useRef(createAsyncActionLock());

  const loadSongs = useCallback(async () => {
    try {
      setLoading(true);
      const songsCollectionRef = collection(db, 'collective', themeId, 'songs');
      const songsQuery = query(songsCollectionRef, orderBy('score', 'desc'));
      const songsSnapshot = await getDocs(songsQuery);

      if (!songsSnapshot.empty) {
        const dedupMap = new Map();
        songsSnapshot.docs.forEach((docSnap) => {
          const raw = { id: docSnap.id, ...docSnap.data() };
          const titleKey = String(raw.trackName || raw.title || '').trim().toLowerCase();
          const artistKey = String(raw.artistName || raw.artist || '').trim().toLowerCase();
          const sigKey =
            raw.trackId != null
              ? `id_${raw.trackId}`
              : titleKey && artistKey
                ? `${titleKey}::${artistKey}`
                : docSnap.id;

          const existing = dedupMap.get(sigKey);
          if (!existing || (Number(raw.score) || 0) > (Number(existing.score) || 0)) {
            dedupMap.set(sigKey, {
              ...existing,
              ...raw,
              id: existing?.id || docSnap.id,
              score: Math.max(Number(raw.score) || 0, Number(existing?.score) || 0),
              artworkUrl100: isUsableArtworkUrl(raw.artworkUrl100)
                ? raw.artworkUrl100
                : existing?.artworkUrl100 || raw.imageUrl || null,
            });
          }
        });

        const sorted = Array.from(dedupMap.values()).sort(
          (a, b) => (Number(b.score) || 0) - (Number(a.score) || 0)
        );
        setSongs(sorted);

        if (userId) {
          const voteStates = {};
          await Promise.all(
            sorted.map(async (song) => {
              try {
                const voteSnap = await getDoc(
                  doc(db, 'collective', themeId, 'songs', song.id, 'votes', userId)
                );
                if (voteSnap.exists()) {
                  voteStates[song.id] = true;
                }
              } catch (_) { }
            })
          );
          setVotedIds(voteStates);
        }
      } else {
        setSongs([]);
      }
    } catch (error) {
      console.error('Error loading songs from Firestore:', error);
    } finally {
      setLoading(false);
    }
  }, [themeId, userId]);

  useFocusEffect(
    useCallback(() => {
      loadSongs();
    }, [loadSongs])
  );

  const addOrIncrementSong = (song) => {
    if (!userId) {
      Alert.alert('Sign In Required', 'Please sign in before upvoting tracks.');
      return;
    }

    const songId = song.id || `${song.trackName}-${song.artistName}`;
    if (votedIds[songId]) {
      Alert.alert('Vote Already Cast', 'You have already upvoted this track on this shelf.');
      return;
    }

    return actionLockRef.current(async () => {
      try {
        const songDocRef = doc(db, 'collective', themeId, 'songs', songId);
        const voteDocRef = doc(db, 'collective', themeId, 'songs', songId, 'votes', userId);
        const existingVote = await getDoc(voteDocRef);

        if (existingVote.exists()) {
          setVotedIds((prev) => ({ ...prev, [songId]: true }));
          Alert.alert('Vote Already Cast', 'You have already voted for this song.');
          return;
        }

        await setDoc(voteDocRef, { userId, votedAt: new Date().toISOString() });

        const existingSong = await getDoc(songDocRef);
        if (existingSong.exists()) {
          await updateDoc(songDocRef, { score: increment(1) });
        } else {
          await setDoc(songDocRef, {
            ...normalizeTrack(song),
            score: 1,
            createdAt: new Date().toISOString(),
          });
        }

        setVotedIds((prev) => ({ ...prev, [songId]: true }));
        await loadSongs();
      } catch (error) {
        console.error('Error adding or updating song in Firestore:', error);
        Alert.alert('Vote Failed', 'Unable to submit your vote right now.');
      }
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Obsidian Top Header with Back Navigation */}
      <View style={styles.topHeader}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          accessibilityLabel="Go back"
        >
          <Feather name="arrow-left" size={16} color="#FFFFFF" />
          <Text style={styles.backBtnText}>Back</Text>
        </TouchableOpacity>

        <Text style={styles.headerTitle} numberOfLines={1}>
          {themeTitle}
        </Text>

        <TouchableOpacity
          onPress={() => navigation.navigate('AddSong', { themeId, theme: themeTitle })}
          style={styles.headerAddBtn}
          accessibilityLabel="Add a song to shelf"
        >
          <Feather name="plus" size={17} color="#000000" />
        </TouchableOpacity>
      </View>

      <Text style={styles.subHeader}>Music List • Ranked by Community Votes</Text>

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#FF8C00" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          {songs.length === 0 ? (
            <View style={styles.emptyBox}>
              <FontAwesome5 name="compact-disc" size={34} color="#475569" />
              <Text style={styles.noSongsText}>No tracks on this shelf yet</Text>
              <Text style={styles.emptySub}>Be the first listener to add a track to {themeTitle}.</Text>
            </View>
          ) : (
            songs.map((song, index) => {
              const songId = song.id || `${song.trackName}-${song.artistName}`;
              const rawArt = song.artworkUrl100 || song.imageUrl;
              const showArtwork = isUsableArtworkUrl(rawArt) && !failedArtIds[songId];
              const highResUri = showArtwork ? rawArt.replace('100x100', '500x500') : null;
              const hasVoted = Boolean(votedIds[songId]);

              return (
                <View key={songId || index} style={styles.songCard}>
                  <TouchableOpacity
                    style={styles.songRowMain}
                    activeOpacity={0.85}
                    onPress={() =>
                      navigation.navigate('SongDetails', { song: normalizeTrack(song) })
                    }
                  >
                    {showArtwork && highResUri ? (
                      <Image
                        source={{ uri: highResUri }}
                        style={styles.songCover}
                        onError={() =>
                          setFailedArtIds((prev) => ({ ...prev, [songId]: true }))
                        }
                      />
                    ) : (
                      <View style={styles.fallbackCover}>
                        <FontAwesome5 name="music" size={20} color="#FF8C00" />
                      </View>
                    )}

                    <View style={styles.songInfo}>
                      <Text style={styles.songName} numberOfLines={1}>
                        {song.trackName || song.title || 'Unknown Track'}
                      </Text>
                      <Text style={styles.artistName} numberOfLines={1}>
                        by {song.artistName || song.artist || 'Unknown Artist'}
                      </Text>
                      <Text style={styles.songScore}>
                        {Number(song.score) || 0} {Number(song.score) === 1 ? 'vote' : 'votes'}
                      </Text>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => addOrIncrementSong(song)}
                    style={[styles.voteButton, hasVoted && styles.voteButtonVoted]}
                    activeOpacity={0.8}
                    accessibilityLabel={hasVoted ? 'Already voted' : `Upvote ${song.trackName}`}
                  >
                    <Feather
                      name={hasVoted ? 'check' : 'arrow-up'}
                      size={14}
                      color={hasVoted ? '#10B981' : '#000000'}
                    />
                    <Text
                      style={[
                        styles.voteButtonLabel,
                        hasVoted && styles.voteButtonVotedLabel,
                      ]}
                    >
                      {hasVoted ? 'Voted' : '+1'}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })
          )}

          <TouchableOpacity
            onPress={() => navigation.navigate('AddSong', { themeId, theme: themeTitle })}
            style={styles.addSongButton}
            activeOpacity={0.85}
          >
            <Feather name="plus-circle" size={18} color="#000000" />
            <Text style={styles.addSongButtonLabel}>Add a Song</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0C10',
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1F2430',
    backgroundColor: '#0D1017',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1E29',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 6,
  },
  backBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    color: '#FFFFFF',
    paddingHorizontal: 8,
  },
  headerAddBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FF8C00',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subHeader: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 8,
  },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContainer: {
    paddingHorizontal: 14,
    paddingTop: 6,
    paddingBottom: 36,
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 20,
  },
  noSongsText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#E2E8F0',
    textAlign: 'center',
    marginTop: 12,
  },
  emptySub: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 4,
  },
  songCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#151821',
    padding: 12,
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#242936',
  },
  songRowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10,
  },
  songCover: {
    width: 54,
    height: 54,
    borderRadius: 10,
    marginRight: 12,
    backgroundColor: '#202534',
  },
  fallbackCover: {
    width: 54,
    height: 54,
    borderRadius: 10,
    marginRight: 12,
    backgroundColor: '#1C202E',
    borderWidth: 1,
    borderColor: '#2B3245',
    alignItems: 'center',
    justifyContent: 'center',
  },
  songInfo: {
    flex: 1,
  },
  songName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 3,
  },
  artistName: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: 3,
  },
  songScore: {
    fontSize: 12,
    color: '#FF8C00',
    fontWeight: '700',
  },
  voteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF8C00',
    minWidth: 64,
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 12,
    gap: 4,
  },
  voteButtonVoted: {
    backgroundColor: 'rgba(16, 185, 129, 0.14)',
    borderWidth: 1,
    borderColor: '#10B981',
  },
  voteButtonLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#000000',
  },
  voteButtonVotedLabel: {
    color: '#10B981',
  },
  addSongButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    paddingVertical: 14,
    backgroundColor: '#FF8C00',
    borderRadius: 14,
    gap: 8,
  },
  addSongButtonLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: '#000000',
  },
});

export default Pickerchoosers;
