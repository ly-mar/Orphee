// MainChatScreen.js
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  FlatList,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Image,
  ActivityIndicator,
} from 'react-native';
import { db, auth } from './firebaseConfig';
import { collection, query, where, onSnapshot, getDoc, doc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { FontAwesome5 } from '@expo/vector-icons';

const DEFAULT_AVATAR =
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120';

const MainChatScreen = ({ navigation }) => {
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState(auth.currentUser?.uid || null);
  const userCacheRef = useRef({});

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUserId(user?.uid || null);
      if (!user) setLoading(false);
    });
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    if (!currentUserId) {
      setChats([]);
      setLoading(false);
      return;
    }

    const chatsRef = collection(db, 'chats');
    const q = query(chatsRef, where('participants', 'array-contains', currentUserId));

    const unsubscribe = onSnapshot(
      q,
      async (querySnapshot) => {
        try {
          const chatPromises = querySnapshot.docs.map(async (chatDoc) => {
            const chatData = chatDoc.data();
            const participants = Array.isArray(chatData.participants)
              ? chatData.participants
              : [];
            const otherParticipantId = participants.find(
              (participant) => participant !== currentUserId
            );

            let username = 'Music Lover';
            let profilePicUrl = DEFAULT_AVATAR;

            if (otherParticipantId) {
              if (userCacheRef.current[otherParticipantId]) {
                username = userCacheRef.current[otherParticipantId].username;
                profilePicUrl = userCacheRef.current[otherParticipantId].profilePicUrl;
              } else {
                try {
                  const userDoc = await getDoc(doc(db, 'users', otherParticipantId));
                  if (userDoc.exists()) {
                    const uData = userDoc.data();
                    username = uData.username || otherParticipantId;
                    profilePicUrl = uData.profileImageUrl || DEFAULT_AVATAR;
                  }
                  userCacheRef.current[otherParticipantId] = {
                    username,
                    profilePicUrl,
                  };
                } catch (_) { }
              }
            }

            return {
              id: chatDoc.id,
              ...chatData,
              otherUserId: otherParticipantId,
              username,
              profilePicUrl,
            };
          });

          const chatList = await Promise.all(chatPromises);
          setChats(chatList);
        } catch (error) {
          console.error('Error fetching chat data:', error);
        } finally {
          setLoading(false);
        }
      },
      (err) => {
        console.warn('Chat listener error:', err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [currentUserId]);

  const openChat = (chatId, username, otherUserId) => {
    navigation.navigate('ChatScreen', { chatId, username, otherUserId });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerContainer}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <FontAwesome5 name="arrow-left" size={16} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerText}>Direct Messages</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#FF8C00" style={{ marginTop: 40 }} />
      ) : chats.length === 0 ? (
        <Text style={styles.noChatsText}>
          No active conversations yet. Visit a Music Twin's profile to say hello!
        </Text>
      ) : (
        <FlatList
          data={chats}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => openChat(item.id, item.username, item.otherUserId)}
              style={styles.chatCard}
            >
              <Image
                source={{ uri: item.profilePicUrl || DEFAULT_AVATAR }}
                style={styles.chatAvatar}
              />
              <View style={styles.chatDetails}>
                <Text style={styles.chatName}>@{item.username}</Text>
                <Text style={styles.lastMessage}>Tap to open conversation</Text>
              </View>
              <FontAwesome5 name="chevron-right" size={14} color="#718096" />
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0E12',
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1F2430',
  },
  backButton: {
    backgroundColor: '#1A1E29',
    padding: 10,
    borderRadius: 10,
  },
  headerText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  chatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161922',
    padding: 14,
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#242936',
  },
  chatAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 14,
    borderWidth: 1.5,
    borderColor: '#FF8C00',
  },
  chatDetails: {
    flex: 1,
  },
  chatName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  lastMessage: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  noChatsText: {
    textAlign: 'center',
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 40,
    paddingHorizontal: 32,
    lineHeight: 20,
  },
});

export default MainChatScreen;