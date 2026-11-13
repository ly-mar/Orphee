// ChatScreen.js
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  SafeAreaView,
  TextInput,
  FlatList,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
import { db, auth } from './firebaseConfig';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  getDoc,
  setDoc,
  doc,
} from 'firebase/firestore';
import { loadUserProfilePic } from './UploadProfilePicture';
import { sendExpoPushNotification } from './HandlingFriends';
import { FontAwesome5 } from '@expo/vector-icons';
import { subscribeSafeSnapshot } from './firestoreListenerUtils';
import { createAsyncActionLock } from './utils/actionLockUtils';
import {
  validateOutgoingChatMessage,
  buildLastMessageUpdate,
  MAX_CHAT_MESSAGE_LENGTH,
} from './utils/chatMessageUtils';
import { UserAvatar } from './utils/avatarUtils';
import UserModerationModal from './UserModerationModal';

const DEFAULT_AVATAR =
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120';

const ChatScreen = ({ route, navigation }) => {
  const { chatId, username = 'User', otherUserId: routeOtherId } = route?.params || {};
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [userProfilePic, setUserProfilePic] = useState(DEFAULT_AVATAR);
  const [otherUserId, setOtherUserId] = useState(routeOtherId || null);
  const [moderationVisible, setModerationVisible] = useState(false);
  const userId = auth.currentUser?.uid;
  const sendLockRef = useRef(createAsyncActionLock());

  // 1. Dedicated real-time messages listener with deterministic teardown guard [BUG-004]
  useEffect(() => {
    return subscribeSafeSnapshot({
      isReady: Boolean(chatId),
      buildQuery: () => query(collection(db, 'chats', chatId, 'messages'), orderBy('timestamp', 'asc')),
      onSnapshotFn: onSnapshot,
      onNext: (snapshot) => {
        const chatMessages = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        setMessages(chatMessages);
      },
      onError: (err) => {
        console.warn('Error listening to messages:', err.message);
      },
    });
  }, [chatId]);

  // 2. Single-pass participant & avatar resolution
  useEffect(() => {
    if (!chatId) return;

    const resolveParticipant = async () => {
      try {
        let targetId = routeOtherId;

        if (!targetId) {
          const chatDoc = await getDoc(doc(db, 'chats', chatId));
          if (chatDoc.exists()) {
            const data = chatDoc.data();
            if (Array.isArray(data.participants)) {
              targetId = data.participants.find((id) => id !== userId);
            } else if (typeof data.chatId === 'string') {
              targetId = data.chatId.split('_').find((id) => id !== userId);
            }
          }
        }

        if (targetId) {
          setOtherUserId(targetId);
          const pic = await loadUserProfilePic(targetId);
          setUserProfilePic(pic);
        }
      } catch (error) {
        console.warn('Error resolving chat participant:', error.message);
      }
    };

    resolveParticipant();
  }, [chatId, routeOtherId, userId]);

  const sendMessage = () => {
    const validation = validateOutgoingChatMessage({
      text: message,
      senderId: userId,
      chatId,
    });
    if (!validation.ok) return;

    const textToSend = validation.payload.text;

    return sendLockRef.current(async () => {
      setMessage('');

      if (otherUserId) {
        sendExpoPushNotification(
          otherUserId,
          `New message from @${auth.currentUser?.displayName || 'Music Twin'}`,
          textToSend,
          { chatId }
        );
      }

      try {
        const now = Date.now();
        const messagesRef = collection(db, 'chats', chatId, 'messages');
        await addDoc(messagesRef, {
          text: textToSend,
          timestamp: now,
          userId,
        });

        const chatDocRef = doc(db, 'chats', chatId);
        await setDoc(
          chatDocRef,
          buildLastMessageUpdate({ text: textToSend, senderId: userId, timestamp: now }),
          { merge: true }
        );
      } catch (error) {
        console.error('Error sending message:', error);
      }
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          accessibilityLabel="Go back"
        >
          <FontAwesome5 name="chevron-left" size={18} color="#FFFFFF" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.recipientRow}
          onPress={() => {
            if (otherUserId) {
              navigation.navigate('UserProfile', { userId: otherUserId, username });
            }
          }}
        >
          <UserAvatar
            imageUrl={userProfilePic}
            name={username}
            size={36}
            style={styles.profileImage}
          />
          <Text style={styles.username} numberOfLines={1}>@{username}</Text>
        </TouchableOpacity>

        {otherUserId && otherUserId !== userId ? (
          <TouchableOpacity
            style={styles.moderationButton}
            onPress={() => setModerationVisible(true)}
            accessibilityLabel="Report or block user"
          >
            <FontAwesome5 name="ellipsis-h" size={16} color="#E2E8F0" />
          </TouchableOpacity>
        ) : null}
      </View>

      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          { padding: 14 },
          messages.length === 0 && styles.emptyListContent,
        ]}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <FontAwesome5 name="comments" size={28} color="#475569" />
            <Text style={styles.emptyTitle}>No messages yet</Text>
            <Text style={styles.emptySubtitle}>
              Break the ice with @{username} about your favorite tracks.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const isMine = item.userId === userId;
          return (
            <View
              style={[
                styles.messageContainer,
                isMine ? styles.myMessage : styles.otherMessage,
              ]}
            >
              <Text
                style={[
                  styles.messageText,
                  isMine ? styles.myMessageText : styles.otherMessageText,
                ]}
              >
                {item.text}
              </Text>
            </View>
          );
        }}
      />

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Type a message..."
          placeholderTextColor="#718096"
          onChangeText={setMessage}
          value={message}
          maxLength={MAX_CHAT_MESSAGE_LENGTH}
          onSubmitEditing={sendMessage}
        />
        <TouchableOpacity onPress={sendMessage} style={styles.sendButton}>
          <Text style={styles.sendButtonText}>Send</Text>
        </TouchableOpacity>
      </View>

      <UserModerationModal
        visible={moderationVisible}
        onClose={() => setModerationVisible(false)}
        targetUid={otherUserId}
        targetUsername={username}
        onBlockedSuccess={() => {
          if (navigation.canGoBack()) {
            navigation.goBack();
          }
        }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0E12',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1F2430',
    backgroundColor: '#141822',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  recipientRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  moderationButton: {
    width: 40,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#1E2433',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyListContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    color: '#F1F5F9',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 12,
  },
  emptySubtitle: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 19,
  },
  profileImage: {
    width: 42,
    height: 42,
    borderRadius: 21,
    marginRight: 12,
    borderWidth: 1.5,
    borderColor: '#FF8C00',
  },
  username: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  messageContainer: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginVertical: 4,
    borderRadius: 16,
    maxWidth: '78%',
  },
  myMessage: {
    backgroundColor: '#FF8C00',
    alignSelf: 'flex-end',
  },
  otherMessage: {
    backgroundColor: '#1E2433',
    alignSelf: 'flex-start',
  },
  messageText: {
    fontSize: 15,
  },
  myMessageText: {
    color: '#000000',
    fontWeight: '600',
  },
  otherMessageText: {
    color: '#FFFFFF',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: '#1F2430',
    backgroundColor: '#141822',
  },
  input: {
    flex: 1,
    borderColor: '#2D3446',
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 16,
    marginRight: 10,
    height: 42,
    backgroundColor: '#0D0E12',
    color: '#FFFFFF',
  },
  sendButton: {
    backgroundColor: '#FF8C00',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 24,
  },
  sendButtonText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '800',
  },
});

export default ChatScreen;