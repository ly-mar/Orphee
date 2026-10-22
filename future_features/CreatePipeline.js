import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, SafeAreaView } from 'react-native';
import { Text, Button, TextInput, Card, IconButton } from 'react-native-paper';
import axios from 'axios';
import shortid from 'shortid';
import { database } from './firebaseConfig';
import { ref, set } from 'firebase/database';

function CreatePipeline({ navigation }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedSongs, setSelectedSongs] = useState([]);
  const [pipelineKey, setPipelineKey] = useState('');
  const [pipelineName, setPipelineName] = useState('');
  const [numTracks, setNumTracks] = useState(5); // default to 5 tracks
  const [selectedSongsMinimized, setSelectedSongsMinimized] = useState(false); // Step 1

  useEffect(() => {
    generatePipelineKey();
  }, []);

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

  const generatePipelineKey = () => {
    const key = shortid.generate().substring(0, 6).toUpperCase();
    setPipelineKey(key);
  };

  const handleSearch = async () => {
    try {
      const response = await axios.get('https://itunes.apple.com/search', {
        params: {
          term: debouncedQuery,
          media: 'music',
          limit: 20
        }
      });
      setSearchResults(response.data.results);
    } catch (error) {
      console.error('Error fetching music data:', error);
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

  const publishPipeline = async () => {
    if (selectedSongs.length !== numTracks) {
      alert(`Please select exactly ${numTracks} tracks.`);
      return;
    }

    const genres = Array.from(new Set(selectedSongs.map(song => song.primaryGenreName)));
    const releaseDates = selectedSongs.map(song => new Date(song.releaseDate));
    const releaseDateRange = `${Math.min(...releaseDates)} - ${Math.max(...releaseDates)}`;

    try {
      const pipelineRef = ref(database, `pipelines/${pipelineKey}`);
      await set(pipelineRef, {
        name: pipelineName,
        songs: selectedSongs,
        genres: genres,
        releaseDateRange: releaseDateRange
      });
      setSelectedSongs([]);
      navigation.navigate('Home');
    } catch (error) {
      console.error('Error publishing pipeline:', error);
    }
  };

  const toggleSelectedSongs = () => {
    setSelectedSongsMinimized(!selectedSongsMinimized); // Step 2
  };

  const renderSongItem = ({ item }) => (
    <Card
      style={[
        styles.songCard,
        selectedSongs.some(song => song.trackId === item.trackId) && styles.selectedSongCard,
      ]}
    >
      <Card.Cover source={{ uri: item.artworkUrl100 }} />
      <Card.Content style={styles.songCardContent}>
        <Text style={styles.cardTitle}>{item.trackName}</Text>
        <Text style={styles.cardSubtitle}>{item.artistName}</Text>
        <Text style={styles.cardInfo}>Genre: {item.primaryGenreName}</Text>
        <Text style={styles.cardInfo}>Release Date: {item.releaseDate}</Text>
      </Card.Content>
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
        <Text style={styles.headerText}>Create a Pipeline</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter Pipeline Name"
          value={pipelineName}
          onChangeText={text => setPipelineName(text)}
        />
        <TextInput
          style={styles.input}
          placeholder="Number of Tracks"
          value={numTracks.toString()}
          onChangeText={text => setNumTracks(parseInt(text) || 0)}
          keyboardType="numeric"
        />
        <Text style={styles.pipelineKeyText}>Pipeline Key: {pipelineKey}</Text>
      </View>
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
      {selectedSongs.length > 0 && ( // Step 3
        <View style={styles.selectedSongsContainer}>
          <View style={styles.selectedSongsHeader}>
            <Text style={styles.selectedSongsTitle}>Selected Songs:</Text>
            <IconButton
              icon={selectedSongsMinimized ? 'chevron-down' : 'chevron-up'}
              color="#ffffff"
              size={24}
              onPress={toggleSelectedSongs}
              style={styles.toggleButton}
            />
          </View>
          {!selectedSongsMinimized && ( // Adjusted rendering based on state
            <FlatList
              data={selectedSongs}
              keyExtractor={(item) => item.trackId.toString()}
              renderItem={({ item }) => (
                <Card style={styles.selectedSongCard}>
                  <Card.Cover source={{ uri: item.artworkUrl100 }} />
                  <Card.Content style={styles.selectedSongCardContent}>
                    <Text style={styles.cardTitle}>{item.trackName}</Text>
                    <Text style={styles.cardSubtitle}>{item.artistName}</Text>
                    <Text style={styles.cardInfo}>Genre: {item.primaryGenreName}</Text>
                    <Text style={styles.cardInfo}>Release Date: {item.releaseDate}</Text>
                  </Card.Content>
                  <IconButton
                    icon="playlist-remove"
                    color="#FF6347"
                    size={20}
                    onPress={() => handleMusicSelection(item)}
                    style={styles.addRemoveButton}
                  />
                </Card>
              )}
              horizontal
              contentContainerStyle={styles.selectedSongsFlatList}
            />
          )}
        </View>
      )}
      <Button mode="contained" onPress={publishPipeline} style={styles.publishButton}>
        Publish Pipeline
      </Button>
      <Button mode="contained" onPress={() => navigation.goBack()} style={styles.backButton}>
        Back
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
    marginBottom: 10,
  },
  headerText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  input: {
    width: '80%',
    backgroundColor: '#ffffff',
    color: '#000000',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 5,
    fontSize: 16,
    marginBottom: 10,
  },
  pipelineKeyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginTop: 10,
  },
  searchInput: {
    marginBottom: 10,
    backgroundColor: '#ffffff',
    color: '#000000',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 5,
    fontSize: 16,
  },
  songCard: {
    marginBottom: 10,
    backgroundColor: '#1f1f1f',
    borderRadius: 10,
    padding: 10,
  },
  selectedSongCard: {
    width: 200,
    marginRight: 10,
    backgroundColor: '#1f1f1f',
    borderRadius: 10,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  songCardContent: {
    flex: 1,
    marginLeft: 10,
  },
  selectedSongCardContent: {
    flex: 1,
    marginLeft: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 5,
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#ffffff',
    marginBottom: 5,
  },
  cardInfo: {
    fontSize: 12,
    color: '#ffffff',
  },
  addRemoveButton: {
    alignSelf: 'flex-end',
  },
  selectedSongsContainer: {
    marginTop: 20,
    paddingLeft: 10,
  },
  selectedSongsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  selectedSongsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  selectedSongsFlatList: {
    flexGrow: 0,
  },
  publishButton: {
    marginTop: 20,
    backgroundColor: '#ff8c00',
  },
  backButton: {
    marginTop: 20,
    backgroundColor: '#ff8c00',
  },
  toggleButton: {
    backgroundColor: 'transparent',
  },
});

export default CreatePipeline;
