// AddSong.js
import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  View,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Text } from 'react-native-paper';
import { useNavigation, useRoute } from '@react-navigation/native';
import { db, auth } from './firebaseConfig';
import { doc, setDoc, getDoc, updateDoc, increment } from 'firebase/firestore';
import { FontAwesome5 } from '@expo/vector-icons';
import Taskbar from './Taskbar';
import {
  createDebouncedSearch,
  normalizeTrack,
  getHighResImage,
} from './services/musicApi';
import { createAudioPreviewController } from './audioPreviewController';
import { createAsyncActionLock } from './utils/actionLockUtils';

function AddSong() {
  const navigation = useNavigation();
  const route = useRoute();
  const themeId = route?.params?.themeId || 'child_of_the_80s';

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const userId = auth.currentUser?.uid;
  const submitLockRef = useRef(createAsyncActionLock());

  const audioControllerRef = useRef(null);
  if (!audioControllerRef.current) {
    audioControllerRef.current = createAudioPreviewController({
      onError: (msg) => console.warn(msg),
    });
  }

  useEffect(() => {
    const unsubscribeBlur = navigation?.addListener?.('blur', () => {
      audioControllerRef.current?.stop();
    });
    return () => {
      unsubscribeBlur?.();
      audioControllerRef.current?.dispose();
    };
  }, [navigation]);

  const debouncedFetcher = useMemo(
    () =>
      createDebouncedSearch((results, err) => {
        setLoading(false);
        if (err) {
          setError('Error fetching music. Please try again later.');
        } else {
          setError('');
          setSearchResults(results);
        }
      }, 380),
    []
  );

  useEffect(() => {
    return () => {
      if (debouncedFetcher.cancel) debouncedFetcher.cancel();
    };
  }, [debouncedFetcher]);

  const onSearchChange = (text) => {
    setSearchQuery(text);
    if (text.trim().length >= 2) {
      setLoading(true);
      debouncedFetcher(text.trim(), { limit: 25 });
    } else {
      setSearchResults([]);
      setLoading(false);
    }
  };

  const addSearchedSong = (rawSong) => {
    if (!userId) {
      Alert.alert('Authentication Required', 'Please sign in to contribute songs.');
      return;
    }

    return submitLockRef.current(async () => {
      const song = normalizeTrack(rawSong);
      const safeSongId = song.trackId
        ? `track_${song.trackId}`
        : `${song.trackName}_${song.artistName}`.replace(/[\/.#$\[\]]+/g, '_');

      try {
        const songDocRef = doc(db, 'collective', themeId, 'songs', safeSongId);
        const voteDocRef = doc(
          db,
          'collective',
          themeId,
          'songs',
          safeSongId,
          'votes',
          userId
        );
        const existingVote = await getDoc(voteDocRef);

        if (existingVote.exists()) {
          Alert.alert('Vote Already Cast', 'You have already voted for this song.');
          return;
        }

        await setDoc(voteDocRef, { userId, votedAt: new Date().toISOString() });

        const existingSong = await getDoc(songDocRef);
        if (existingSong.exists()) {
          await updateDoc(songDocRef, { score: increment(1) });
        } else {
          await setDoc(songDocRef, {
            ...song,
            score: 1,
            createdAt: new Date().toISOString(),
          });
        }

        navigation.navigate('Pickerchoosers', { themeId, refresh: true });
      } catch (err) {
        console.error('Error adding song to Firestore:', err);
        Alert.alert('Error', 'Could not add song to The Collective.');
      }
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topHeader}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <FontAwesome5 name="arrow-left" size={14} color="#FFF" />
          <Text style={styles.backBtnText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add to Collective</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.searchBarContainer}>
        <FontAwesome5 name="search" size={15} color="#FF8C00" style={{ marginRight: 10 }} />
        <TextInput
          style={styles.searchBar}
          placeholder="Search iTunes for songs or artists..."
          placeholderTextColor="#718096"
          value={searchQuery}
          onChangeText={onSearchChange}
        />
      </View>

      {loading && (
        <ActivityIndicator size="small" color="#FF8C00" style={{ marginVertical: 10 }} />
      )}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <FlatList
        data={searchResults}
        keyExtractor={(item) => item.trackId.toString()}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 90 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => addSearchedSong(item)}
            style={styles.resultCard}
          >
            <Image
              source={{ uri: getHighResImage(item.artworkUrl100) }}
              style={styles.resultCoverImage}
            />
            <View style={styles.resultInfoContainer}>
              <Text style={styles.trackTitle} numberOfLines={1}>
                {item.trackName}
              </Text>
              <Text style={styles.artistName} numberOfLines={1}>
                {item.artistName} • {item.primaryGenreName}
              </Text>
            </View>
            <View style={styles.upvotePill}>
              <FontAwesome5 name="plus" size={11} color="#000" />
              <Text style={styles.upvotePillText}>Add</Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          !loading && !error && searchQuery.trim().length >= 2 ? (
            <Text style={styles.noResultsText}>No results found</Text>
          ) : null
        }
      />

      <View style={styles.taskbarContainer}>
        <Taskbar />
      </View>
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
    backgroundColor: '#1A1E29',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 6,
  },
  backBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    paddingHorizontal: 14,
    backgroundColor: '#161922',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#242936',
    height: 46,
  },
  searchBar: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
  },
  resultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#161922',
    borderWidth: 1,
    borderColor: '#242936',
    borderRadius: 12,
    marginBottom: 10,
  },
  resultCoverImage: {
    width: 54,
    height: 54,
    borderRadius: 8,
    marginRight: 12,
  },
  resultInfoContainer: {
    flex: 1,
  },
  trackTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  artistName: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 2,
  },
  upvotePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF8C00',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 5,
  },
  upvotePillText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '800',
  },
  noResultsText: {
    textAlign: 'center',
    marginTop: 24,
    color: '#94A3B8',
  },
  errorText: {
    textAlign: 'center',
    color: '#F87171',
    marginBottom: 12,
  },
  taskbarContainer: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    backgroundColor: '#0D1017',
  },
});

export default AddSong;