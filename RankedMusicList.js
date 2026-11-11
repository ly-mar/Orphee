// RankedMusicList.js
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  Image,
  ImageBackground,
  Platform,
  ActivityIndicator,
  TextInput,
  RefreshControl,
  Alert,
} from 'react-native';
import { Audio } from 'expo-av';
import { db, auth } from './firebaseConfig';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import Icon from 'react-native-vector-icons/Ionicons';
import { FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import { normalizeTrack, getHighResImage } from './services/musicApi';
import { aggregateCommunity13Charts } from './utils/chartUtils';
import { normalizeYour13List } from './utils/playlistUtils';
import Taskbar from './Taskbar';
import backgroundImage from './assets/gabriel-bassino-zEawlLdVloo-unsplash.jpg';

// Curated seed community playlists used when Firestore collection is empty or restricted
const CURATED_COMMUNITY_SEED = [
  {
    username: 'alex_beats',
    songs: [
      {
        trackId: 1440857781,
        trackName: 'Blinding Lights',
        artistName: 'The Weeknd',
        primaryGenreName: 'R&B/Soul',
        artworkUrl100: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/a4/43/66/a44366e6-993c-ebc4-64e0-a7d18721516e/20UMGIM08240.rgb.jpg/400x400bb.jpg',
        previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/a8/38/26/a838260a-01c0-0f2c-5509-f5c76db36d07/mzaf_6139414571936553816.plus.aac.p.m4a',
      },
      {
        trackId: 1746206126,
        trackName: 'Not Like Us',
        artistName: 'Kendrick Lamar',
        primaryGenreName: 'Hip-Hop/Rap',
        artworkUrl100: 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/4e/77/84/4e778434-6663-e31d-b6a5-7140411317e0/24UMGIM53229.rgb.jpg/400x400bb.jpg',
        previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/6b/64/00/6b640097-4b72-243e-a4be-ef4aeb3a2bc0/mzaf_11303866597984852928.plus.aac.p.m4a',
      },
      {
        trackId: 1652442224,
        trackName: 'Kill Bill',
        artistName: 'SZA',
        primaryGenreName: 'R&B/Soul',
        artworkUrl100: 'https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/f4/bf/ae/f4bfae6f-6ec9-de8b-b892-05459b7dfb84/196589558807.jpg/400x400bb.jpg',
        previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview122/v4/f3/7b/cf/f37bcf7b-4813-f661-bc93-5ba2b10fef42/mzaf_10578508931215442548.plus.aac.p.m4a',
      },
      {
        trackId: 1538503500,
        trackName: 'Levitating',
        artistName: 'Dua Lipa',
        primaryGenreName: 'Pop',
        artworkUrl100: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/1b/27/a3/1b27a3c3-63b7-7eb2-ea63-5484832506d8/190295240409.jpg/400x400bb.jpg',
        previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/20/78/3f/20783fa7-ec07-28e7-ff47-1c60ad630327/mzaf_3895914102925232876.plus.aac.p.m4a',
      },
      {
        trackId: 1615584999,
        trackName: 'As It Was',
        artistName: 'Harry Styles',
        primaryGenreName: 'Pop',
        artworkUrl100: 'https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/1e/8a/be/1e8abeeb-fa79-a78b-bf26-eb52d0fa3e5d/886449987979.jpg/400x400bb.jpg',
        previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview112/v4/f1/e2/2e/f1e22e96-a88a-211c-1bb5-c9bc60ad6c92/mzaf_12403664797087661559.plus.aac.p.m4a',
      },
    ],
  },
  {
    username: 'maya_grooves',
    songs: [
      {
        trackId: 1440857781,
        trackName: 'Blinding Lights',
        artistName: 'The Weeknd',
        primaryGenreName: 'R&B/Soul',
        artworkUrl100: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/a4/43/66/a44366e6-993c-ebc4-64e0-a7d18721516e/20UMGIM08240.rgb.jpg/400x400bb.jpg',
        previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/a8/38/26/a838260a-01c0-0f2c-5509-f5c76db36d07/mzaf_6139414571936553816.plus.aac.p.m4a',
      },
      {
        trackId: 1746206126,
        trackName: 'Not Like Us',
        artistName: 'Kendrick Lamar',
        primaryGenreName: 'Hip-Hop/Rap',
        artworkUrl100: 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/4e/77/84/4e778434-6663-e31d-b6a5-7140411317e0/24UMGIM53229.rgb.jpg/400x400bb.jpg',
        previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/6b/64/00/6b640097-4b72-243e-a4be-ef4aeb3a2bc0/mzaf_11303866597984852928.plus.aac.p.m4a',
      },
      {
        trackId: 1440783617,
        trackName: 'Starboy',
        artistName: 'The Weeknd',
        primaryGenreName: 'R&B/Soul',
        artworkUrl100: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/d3/18/d5/d318d530-5b12-9c98-ec5b-b98a002b544d/16UMGIM56461.rgb.jpg/400x400bb.jpg',
        previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/33/c2/f3/33c2f306-0565-df03-b09e-711e721bcbc1/mzaf_1044458376916544949.plus.aac.p.m4a',
      },
      {
        trackId: 1184344445,
        trackName: 'Redbone',
        artistName: 'Childish Gambino',
        primaryGenreName: 'R&B/Soul',
        artworkUrl100: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/55/75/eb/5575eb37-010e-8316-c2eb-e8a0fa1d8820/810599021665.jpg/400x400bb.jpg',
        previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/b9/88/4b/b9884b65-690a-e3d6-4441-26c72e3995f5/mzaf_14620023610486803975.plus.aac.p.m4a',
      },
    ],
  },
  {
    username: 'samy_vinyl',
    songs: [
      {
        trackId: 1746206126,
        trackName: 'Not Like Us',
        artistName: 'Kendrick Lamar',
        primaryGenreName: 'Hip-Hop/Rap',
        artworkUrl100: 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/4e/77/84/4e778434-6663-e31d-b6a5-7140411317e0/24UMGIM53229.rgb.jpg/400x400bb.jpg',
        previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/6b/64/00/6b640097-4b72-243e-a4be-ef4aeb3a2bc0/mzaf_11303866597984852928.plus.aac.p.m4a',
      },
      {
        trackId: 1652442224,
        trackName: 'Kill Bill',
        artistName: 'SZA',
        primaryGenreName: 'R&B/Soul',
        artworkUrl100: 'https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/f4/bf/ae/f4bfae6f-6ec9-de8b-b892-05459b7dfb84/196589558807.jpg/400x400bb.jpg',
        previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview122/v4/f3/7b/cf/f37bcf7b-4813-f661-bc93-5ba2b10fef42/mzaf_10578508931215442548.plus.aac.p.m4a',
      },
      {
        trackId: 1538503500,
        trackName: 'Levitating',
        artistName: 'Dua Lipa',
        primaryGenreName: 'Pop',
        artworkUrl100: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/1b/27/a3/1b27a3c3-63b7-7eb2-ea63-5484832506d8/190295240409.jpg/400x400bb.jpg',
        previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/20/78/3f/20783fa7-ec07-28e7-ff47-1c60ad630327/mzaf_3895914102925232876.plus.aac.p.m4a',
      },
    ],
  },
];

const NeonText = ({ text, style }) => (
  <View style={style}>
    <Text style={[styles.neonText, styles.neonShadow]}>{text}</Text>
  </View>
);

const RankedMusicList = ({ navigation }) => {
  const [rankedSongs, setRankedSongs] = useState([]);
  const [rankedArtists, setRankedArtists] = useState([]);
  const [rankedGenres, setRankedGenres] = useState([]);
  const [totalCurators, setTotalCurators] = useState(0);
  const [totalPicks, setTotalPicks] = useState(0);
  const [selectedView, setSelectedView] = useState('Songs');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Audio preview state
  const soundRef = useRef(null);
  const [playingTrackId, setPlayingTrackId] = useState(null);
  const [loadingTrackId, setLoadingTrackId] = useState(null);

  const stopAndUnloadPreview = useCallback(async () => {
    if (soundRef.current) {
      try {
        await soundRef.current.stopAsync();
      } catch (_) { }
      try {
        await soundRef.current.unloadAsync();
      } catch (_) { }
      soundRef.current = null;
    }
    setPlayingTrackId(null);
    setLoadingTrackId(null);
  }, []);

  useEffect(() => {
    return () => {
      stopAndUnloadPreview();
    };
  }, [stopAndUnloadPreview]);

  const handleTogglePreview = async (song) => {
    if (!song.previewUrl) {
      Alert.alert(
        'Preview Unavailable',
        'No 30-second audio preview found for this track. Tap the song to open details.',
        [{ text: 'Open Details', onPress: () => navigation.navigate('SongDetails', { song }) }, { text: 'Cancel' }]
      );
      return;
    }

    try {
      if (playingTrackId === song.trackId) {
        await stopAndUnloadPreview();
        return;
      }

      await stopAndUnloadPreview();
      setLoadingTrackId(song.trackId);

      const { sound } = await Audio.Sound.createAsync(
        { uri: song.previewUrl },
        { shouldPlay: true },
        (status) => {
          if (status.isLoaded && status.didJustFinish) {
            setPlayingTrackId(null);
          }
        }
      );

      soundRef.current = sound;
      setLoadingTrackId(null);
      setPlayingTrackId(song.trackId);
    } catch (error) {
      console.warn('Playback error for preview:', error);
      setLoadingTrackId(null);
      setPlayingTrackId(null);
    }
  };

  /**
   * Aggregates the community charts directly from each user's 13 selected songs
   * stored in Firestore collection 'playlists'.
   */
  const fetchCommunityCharts = async () => {
    try {
      setLoading(true);

      const userPlaylists = [];
      const userIdsSeen = new Set();

      // 1. Fetch all playlists from Firestore
      try {
        const querySnapshot = await getDocs(collection(db, 'playlists'));
        querySnapshot.forEach((docSnap) => {
          const docData = docSnap.data();
          if (!docData || !docData.songs) return;

          const rawSongs = Array.isArray(docData.songs)
            ? docData.songs
            : Object.values(docData.songs || {});
          const validSongs = normalizeYour13List(rawSongs);

          if (validSongs.length > 0) {
            userIdsSeen.add(docSnap.id);
            userPlaylists.push({
              username: docSnap.id,
              songs: validSongs,
            });
          }
        });
      } catch (err) {
        console.warn('Firestore playlists scan restricted or unavailable:', err.message);
      }

      // 2. Also ensure current user's playlist is included if logged in
      const currentUid = auth.currentUser?.uid;
      if (currentUid && !userIdsSeen.has(currentUid)) {
        try {
          const userPlaylistDoc = await getDoc(doc(db, 'playlists', currentUid));
          if (userPlaylistDoc.exists()) {
            const data = userPlaylistDoc.data();
            const rawSongs = Array.isArray(data?.songs)
              ? data.songs
              : Object.values(data?.songs || {});
            const validSongs = normalizeYour13List(rawSongs);
            if (validSongs.length > 0) {
              userIdsSeen.add(currentUid);
              userPlaylists.push({
                username: currentUid,
                songs: validSongs,
              });
            }
          }
        } catch (_) { }
      }

      // 3. Fallback: If 0 community playlists found, merge curated seeds
      if (userPlaylists.length === 0) {
        userPlaylists.push(...CURATED_COMMUNITY_SEED);
      }

      // 4. Aggregate across all users' 13 choices
      const {
        rankedSongs: sortedSongs,
        rankedArtists: sortedArtists,
        rankedGenres: sortedGenres,
        totalCurators: curatorCount,
        totalPicks: totalAccumulatedPicks,
      } = aggregateCommunity13Charts(userPlaylists);

      setRankedSongs(sortedSongs);
      setRankedArtists(sortedArtists);
      setRankedGenres(sortedGenres);
      setTotalCurators(curatorCount);
      setTotalPicks(totalAccumulatedPicks);
    } catch (error) {
      console.error('Error calculating community charts from 13s:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCommunityCharts();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchCommunityCharts();
  };

  // Filtered views based on search query
  const filteredSongs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return rankedSongs;
    return rankedSongs.filter(
      (s) =>
        (s.trackName && s.trackName.toLowerCase().includes(q)) ||
        (s.artistName && s.artistName.toLowerCase().includes(q)) ||
        (s.primaryGenreName && s.primaryGenreName.toLowerCase().includes(q))
    );
  }, [rankedSongs, searchQuery]);

  const filteredArtists = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return rankedArtists;
    return rankedArtists.filter((a) => a.name.toLowerCase().includes(q));
  }, [rankedArtists, searchQuery]);

  const filteredGenres = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return rankedGenres;
    return rankedGenres.filter((g) => g.name.toLowerCase().includes(q));
  }, [rankedGenres, searchQuery]);

  const topSong = rankedSongs[0];

  const getRankBadgeColor = (index) => {
    switch (index) {
      case 0:
        return '#FFD700'; // Gold
      case 1:
        return '#E2E8F0'; // Silver
      case 2:
        return '#CD7F32'; // Bronze
      default:
        return '#FF8C00'; // Brand Accent
    }
  };

  const renderSpotlight = () => {
    if (!topSong || selectedView !== 'Songs' || searchQuery.trim().length > 0) {
      return null;
    }

    const isPlaying = playingTrackId === topSong.trackId;
    const isLoading = loadingTrackId === topSong.trackId;

    return (
      <View style={styles.spotlightWrapper}>
        <View style={styles.spotlightHeaderRow}>
          <View style={styles.spotlightCrownBadge}>
            <FontAwesome5 name="crown" size={13} color="#000000" />
            <Text style={styles.spotlightCrownText}>#1 COMMUNITY CHOICE</Text>
          </View>
          <View style={styles.curatorsBadge}>
            <Text style={styles.curatorsBadgeText}>
              In {topSong.count} {topSong.count === 1 ? 'Hit List' : 'Hit Lists'}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.spotlightCard}
          activeOpacity={0.88}
          onPress={() => navigation.navigate('SongDetails', { song: topSong })}
        >
          <Image
            source={{ uri: getHighResImage(topSong.artworkUrl100 || topSong.imageUrl) }}
            style={styles.spotlightCover}
          />
          <View style={styles.spotlightInfo}>
            <Text style={styles.spotlightTitle} numberOfLines={1}>
              {topSong.trackName}
            </Text>
            <Text style={styles.spotlightArtist} numberOfLines={1}>
              {topSong.artistName}
            </Text>
            <Text style={styles.spotlightGenre}>
              {topSong.primaryGenreName} • Tap for details
            </Text>

            <View style={styles.spotlightActionRow}>
              <TouchableOpacity
                style={[styles.previewPill, isPlaying && styles.previewPillPlaying]}
                onPress={() => handleTogglePreview(topSong)}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <Icon
                    name={isPlaying ? 'pause' : 'play'}
                    size={14}
                    color="#000000"
                    style={{ marginRight: 4 }}
                  />
                )}
                <Text style={styles.previewPillText}>
                  {isPlaying ? 'Pause' : '30s Preview'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  const renderSongItem = ({ item, index }) => {
    const isPlaying = playingTrackId === item.trackId;
    const isLoading = loadingTrackId === item.trackId;
    const badgeColor = getRankBadgeColor(index);
    const coverUri = item.artworkUrl100 || item.imageUrl;

    return (
      <TouchableOpacity
        style={styles.chartItem}
        activeOpacity={0.85}
        onPress={() => navigation.navigate('SongDetails', { song: normalizeTrack(item) })}
      >
        <View style={[styles.rankBadge, { borderColor: badgeColor }]}>
          <Text style={[styles.rankNumber, { color: badgeColor }]}>#{index + 1}</Text>
        </View>

        {coverUri ? (
          <Image source={{ uri: coverUri }} style={styles.musicCover} />
        ) : (
          <View style={[styles.musicCover, styles.coverPlaceholder]}>
            <FontAwesome5 name="music" size={20} color="#FF8C00" />
          </View>
        )}

        <View style={styles.itemMeta}>
          <Text style={styles.itemTitle} numberOfLines={1}>
            {item.trackName || item.title}
          </Text>
          <Text style={styles.itemSubtitle} numberOfLines={1}>
            {item.artistName || item.artist}
          </Text>
          <Text style={styles.itemTag} numberOfLines={1}>
            {item.primaryGenreName || 'Music'}
          </Text>
        </View>

        <View style={styles.actionColumn}>
          <View style={styles.pickBadge}>
            <Text style={styles.pickBadgeText}>
              {item.count} {item.count === 1 ? 'pick' : 'picks'}
            </Text>
          </View>

          {item.previewUrl ? (
            <TouchableOpacity
              style={[styles.audioBtn, isPlaying && styles.audioBtnPlaying]}
              onPress={() => handleTogglePreview(item)}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#FF8C00" />
              ) : (
                <Icon
                  name={isPlaying ? 'pause-circle' : 'play-circle'}
                  size={24}
                  color={isPlaying ? '#FF8C00' : '#CBD5E1'}
                />
              )}
            </TouchableOpacity>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  const renderArtistItem = ({ item, index }) => {
    const badgeColor = getRankBadgeColor(index);
    const percent = totalPicks > 0 ? Math.round((item.count / totalPicks) * 100) : 0;

    return (
      <View style={styles.chartItem}>
        <View style={[styles.rankBadge, { borderColor: badgeColor }]}>
          <Text style={[styles.rankNumber, { color: badgeColor }]}>#{index + 1}</Text>
        </View>

        {item.artworkUrl100 ? (
          <Image
            source={{ uri: item.artworkUrl100 }}
            style={[styles.musicCover, { borderRadius: 27 }]}
          />
        ) : (
          <View style={[styles.musicCover, styles.coverPlaceholder, { borderRadius: 27 }]}>
            <FontAwesome5 name="user-alt" size={20} color="#FF8C00" />
          </View>
        )}

        <View style={styles.itemMeta}>
          <Text style={styles.itemTitle} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.itemSubtitle} numberOfLines={1}>
            Top track: {item.topSong || 'Signature Track'}
          </Text>
          <Text style={styles.itemTag}>
            In {item.curators.length} {item.curators.length === 1 ? 'curator list' : 'curator lists'}
          </Text>
        </View>

        <View style={styles.pickBadge}>
          <Text style={styles.pickBadgeText}>
            {item.count} {item.count === 1 ? 'track' : 'tracks'}
          </Text>
        </View>
      </View>
    );
  };

  const renderGenreItem = ({ item, index }) => {
    const badgeColor = getRankBadgeColor(index);
    const percent = totalPicks > 0 ? ((item.count / totalPicks) * 100).toFixed(1) : 0;

    return (
      <View style={styles.chartItem}>
        <View style={[styles.rankBadge, { borderColor: badgeColor }]}>
          <Text style={[styles.rankNumber, { color: badgeColor }]}>#{index + 1}</Text>
        </View>

        <View style={[styles.musicCover, styles.genreIconBox]}>
          <MaterialCommunityIcons name="waveform" size={24} color="#FF8C00" />
        </View>

        <View style={styles.itemMeta}>
          <Text style={styles.itemTitle} numberOfLines={1}>
            {item.name}
          </Text>
          <View style={styles.progressBarBackground}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${Math.min(Number(percent) * 2, 100)}%` },
              ]}
            />
          </View>
          <Text style={styles.itemTag}>{percent}% of all community 13 picks</Text>
        </View>

        <View style={styles.pickBadge}>
          <Text style={styles.pickBadgeText}>
            {item.count} {item.count === 1 ? 'song' : 'songs'}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <ImageBackground source={backgroundImage} style={styles.backgroundImage}>
      <SafeAreaView style={styles.container}>
        {/* Top Header */}
        <View style={styles.topHeader}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Icon name="arrow-back" size={20} color="#FFFFFF" />
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>

          <NeonText text="Community Charts" style={styles.neonTitle} />

          <TouchableOpacity
            onPress={fetchCommunityCharts}
            style={styles.refreshButton}
          >
            <Icon name="refresh" size={20} color="#FF8C00" />
          </TouchableOpacity>
        </View>

        {/* Community Metrics Banner */}
        <View style={styles.metricsBanner}>
          <View style={styles.metricItem}>
            <Text style={styles.metricValue}>{totalCurators}</Text>
            <Text style={styles.metricLabel}>Curators</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricItem}>
            <Text style={styles.metricValue}>{totalPicks}</Text>
            <Text style={styles.metricLabel}>13 Picks</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricItem}>
            <Text style={styles.metricValue}>{rankedSongs.length}</Text>
            <Text style={styles.metricLabel}>Ranked Songs</Text>
          </View>
        </View>

        {/* Search & Filter Bar */}
        <View style={styles.searchBox}>
          <Icon name="search" size={18} color="#94A3B8" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder={`Search charting ${selectedView.toLowerCase()}...`}
            placeholderTextColor="#64748B"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Icon name="close-circle" size={18} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>

        {/* Navigation Tabs */}
        <View style={styles.navBar}>
          {['Songs', 'Artists', 'Genres'].map((tab) => (
            <TouchableOpacity
              key={tab}
              onPress={() => setSelectedView(tab)}
              style={[styles.navButton, selectedView === tab && styles.activeNavButton]}
            >
              <Text
                style={[
                  styles.navButtonText,
                  selectedView === tab && styles.activeNavButtonText,
                ]}
              >
                {tab === 'Songs' ? 'Top 13 Songs' : tab === 'Artists' ? 'Top Artists' : 'Genres'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* List Content */}
        {loading && !refreshing ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#FF8C00" />
            <Text style={styles.loadingText}>
              Aggregating community choices from Your13...
            </Text>
          </View>
        ) : (
          <FlatList
            data={
              selectedView === 'Songs'
                ? filteredSongs
                : selectedView === 'Artists'
                  ? filteredArtists
                  : filteredGenres
            }
            keyExtractor={(item, index) =>
              item.trackId ? `song-${item.trackId}-${index}` : `chart-${item.name}-${index}`
            }
            ListHeaderComponent={renderSpotlight}
            renderItem={
              selectedView === 'Songs'
                ? renderSongItem
                : selectedView === 'Artists'
                  ? renderArtistItem
                  : renderGenreItem
            }
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#FF8C00"
                colors={['#FF8C00']}
              />
            }
            contentContainerStyle={styles.listContainer}
            ListEmptyComponent={
              <View style={styles.emptyBox}>
                <FontAwesome5 name="compact-disc" size={38} color="#475569" style={{ marginBottom: 12 }} />
                <Text style={styles.emptyTitle}>No Chart Matches Found</Text>
                <Text style={styles.emptySub}>
                  {searchQuery
                    ? `No ${selectedView.toLowerCase()} match "${searchQuery}".`
                    : 'Add tracks in Your13 to populate the community charts!'}
                </Text>
              </View>
            }
          />
        )}

        <Taskbar />
      </SafeAreaView>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
    resizeMode: 'cover',
  },
  container: {
    flex: 1,
    backgroundColor: 'rgba(10, 12, 18, 0.88)',
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 4,
  },
  refreshButton: {
    backgroundColor: 'rgba(255, 140, 0, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 140, 0, 0.4)',
    padding: 7,
    borderRadius: 8,
  },
  neonText: {
    fontSize: 22,
    color: '#FFFFFF',
    fontWeight: '800',
    textAlign: 'center',
  },
  neonShadow: {
    textShadowColor: '#FF8C00',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  neonTitle: {
    alignItems: 'center',
  },
  metricsBanner: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 6,
    marginBottom: 10,
    backgroundColor: 'rgba(22, 25, 34, 0.85)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#242B3B',
  },
  metricItem: {
    alignItems: 'center',
    flex: 1,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FF8C00',
  },
  metricLabel: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metricDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#2D3446',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161922',
    marginHorizontal: 16,
    marginBottom: 10,
    paddingHorizontal: 12,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2D3446',
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13,
    paddingVertical: 0,
  },
  navBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: '#12151D',
    borderRadius: 10,
    padding: 4,
    borderWidth: 1,
    borderColor: '#242B3B',
  },
  navButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeNavButton: {
    backgroundColor: '#FF8C00',
  },
  navButtonText: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '700',
  },
  activeNavButtonText: {
    color: '#000000',
    fontWeight: '800',
  },
  spotlightWrapper: {
    marginBottom: 14,
    backgroundColor: '#161922',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#FFD700',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  spotlightHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  spotlightCrownBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFD700',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    gap: 6,
  },
  spotlightCrownText: {
    color: '#000000',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  curatorsBadge: {
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    borderWidth: 1,
    borderColor: '#FFD700',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  curatorsBadgeText: {
    color: '#FFD700',
    fontSize: 11,
    fontWeight: '700',
  },
  spotlightCard: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  spotlightCover: {
    width: 72,
    height: 72,
    borderRadius: 10,
    marginRight: 12,
  },
  spotlightInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  spotlightTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 2,
  },
  spotlightArtist: {
    color: '#FF8C00',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  spotlightGenre: {
    color: '#94A3B8',
    fontSize: 11,
    marginBottom: 6,
  },
  spotlightActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  previewPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF8C00',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  previewPillPlaying: {
    backgroundColor: '#E2E8F0',
  },
  previewPillText: {
    color: '#000000',
    fontSize: 11,
    fontWeight: '800',
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  chartItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    padding: 10,
    backgroundColor: '#161922',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#242B3B',
  },
  rankBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    backgroundColor: '#10121A',
  },
  rankNumber: {
    fontSize: 12,
    fontWeight: '800',
  },
  musicCover: {
    width: 50,
    height: 50,
    borderRadius: 8,
    marginRight: 12,
  },
  coverPlaceholder: {
    backgroundColor: '#202534',
    alignItems: 'center',
    justifyContent: 'center',
  },
  genreIconBox: {
    backgroundColor: 'rgba(255, 140, 0, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 140, 0, 0.3)',
  },
  itemMeta: {
    flex: 1,
    justifyContent: 'center',
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  itemSubtitle: {
    fontSize: 12,
    color: '#CBD5E1',
    marginTop: 2,
  },
  itemTag: {
    fontSize: 11,
    color: '#718096',
    marginTop: 2,
  },
  progressBarBackground: {
    height: 4,
    backgroundColor: '#242B3B',
    borderRadius: 2,
    marginTop: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#FF8C00',
    borderRadius: 2,
  },
  actionColumn: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginLeft: 8,
    gap: 6,
  },
  pickBadge: {
    backgroundColor: 'rgba(255, 140, 0, 0.15)',
    borderWidth: 1,
    borderColor: '#FF8C00',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  pickBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FF8C00',
  },
  audioBtn: {
    padding: 2,
  },
  audioBtnPlaying: {
    transform: [{ scale: 1.1 }],
  },
  loadingBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 12,
    textAlign: 'center',
  },
  emptyBox: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  emptySub: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
  },
});

export default RankedMusicList;