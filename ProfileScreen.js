import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, Image, TouchableOpacity, Dimensions, ActivityIndicator } from 'react-native';
import { Button, Modal, Portal, IconButton } from 'react-native-paper';
import { signOut } from "firebase/auth";
import { auth, db } from './firebaseConfig';
import { doc, getDoc, setDoc, collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { useFocusEffect } from '@react-navigation/native';
import Taskbar from './Taskbar';
import { FontAwesome5 } from '@expo/vector-icons'; // Assuming using Expo for icons
import moment from 'moment';
import eventEmitter from './events'; // Import the event emitter
import { pickImage, uploadImage } from './UploadProfilePicture';
import FadingCarousel from './FadingCarousel';

const windowWidth = Dimensions.get('window').width;
const windowHeight = Dimensions.get('window').height;

const getHighResImage = (imageUrl) => {
  return imageUrl.replace('100x100', '500x500');
};

const ProfileScreen = ({ route, navigation }) => {
  const userId = route?.params?.userId ?? auth.currentUser?.uid;
  const [username, setUsername] = useState('');
  const [selectedSongs, setSelectedSongs] = useState([]);
  const [musicOfTheDay, setMusicOfTheDay] = useState(null);
  const [selectedSong, setSelectedSong] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [currentDate, setCurrentDate] = useState(moment().format('YYYY-MM-DD'));
  const [selectedMemoir, setSelectedMemoir] = useState(null);
  const [pastMemoirs, setPastMemoirs] = useState([]);
  const [mostRecentMemoir, setMostRecentMemoir] = useState(null);  // Store the most recent memoir
  const [profileImageUrl, setProfileImageUrl] = useState('./assets/john-mark-arnold-soMvIOHmdgM-unsplash.jpg'); // Default placeholder image
  const [uploading, setUploading] = useState(false);
  const [mediaList, setMediaList] = useState([]);  // For storing the list of user's uploaded images
  const [loading, setLoading] = useState(true);
  const [followers, setFollowers] = useState(0);
  const [following, setFollowing] = useState(0);
  const [selectedTab, setSelectedTab] = useState('13');

  const fetchUserData = async () => {
    try {
      const userRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userRef);
      const userData = userDoc.data();
      if (userData && userData.username) {
        setUsername(userData.username);
      }
      if (userData && userData.profileImageUrl) {
        setProfileImageUrl(userData.profileImageUrl);
      } else {
        try {
          const imgQuery = query(collection(db, 'images'), where('userId', '==', userId), orderBy('uploadedAt', 'desc'));
          const imgSnap = await getDocs(imgQuery);
          if (!imgSnap.empty) {
            const latestImg = imgSnap.docs[0].data().downloadURL;
            setProfileImageUrl(latestImg);
            await setDoc(userRef, { profileImageUrl: latestImg }, { merge: true });
          }
        } catch (e) {
          console.log("No images fallback found:", e);
        }
      }

      const songsRef = doc(db, 'playlists', userData.username);
      const songsDoc = await getDoc(songsRef);
      const songsData = songsDoc.data();
      setSelectedSongs(songsData?.songs || []);

      const today = currentDate;
      const musicRef = doc(db, 'daily', `${auth.currentUser.uid}_${today}`);
      const musicDoc = await getDoc(musicRef);
      const musicData = musicDoc.data();
      if (musicData && musicData.music) {
        setMusicOfTheDay(musicData.music);
      } else {
        setMusicOfTheDay(null);
      }
      const friendRef = doc(db, 'requests', userId);
      const friendsDoc = await getDoc(friendRef);
      setFollowing(Object.keys(friendsDoc.data()?.following || {}).length);
      setFollowers(Object.keys(friendsDoc.data()?.followers || {}).length);
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      // Only fetch user data if it isn't coming directly from memoir
      if (!route?.params?.fromMemoir) {
        fetchUserData();
      }
    }, [userId, route?.params?.fromMemoir])
  );

  useEffect(() => {
    // Set up the event listener for memoir selection
    const handleMemoirSelected = (memoir) => {
      setSelectedMemoir(memoir);
      console.log('Selected Memoir:', memoir);
    };
    eventEmitter.on('memoirSelected', handleMemoirSelected);
    return () => {
      eventEmitter.off('memoirSelected', handleMemoirSelected);
    };
  }, []);

  const handleDoubleClick = (song) => {
    setSelectedSong(song);
    setModalVisible(true);
  };

  const handleFriendsPress = () => {
    navigation.navigate('FriendsScreen', { userId });
  };

  const handleNotificationPress = () => {
    navigation.navigate('NotifPage', { userId });
  };

  const handleSettingsPress = () => {
    navigation.navigate('SettingsScreen', { userId });
  };

  // Fetch memoirs from Firestore
  const fetchMemoirs = async () => {
    try {
      const memoirRef = doc(db, 'memoirs', userId);
      const memoirDoc = await getDoc(memoirRef);
      if (memoirDoc.exists()) {
        const memoirData = memoirDoc.data();
        const sortedMemoirs = memoirData.pastMemoirs.sort((a, b) => b.timestamp.seconds - a.timestamp.seconds);
        setPastMemoirs(sortedMemoirs);
        setMostRecentMemoir(sortedMemoirs[0]);
      } else {
        console.log("No memoirs found for this user.");
      }
    } catch (error) {
      console.error("Error fetching memoirs:", error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchMemoirs();
    }, [userId])
  );

  const handlePickImage = async () => {
    try {
      const selectedAsset = await pickImage();
      if (selectedAsset?.uri) {
        setUploading(true);
        const downloadURL = await uploadImage(selectedAsset.uri, userId);
        setProfileImageUrl(downloadURL);
        setUploading(false);
      }
    } catch (error) {
      console.error('Error handling image upload:', error);
      setUploading(false);
    }
  };

  useEffect(() => {
    const imagesQuery = query(
      collection(db, 'images'),
      where('userId', '==', userId),
      orderBy('uploadedAt', 'desc')
    );

    const unsubscribe = onSnapshot(imagesQuery, (snapshot) => {
      const userMedia = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setMediaList(userMedia);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userId]);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollViewContent}>
        <View style={styles.profileHeaderContainer}>
          <View style={styles.profileImageContainer}>
            {loading ? (
              <ActivityIndicator size="large" color="#0000ff" />
            ) : mediaList.length > 0 ? (
              <FadingCarousel images={mediaList.map((item) => item.downloadURL)} duration={3000} />
            ) : (
              <Text>No profile image available</Text>
            )}
            <TouchableOpacity style={{ marginTop: 10 }} onPress={handlePickImage}>
              <FontAwesome5 name="images" size={24} color="red" />
            </TouchableOpacity>
            {uploading && <ActivityIndicator size="large" color="#0000ff" />}
          </View>

          <Text style={styles.username}>{username}</Text>
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
            <TouchableOpacity style={styles.statItem} onPress={handleFriendsPress}> 
              <Text style={styles.statNumber}>{following}</Text>
              <Text style={styles.statLabel}>Following</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.statItem} onPress={handleFriendsPress}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{followers}</Text>
              <Text style={styles.statLabel}>Followers</Text>
            </View>
            </TouchableOpacity>
          </View>
          
          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <IconButton icon="bell" size={24} onPress={handleNotificationPress} style={styles.iconButton} iconColor="red" />
            <IconButton icon="cog" size={24} onPress={handleSettingsPress} style={styles.iconButton} iconColor="red" />
            <IconButton icon="message" size={24} onPress={() => navigation.navigate('MainChatScreen')} style={styles.iconButton} iconColor="red" />
          </View>
        </View>

        {/* Tab Navigation */}
        <View style={styles.tabContainer}>
          {['13', 'Memoir'].map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tabItem, selectedTab === tab && styles.activeTabItem]}
              onPress={() => setSelectedTab(tab)}
            >
              <Text style={[styles.tabText, selectedTab === tab && styles.activeTabText]}>{tab === '13' ? 'Your 13' : tab}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {selectedTab === '13' && (
          <View style={styles.musicOfTheDayContainer}>
            <Text style={styles.sectionTitle}>Your 13</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {selectedSongs.length > 0 ? (
                selectedSongs.map((item) => (
                  <TouchableOpacity key={item.trackId} onPress={() => handleDoubleClick(item)}>
                    <Image source={{ uri: getHighResImage(item.artworkUrl100) }} style={styles.playlistCover} />
                  </TouchableOpacity>
                ))
              ) : (
                <View style={styles.centeredContainer}>
                <Text style={styles.noMusicText}>No songs in your Hit List.</Text>
                <TouchableOpacity
                    style={styles.customButton}
                    onPress={() => navigation.navigate('Your13')}>
                    <Text style={styles.customButtonText}>Write Your Hit List</Text> 
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          </View>
        )}

        {selectedTab === 'Memoir' && (
          <View style={styles.memoirContainer}>
             <TouchableOpacity onPress={() => navigation.navigate('MemoirSearchPage')}>
                  <FontAwesome5 name="pen-nib" size={24} color="white" style={styles.bookIcon} />
              </TouchableOpacity>
            {pastMemoirs.length > 0 ? (
              pastMemoirs.map((memoir, index) => (
                <View key={index} style={styles.memoirItemContainer}>
                  <View style={styles.coverAndTrackInfoContainer}>
                    <Image
                      source={{ uri: getHighResImage(memoir.item.artworkUrl100) }}
                      style={styles.coverImage}
                    />
                    <Text style={styles.trackTitle}>
                      {memoir.item.trackName} - {memoir.item.artistName}
                    </Text>
                  </View>
                  <View style={styles.commentDisplayContainer}>
                    <Text style={styles.commentDisplayText}>{memoir.comment}</Text>
                  </View>
                </View>
              ))
            ) : (
              <Text style={styles.noMemoirsText}>No recent memoirs to display.</Text>
            )}
          </View>
        )}
      </ScrollView>

      <View style={styles.taskbarContainer}>
        <Taskbar />
      </View>

      {/* Modal for Selected Song */}
      <Portal>
        <Modal visible={modalVisible} onDismiss={() => setModalVisible(false)} contentContainerStyle={styles.modalContainer}>
          {selectedSong && (
            <View>
              <Image source={{ uri: getHighResImage(selectedSong.artworkUrl100) }} style={styles.modalImage} />
              <Text style={styles.modalTitle}>{selectedSong.trackName}</Text>
              <Text style={styles.modalArtist}>{selectedSong.artistName}</Text>
              <Text style={styles.modalDuration}>{Math.floor(selectedSong.trackTimeMillis / 60000)}:{Math.floor((selectedSong.trackTimeMillis % 60000) / 1000).toFixed(0).padStart(2, '0')}</Text>
              <Button onPress={() => setModalVisible(false)} style={styles.closeButton}>Close</Button>
            </View>
          )}
        </Modal>
      </Portal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  scrollViewContent: {
    paddingBottom: 100,
  },
  profileHeaderContainer: {
    alignItems: 'center',
    padding: 20,
  },
  profileImageContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },
  profileImage: {
    width: windowWidth * 0.2,
    height: windowWidth * 0.2,
  },
  username: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    textShadowColor: '#CC3639',
    textShadowOffset: { width: 3, height: 3 },
    textShadowRadius: 1,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginVertical: 10,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  statLabel: {
    fontSize: 14,
    color: 'gray',
  },
  followButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 25,
    marginTop: 10,
  },
  followButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  tabContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    marginBottom: 10,
  },
  tabItem: {
    paddingVertical: 10,
  },
  activeTabItem: {
    borderBottomWidth: 2,
    borderBottomColor: '#fff',
  },
  tabText: {
    fontSize: 16,
    color: 'gray',
  },
  activeTabText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  musicOfTheDayContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: 'white',
  },
  musicCover: {
    width: 300,
    height: 300,
    borderRadius: 10,
    marginTop: 10,
  },
  noMusicText: {
    color: '#cccccc',
    fontSize: 16,
    marginTop: 10,
  },
  playlistContainer: {
    marginVertical: 20,
  },
  playlistTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
  },
  playlistCover: {
    width: 100,
    height: 100,
    borderRadius: 5,
    marginHorizontal: 5,
  },
  memoirContainer: {
    marginVertical: 20,
    alignItems: 'center',
  },
  memoirHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memoirTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    marginBottom: 10,
  },
  bookIcon: {
    marginLeft: 10,
  },
  memoirItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
    paddingHorizontal: 10,
    backgroundColor: '#121212',
    borderRadius: 10,
  },
  coverAndTrackInfoContainer: {
    flex: 0.6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  coverImage: {
    width: 120,
    height: 120,
    borderRadius: 10,
    marginLeft: 5,
  },
  trackTitle: {
    fontSize: 16,
    color: 'white',
    textAlign: 'center',
    marginTop: 8,
    flexWrap: 'wrap',
    maxWidth: '100%',
  },
  commentDisplayContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingLeft: 20,
  },
  commentDisplayText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    fontStyle: 'italic',
    textAlign: 'left',
  },
  taskbarContainer: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    backgroundColor: '#121212',
    paddingVertical: windowWidth * 0.02,
  },
  modalContainer: {
    backgroundColor: '#1f1f1f',
    padding: 20,
    borderRadius: 10,
    alignItems: 'center',
  },
  centeredContainer: {
    flex: 1, // Ensures the view takes up available space
    justifyContent: 'center', // Vertically centers the content
    alignItems: 'center', // Horizontally centers the content
  },
  modalImage: {
    width: 200,
    height: 200,
    borderRadius: 10,
    marginBottom: 20,
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  modalArtist: {
    color: '#ffffff',
    fontSize: 16,
    textAlign: 'center',
  },
  modalDuration: {
    color: '#ffffff',
    fontSize: 14,
    textAlign: 'center',
    marginVertical: 10,
  },
  closeButton: {
    backgroundColor: '#ff8c00',
    marginTop: 20,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems : 'center',
  },
  iconButton: {
    marginHorizontal: 3,
    color:'#CC3639',
  },
  customButton: {
    backgroundColor: '#edfafa',
    paddingVertical: 15, // Height of the button
    paddingHorizontal: 30, // Width of the button
    borderRadius: 30, // Fully rounded corners
    marginTop: 15, // Space between the text and button
    alignItems: 'center', // Center the text horizontally
    shadowColor: '#000', // Shadow for a raised effect
    shadowOffset: { width: 10, height: 40 }, // Position the shadow
    shadowOpacity: 1, // Light shadow opacity
    shadowRadius: 10, // Spread the shadow
    elevation: 5, // Elevation for Android
    textShadowColor: '#CC3639',
    /*    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    textShadowColor: '#CC3639',
    textShadowOffset: { width: 3, height: 3 },
    textShadowRadius: 1,*/
  },
  customButtonText: {
    color: '#cc3639', // White text
    fontSize: 16, // Text size
    fontWeight: 'bold', // Bold text style
  },
  songTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    textShadowColor: '#CC3639',
    textShadowOffset: { width: 3, height: 3 },
    textShadowRadius: 4,
    fontStyle: 'italic',
    marginBottom: 10,
  },
});

export default ProfileScreen;
