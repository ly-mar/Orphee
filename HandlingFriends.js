import { doc, getDoc, updateDoc, deleteField, setDoc, onSnapshot } from 'firebase/firestore';
import { db, auth } from './firebaseConfig';
import { Alert } from 'react-native';
import { subscribeSafeSnapshot } from './firestoreListenerUtils';
import { toast } from './crossPlatformAlert';

// Helper function to fetch user details by userId
export const fetchUserDetails = async (userId) => {
  const userRef = doc(db, 'users', userId);
  const userDoc = await getDoc(userRef);

  if (!userDoc.exists()) {
    throw new Error("User not found");
  }

  return userDoc.data();
};

// Send a friend request
export const sendFriendRequest = async (userId, selectedUsername) => {
  try {
    const currentUserId = auth.currentUser?.uid;
    if (!currentUserId) {
      throw new Error('Current user not authenticated.');
    }

    // Fetch current user's username from Firestore
    const currentUserData = await fetchUserDetails(currentUserId);
    const currentUsername = currentUserData.username;

    const currentUserRef = doc(db, 'requests', currentUserId);
    const userRef = doc(db, 'requests', userId);

    // Initialize documents if they don't exist
    const [currentUserDoc, userDoc] = await Promise.all([getDoc(currentUserRef), getDoc(userRef)]);

    if (!currentUserDoc.exists()) {
      await setDoc(currentUserRef, {
        sentRequests: {},
        receivedRequests: {},
        followers: {},
        following: {}
      });
    }

    if (!userDoc.exists()) {
      await setDoc(userRef, {
        sentRequests: {},
        receivedRequests: {},
        followers: {},
        following: {}
      });
    }

    // Check if request has already been sent or user is already a friend
    if (currentUserDoc.data()?.sentRequests?.[userId]) {
      Alert.alert("Info", `You've already sent a request to ${selectedUsername}.`);
      return;
    }

    if (currentUserDoc.data()?.allFriends?.[userId]) {
      Alert.alert("Info", "This user is already your friend.");
      return;
    }

    // Add the friend request
    await updateDoc(currentUserRef, {
      [`sentRequests.${userId}`]: {
        uid: userId,
        username: selectedUsername,
      },
    });

    await updateDoc(userRef, {
      [`receivedRequests.${currentUserId}`]: {
        uid: currentUserId,
        username: currentUsername,
      },
    });

    toast.show({ kind: 'success', message: `Friend request sent to ${selectedUsername}.` });

    await sendExpoPushNotification(
      userId,
      'New Music Twin Request!',
      `@${currentUsername} sent you a friend request on TuneHub.`
    );

  } catch (error) {
    console.error('Error sending friend request:', error);
    Alert.alert("Error", "Failed to send friend request.");
  }
};

// Accept a friend request
export const acceptFriendRequest = async (userId, requesterUid) => {
  try {
    const currentUserId = auth.currentUser?.uid;
    // Fetch current user's username from Firestore
    const currentUserData = await fetchUserDetails(currentUserId);
    const currentUsername = currentUserData.username;

    const currentUserRef = doc(db, 'requests', userId);
    const requesterRef = doc(db, 'requests', requesterUid);

    const currentUserDoc = await getDoc(currentUserRef);
    const requesterDoc = await getDoc(requesterRef);

    const { receivedRequests = {}, followers = {} } = currentUserDoc.exists() ? currentUserDoc.data() : {};
    const { sentRequests = {}, following = {} } = requesterDoc.exists() ? requesterDoc.data() : {};

    const requesterData = receivedRequests[requesterUid];

    if (requesterData) {
      // Move from receivedRequests to followers
      await updateDoc(currentUserRef, {
        [`followers.${requesterUid}`]: requesterData,
        [`receivedRequests.${requesterUid}`]: deleteField(),
      });

      // Move from sentRequests to following
      await updateDoc(requesterRef, {
        [`following.${userId}`]: {
          uid: userId,
          username: currentUsername,
        },
        [`sentRequests.${userId}`]: deleteField(),
      });

      Alert.alert("Success", "Friend request accepted.");
    }
  } catch (error) {
    console.error('Error accepting friend request:', error);
    Alert.alert("Error", "Failed to accept friend request.");
  }
};

// Reject or cancel a friend request
export const rejectOrCancelRequest = async (userId, otherUid, isRejecting = true) => {
  try {
    const currentUserRef = doc(db, 'requests', userId);
    const otherUserRef = doc(db, 'requests', otherUid);

    if (isRejecting) {
      // Remove from receivedRequests
      await updateDoc(currentUserRef, {
        [`receivedRequests.${otherUid}`]: deleteField(),
      });

      // Remove from sentRequests for the other user
      await updateDoc(otherUserRef, {
        [`sentRequests.${userId}`]: deleteField(),
      });

      Alert.alert("Success", "Friend request rejected.");
    } else {
      // Remove from sentRequests
      await updateDoc(currentUserRef, {
        [`sentRequests.${otherUid}`]: deleteField(),
      });

      // Remove from receivedRequests for the other user
      await updateDoc(otherUserRef, {
        [`receivedRequests.${userId}`]: deleteField(),
      });

      Alert.alert("Success", "Friend request canceled.");
    }
  } catch (error) {
    console.error(`Error ${isRejecting ? 'rejecting' : 'canceling'} friend request:`, error);
    Alert.alert("Error", `Failed to ${isRejecting ? 'reject' : 'cancel'} friend request.`);
  }
};

// Unfriend a user
export const unfriendUser = async (userId, friendUid) => {
  try {
    const currentUserRef = doc(db, 'requests', userId);
    const friendRef = doc(db, 'requests', friendUid);

    // Remove from both followers and following
    await updateDoc(currentUserRef, {
      [`followers.${friendUid}`]: deleteField(),
      [`following.${friendUid}`]: deleteField(),
    });

    await updateDoc(friendRef, {
      [`followers.${userId}`]: deleteField(),
      [`following.${userId}`]: deleteField(),
    });

    Alert.alert("Success", "You have unfriended the user.");
  } catch (error) {
    console.error('Error unfriending user:', error);
    Alert.alert("Error", "Failed to unfriend user.");
  }
};

// Query for friends or requests
export const queryFriendsOrRequests = async (userId) => {
  try {
    const requestsRef = doc(db, 'requests', userId);
    const requestsDoc = await getDoc(requestsRef);

    if (requestsDoc.exists()) {
      const {
        followers = {},
        following = {},
        sentRequests = {},
        receivedRequests = {}
      } = requestsDoc.data();

      return {
        followers: Object.entries(followers),
        following: Object.entries(following),
        sentRequests: Object.entries(sentRequests),
        receivedRequests: Object.entries(receivedRequests),
      };
    }
    return { followers: [], following: [], sentRequests: [], receivedRequests: [] };
  } catch (error) {
    console.error('Error querying friends or requests:', error);
    Alert.alert("Error", "Failed to fetch friends or requests.");
    return { followers: [], following: [], sentRequests: [], receivedRequests: [] };
  }
};

// Push Notification helper (included in HandlingFriends.js & ChatScreen.js)
export async function sendExpoPushNotification(targetUserId, title, body, data = {}) {
  if (!targetUserId) return;
  try {
    const targetDoc = await getDoc(doc(db, 'users', targetUserId));
    const pushToken = targetDoc.exists() ? targetDoc.data()?.pushToken : null;
    if (!pushToken || !pushToken.startsWith('ExponentPushToken')) return;

    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: pushToken,
        sound: 'default',
        title,
        body,
        data,
      }),
    });
  } catch (_) { }
}

// Subscribe to real-time friend requests with safe unmount/logout teardown [BUG-009]
export function subscribeUserRequests(userId, onUpdate, onError) {
  return subscribeSafeSnapshot({
    isReady: Boolean(userId),
    buildQuery: () => doc(db, 'requests', userId),
    onSnapshotFn: onSnapshot,
    onNext: (snapshot) => {
      if (snapshot && typeof snapshot.data === 'function') {
        const {
          followers = {},
          following = {},
          sentRequests = {},
          receivedRequests = {},
        } = snapshot.data() || {};
        onUpdate?.({
          followers: Object.entries(followers),
          following: Object.entries(following),
          sentRequests: Object.entries(sentRequests),
          receivedRequests: Object.entries(receivedRequests),
        });
      } else {
        onUpdate?.({ followers: [], following: [], sentRequests: [], receivedRequests: [] });
      }
    },
    onError: (err) => {
      if (err?.code !== 'permission-denied') {
        console.warn('subscribeUserRequests error:', err);
        onError?.(err);
      }
    },
  });
}
