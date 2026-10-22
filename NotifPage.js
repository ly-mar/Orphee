// NotifPage.js
import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  Image,
} from 'react-native';
import { db, auth } from './firebaseConfig';
import {
  doc,
  getDoc,
  getDocs,
  query,
  where,
  collection,
  limit,
} from 'firebase/firestore';
import { FontAwesome5 } from '@expo/vector-icons';
import Taskbar from './Taskbar';
import { getHighResImage } from './services/musicApi';

const NotifPage = ({ route, navigation }) => {
  const userId = route?.params?.userId ?? auth.currentUser?.uid;
  const [username, setUsername] = useState('');
  const [records, setRecords] = useState([]);
  const [likedRecords, setLikedRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('activity');
  const usernamesCache = useRef({});

  const fetchUsernameById = async (uid) => {
    if (!uid) return 'Unknown User';
    if (usernamesCache.current[uid]) return usernamesCache.current[uid];
    try {
      const userDoc = await getDoc(doc(db, 'users', uid));
      if (userDoc.exists() && userDoc.data()?.username) {
        usernamesCache.current[uid] = userDoc.data().username;
        return userDoc.data().username;
      }
    } catch (_) { }
    return uid;
  };

  useEffect(() => {
    let isMounted = true;

    const loadNotifications = async () => {
      if (!userId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const myName = await fetchUsernameById(userId);
        if (isMounted) setUsername(myName);

        if (activeTab === 'activity') {
          const dailyRef = collection(db, 'daily');
          const qByUid = query(
            dailyRef,
            where('__name__', '>=', `${userId}_`),
            where('__name__', '<', `${userId}_\uf8ff`),
            limit(30)
          );
          const snap = await getDocs(qByUid);
          const activityItems = [];

          for (const d of snap.docs) {
            const docData = d.data();
            const likedByArray = Array.isArray(docData.likedBy) ? docData.likedBy : [];
            const likesCount = docData.likesCount || likedByArray.length || 0;

            if (likesCount > 0) {
              const likedByNames = await Promise.all(
                likedByArray.slice(0, 5).map((uid) => fetchUsernameById(uid))
              );
              activityItems.push({
                id: d.id,
                date: docData.date || 'Recent',
                artist: docData.music?.artistName || docData.music?.artist || 'Unknown Artist',
                title: docData.music?.trackName || docData.music?.title || 'Unknown Title',
                likesCount,
                likedBy: likedByNames,
                postCreator: myName,
                coverImageUrl:
                  docData.music?.artworkUrl100 || docData.music?.imageUrl || null,
              });
            }
          }
          if (isMounted) setRecords(activityItems);
        } else {
          const dailyRef = collection(db, 'daily');
          const qLiked = query(
            dailyRef,
            where('likedBy', 'array-contains', userId),
            limit(30)
          );
          const snap = await getDocs(qLiked);
          const likedItems = snap.docs.map((d) => {
            const docData = d.data();
            return {
              id: d.id,
              date: docData.date || 'Recent',
              artist: docData.music?.artistName || docData.music?.artist || 'Unknown Artist',
              title: docData.music?.trackName || docData.music?.title || 'Unknown Title',
              likesCount: docData.likesCount || 1,
              postCreator: docData.username || 'Community Member',
              coverImageUrl:
                docData.music?.artworkUrl100 || docData.music?.imageUrl || null,
            };
          });
          if (isMounted) setLikedRecords(likedItems);
        }
      } catch (err) {
        if (isMounted) setError('Could not load activity feed right now.');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadNotifications();
    return () => {
      isMounted = false;
    };
  }, [userId, activeTab]);

  const renderNotificationItem = ({ item }) => (
    <View style={styles.notificationCard}>
      {item.coverImageUrl && (
        <Image
          source={{ uri: getHighResImage(item.coverImageUrl) }}
          style={styles.coverImage}
          resizeMode="cover"
        />
      )}
      <View style={styles.cardBody}>
        <Text style={styles.postCreatorText}>@{item.postCreator}</Text>
        <Text style={styles.dateText}>{item.date}</Text>
        <Text style={styles.titleText}>{item.title}</Text>
        <Text style={styles.artistText}>{item.artist}</Text>
        <Text style={styles.likesText}>❤️ {item.likesCount} Likes</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topHeader}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <FontAwesome5 name="arrow-left" size={14} color="#FFF" />
          <Text style={styles.backBtnText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Notifications</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'activity' && styles.activeTab]}
          onPress={() => setActiveTab('activity')}
        >
          <Text style={styles.tabText}>Activity</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'likedByMe' && styles.activeTab]}
          onPress={() => setActiveTab('likedByMe')}
        >
          <Text style={styles.tabText}>Liked by Me</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#FF8C00" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={
            activeTab === 'activity'
              ? [...records].reverse()
              : [...likedRecords].reverse()
          }
          keyExtractor={(item) => item.id}
          renderItem={renderNotificationItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No notifications in this tab yet.</Text>
          }
        />
      )}

      {error && <Text style={styles.errorText}>{error}</Text>}

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
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1F2430',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1E29',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 6,
  },
  backBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  tabs: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginVertical: 14,
    gap: 10,
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 22,
    borderRadius: 10,
    backgroundColor: '#161922',
    borderWidth: 1,
    borderColor: '#242936',
  },
  activeTab: {
    backgroundColor: '#FF8C00',
    borderColor: '#FF8C00',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 90,
  },
  notificationCard: {
    flexDirection: 'row',
    backgroundColor: '#161922',
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#242936',
    alignItems: 'center',
  },
  coverImage: {
    width: 68,
    height: 68,
    borderRadius: 8,
    marginRight: 12,
  },
  cardBody: {
    flex: 1,
  },
  postCreatorText: {
    color: '#FF8C00',
    fontSize: 13,
    fontWeight: '700',
  },
  dateText: {
    fontSize: 11,
    color: '#718096',
    marginBottom: 4,
  },
  titleText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  artistText: {
    fontSize: 13,
    color: '#CBD5E1',
  },
  likesText: {
    fontSize: 12,
    color: '#F87171',
    marginTop: 4,
    fontWeight: '600',
  },
  emptyText: {
    color: '#718096',
    textAlign: 'center',
    marginTop: 40,
    fontSize: 14,
  },
  errorText: {
    color: '#F87171',
    textAlign: 'center',
    marginTop: 10,
  },
  taskbarContainer: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    backgroundColor: '#0D1017',
  },
});

export default NotifPage;