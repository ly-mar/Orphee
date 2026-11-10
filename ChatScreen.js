// ChatScreen.js
import React, { useState, useEffect } from 'react';
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
  doc,
  setDoc,
} from 'firebase/firestore';
import { loadUserProfilePic } from './UploadProfilePicture';
import { FontAwesome5 } from '@expo/vector-icons';
import { subscribeSafeSnapshot } from './firestoreListenerUtils';

const DEFAULT_AVATAR =
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120';

const ChatScreen = ({ route, navigation }) => {
  const { chatId, username = 'User', otherUserId: routeOtherId } = route?.params || {};
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [userProfilePic, setUserProfilePic] = useState(DEFAULT_AVATAR);
  const [otherUserId, setOtherUserId] = useState(routeOtherId || null);
  const userId = auth.currentUser?.uid;

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

  const sendMessage = async () => {
    if (!message.trim() || !chatId || !userId) return;

    const textToSend = message.trim();
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
      const messagesRef = collection(db, 'chats', chatId, 'messages');
      await addDoc(messagesRef, {
        text: textToSend,
        timestamp: Date.now(),
        userId,
      });
    } catch (error) {
      console.error('Error sending message:', error);
    }
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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <FontAwesome5 name="chevron-left" size={18} color="#FFFFFF" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.recipientRow}
          onPress={() => {
            if (otherUserId) {
              navigation.navigate('UserProfile', { userId: otherUserId });
            }
          }}
        >
          <Image
            source={{ uri: userProfilePic || DEFAULT_AVATAR }}
            style={styles.profileImage}
          />
          <Text style={styles.username}>@{username}</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 14 }}
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
          onSubmitEditing={sendMessage}
        />
        <TouchableOpacity onPress={sendMessage} style={styles.sendButton}>
          <Text style={styles.sendButtonText}>Send</Text>
        </TouchableOpacity>
      </View>
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
    flexDirection: 'row',
    alignItems: 'center',
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