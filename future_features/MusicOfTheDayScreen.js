// MusicOfTheDayScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Image,
  Alert,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Text, TextInput, Button, Modal, Portal } from 'react-native-paper';
import { auth, db } from '../firebaseConfig';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import axios from 'axios';
import { Calendar } from 'react-native-calendars';
import Taskbar from '../Taskbar';
import moment from 'moment';
import debounce from 'lodash.debounce';
import { useNavigation } from '@react-navigation/native';
import { FontAwesome5 } from '@expo/vector-icons';
import { normalizeTrack } from '../Memoir';

const getHighResImage = (imageUrl) => {
  if (!imageUrl) return 'https://via.placeholder.com/300';
  return imageUrl.replace('100x100', '400x400');
};

const MusicOfTheDayScreen = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedMusic, setSelectedMusic] = useState(null);
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState('');
  const [currentDate, setCurrentDate] = useState(moment().format('YYYY-MM-DD'));
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedDayMusic, setSelectedDayMusic] = useState(null);

  const nav = useNavigation();

  useEffect(() => {
    const fetchUserDataAndTodayMusic = async () => {
      try {
        const uid = auth.currentUser?.uid;
        if (!uid) return;

        const userDoc = await getDoc(doc(db, 'users', uid));
        if (userDoc.exists()) {
          setUsername(userDoc.data().username || '');
        }

        const today = moment().format('YYYY-MM-DD');
        const musicRef = doc(db, 'daily', `${uid}_${today}`);
        const musicDoc = await getDoc(musicRef);
        if (musicDoc.exists() && musicDoc.data()?.music) {
          setSelectedMusic(normalizeTrack(musicDoc.data().music));
        }
      } catch (error) {
        console.error('Error fetching initial daily music:', error);
      }
    };

    fetchUserDataAndTodayMusic();
  }, []);

  useEffect(() => {
    if (searchQuery.trim().length > 2) {
      const debouncedFetch = debounce(() => {
        fetchMusicOptions();
      }, 380);

      debouncedFetch();
      return () => debouncedFetch.cancel();
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  const fetchMusicOptions = async () => {
    if (searchQuery.trim().length <= 2) return;
    try {
      setLoading(true);
      const response = await axios.get('https://itunes.apple.com/search', {
        params: {
          term: searchQuery.trim(),
          media: 'music',
          entity: 'song',
          limit: 15,
        },
      });

      const musicData = Array.isArray(response.data?.results)
        ? response.data.results.map(normalizeTrack)
        : [];
      setSearchResults(musicData);
    } catch (error) {
      console.error('Error fetching music options:', error);
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectMusic = async (rawMusic) => {
    const music = normalizeTrack(rawMusic);
    setSelectedMusic(music);
    setSearchResults([]);
    setSearchQuery('');

    try {
      const today = currentDate;
      const uid = auth.currentUser?.uid;

      if (!uid) {
        Alert.alert('Error', 'User not authenticated.');
        return;
      }

      await setDoc(doc(db, 'daily', `${uid}_${today}`), {
        userId: uid,
        username: username || 'User',
        date: today,
        music,
        updatedAt: new Date().toISOString(),
      });

      Alert.alert(
        'Daily Tune Saved',
        `"${music.trackName}" set as your tune for ${today}!`
      );
    } catch (error) {
      console.error('Error storing music of the day:', error);
      Alert.alert('Error', 'Could not save daily tune.');
    }
  };

  const handleDateSelect = async (day) => {
    const date = day.dateString;
    setCurrentDate(date);

    try {
      const uid = auth.currentUser?.uid;
      if (!uid) return;
      const docRef = doc(db, 'daily', `${uid}_${date}`);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists() && docSnap.data()?.music) {
        setSelectedMusic(normalizeTrack(docSnap.data().music));
      } else {
        setSelectedMusic(null);
      }
    } catch (error) {
      console.error('Error fetching music for selected day:', error);
    }
  };

  const handleDayDoubleClick = async (day) => {
    const date = day.dateString;
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) return;
      const docRef = doc(db, 'daily', `${uid}_${date}`);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists() && docSnap.data()?.music) {
        setSelectedDayMusic(normalizeTrack(docSnap.data().music));
      } else {
        setSelectedDayMusic(null);
      }
      setModalVisible(true);
    } catch (error) {
      console.error('Error inspecting day:', error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerBlock}>
          <Text style={styles.screenTitle}>Daily Tune</Text>
          <Text style={styles.screenSubtitle}>
            {username
              ? `@${username}'s Daily Soundtrack`
              : 'Set your daily music vibe'}
          </Text>
        </View>

        <View style={styles.searchBoxWrapper}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search iTunes for today's tune..."
            placeholderTextColor="#888"
            textColor="#FFFFFF"
            value={searchQuery}
            onChangeText={setSearchQuery}
            left={<TextInput.Icon icon="magnify" color="#FF8C00" />}
            right={
              searchQuery.length > 0 ? (
                <TextInput.Icon
                  icon="close"
                  onPress={() => {
                    setSearchQuery('');
                    setSearchResults([]);
                  }}
                />
              ) : null
            }
          />
        </View>

        {loading && (
          <ActivityIndicator style={styles.loader} size="small" color="#FF8C00" />
        )}

        {searchResults.length > 0 && (
          <View style={styles.searchResultsContainer}>
            <View style={styles.resultsHeader}>
              <Text style={styles.resultsTitle}>
                Search Results ({searchResults.length})
              </Text>
              <TouchableOpacity onPress={() => setSearchResults([])}>
                <Text style={styles.dismissText}>Close ✕</Text>
              </TouchableOpacity>
            </View>

            {searchResults.map((item) => (
              <View key={item.trackId} style={styles.searchResultCard}>
                <TouchableOpacity
                  onPress={() => nav.navigate('SongDetails', { song: item })}
                >
                  <Image
                    source={{ uri: getHighResImage(item.artworkUrl100) }}
                    style={styles.resultArtwork}
                  />
                </TouchableOpacity>
                <View style={styles.resultMeta}>
                  <Text style={styles.resultTitle} numberOfLines={1}>
                    {item.trackName}
                  </Text>
                  <Text style={styles.resultArtist} numberOfLines={1}>
                    {item.artistName}
                  </Text>
                  <Text style={styles.resultGenre} numberOfLines={1}>
                    {item.primaryGenreName} •{' '}
                    {new Date(item.releaseDate).getFullYear()}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.selectTuneBtn}
                  onPress={() => handleSelectMusic(item)}
                >
                  <FontAwesome5
                    name="check"
                    size={12}
                    color="#000"
                    style={{ marginRight: 4 }}
                  />
                  <Text style={styles.selectTuneBtnText}>Set Tune</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        <View style={styles.spotlightCard}>
          <View style={styles.spotlightBadgeRow}>
            <View style={styles.spotlightBadge}>
              <FontAwesome5
                name="music"
                size={12}
                color="#000"
                style={{ marginRight: 5 }}
              />
              <Text style={styles.spotlightBadgeText}>
                Selected for {currentDate}
              </Text>
            </View>
          </View>

          {selectedMusic ? (
            <TouchableOpacity
              style={styles.spotlightContent}
              onPress={() => nav.navigate('SongDetails', { song: selectedMusic })}
            >
              <Image
                source={{
                  uri: getHighResImage(
                    selectedMusic.artworkUrl100 || selectedMusic.imageUrl
                  ),
                }}
                style={styles.spotlightImage}
              />
              <View style={styles.spotlightInfo}>
                <Text style={styles.spotlightSongTitle} numberOfLines={1}>
                  {selectedMusic.trackName || selectedMusic.title}
                </Text>
                <Text style={styles.spotlightArtist} numberOfLines={1}>
                  {selectedMusic.artistName || selectedMusic.artist}
                </Text>
                <Text style={styles.spotlightGenre}>
                  {selectedMusic.primaryGenreName || selectedMusic.genre} • Tap to
                  Preview
                </Text>
              </View>
            </TouchableOpacity>
          ) : (
            <View style={styles.emptySpotlight}>
              <FontAwesome5
                name="compact-disc"
                size={32}
                color="#4A5568"
                style={{ marginBottom: 8 }}
              />
              <Text style={styles.emptySpotlightText}>
                No tune set for {currentDate}
              </Text>
              <Text style={styles.emptySpotlightSub}>
                Search above to set your song of the day
              </Text>
            </View>
          )}
        </View>

        <View style={styles.calendarWrapper}>
          <Text style={styles.calendarSectionTitle}>Calendar Overview</Text>
          <Calendar
            theme={{
              calendarBackground: '#161922',
              textSectionTitleColor: '#A0AEC0',
              todayTextColor: '#FF8C00',
              dayTextColor: '#FFFFFF',
              textDisabledColor: '#3A3F4D',
              arrowColor: '#FF8C00',
              monthTextColor: '#FF8C00',
              selectedDayBackgroundColor: '#FF8C00',
              selectedDayTextColor: '#000000',
            }}
            markedDates={{
              [currentDate]: {
                selected: true,
                marked: true,
                selectedColor: '#FF8C00',
              },
            }}
            onDayPress={handleDateSelect}
            onDayLongPress={handleDayDoubleClick}
          />
        </View>

        <TouchableOpacity
          style={styles.rhythmBanner}
          onPress={() => nav.navigate('RankedMusicList')}
        >
          <View style={styles.rhythmIconBox}>
            <FontAwesome5 name="chart-line" size={20} color="#FF8C00" />
          </View>
          <View style={styles.rhythmMeta}>
            <Text style={styles.rhythmTitle}>Daily Rhythm Charts</Text>
            <Text style={styles.rhythmSub}>
              Explore top trending songs, artists & genres
            </Text>
          </View>
          <FontAwesome5 name="chevron-right" size={16} color="#A0AEC0" />
        </TouchableOpacity>

        <Portal>
          <Modal
            visible={modalVisible}
            onDismiss={() => setModalVisible(false)}
            contentContainerStyle={styles.modalContainer}
          >
            {selectedDayMusic ? (
              <View style={{ alignItems: 'center' }}>
                <Image
                  source={{
                    uri: getHighResImage(
                      selectedDayMusic.artworkUrl100 || selectedDayMusic.imageUrl
                    ),
                  }}
                  style={styles.modalImage}
                  resizeMode="cover"
                />
                <Text style={styles.modalSongTitle}>
                  {selectedDayMusic.trackName || selectedDayMusic.title}
                </Text>
                <Text style={styles.modalSongArtist}>
                  {selectedDayMusic.artistName || selectedDayMusic.artist}
                </Text>
              </View>
            ) : (
              <Text style={styles.noMusicText}>No song recorded for this day.</Text>
            )}
            <Button
              mode="contained"
              buttonColor="#FF8C00"
              textColor="#000"
              onPress={() => setModalVisible(false)}
              style={styles.closeButton}
            >
              Close
            </Button>
          </Modal>
        </Portal>
      </ScrollView>

      <View style={styles.taskbarContainer}>
        <Taskbar />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0E12',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
    alignItems: 'center',
  },
  headerBlock: {
    alignItems: 'center',
    marginBottom: 12,
    width: '100%',
    maxWidth: 500,
  },
  screenTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  screenSubtitle: {
    fontSize: 13,
    color: '#A0AEC0',
    marginTop: 2,
  },
  searchBoxWrapper: {
    width: '100%',
    maxWidth: 500,
    marginBottom: 8,
  },
  searchInput: {
    backgroundColor: '#161922',
    borderRadius: 10,
    fontSize: 14,
    height: 46,
  },
  loader: {
    marginVertical: 10,
  },
  searchResultsContainer: {
    width: '100%',
    maxWidth: 500,
    backgroundColor: '#161922',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#242834',
  },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#242834',
  },
  resultsTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  dismissText: {
    color: '#A0AEC0',
    fontSize: 13,
    fontWeight: '600',
  },
  searchResultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C202B',
    borderRadius: 10,
    padding: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#2D323E',
  },
  resultArtwork: {
    width: 48,
    height: 48,
    borderRadius: 6,
    marginRight: 10,
  },
  resultMeta: {
    flex: 1,
    justifyContent: 'center',
  },
  resultTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  resultArtist: {
    color: '#CBD5E1',
    fontSize: 12,
  },
  resultGenre: {
    color: '#718096',
    fontSize: 10,
    marginTop: 2,
  },
  selectTuneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF8C00',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    marginLeft: 8,
  },
  selectTuneBtnText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '700',
  },
  spotlightCard: {
    width: '100%',
    maxWidth: 500,
    backgroundColor: '#161922',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#FF8C00',
  },
  spotlightBadgeRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  spotlightBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF8C00',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  spotlightBadgeText: {
    color: '#000000',
    fontSize: 11,
    fontWeight: '800',
  },
  spotlightContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  spotlightImage: {
    width: 72,
    height: 72,
    borderRadius: 10,
    marginRight: 14,
  },
  spotlightInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  spotlightSongTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  spotlightArtist: {
    fontSize: 14,
    color: '#FF8C00',
    fontWeight: '600',
    marginBottom: 2,
  },
  spotlightGenre: {
    fontSize: 12,
    color: '#A0AEC0',
  },
  emptySpotlight: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
  },
  emptySpotlightText: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  emptySpotlightSub: {
    color: '#718096',
    fontSize: 12,
  },
  calendarWrapper: {
    width: '100%',
    maxWidth: 500,
    marginBottom: 16,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#242834',
    padding: 10,
    backgroundColor: '#161922',
  },
  calendarSectionTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 8,
    marginLeft: 4,
  },
  rhythmBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    maxWidth: 500,
    backgroundColor: '#161922',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#242834',
    marginBottom: 16,
  },
  rhythmIconBox: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 140, 0, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rhythmMeta: {
    flex: 1,
  },
  rhythmTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  rhythmSub: {
    color: '#A0AEC0',
    fontSize: 12,
  },
  modalContainer: {
    backgroundColor: '#161922',
    padding: 24,
    borderRadius: 14,
    alignItems: 'center',
    width: '85%',
    maxWidth: 400,
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: '#242834',
  },
  modalImage: {
    width: 140,
    height: 140,
    borderRadius: 12,
    marginBottom: 14,
  },
  modalSongTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FF8C00',
    textAlign: 'center',
    marginBottom: 4,
  },
  modalSongArtist: {
    fontSize: 14,
    color: '#CBD5E1',
    textAlign: 'center',
    marginBottom: 16,
  },
  noMusicText: {
    fontSize: 15,
    color: '#CBD5E1',
    textAlign: 'center',
    marginBottom: 16,
  },
  closeButton: {
    marginTop: 10,
    width: 140,
  },
  taskbarContainer: {
    backgroundColor: '#121212',
  },
});

export default MusicOfTheDayScreen;