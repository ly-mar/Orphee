// NotifPage.js — Canonical Orphee Notifications & Co-Sign Alerts [WS-04]
import React, { useEffect, useState, useRef, useMemo } from 'react';
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
  onSnapshot,
} from 'firebase/firestore';
import { FontAwesome5, Feather } from '@expo/vector-icons';
import moment from 'moment';
import { getHighResImage } from './services/musicApi';
import { subscribeSafeSnapshot } from './firestoreListenerUtils';
import { NOTIF_FILTERS, filterNotifications } from './utils/notificationPrefsUtils';

export { NOTIF_FILTERS, filterNotifications };

const formatNotificationTimestamp = (rawDate) => {
  if (!rawDate || rawDate === 'Recent') return 'Recently';
  if (rawDate?.seconds) {
    const m = moment(rawDate.seconds * 1000);
    return m.isValid() ? m.fromNow() : 'Recently';
  }
  const str = String(rawDate).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const parsed = moment(str, 'YYYY-MM-DD', true);
    return parsed.isValid() ? parsed.format('MMM D, YYYY') : str;
  }
  const parsed = moment(str);
  return parsed.isValid() ? parsed.fromNow() : str;
};

const NotifPage = ({ route, navigation }) => {
  const userId = route?.params?.userId ?? auth.currentUser?.uid;
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all');
  const usernamesCache = useRef({});

  useEffect(() => {
    const uid = userId;
    return subscribeSafeSnapshot({
      isReady: Boolean(uid),
      buildQuery: () => doc(db, 'requests', uid),
      onSnapshotFn: onSnapshot,
      onNext: (_snapshot) => {
        // Keeps user aware of real-time incoming requests / notifications safely
      },
      onError: (err) => {
        if (err?.code !== 'permission-denied') {
          console.warn('Notification snapshot error:', err);
        }
      },
    });
  }, [userId]);

  const fetchUsernameById = async (uid) => {
    if (!uid) return 'Listener';
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
        const notifList = [];

        // 1. Primary: Fetch real notifications from 'notifications' collection
        try {
          const notifQuery = query(
            collection(db, 'notifications'),
            where('recipientId', '==', userId),
            limit(50)
          );
          const snap = await getDocs(notifQuery);
          snap.forEach((d) => {
            const data = d.data();
            notifList.push({
              id: d.id,
              type: data.type || 'cosign',
              title: data.title || (data.type === 'cosign' ? 'Collective Co-Sign' : 'Notification'),
              message: data.message || data.body || '',
              senderUsername: data.senderUsername || data.fromUsername || 'Community Member',
              senderUid: data.senderUid || data.fromUid || null,
              coverImageUrl: data.coverImageUrl || data.imageUrl || null,
              date: data.createdAt || data.timestamp || 'Recent',
              read: Boolean(data.read),
              ...data,
            });
          });
        } catch (_) { }

        // 2. Fetch pending friend / Vibe Match requests from requests/{userId}
        try {
          const reqSnap = await getDoc(doc(db, 'requests', userId));
          if (reqSnap.exists()) {
            const received = reqSnap.data()?.receivedRequests || {};
            for (const [senderUid, reqData] of Object.entries(received)) {
              notifList.push({
                id: `req_${senderUid}`,
                type: 'friend_request',
                title: 'Vibe Match Request',
                message: `@${reqData.username || 'Listener'} wants to connect and compare signature tracks.`,
                senderUsername: reqData.username || 'Listener',
                senderUid,
                date: reqData.timestamp || 'Recent',
                isPendingRequest: true,
              });
            }
          }
        } catch (_) { }

        // Sort newest first
        notifList.sort((a, b) => {
          const getSec = (item) => {
            if (item.date?.seconds) return item.date.seconds;
            if (item.timestamp?.seconds) return item.timestamp.seconds;
            const parsed = new Date(item.date || item.createdAt || 0).getTime();
            return Number.isFinite(parsed) ? Math.floor(parsed / 1000) : 0;
          };
          return getSec(b) - getSec(a);
        });

        if (isMounted) {
          setNotifications(notifList);
        }
      } catch (err) {
        if (isMounted) setError('Could not load notifications right now.');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadNotifications();
    return () => {
      isMounted = false;
    };
  }, [userId]);

  const displayedNotifications = useMemo(() => {
    return filterNotifications(notifications, activeFilter);
  }, [notifications, activeFilter]);

  const handleCardPress = (item) => {
    if (item.type === 'friend_request' && item.senderUid) {
      navigation.navigate('UserProfileScreen', { userId: item.senderUid });
    } else if (item.type === 'cosign') {
      navigation.navigate('TheCollective');
    } else if (item.type === 'chat' && item.chatId) {
      navigation.navigate('ChatScreen', { chatId: item.chatId });
    }
  };

  const renderNotificationItem = ({ item }) => {
    const isCosign = item.type === 'cosign';
    const isFriendReq = item.type === 'friend_request';

    return (
      <TouchableOpacity
        style={styles.notificationCard}
        onPress={() => handleCardPress(item)}
        activeOpacity={0.85}
      >
        {item.coverImageUrl ? (
          <Image
            source={{ uri: getHighResImage(item.coverImageUrl) }}
            style={styles.coverImage}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.coverFallback, isCosign && styles.coverFallbackCosign]}>
            <FontAwesome5
              name={isCosign ? 'record-vinyl' : isFriendReq ? 'user-friends' : 'bell'}
              size={18}
              color={isCosign ? '#D4F458' : isFriendReq ? '#FF8C00' : '#94A3B8'}
            />
          </View>
        )}

        <View style={styles.cardBody}>
          <View style={styles.topMetaRow}>
            <Text style={styles.senderText}>
              @{item.senderUsername || 'Listener'}
            </Text>
            <Text style={styles.dateText}>{formatNotificationTimestamp(item.date)}</Text>
          </View>

          <Text style={styles.titleText}>{item.title}</Text>
          {Boolean(item.message) && (
            <Text style={styles.messageText} numberOfLines={2}>
              {item.message}
            </Text>
          )}

          {isCosign && (
            <View style={styles.badgePillCosign}>
              <Feather name="zap" size={11} color="#0B0C10" />
              <Text style={styles.badgePillCosignText}>Collective Co-Sign</Text>
            </View>
          )}
          {isFriendReq && (
            <View style={styles.badgePillFriend}>
              <Feather name="users" size={11} color="#0B0C10" />
              <Text style={styles.badgePillFriendText}>Vibe Connection</Text>
            </View>
          )}
        </View>

        <Feather name="chevron-right" size={18} color="#64748B" style={{ marginLeft: 8 }} />
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topHeader}>
        <TouchableOpacity
          onPress={() => {
            if (navigation.canGoBack()) navigation.goBack();
            else navigation.navigate('Home');
          }}
          style={styles.backBtn}
        >
          <FontAwesome5 name="arrow-left" size={14} color="#FFF" />
          <Text style={styles.backBtnText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Notifications</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Streamlined Filter Pills (All vs Co-Signs & Social) */}
      <View style={styles.filterRow}>
        {NOTIF_FILTERS.map((f) => {
          const isSelected = activeFilter === f.id;
          return (
            <TouchableOpacity
              key={f.id}
              style={[styles.filterPill, isSelected && styles.filterPillActive]}
              onPress={() => setActiveFilter(f.id)}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.filterPillText,
                  isSelected && styles.filterPillTextActive,
                ]}
              >
                {f.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#FF8C00" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={displayedNotifications}
          keyExtractor={(item) => item.id}
          renderItem={renderNotificationItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <FontAwesome5
                name="bell-slash"
                size={32}
                color="#FF8C00"
                style={{ marginBottom: 14 }}
              />
              <Text style={styles.emptyTitle}>No Notifications Yet</Text>
              <Text style={styles.emptySubtitle}>
                {activeFilter === 'social'
                  ? 'No Co-Signs or Vibe Match alerts yet.'
                  : 'Your notification inbox is clean. Co-Signs, Vibe Matches, and chat alerts will appear here.'}
              </Text>
            </View>
          }
        />
      )}

      {error && <Text style={styles.errorText}>{error}</Text>}
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
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginVertical: 14,
    gap: 10,
  },
  filterPill: {
    flex: 1,
    minHeight: 42,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: '#151821',
    borderWidth: 1,
    borderColor: '#242936',
  },
  filterPillActive: {
    backgroundColor: '#FF8C00',
    borderColor: '#FF8C00',
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94A3B8',
  },
  filterPillTextActive: {
    color: '#0A0C10',
    fontWeight: '800',
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 90,
  },
  notificationCard: {
    flexDirection: 'row',
    backgroundColor: '#151821',
    padding: 14,
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#242936',
    alignItems: 'center',
  },
  coverImage: {
    width: 52,
    height: 52,
    borderRadius: 10,
    marginRight: 12,
  },
  coverFallback: {
    width: 52,
    height: 52,
    borderRadius: 10,
    backgroundColor: '#1E2430',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  coverFallbackCosign: {
    borderColor: 'rgba(212, 244, 88, 0.3)',
  },
  cardBody: {
    flex: 1,
  },
  topMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  senderText: {
    color: '#FF8C00',
    fontSize: 12,
    fontWeight: '700',
  },
  dateText: {
    fontSize: 11,
    color: '#64748B',
  },
  titleText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 2,
  },
  messageText: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
    lineHeight: 17,
  },
  badgePillCosign: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#D4F458',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
    marginTop: 6,
    gap: 4,
  },
  badgePillCosignText: {
    color: '#0B0C10',
    fontSize: 10,
    fontWeight: '800',
  },
  badgePillFriend: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#FF8C00',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
    marginTop: 6,
    gap: 4,
  },
  badgePillFriendText: {
    color: '#0B0C10',
    fontSize: 10,
    fontWeight: '800',
  },
  emptyCard: {
    backgroundColor: '#151821',
    borderRadius: 18,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#242936',
    marginTop: 30,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 6,
    textAlign: 'center',
  },
  emptySubtitle: {
    color: '#94A3B8',
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 20,
    maxWidth: 280,
  },
  errorText: {
    color: '#F87171',
    textAlign: 'center',
    marginTop: 10,
  },
});

export default NotifPage;