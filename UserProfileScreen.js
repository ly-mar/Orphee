// UserProfileScreen.js — updated playlist hydration and SongDetails navigation
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Image,
  TouchableOpacity,
  Dimensions,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {
  doc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  addDoc,
  setDoc,
} from 'firebase/firestore';
import { db, auth } from './firebaseConfig';
import Taskbar from './Taskbar';
import moment from 'moment';
import { sendFriendRequest } from './HandlingFriends';
import { subscribeSafeSnapshot } from './firestoreListenerUtils';
import FadingCarousel from './FadingCarousel';
import { FontAwesome5 } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

const windowWidth = Dimensions.get('window').width;

const getHighResImage = (imageUrl) => {
  if (!imageUrl) return 'https://via.placeholder.com/400';
  return imageUrl.replace('100x100', '500x500');
};

const UserProfileScreen = ({ route, navigation }) => {
  const { userId } = route?.params || {};
  const [username, setUsername] = useState('');
  const [selectedSongs, setSelectedSongs] = useState([]);
  const [musicOfTheDay, setMusicOfTheDay] = useState(null);
  const [currentDate] = useState(moment().format('YYYY-MM-DD'));
  const [friendStatus, setFriendStatus] = useState('none');
  const currentUserId = auth.currentUser?.uid;
  const [mediaList, setMediaList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pastMemoirs, setPastMemoirs] = useState([]);
  const [following, setFollowing] = useState(0);
  const [followers, setFollowers] = useState(0);
  const [selectedTab, setSelectedTab] = useState('13');
  const [userProfileImage, setUserProfileImage] = useState(null);

  const fetchUserData = async () => {
    if (!userId) return;
    try {
      let resolvedUsername = userId;
      const userRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();
        resolvedUsername = userData.username || userId;
        setUsername(resolvedUsername);
        if (userData.profileImageUrl) {
          setUserProfileImage(userData.profileImageUrl);
        }
      } else {
        setUsername(userId);
      }

      // Check playlists/{userId} first, then fallback to playlists/{username}
      let loadedSongs = [];
      const uidPlaylistDoc = await getDoc(doc(db, 'playlists', userId));
      if (uidPlaylistDoc.exists() && uidPlaylistDoc.data()?.songs) {
        const raw = uidPlaylistDoc.data().songs;
        loadedSongs = Array.isArray(raw) ? raw : Object.values(raw);
      } else if (resolvedUsername !== userId) {
        const namePlaylistDoc = await getDoc(doc(db, 'playlists', resolvedUsername));
        if (namePlaylistDoc.exists() && namePlaylistDoc.data()?.songs) {
          const raw = namePlaylistDoc.data().songs;
          loadedSongs = Array.isArray(raw) ? raw : Object.values(raw);
        }
      }
      setSelectedSongs(loadedSongs);

      // Check daily/{userId}_{today} then fallback to daily/{username}_{today}
      const dailyByUid = await getDoc(doc(db, 'daily', `${userId}_${currentDate}`));
      if (dailyByUid.exists() && dailyByUid.data()?.music) {
        setMusicOfTheDay(dailyByUid.data().music);
      } else {
        const dailyByName = await getDoc(
          doc(db, 'daily', `${resolvedUsername}_${currentDate}`)
        );
        setMusicOfTheDay(dailyByName.exists() ? dailyByName.data()?.music || null : null);
      }

      const friendRef = doc(db, 'requests', userId);
      const friendsDoc = await getDoc(friendRef);
      if (friendsDoc.exists()) {
        setFollowing(Object.keys(friendsDoc.data()?.following || {}).length);
        setFollowers(Object.keys(friendsDoc.data()?.followers || {}).length);
      }

      if (currentUserId) {
        const currentUserRequestsRef = doc(db, 'requests', currentUserId);
        const currentUserRequestsDoc = await getDoc(currentUserRequestsRef);
        if (currentUserRequestsDoc.exists()) {
          const {
            followers: myFollowers = {},
            following: myFollowing = {},
            sentRequests = {},
          } = currentUserRequestsDoc.data();

          if (sentRequests[userId] || sentRequests[resolvedUsername]) {
            setFriendStatus('pending');
          } else if (
            myFollowers[userId] ||
            myFollowing[userId] ||
            myFollowers[resolvedUsername] ||
            myFollowing[resolvedUsername]
          ) {
            setFriendStatus('friend');
          }
        }
      }
    } catch (error) {
      console.warn('Error fetching user profile data:', error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserData();
  }, [userId]);

  const fetchMemoirs = async () => {
    if (!userId) return;
    try {
      const memoirRef = doc(db, 'memoirs', userId);
      const memoirDoc = await getDoc(memoirRef);
      if (memoirDoc.exists() && Array.isArray(memoirDoc.data()?.pastMemoirs)) {
        const sortedMemoirs = [...memoirDoc.data().pastMemoirs].sort(
          (a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0)
        );
        setPastMemoirs(sortedMemoirs);
      }
    } catch (_) { }
  };

  useFocusEffect(
    useCallback(() => {
      fetchMemoirs();
    }, [userId])
  );

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    return subscribeSafeSnapshot({
      isReady: Boolean(userId),
      buildQuery: () =>
        query(
          collection(db, 'images'),
          where('userId', '==', userId),
          orderBy('uploadedAt', 'desc')
        ),
      onSnapshotFn: onSnapshot,
      onNext: (snapshot) => {
        const userMedia = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        setMediaList(userMedia);
        setLoading(false);
      },
      onError: (err) => {
        if (err?.code !== 'permission-denied') {
          console.warn('UserProfileScreen listener error:', err);
        }
        setLoading(false);
      },
    });
  }, [userId]);

  const getFriendRequestButtonText = () => {
    if (friendStatus === 'pending') return 'Pending...';
    if (friendStatus === 'friend') return 'Fellow connoisseur';
    return 'Send Friend Request';
  };

  const getFriendRequestButtonStyle = () => {
    if (friendStatus === 'pending') {
      return [styles.sendFriendRequestButton, { backgroundColor: '#2D3748' }];
    }
    if (friendStatus === 'friend') {
      return [styles.sendFriendRequestButton, { backgroundColor: '#1E90FF' }];
    }
    return styles.sendFriendRequestButton;
  };

  const handleSendFriendRequest = async () => {
    try {
      if (!username) {
        Alert.alert('Error', 'No username found for this user.');
        return;
      }
      await sendFriendRequest(userId, username);
      setFriendStatus('pending');
    } catch (error) {
      console.error('Error sending friend request:', error);
      Alert.alert('Error', 'Failed to send friend request.');
    }
  };

  const startChat = async (targetUid, targetUsername) => {
    if (targetUid && targetUid !== currentUserId && currentUserId) {
      try {
        const chatParticipants = [currentUserId, targetUid].sort();
        const chatId = `${chatParticipants[0]}_${chatParticipants[1]}`;
        const chatsRef = collection(db, 'chats');
        const q = query(chatsRef, where('chatId', '==', chatId));
        const querySnapshot = await getDocs(q);

        let finalChatId = chatId;
        if (querySnapshot.empty) {
          const newChatRef = await addDoc(chatsRef, {
            chatId,
            participants: chatParticipants,
            createdAt: Date.now(),
          });
          finalChatId = newChatRef.id;
        } else {
          finalChatId = querySnapshot.docs[0].id;
        }

        navigation.navigate('ChatScreen', {
          chatId: finalChatId,
          username: targetUsername,
        });
      } catch (e) {
        console.error('Error starting chat:', e);
      }
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topNavHeader}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <FontAwesome5 name="arrow-left" size={16} color="#FFF" />
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{username ? `@${username}` : 'Profile'}</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollViewContent}>
        <View style={styles.profileHeaderContainer}>
          <View style={styles.profileImageContainer}>
            {loading ? (
              <ActivityIndicator size="large" color="#FF8C00" />
            ) : mediaList.length > 0 ? (
              <FadingCarousel
                images={mediaList.map((item) => item.downloadURL)}
                duration={3000}
              />
            ) : userProfileImage ? (
              <Image source={{ uri: userProfileImage }} style={styles.profileImage} />
            ) : (
              <Image
                source={require('./assets/john-mark-arnold-soMvIOHmdgM-unsplash.jpg')}
                style={styles.profileImage}
              />
            )}
          </View>

          <View style={styles.usernameWithMailIcon}>
            <Text style={styles.username}>{username}</Text>
            <TouchableOpacity onPress={() => startChat(userId, username)}>
              <FontAwesome5
                name="envelope"
                size={22}
                color="#FF8C00"
                style={styles.mailIcon}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{following}</Text>
              <Text style={styles.statLabel}>Following</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{followers}</Text>
              <Text style={styles.statLabel}>Followers</Text>
            </View>
          </View>

          <TouchableOpacity
            style={getFriendRequestButtonStyle()}
            onPress={handleSendFriendRequest}
            disabled={friendStatus !== 'none'}
          >
            <Text style={styles.followButtonText}>{getFriendRequestButtonText()}</Text>
          </TouchableOpacity>
        </View>

        {/* Tabs Section */}
        <View style={styles.tabContainer}>
          {['13', 'Memoir'].map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tabItem, selectedTab === tab && styles.activeTabItem]}
              onPress={() => setSelectedTab(tab)}
            >
              <Text style={[styles.tabText, selectedTab === tab && styles.activeTabText]}>
                {tab === '13' ? `Your13 (${selectedSongs.length})` : tab}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {selectedTab === '13' && (
          <View style={styles.playlistContainer}>
            {selectedSongs.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 14 }}
              >
                {selectedSongs.map((song, idx) => (
                  <TouchableOpacity
                    key={`${song.trackId || idx}`}
                    style={styles.songTile}
                    onPress={() => navigation.navigate('SongDetails', { song })}
                  >
                    <Image
                      source={{
                        uri: getHighResImage(song.artworkUrl100 || song.imageUrl),
                      }}
                      style={styles.playlistCover}
                    />
                    <Text style={styles.songTileTitle} numberOfLines={1}>
                      {song.trackName || song.title}
                    </Text>
                    <Text style={styles.songTileArtist} numberOfLines={1}>
                      {song.artistName || song.artist}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : (
              <Text style={styles.noMusicText}>No Your13 tracks published yet.</Text>
            )}
          </View>
        )}

        {selectedTab === 'Memoir' && (
          <View style={styles.memoirContainer}>
            {pastMemoirs.length > 0 ? (
              pastMemoirs.map((memoir, index) => (
                <View key={index} style={styles.memoirItemContainer}>
                  <View style={styles.coverAndTrackInfoContainer}>
                    <Image
                      source={{ uri: getHighResImage(memoir.item?.artworkUrl100) }}
                      style={styles.coverImage}
                    />
                    <Text style={styles.trackTitle}>
                      {memoir.item?.trackName} - {memoir.item?.artistName}
                    </Text>
                  </View>
                  <View style={styles.commentDisplayContainer}>
                    <Text style={styles.commentDisplayText}>{memoir.comment}</Text>
                  </View>
                </View>
              ))
            ) : (
              <Text style={styles.noMusicText}>No recent memoirs to display.</Text>
            )}
          </View>
        )}
      </ScrollView>

      <View style={styles.taskbarContainer}>
        <Taskbar />
      </View>
    </SafeAreaView>
  );
};

const handleReportOrBlockUser = (targetUid, targetUsername, navigation) => {
  const reporterUid = auth.currentUser?.uid;
  if (!reporterUid || !targetUid) return;

  const submitReport = async (reason, alsoBlock = false) => {
    try {
      await addDoc(collection(db, 'reports'), {
        reportedUid: targetUid,
        reportedUsername: targetUsername || 'User',
        reporterUid,
        reason,
        blocked: alsoBlock,
        timestamp: new Date().toISOString(),
      });

      if (alsoBlock) {
        await setDoc(
          doc(db, 'users', reporterUid),
          { [`blockedUsers.${targetUid}`]: true },
          { merge: true }
        );
      }

      Alert.alert(
        alsoBlock ? 'User Blocked & Reported' : 'Report Submitted',
        alsoBlock
          ? `@${targetUsername} has been blocked and reported to our moderation team.`
          : 'Thank you. Our moderation team will review this report within 24 hours.'
      );

      if (alsoBlock && navigation?.canGoBack()) {
        navigation.goBack();
      }
    } catch (error) {
      Alert.alert('Error', 'Unable to submit report right now.');
    }
  };

  Alert.alert(
    `Report or Block @${targetUsername || 'User'}`,
    'Select an action to keep TuneHub safe:',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Report Inappropriate Content',
        onPress: () => submitReport('Inappropriate Content / Spam', false),
      },
      {
        text: 'Block & Report User',
        style: 'destructive',
        onPress: () => submitReport('Harassment / Blocked by User', true),
      },
    ]
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0E12',
  },
  topNavHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
    backgroundColor: '#141720',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#222734',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '700',
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
    marginVertical: 14,
  },
  profileImage: {
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 2,
    borderColor: '#FF8C00',
  },
  usernameWithMailIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  username: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  mailIcon: {
    marginLeft: 12,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    maxWidth: 320,
    marginVertical: 14,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  statLabel: {
    fontSize: 13,
    color: '#94A3B8',
  },
  sendFriendRequestButton: {
    backgroundColor: '#10B981',
    paddingVertical: 10,
    paddingHorizontal: 22,
    borderRadius: 20,
    marginTop: 6,
  },
  followButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  tabContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderBottomWidth: 1,
    borderBottomColor: '#242936',
    marginBottom: 14,
  },
  tabItem: {
    paddingVertical: 10,
  },
  activeTabItem: {
    borderBottomWidth: 2,
    borderBottomColor: '#FF8C00',
  },
  tabText: {
    fontSize: 15,
    color: '#94A3B8',
  },
  activeTabText: {
    color: '#FF8C00',
    fontWeight: '700',
  },
  playlistContainer: {
    marginVertical: 16,
    alignItems: 'center',
  },
  songTile: {
    width: 120,
    marginHorizontal: 6,
    backgroundColor: '#161922',
    padding: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#242936',
    alignItems: 'center',
  },
  playlistCover: {
    width: 100,
    height: 100,
    borderRadius: 8,
    marginBottom: 6,
  },
  songTileTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    width: '100%',
    textAlign: 'center',
  },
  songTileArtist: {
    color: '#94A3B8',
    fontSize: 11,
    width: '100%',
    textAlign: 'center',
  },
  musicOfTheDayContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 10,
  },
  musicCover: {
    width: 220,
    height: 220,
    borderRadius: 14,
    marginVertical: 10,
  },
  songTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: 6,
  },
  songArtistSub: {
    fontSize: 14,
    color: '#FF8C00',
    marginTop: 2,
  },
  noMusicText: {
    color: '#94A3B8',
    fontSize: 14,
    marginTop: 14,
    textAlign: 'center',
  },
  memoirContainer: {
    marginVertical: 16,
    paddingHorizontal: 16,
  },
  memoirItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 10,
    padding: 12,
    backgroundColor: '#161922',
    borderRadius: 12,
  },
  coverAndTrackInfoContainer: {
    width: 110,
    alignItems: 'center',
  },
  coverImage: {
    width: 90,
    height: 90,
    borderRadius: 8,
  },
  trackTitle: {
    fontSize: 12,
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: 6,
  },
  commentDisplayContainer: {
    flex: 1,
    paddingLeft: 14,
  },
  commentDisplayText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E2E8F0',
    fontStyle: 'italic',
  },
  taskbarContainer: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    backgroundColor: '#0D1017',
  },
});

export default UserProfileScreen;