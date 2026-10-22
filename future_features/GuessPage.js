import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TextInput, Text, Dimensions, Image, FlatList, TouchableOpacity, SafeAreaView, ActivityIndicator } from 'react-native';
import Taskbar from './Taskbar'; // Import Taskbar component

const windowWidth = Dimensions.get('window').width;

function GuessPage({ route }) {
  const { artist } = route.params; // Access the passed artist parameter
  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState([]); // State for storing search results
  const [revealedAlbums, setRevealedAlbums] = useState([]); // State for revealed album covers
  const [loading, setLoading] = useState(false); // State for loading indicator
  const [showDropdown, setShowDropdown] = useState(false); // State to control dropdown visibility

  useEffect(() => {
    if (searchText.trim() !== '') {
      fetchMusicData();
    } else {
      setSearchResults([]);
      setShowDropdown(false); // Hide dropdown if search is cleared
    }
  }, [searchText]);

  const fetchMusicData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(searchText)}&entity=song&limit=10`);
      const data = await response.json();
      setSearchResults(data.results);
      setShowDropdown(true); // Show dropdown when results are fetched
    } catch (error) {
      console.error('Error fetching data from iTunes API:', error);
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (albumCoverUrl) => {
    if (revealedAlbums.length < 4 && !revealedAlbums.includes(albumCoverUrl)) {
      // Update revealed albums only if not already revealed and less than 4
      setRevealedAlbums([...revealedAlbums, albumCoverUrl]);
      setShowDropdown(false); // Hide dropdown after selection
      setSearchText(''); // Clear the search text
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.headerText}>Play for clue</Text>
        <View style={styles.imageContainer}>
          {/* Placeholder for artist-related content */}
          <Text style={styles.imagePlaceholder}>{artist}</Text>
        </View>
        <TextInput 
          style={styles.input} 
          placeholder="Search for music" 
          value={searchText}
          onChangeText={setSearchText}
          onFocus={() => setShowDropdown(true)} // Show dropdown on focus
        />

        {loading && <ActivityIndicator style={styles.loader} size="large" color="#ffffff" />}

        {/* Dropdown list for search results */}
        {showDropdown && (
          <FlatList
            data={searchResults}
            keyExtractor={(item) => item.trackId.toString()}
            style={styles.dropdown}
            keyboardShouldPersistTaps="handled" // Ensures that taps outside of the dropdown are handled correctly
            renderItem={({ item }) => (
              <TouchableOpacity onPress={() => handleSelect(item.artworkUrl100)}>
                <Text style={styles.searchResult}>{item.trackName} - {item.artistName}</Text>
              </TouchableOpacity>
            )}
          />
        )}

        <View style={styles.hiddenCardsContainer}>
          {/* Display album covers if revealed */}
          {revealedAlbums.map((album, index) => (
            <Image key={index} source={{ uri: album }} style={styles.albumCover} />
          ))}
          {/* Fill the remaining slots with hidden cards */}
          {[...Array(4 - revealedAlbums.length)].map((_, index) => (
            <View key={index + revealedAlbums.length} style={styles.hiddenCard}></View>
          ))}
        </View>
      </View>
      <View style={styles.taskbarContainer}>
        <Taskbar />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#121212', // Dark background color
  },
  container: {
    flex: 1,
    backgroundColor: '#121212',
    alignItems: 'center',
    padding: 20,
  },
  headerText: {
    color: '#fff',
    fontSize: windowWidth * 0.08,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  imageContainer: {
    width: '100%',
    height: 200,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  imagePlaceholder: {
    color: '#fff',
    fontSize: windowWidth * 0.1,
    fontWeight: 'bold',
  },
  input: {
    width: '80%',
    padding: 10,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 5,
    marginBottom: 20,
    color: '#fff',
    backgroundColor: '#222',
  },
  dropdown: {
    width: '80%',
    maxHeight: 200, // Set max height for dropdown
    backgroundColor: '#333', // Background color for dropdown
    borderColor: '#444', // Border color for dropdown
    borderWidth: 1, // Border width for dropdown
    borderRadius: 5, // Border radius for dropdown
    marginBottom: 10, // Margin for spacing
  },
  hiddenCardsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '80%',
    marginTop: 20,
    flexWrap: 'wrap', // Allow wrapping of hidden cards
  },
  hiddenCard: {
    width: 60,
    height: 60,
    backgroundColor: 'red', // Hidden card color
    borderRadius: 10,
    marginBottom: 10, // Add margin for spacing
  },
  albumCover: {
    width: 140,
    height: 140,
    borderRadius: 10,
    marginBottom: 10, // Ensure consistent spacing with hidden cards
  },
  searchResult: {
    color: '#fff',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#444',
  },
  loader: {
    marginTop: 10,
  },
  taskbarContainer: {
    backgroundColor: '#1f1f1f', // Optional background color for the Taskbar
    paddingBottom: 20, // Padding to avoid safe area overlap
    paddingTop: 10, // Padding for better spacing
  },
});

export default GuessPage;
