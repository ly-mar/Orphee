import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ScrollView, StyleSheet, SafeAreaView, View, Alert, Image, Dimensions } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import { db, auth } from './firebaseConfig';
import { collection, getDocs, updateDoc, doc, setDoc, getDoc, query, orderBy } from 'firebase/firestore';
import Taskbar from './Taskbar';
import { createAsyncActionLock } from './utils/actionLockUtils';

const windowWidth = Dimensions.get('window').width;

const getHighResImage = (imageUrl) => {
  if (!imageUrl) {
    // Fallback placeholder image URL
    return 'https://example.com/placeholder-image.jpg';
  }
  return imageUrl.replace('100x100', '500x500');
};

function Pickerchoosers() {
  const route = useRoute();
  const navigation = useNavigation();
  const { themeId, theme } = route.params;

  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const userId = auth.currentUser?.uid;
  const actionLockRef = useRef(createAsyncActionLock());

  const loadSongs = async () => {
    try {
      const songsCollectionRef = collection(db, 'collective', themeId, 'songs');
      const songsQuery = query(songsCollectionRef, orderBy('score', 'desc'));
      const songsSnapshot = await getDocs(songsQuery);

      if (!songsSnapshot.empty) {
        const songsData = songsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setSongs(songsData);
      } else {
        console.log('No songs found in the collection.');
      }
    } catch (error) {
      console.error('Error loading songs from Firestore:', error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadSongs();
    }, [themeId])
  );

  const addOrIncrementSong = (song) => {
    if (!userId) {
      console.error("User is not logged in.");
      return;
    }

    const songId = `${song.trackName}-${song.artistName}`; // Unique ID for song

    return actionLockRef.current(async () => {
      try {
        const songDocRef = doc(db, 'collective', themeId, 'songs', songId);
        const voteDocRef = doc(db, 'collective', themeId, 'songs', songId, 'votes', userId);
        const existingVote = await getDoc(voteDocRef);

        // Check if the user has already voted for this song
        if (existingVote.exists()) {
          Alert.alert("Vote Already Cast", "You have already voted for this song.");
          return; // User has already voted
        }

        // Register the user's vote
        await setDoc(voteDocRef, { userId: userId, votedAt: new Date() });

        // Update the song score
        const existingSong = await getDoc(songDocRef);
        if (existingSong.exists()) {
          await updateDoc(songDocRef, { score: existingSong.data().score + 1 });
        } else {
          console.error('Song not found, which should not happen in this context.');
        }

        // Reload songs after adding or updating
        loadSongs();
      } catch (error) {
        console.error('Error adding or updating song in Firestore:', error);
      }
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.headerText}>{theme} - Music List</Text>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {songs.length === 0 ? (
          <Text style={styles.noSongsText}>No song listed</Text>
        ) : (
          songs.map((song, index) => (
            <View key={index} style={styles.songCard}>
              <Image source={{ uri: getHighResImage(song.artworkUrl100) }} style={styles.songCover} />
              <View style={styles.songInfo}>
                <Text style={styles.songName} numberOfLines={1}>
                  {song.trackName}
                </Text>
                <Text style={styles.artistName} numberOfLines={1}>
                  by {song.artistName}
                </Text>
                <Text style={styles.songScore}>Score: {song.score}</Text>
              </View>
              <Button
                mode="contained"
                onPress={() => addOrIncrementSong(song)}
                style={styles.plusButton}
                labelStyle={styles.plusButtonLabel}
              >
                +
              </Button>
            </View>
          ))
        )}
        <Button
          mode="contained"
          onPress={() => navigation.navigate('AddSong', { themeId })}
          style={styles.addSongButton}
          labelStyle={styles.addSongButtonLabel}
        >
          Add a Song
        </Button>
      </ScrollView>
      <View style={styles.taskbarContainer}>
        <Taskbar />
      </View> 
    </SafeAreaView>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212', // Dark background
    paddingHorizontal: 10,
  },
  scrollContainer: {
    paddingBottom: 20,
  },
  headerText: {
    fontSize: 28,
    fontWeight: 'bold',
    marginVertical: 20,
    textAlign: 'center',
    color: 'white',
    marginVertical: 20,
    textAlign: 'center',
    textShadowColor: '#CC3639',
    textShadowOffset: { width: 3, height: 3 },
    textShadowRadius: 1,
  },
  noSongsText: {
    fontSize: 18,
    color: '#888',
    textAlign: 'center',
    marginBottom: 20,
  },
  songCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e1e1e',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 6,
  },
  songCover: {
    width: 60,
    height: 60,
    borderRadius: 5,
    marginRight: 15,
  },
  songInfo: {
    flex: 1,
  },
  songName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 5,
  },
  artistName: {
    fontSize: 14,
    color: '#aaaaaa',
    marginBottom: 5,
  },
  songScore: {
    fontSize: 14,
    color: '#ffffff',
  },
  plusButton: {
    backgroundColor: 'transparent', // Spotify green
    borderRadius: 50,
  },
  plusButtonLabel: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  addSongButton: {
    marginTop: 20,
    paddingVertical: 10,
    backgroundColor: 'transparent', // Spotify green
    borderBottomColor: '#6E8D82',  // Keep if you want this for the bottom border
    borderTopColor :'#6E8D82',
    borderRadius: 40,
    alignItems: 'center',
    marginBottom: 10,
    borderColor: 'transparent',  // Set border color to white
    borderWidth: 2, 
    marginLeft : 10,
    marginRight : 10,
  },
  addSongButtonLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
  },
});

export default Pickerchoosers;
