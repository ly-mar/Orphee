// Algo.js
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { collection, getDocs } from 'firebase/firestore';
import { db } from './firebaseConfig';
import {
  jaccardSimilarity,
  cosineSimilarity,
  levenshteinDistance,
  calculateGenreDistributionSimilarity,
  calculateReleaseYearAffinity,
  computePairwiseAffinity,
  computeSimilarityMatrix,
  sanitizeCompatibilityScore,
} from './utils/algorithmUtils';

export {
  jaccardSimilarity,
  cosineSimilarity,
  levenshteinDistance,
  calculateGenreDistributionSimilarity,
  calculateReleaseYearAffinity,
  computePairwiseAffinity,
  computeSimilarityMatrix,
  sanitizeCompatibilityScore,
};

const PlaylistComponent = () => {
  const [playlists, setPlaylists] = useState([]);
  const [similarityMatrix, setSimilarityMatrix] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPlaylists = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'playlists'));
        const userPlaylists = [];

        querySnapshot.forEach((docSnap) => {
          const data = docSnap.data();
          if (!data || !data.songs) return;

          const songs = Array.isArray(data.songs)
            ? data.songs
            : Object.values(data.songs || {});
          const validSongs = songs.filter((s) => s && s.trackId);
          if (validSongs.length === 0) return;

          userPlaylists.push({
            username: docSnap.id,
            trackIds: validSongs.map((song) => song.trackId),
            artistIds: validSongs.map((song) => song.artistId),
            primaryGenres: validSongs.map((song) => song.primaryGenreName),
            releaseDates: validSongs.map((song) => song.releaseDate),
          });
        });

        setPlaylists(userPlaylists);
        setSimilarityMatrix(
          computeSimilarityMatrix(userPlaylists, [0.5, 0.35, 0.075, 0.075])
        );
      } catch (error) {
        console.error('Error fetching playlists:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPlaylists();
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.text}>Loading playlists and computing similarity...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>User Playlist Similarity Matrix</Text>
      {similarityMatrix.map((row, i) => (
        <View key={playlists[i].username} style={styles.similarityRow}>
          <Text style={styles.username}>{playlists[i].username}:</Text>
          <Text style={styles.text}>{row.map((score) => score.toFixed(4)).join(', ')}</Text>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0D0E12',
  },
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#0D0E12',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#FFFFFF',
  },
  similarityRow: {
    marginBottom: 10,
  },
  username: {
    fontWeight: 'bold',
    color: '#FF8C00',
  },
  text: {
    color: '#CBD5E1',
  },
});

export default PlaylistComponent;