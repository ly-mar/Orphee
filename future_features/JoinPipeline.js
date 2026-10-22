// JoinPipeline.js
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TextInput, FlatList, SafeAreaView } from 'react-native';
import { Text, Button, Card, IconButton } from 'react-native-paper';
import { database } from './firebaseConfig';
import { ref, get } from 'firebase/database';
import axios from 'axios';

function JoinPipeline({ navigation }) {
  const [pipelineKey, setPipelineKey] = useState('');
  const [pipeline, setPipeline] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedSongs, setSelectedSongs] = useState([]);
  const [score, setScore] = useState(null);

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

  const fetchPipeline = async () => {
    try {
      const pipelineRef = ref(database, `pipelines/${pipelineKey}`);
      const snapshot = await get(pipelineRef);
      if (snapshot.exists()) {
        setPipeline(snapshot.val());
      } else {
        alert('Invalid Pipeline Key');
        setPipeline(null);
      }
    } catch (error) {
      console.error('Error fetching pipeline:', error);
    }
  };

  const handleSongSelection = (song) => {
    const isSelected = selectedSongs.some(selectedSong => selectedSong.trackId === song.trackId);
    if (isSelected) {
      const updatedSongs = selectedSongs.filter(selectedSong => selectedSong.trackId !== song.trackId);
      setSelectedSongs(updatedSongs);
    } else {
      setSelectedSongs([...selectedSongs, song]);
    }
  };

  const submitSelection = () => {
    if (!pipeline) return;
    let correctCount = 0;
    selectedSongs.forEach(selectedSong => {
      if (pipeline.songs.some(song => song.trackId === selectedSong.trackId)) {
        correctCount++;
      }
    });
    const calculatedScore = (correctCount / pipeline.songs.length) * 100;
    setScore(calculatedScore);
  };

  const renderSongItem = ({ item }) => (
    <Card
      style={[
        styles.songCard,
        selectedSongs.some(song => song.trackId === item.trackId) && styles.selectedSongCard,
      ]}
    >
      <Card.Cover source={{ uri: item.artworkUrl100 }} />
      <Card.Content>
        <Text style={styles.cardTitle}>{item.trackName}</Text>
        <Text style={styles.cardSubtitle}>{item.artistName}</Text>
        <Text style={styles.cardInfo}>Genre: {item.primaryGenreName}</Text>
        <Text style={styles.cardInfo}>Release Date: {item.releaseDate}</Text>
      </Card.Content>
      <IconButton
        icon={selectedSongs.some(song => song.trackId === item.trackId) ? 'playlist-remove' : 'playlist-plus'}
        color={selectedSongs.some(song => song.trackId === item.trackId) ? '#FF6347' : '#ff8c00'}
        size={20}
        onPress={() => handleSongSelection(item)}
        style={styles.addRemoveButton}
      />
    </Card>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerContainer}>
        <Text style={styles.headerText}>Join a Pipeline</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter Pipeline Key"
          value={pipelineKey}
          onChangeText={text => setPipelineKey(text)}
        />
        <Button mode="contained" onPress={fetchPipeline} style={styles.fetchButton}>
          Fetch Pipeline
        </Button>
      </View>
      {pipeline && (
        <>
          <Text style={styles.pipelineInfoText}>Number of Songs: {pipeline.songs.length}</Text>
          <Text style={styles.pipelineInfoText}>Genres: {pipeline.genres.join(', ')}</Text>
          <Text style={styles.pipelineInfoText}>Release Date Range: {pipeline.releaseDateRange}</Text>
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
          <Button mode="contained" onPress={submitSelection} style={styles.submitButton}>
            Submit Selection
          </Button>
        </>
      )}
      {score !== null && (
        <View style={styles.scoreContainer}>
          <Text style={styles.scoreText}>Your Score: {score.toFixed(2)}%</Text>
        </View>
      )}
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
  fetchButton: {
    marginBottom: 20,
    backgroundColor: '#ff8c00',
  },
  pipelineInfoText: {
    fontSize: 18,
    color: '#ffffff',
    marginVertical: 5,
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
    borderColor: '#ff8c00',
    borderWidth: 2,
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
  submitButton: {
    marginTop: 20,
    backgroundColor: '#ff8c00',
  },
  scoreContainer: {
    marginTop: 20,
    alignItems: 'center',
  },
  scoreText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  backButton: {
    marginTop: 20,
    backgroundColor: '#ff8c00',
  },
});

export default JoinPipeline;
