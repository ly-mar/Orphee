import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { queryFriendsOrRequests, acceptFriendRequest, rejectOrCancelRequest, unfriendUser, fetchUserDetails } from './HandlingFriends';
import { auth } from './firebaseConfig';
import { useNavigation } from '@react-navigation/native';
import { FontAwesome5 } from '@expo/vector-icons';

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
    fetchData();
  }, [userId]);

  const handleAcceptRequest = async (userId, requesterUid) => {
    await acceptFriendRequest(userId, requesterUid);
    fetchData();
  };

  const handleRejectOrCancelRequest = async (userId, otherUid, isRejecting = true) => {
    await rejectOrCancelRequest(userId, otherUid, isRejecting);
    fetchData();
  };

  const handleunfriend = async (userId, otherUid) => {
    await unfriendUser(userId, otherUid);
    fetchData();
  };

  const navigateToUserProfile = (targetUid) => {
    if (targetUid === auth.currentUser?.uid) {
      navigation.navigate('Profile');
    } else {
      navigation.navigate('UserProfile', { userId: targetUid });
    }
  };

  const defaultAvatar = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120';

  // Render functions
  const renderFollowerItem = ({ item }) => (
    <View style={styles.itemContainer}>
      <TouchableOpacity
        style={styles.userInfoRow}
        onPress={() => navigateToUserProfile(item[0])}
      >
        <Image
          source={{ uri: item[1]?.profileImageUrl || defaultAvatar }}
          style={styles.userThumbnail}
        />
        <Text style={styles.itemText}>{item[1]?.username || 'User'}</Text>
      </TouchableOpacity>
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.unfriendButton}
          onPress={() => handleunfriend(userId, item[0])}
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
        <Image
          source={{ uri: item[1]?.profileImageUrl || defaultAvatar }}
          style={styles.userThumbnail}
        />
        <Text style={styles.itemText}>{item[1]?.username || 'User'}</Text>
      </TouchableOpacity>
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.unfriendButton}
          onPress={() => handleunfriend(userId, item[0])}
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
        <Image
          source={{ uri: item[1]?.profileImageUrl || defaultAvatar }}
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
        <Image
          source={{ uri: item[1]?.profileImageUrl || defaultAvatar }}
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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topHeader}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <FontAwesome5 name="arrow-left" size={16} color="#111" />
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Friends & Requests</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'followers' && styles.activeTab]}
          onPress={() => setActiveTab('followers')}
        >
          <Text style={styles.tabText}>Followers</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'following' && styles.activeTab]}
          onPress={() => setActiveTab('following')}
        >
          <Text style={styles.tabText}>Following</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'sentRequests' && styles.activeTab]}
          onPress={() => setActiveTab('sentRequests')}
        >
          <Text style={styles.tabText}>Sent</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'receivedRequests' && styles.activeTab]}
          onPress={() => setActiveTab('receivedRequests')}
        >
          <Text style={styles.tabText}>Received</Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {loading ? (
        <ActivityIndicator size="large" color="#CC3639" />
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
          keyExtractor={(item) => item[0]}  // Assuming item[0] contains unique userId
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
    backgroundColor: '#ffeded',
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111',
    marginLeft: 6,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: 'black',
    textAlign: 'center',
  },
  userInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  userThumbnail: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
    backgroundColor: '#ddd',
  },
  tabs: {
    flexDirection: 'row',
    justifyContent: 'space-between', // Spread the tabs evenly across the screen
    flexWrap: 'wrap',  // Allow wrapping of tabs to avoid overflow
    marginHorizontal: 10,
    marginVertical: 10,
  },
  tab: {
    flex: 1,  // Distribute space equally for each tab
    paddingVertical: 8,
    paddingHorizontal: 5,
    borderRadius: 10,
    backgroundColor: '#e0e0e0',
    marginHorizontal: 2,
    textAlign: 'center',
  },
  activeTab: {
    backgroundColor: '#CC3639',
  },
  tabText: {
    fontSize: 14,  // Adjust text size to fit better
    fontWeight: '600',
    color: '#ffffff',
    textAlign: 'center',
  },
  itemContainer: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginVertical: 10,
    marginHorizontal: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 2,
  },
  itemText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  unfriendButton: {
    backgroundColor: '#FF6347',  // Tomato color
    padding: 10,
    borderRadius: 5,
    flex: 1,
    marginHorizontal: 5,
  },
  unfriendButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  cancelButton: {
    backgroundColor: '#FFA500',  // Orange color
    padding: 10,
    borderRadius: 5,
    flex: 1,
    marginHorizontal: 5,
  },
  cancelButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  acceptButton: {
    backgroundColor: '#4CAF50',  // Green color
    padding: 10,
    borderRadius: 5,
    flex: 1,
    marginHorizontal: 5,
  },
  acceptButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  rejectButton: {
    backgroundColor: '#FF6347',  // Red color
    padding: 10,
    borderRadius: 5,
    flex: 1,
    marginHorizontal: 5,
  },
  rejectButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

export default FriendsScreen;
