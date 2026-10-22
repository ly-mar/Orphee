import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, SafeAreaView } from 'react-native';
import { Text, TextInput, Button, Card, IconButton } from 'react-native-paper';
import axios from 'axios';
import { database } from './firebaseConfig';
import { ref, get, update } from 'firebase/database';

function PlayShare({ route, navigation }) {
  const [playlistKey, setPlaylistKey] = useState(route.params.playlistKey);
  const [playlistName, setPlaylistName] = useState('');
  const [playlistSongs, setPlaylistSongs] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedSongs, setSelectedSongs] = useState([]);

  useEffect(() => {
    const timerId = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);

    return () => {
      clearTimeout(timerId);
    };
  }, [searchQuery]);

  useEffect(() => {
    if (debouncedQuery.trim() !== '') {
      handleSearch();
    } else {
      setSearchResults([]);
    }
  }, [debouncedQuery]);

  useEffect(() => {
    handleAccessPlaylist();
  }, []);

  const handleSearch = async () => {
    try {
      const response = await axios.get('https://itunes.apple.com/search', {
        params: {
          term: debouncedQuery,
          media: 'music',
          limit: 20
        }
      });
      const filteredResults = response.data.results.filter(
        result => !playlistSongs.some(song => song.trackId === result.trackId)
      );
      setSearchResults(filteredResults);
    } catch (error) {
      console.error('Error fetching music data:', error);
    }
  };

  const handleAccessPlaylist = async () => {
    try {
      const playlistRef = ref(database, `playlists/${playlistKey}`);
      const snapshot = await get(playlistRef);
      if (snapshot.exists()) {
        const playlistData = snapshot.val();
        setPlaylistName(playlistData.name || 'Unknown Playlist');
        setPlaylistSongs(playlistData.songs || []);
      } else {
        alert('Playlist not found with this key.');
      }
    } catch (error) {
      console.error('Error retrieving playlist:', error);
    }
  };

  const handleMusicSelection = (music) => {
    const isSelected = selectedSongs.some(song => song.trackId === music.trackId);
    if (isSelected) {
      const updatedSongs = selectedSongs.filter(song => song.trackId !== music.trackId);
      setSelectedSongs(updatedSongs);
    } else {
      setSelectedSongs([...selectedSongs, music]);
    }
  };

  const addToPlaylist = async () => {
    try {
      const updatedPlaylist = [...playlistSongs, ...selectedSongs];
      const playlistRef = ref(database, `playlists/${playlistKey}`);
      await update(playlistRef, { songs: updatedPlaylist });
      setPlaylistSongs(updatedPlaylist);
      setSelectedSongs([]);
      alert('Songs added to playlist successfully!');
    } catch (error) {
      console.error('Error adding songs to playlist:', error);
    }
  };

  const handlePlaySong = (songUrl) => {
    alert(`Playing song: ${songUrl}`);
  };

  const renderSongItem = ({ item }) => (
    <Card style={styles.songCard}>
      <Card.Cover source={{ uri: item.artworkUrl100 }} />
      <Card.Content>
        <Text style={styles.cardTitle}>{item.trackName}</Text>
        <Text style={styles.cardSubtitle}>{item.artistName}</Text>
        <Text style={styles.cardInfo}>Genre: {item.primaryGenreName}</Text>
        <Text style={styles.cardInfo}>Release Date: {item.releaseDate}</Text>
      </Card.Content>
      <IconButton
        icon="play-circle-outline"
        color="#ff8c00"
        size={30}
        onPress={() => handlePlaySong(item.previewUrl)}
        style={styles.playButton}
      />
      <IconButton
        icon={selectedSongs.some(song => song.trackId === item.trackId) ? 'playlist-remove' : 'playlist-plus'}
        color={selectedSongs.some(song => song.trackId === item.trackId) ? '#FF6347' : '#ff8c00'}
        size={20}
        onPress={() => handleMusicSelection(item)}
        style={styles.addRemoveButton}
      />
    </Card>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerContainer}>
        <Text style={styles.headerText}>Access Shared Playlist</Text>
      </View>
      {playlistName && (
        <View style={styles.playlistNameContainer}>
          <Text style={styles.playlistNameText}>Playlist Name: {playlistName}</Text>
        </View>
      )}
      <FlatList
        data={playlistSongs}
        keyExtractor={(item) => item.trackId.toString()}
        renderItem={renderSongItem}
      />
      <TextInput
        style={styles.searchInput}
        placeholder="Search for music..."
        value={searchQuery}
        onChangeText={text => setSearchQuery(text)}
      />
      <FlatList
        data={searchResults}
        keyExtractor={(item) => item.trackId.toString()}
        renderItem={renderSongItem}
      />
      {selectedSongs.length > 0 && (
        <Button mode="contained" onPress={addToPlaylist} style={styles.addButton}>
          Add to Playlist
        </Button>
      )}
      <Button mode="contained" onPress={() => navigation.goBack()} style={styles.backButton}>
        Back to Coplay
      </Button>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
    backgroundColor: '#121212',
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  headerText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ff8c00',
    fontFamily: 'Nexa-Bold',
  },
  playlistNameContainer: {
    marginTop: 10,
    alignItems: 'center',
  },
  playlistNameText: {
    fontSize: 20,
    color: '#ff8c00',
    fontFamily: 'Nexa-Bold',
  },
  songCard: {
    marginBottom: 10,
    backgroundColor: '#1f1f1f',
    borderRadius: 10,
    padding: 10,
    width: '100%',
  },
  cardTitle: {
    fontSize: 16,
    color: '#CCCCCC',
    fontFamily: 'Nexa-Bold',
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#CCCCCC',
    fontFamily: 'Nexa-Light',
  },
  cardInfo: {
    fontSize: 12,
    color: '#CCCCCC',
    fontFamily: 'Nexa-Light',
  },
  playButton: {
    position: 'absolute',
    top: 5,
    left: 5,
  },
  addRemoveButton: {
    position: 'absolute',
    top: 5,
    right: 5,
  },
  searchInput: {
    marginBottom: 10,
    backgroundColor: '#ffffff',
    color: '#000000',
    borderRadius: 10,
    paddingHorizontal: 15,
    fontFamily: 'Nexa-Light',
  },
  addButton: {
    marginTop: 20,
    backgroundColor: '#ff8c00',
  },
  backButton: {
    marginTop: 20,
    backgroundColor: '#ff8c00',
  },
});

export default PlayShare;
