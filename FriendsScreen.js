import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import { queryFriendsOrRequests, acceptFriendRequest, rejectOrCancelRequest, unfriendUser, fetchUserDetails } from './HandlingFriends';
import { auth, db } from './firebaseConfig';
import { doc, onSnapshot } from 'firebase/firestore';
import { subscribeSafeSnapshot } from './firestoreListenerUtils';
import { useNavigation } from '@react-navigation/native';
import { FontAwesome5 } from '@expo/vector-icons';
import { UserAvatar } from './utils/avatarUtils';

const FriendsScreen = ({ route }) => {
  const userId = route?.params?.userId ?? auth.currentUser?.uid;
  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [sentRequests, setSentRequests] = useState([]);
  const [receivedRequests, setReceivedRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('followers');
  const [currentUsername, setCurrentUsername] = useState('');
  const navigation = useNavigation();

  useEffect(() => {
    const fetchUsername = async () => {
      try {
        const userData = await fetchUserDetails(userId);
        setCurrentUsername(userData.username);
      } catch (error) {
        console.error('Error fetching username:', error);
      }
    };
    fetchUsername();
  }, [userId]);

    const fetchData =  async ()  => {
      try {
        const { followers, following, sentRequests, receivedRequests } = await queryFriendsOrRequests(userId);
        setFollowers(followers);
        setFollowing(following);
        setSentRequests(sentRequests);
        setReceivedRequests(receivedRequests);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching friends and requests:', error);
        setLoading(false);
      }
    };

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    return subscribeSafeSnapshot({
      isReady: Boolean(userId),
      buildQuery: () => doc(db, 'requests', userId),
      onSnapshotFn: onSnapshot,
      onNext: (snapshot) => {
        if (snapshot && typeof snapshot.data === 'function') {
          const data = snapshot.data() || {};
          const {
            followers = {},
            following = {},
            sentRequests = {},
            receivedRequests = {}
          } = data;
          setFollowers(Object.entries(followers));
          setFollowing(Object.entries(following));
          setSentRequests(Object.entries(sentRequests));
          setReceivedRequests(Object.entries(receivedRequests));
        } else {
          setFollowers([]);
          setFollowing([]);
          setSentRequests([]);
          setReceivedRequests([]);
        }
        setLoading(false);
      },
      onError: (err) => {
        if (err?.code !== 'permission-denied') {
          console.warn('FriendsScreen snapshot error:', err);
        }
        fetchData();
      },
    });
  }, [userId]);

  const handleAcceptRequest = async (userId, requesterUid) => {
    await acceptFriendRequest(userId, requesterUid);
    fetchData();
  };

  const handleRejectOrCancelRequest = async (userId, otherUid, isRejecting = true) => {
    await rejectOrCancelRequest(userId, otherUid, isRejecting);
    fetchData();
  };

  const handleunfriend = (currentUid, otherUid, targetUsername) => {
    const label = targetUsername ? `@${targetUsername}` : 'this connection';
    Alert.alert(
      'Remove Connection',
      `Are you sure you want to unfriend ${label}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unfriend',
          style: 'destructive',
          onPress: async () => {
            await unfriendUser(currentUid, otherUid);
            fetchData();
          },
        },
      ]
    );
  };

  const navigateToUserProfile = (targetUid) => {
    if (targetUid === auth.currentUser?.uid) {
      navigation.navigate('Profile');
    } else {
      navigation.navigate('UserProfile', { userId: targetUid });
    }
  };

  const defaultAvatar = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120';

  const getEmptyStateForTab = () => {
    if (activeTab === 'followers') {
      return {
        icon: 'user-friends',
        title: 'No Friends Yet',
        subtitle: 'Connect with kindred listeners from Vibe Check and Affinity Radar.',
      };
    }
    if (activeTab === 'following') {
      return {
        icon: 'compass',
        title: 'Not Following Anyone Yet',
        subtitle: 'Explore Affinity Radar or Search Users to follow listeners who match your vibe.',
      };
    }
    if (activeTab === 'sentRequests') {
      return {
        icon: 'paper-plane',
        title: 'No Pending Sent Requests',
        subtitle: 'Connection requests you send will stay listed here until they are accepted.',
      };
    }
    return {
      icon: 'inbox',
      title: 'No Incoming Requests',
      subtitle: 'You are all caught up. New friend requests from the community will appear here.',
    };
  };

  // Render functions
  const renderFollowerItem = ({ item }) => (
    <View style={styles.itemContainer}>
      <TouchableOpacity
        style={styles.userInfoRow}
        onPress={() => navigateToUserProfile(item[0])}
      >
        <UserAvatar
          imageUrl={item[1]?.profileImageUrl}
          name={item[1]?.username || 'Listener'}
          size={44}
          style={styles.userThumbnail}
        />
        <Text style={styles.itemText}>{item[1]?.username || 'Listener'}</Text>
      </TouchableOpacity>
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.unfriendButton}
          onPress={() => handleunfriend(userId, item[0], item[1]?.username)}
        >
          <Text style={styles.unfriendButtonText}>Unfriend</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderFollowingItem = ({ item }) => (
    <View style={styles.itemContainer}>
      <TouchableOpacity
        style={styles.userInfoRow}
        onPress={() => navigateToUserProfile(item[0])}
      >
        <UserAvatar
          imageUrl={item[1]?.profileImageUrl}
          name={item[1]?.username || 'Listener'}
          size={44}
          style={styles.userThumbnail}
        />
        <Text style={styles.itemText}>{item[1]?.username || 'Listener'}</Text>
      </TouchableOpacity>
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.unfriendButton}
          onPress={() => handleunfriend(userId, item[0], item[1]?.username)}
        >
          <Text style={styles.unfriendButtonText}>Unfriend</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderSentRequestItem = ({ item }) => (
    <View style={styles.itemContainer}>
      <TouchableOpacity
        style={styles.userInfoRow}
        onPress={() => navigateToUserProfile(item[0])}
      >
        <UserAvatar
          imageUrl={item[1]?.profileImageUrl}
          name={item[1]?.username || 'User'}
          size={44}
          style={styles.userThumbnail}
        />
        <Text style={styles.itemText}>{item[1]?.username || 'User'}</Text>
      </TouchableOpacity>
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => handleRejectOrCancelRequest(userId, item[0], false)}
        >
          <Text style={styles.cancelButtonText}>Cancel Request</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderReceivedRequestItem = ({ item }) => (
    <View style={styles.itemContainer}>
      <TouchableOpacity
        style={styles.userInfoRow}
        onPress={() => navigateToUserProfile(item[0])}
      >
        <UserAvatar
          imageUrl={item[1]?.profileImageUrl}
          name={item[1]?.username || 'User'}
          size={44}
          style={styles.userThumbnail}
        />
        <Text style={styles.itemText}>{item[1]?.username || 'User'}</Text>
      </TouchableOpacity>
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.acceptButton}
          onPress={() => handleAcceptRequest(userId, item[0])}
        >
          <Text style={styles.acceptButtonText}>Accept</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.rejectButton}
          onPress={() => handleRejectOrCancelRequest(userId, item[0], true)}
        >
          <Text style={styles.rejectButtonText}>Reject</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const emptyMeta = getEmptyStateForTab();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topHeader}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <FontAwesome5 name="arrow-left" size={14} color="#FFFFFF" />
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Friends & Requests</Text>
        <View style={{ width: 64 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {[
          { key: 'followers', label: 'Friends' },
          { key: 'following', label: 'Following' },
          { key: 'sentRequests', label: 'Sent' },
          { key: 'receivedRequests', label: 'Received' },
        ].map((t) => {
          const isActive = activeTab === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              style={[styles.tab, isActive && styles.activeTab]}
              onPress={() => setActiveTab(t.key)}
            >
              <Text style={[styles.tabText, isActive && styles.activeTabText]} numberOfLines={1}>
                {t.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Content */}
      {loading ? (
        <ActivityIndicator size="large" color="#FF8C00" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={
            activeTab === 'followers'
              ? followers
              : activeTab === 'following'
              ? following
              : activeTab === 'sentRequests'
              ? sentRequests
              : receivedRequests
          }
          keyExtractor={(item) => item[0]}
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 32 }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconBadge}>
                <FontAwesome5 name={emptyMeta.icon} size={24} color="#FF8C00" />
              </View>
              <Text style={styles.emptyTitle}>{emptyMeta.title}</Text>
              <Text style={styles.emptySubtitle}>{emptyMeta.subtitle}</Text>
            </View>
          }
          renderItem={
            activeTab === 'followers'
              ? renderFollowerItem
              : activeTab === 'following'
              ? renderFollowingItem
              : activeTab === 'sentRequests'
              ? renderSentRequestItem
              : renderReceivedRequestItem
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0C10',
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#151821',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  backButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 6,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F8FAFC',
    textAlign: 'center',
  },
  userInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  userThumbnail: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
    backgroundColor: '#1E2433',
    borderWidth: 1,
    borderColor: 'rgba(255,140,0,0.45)',
  },
  tabs: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: 14,
    marginVertical: 14,
    gap: 8,
  },
  tab: {
    flex: 1,
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 12,
    backgroundColor: '#151821',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  activeTab: {
    backgroundColor: '#FF8C00',
    borderColor: '#FF8C00',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94A3B8',
    textAlign: 'center',
  },
  activeTabText: {
    color: '#0A0C10',
  },
  itemContainer: {
    backgroundColor: '#151821',
    padding: 14,
    borderRadius: 14,
    marginVertical: 6,
    marginHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  itemText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 48,
  },
  emptyIconBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 140, 0, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 140, 0, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    color: '#F8FAFC',
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
  },
  emptySubtitle: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  unfriendButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    paddingVertical: 10,
    borderRadius: 10,
    flex: 1,
  },
  unfriendButtonText: {
    color: '#FCA5A5',
    fontWeight: '700',
    textAlign: 'center',
    fontSize: 13,
  },
  cancelButton: {
    backgroundColor: '#1E2433',
    borderWidth: 1,
    borderColor: 'rgba(255,140,0,0.45)',
    paddingVertical: 10,
    borderRadius: 10,
    flex: 1,
  },
  cancelButtonText: {
    color: '#FF8C00',
    fontWeight: '700',
    textAlign: 'center',
    fontSize: 13,
  },
  acceptButton: {
    backgroundColor: '#10B981',
    paddingVertical: 10,
    borderRadius: 10,
    flex: 1,
  },
  acceptButtonText: {
    color: '#0A0C10',
    fontWeight: '800',
    textAlign: 'center',
    fontSize: 13,
  },
  rejectButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    paddingVertical: 10,
    borderRadius: 10,
    flex: 1,
  },
  rejectButtonText: {
    color: '#FCA5A5',
    fontWeight: '700',
    textAlign: 'center',
    fontSize: 13,
  },
});

export default FriendsScreen;
