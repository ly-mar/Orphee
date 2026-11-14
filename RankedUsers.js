// RankedUsers.js
import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  SafeAreaView,
  Alert,
  TouchableOpacity,
  Text,
  Animated,
  Image,
  ActivityIndicator,
} from 'react-native';
import { db, auth } from './firebaseConfig';
import { doc, getDoc, collection, query, where, getDocs, setDoc } from 'firebase/firestore';
import { FontAwesome5 } from '@expo/vector-icons';
import { sendFriendRequest } from './HandlingFriends';
import {
  sanitizeCompatibilityScore,
  deduplicateRankedUsers,
  formatListenerDisplayName,
  computeSimilarityMatrix,
} from './utils/algorithmUtils';
import { UserAvatar } from './utils/avatarUtils';
import {
  getCachedRankedUsers,
  setCachedRankedUsers,
  getCachedUserProfile,
  getCachedUserPlaylist,
} from './utils/sessionCache';
import { canAccessVibeFeatures } from './utils/playlistUtils';

export { sanitizeCompatibilityScore };

const DEFAULT_AVATAR =
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120';

async function resolveUserRecord(identifier) {
  if (!identifier || identifier === 'current_user') {
    return { uid: identifier || 'current_user', username: 'You', profileImageUrl: null };
  }
  try {
    const directDoc = await getDoc(doc(db, 'users', identifier));
    if (directDoc.exists()) {
      const data = directDoc.data();
      return {
        uid: directDoc.id,
        username: formatListenerDisplayName(identifier, data.username || data.displayName),
        profileImageUrl: data.profileImageUrl || null,
      };
    }

    const q = query(collection(db, 'users'), where('username', '==', identifier));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      const userDoc = querySnapshot.docs[0];
      const data = userDoc.data();
      return {
        uid: userDoc.id,
        username: formatListenerDisplayName(identifier, data.username || data.displayName),
        profileImageUrl: data.profileImageUrl || null,
      };
    }
  } catch (_) {
    // Fallback to clean formatted identifier if Firestore permissions restrict user lookup
  }
  return {
    uid: identifier,
    username: formatListenerDisplayName(identifier),
    profileImageUrl: null,
  };
}

function RankedUsers({ route, navigation }) {
  const routeRankedUsers = route?.params?.rankedUsers;
  const initialUserId = route?.params?.userId || auth.currentUser?.uid || '';
  const [userId] = useState(initialUserId);
  const [rankedUsers, setRankedUsers] = useState(() => {
    if (Array.isArray(routeRankedUsers) && routeRankedUsers.length > 0) {
      return routeRankedUsers;
    }
    return (initialUserId ? getCachedRankedUsers(initialUserId) : null) || [];
  });
  const [usernames, setUsernames] = useState({});
  const [userIds, setUserIds] = useState({});
  const [userImages, setUserImages] = useState({});
  const [friendStatuses, setFriendStatuses] = useState({});
  const [currentUsername, setCurrentUsername] = useState(null);
  const [hydrating, setHydrating] = useState(true);
  const [isGated, setIsGated] = useState(false);
  const [animationValue] = useState(new Animated.Value(0));

  useEffect(() => {
    let isMounted = true;

    const hydrateLeaderboard = async () => {
      setHydrating(true);

      const currentUid = userId || auth.currentUser?.uid;

      if (currentUid && currentUid !== 'current_user') {
        let userSongs = route?.params?.selectedSongs || [];
        let isConfirmed = route?.params?.isConfirmed;

        if (!userSongs || userSongs.length === 0 || isConfirmed === undefined) {
          const cachedPl = getCachedUserPlaylist(currentUid);
          const cachedPr = getCachedUserProfile(currentUid);
          userSongs = userSongs.length > 0 ? userSongs : (cachedPl?.songs || cachedPr?.your13 || []);
          isConfirmed = isConfirmed !== undefined
            ? isConfirmed
            : Boolean(cachedPl?.your13Confirmed || cachedPr?.your13Confirmed || cachedPl?.isLocked);

          if (!userSongs || userSongs.length === 0 || !isConfirmed) {
            try {
              const uDoc = await getDoc(doc(db, 'users', currentUid));
              if (uDoc.exists()) {
                const uData = uDoc.data();
                userSongs = userSongs.length > 0 ? userSongs : (uData.your13 || uData.songs || []);
                isConfirmed = Boolean(uData.your13Confirmed || uData.isLocked);
              }
            } catch (_) {}
          }
        }

        if (!canAccessVibeFeatures(userSongs, Boolean(isConfirmed))) {
          if (isMounted) {
            setIsGated(true);
            setHydrating(false);
          }
          return;
        }
      }

      let listToHydrate = rankedUsers;

      if (!Array.isArray(listToHydrate) || listToHydrate.length === 0) {
        if (currentUid) {
          const cached = getCachedRankedUsers(currentUid);
          if (Array.isArray(cached) && cached.length > 0) {
            listToHydrate = cached;
          } else {
            try {
              const rankSnap = await getDoc(doc(db, 'ranking', currentUid));
              if (
                rankSnap.exists() &&
                Array.isArray(rankSnap.data()?.rankings) &&
                rankSnap.data().rankings.length > 0
              ) {
                listToHydrate = rankSnap.data().rankings;
                setCachedRankedUsers(currentUid, listToHydrate);
              } else {
                const playlistsSnap = await getDocs(collection(db, 'playlists'));
                const userPlaylists = [];
                playlistsSnap.forEach((docSnap) => {
                  const d = docSnap.data();
                  if (!d || !d.songs) return;
                  const songs = Array.isArray(d.songs) ? d.songs : Object.values(d.songs || {});
                  const valid = songs.filter((s) => s && s.trackId);
                  if (valid.length === 0) return;
                  userPlaylists.push({
                    username: docSnap.id,
                    trackIds: valid.map((s) => s.trackId),
                    artistIds: valid.map((s) => s.artistId),
                    primaryGenres: valid.map((s) => s.primaryGenreName),
                    releaseDates: valid.map((s) => s.releaseDate),
                  });
                });

                const currentUserInList = userPlaylists.some((p) => p.username === currentUid);
                if (!currentUserInList) {
                  const userDocSnap = await getDoc(doc(db, 'users', currentUid));
                  const uData = userDocSnap.exists() ? userDocSnap.data() : null;
                  const userSongs = (uData?.songs || uData?.your13 || []).filter((s) => s && s.trackId);
                  if (userSongs.length > 0) {
                    userPlaylists.unshift({
                      username: currentUid,
                      trackIds: userSongs.map((s) => s.trackId),
                      artistIds: userSongs.map((s) => s.artistId),
                      primaryGenres: userSongs.map((s) => s.primaryGenreName),
                      releaseDates: userSongs.map((s) => s.releaseDate),
                    });
                  }
                }

                if (userPlaylists.length > 0) {
                  const matrix = computeSimilarityMatrix(userPlaylists, [0.5, 0.35, 0.075, 0.075]);
                  const currentIdx = userPlaylists.findIndex((p) => p.username === currentUid);
                  const baseIdx = currentIdx !== -1 ? currentIdx : 0;
                  listToHydrate = userPlaylists
                    .map((up, idx) => ({
                      uid: up.username,
                      uname: up.username,
                      totalScore: Number(matrix[baseIdx][idx]) || 0,
                    }))
                    .sort((a, b) => b.totalScore - a.totalScore)
                    .slice(0, 50);

                  if (listToHydrate.length > 0) {
                    setCachedRankedUsers(currentUid, listToHydrate);
                    try {
                      await setDoc(
                        doc(db, 'ranking', currentUid),
                        {
                          rankings: listToHydrate,
                          updatedAt: new Date().toISOString(),
                        },
                        { merge: true }
                      );
                    } catch (_) {}
                  }
                }
              }
            } catch (err) {
              console.warn('RankedUsers auto-hydration notice:', err);
            }
          }
        }
      }

      if (isMounted && Array.isArray(listToHydrate) && listToHydrate.length > 0) {
        setRankedUsers(listToHydrate);
      }

      const safeList = Array.isArray(listToHydrate) ? listToHydrate : [];
      const fetchedUsernames = {};
      const fetchedUserIds = {};
      const fetchedImages = {};
      const fetchedStatuses = {};

      let requestsData = {};
      if (userId && userId !== 'current_user') {
        try {
          const currentUserRequestsDoc = await getDoc(doc(db, 'requests', userId));
          if (currentUserRequestsDoc.exists()) {
            requestsData = currentUserRequestsDoc.data();
          }
        } catch (_) {}
      }

      const {
        followers = {},
        following = {},
        sentRequests = {},
      } = requestsData;

      await Promise.all(
        safeList.map(async (user) => {
          const key = user.uname || user.uid || 'unknown';
          const record = await resolveUserRecord(key);
          const resolvedUid = record.uid || key;
          const resolvedName = record.username || key;

          fetchedUsernames[key] = resolvedName;
          fetchedUserIds[key] = resolvedUid;
          if (record.profileImageUrl) {
            fetchedImages[key] = record.profileImageUrl;
          }

          if (sentRequests[resolvedUid] || sentRequests[resolvedName]) {
            fetchedStatuses[key] = 'pending';
          } else if (
            followers[resolvedUid] ||
            following[resolvedUid] ||
            followers[resolvedName] ||
            following[resolvedName]
          ) {
            fetchedStatuses[key] = 'friend';
          } else {
            fetchedStatuses[key] = 'none';
          }
        })
      );

      if (userId && userId !== 'current_user') {
        try {
          const currentUserDoc = await getDoc(doc(db, 'users', userId));
          if (currentUserDoc.exists() && isMounted) {
            const cName = currentUserDoc.data().username;
            setCurrentUsername(cName);
            if (cName) {
              fetchedUsernames[userId] = cName;
            }
          }
        } catch (_) { }
      }

      if (isMounted) {
        setUsernames(fetchedUsernames);
        setUserIds(fetchedUserIds);
        setUserImages(fetchedImages);
        setFriendStatuses(fetchedStatuses);
        setHydrating(false);

        Animated.spring(animationValue, {
          toValue: 1,
          friction: 6,
          useNativeDriver: true,
        }).start();
      }
    };

    hydrateLeaderboard();
    return () => {
      isMounted = false;
    };
  }, [rankedUsers, userId]);

  const handleSendFriendRequest = async (rawKey) => {
    try {
      const targetUid = userIds[rawKey] || rawKey;
      const selectedUsername = usernames[rawKey] || rawKey;

      if (!targetUid || targetUid === 'current_user') {
        Alert.alert('Error', 'Unable to locate this user profile.');
        return;
      }

      await sendFriendRequest(targetUid, selectedUsername);

      setFriendStatuses((prevStatuses) => ({
        ...prevStatuses,
        [rawKey]: 'pending',
      }));
    } catch (error) {
      console.error('Error sending friend request:', error);
      Alert.alert('Error', 'Failed to send friend request.');
    }
  };

  const getFriendRequestButtonText = (key) => {
    if (friendStatuses[key] === 'pending') return 'Pending';
    if (friendStatuses[key] === 'friend') return 'Connected';
    return '+ Connect';
  };

  const getFriendRequestButtonStyle = (key) => {
    if (friendStatuses[key] === 'pending') {
      return [styles.friendBtn, styles.friendBtnPending];
    }
    if (friendStatuses[key] === 'friend') {
      return [styles.friendBtn, styles.friendBtnConnected];
    }
    return styles.friendBtn;
  };

  const getRankAccent = (index) => {
    if (index === 0) return { border: '#FFD700', badgeBg: 'rgba(255, 215, 0, 0.18)', badgeText: '#FFD700', icon: '👑' };
    if (index === 1) return { border: '#C0C0C0', badgeBg: 'rgba(192, 192, 192, 0.18)', badgeText: '#E2E8F0', icon: '🥈' };
    if (index === 2) return { border: '#CD7F32', badgeBg: 'rgba(205, 127, 50, 0.2)', badgeText: '#F6AD55', icon: '🥉' };
    return { border: '#262B38', badgeBg: '#1F2430', badgeText: '#94A3B8', icon: '⭐' };
  };

  const dedupedRankedUsers = useMemo(
    () =>
      deduplicateRankedUsers(rankedUsers, {
        usernamesMap: usernames,
        userIdsMap: userIds,
        currentUserId: userId,
        currentUsername,
      }),
    [rankedUsers, usernames, userIds, userId, currentUsername]
  );

  const navigateToGraph = () => {
    const enrichedUsers = dedupedRankedUsers.map((u) => {
      const key = u.uname || u.uid;
      const pct = sanitizeCompatibilityScore(Math.round((Number(u.totalScore) || 0) * 100));
      return {
        ...u,
        uname: key,
        uid: u.resolvedUid || userIds[key] || key,
        username: u.displayName || usernames[key] || u.username || key,
        profileImageUrl: userImages[key] || null,
        friendStatus: friendStatuses[key] || 'none',
        formattedScore: `${pct}%`,
      };
    });

    navigation.navigate('UserGraph', {
      rankedUsers: enrichedUsers,
      usernames: {
        ...usernames,
        [userId]: currentUsername || usernames[userId] || 'You',
      },
      userId,
    });
  };

  const renderRanking = () => {
    if (isGated) {
      return (
        <View style={styles.gateBox}>
          <FontAwesome5 name="lock" size={32} color="#FF8C00" style={{ marginBottom: 14 }} />
          <Text style={styles.gateTitle}>Your13 Incomplete</Text>
          <Text style={styles.gateSub}>
            Curate and confirm all 13 signature tracks in Your13 to unlock community Vibe Check and compatibility rankings.
          </Text>
          <TouchableOpacity
            style={styles.gateCtaBtn}
            onPress={() => navigation.navigate('Your13')}
            activeOpacity={0.85}
          >
            <Text style={styles.gateCtaText}>Complete & Confirm Your13</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (hydrating) {
      return (
        <View style={styles.emptyBox}>
          <ActivityIndicator size="large" color="#FF8C00" style={{ marginBottom: 12 }} />
          <Text style={styles.emptyTitle}>Matching Vibe Checks...</Text>
          <Text style={styles.emptySub}>Resolving community profiles & compatibility scores.</Text>
        </View>
      );
    }

    if (!dedupedRankedUsers || dedupedRankedUsers.length === 0) {
      return (
        <View style={styles.emptyBox}>
          <FontAwesome5 name="users-slash" size={32} color="#4A5568" style={{ marginBottom: 12 }} />
          <Text style={styles.emptyTitle}>No Ranked Connections Yet</Text>
          <Text style={styles.emptySub}>
            Curate your 13 tracks in Your13 to calculate your compatibility rankings across the community!
          </Text>
        </View>
      );
    }

    return (
      <FlatList
        data={dedupedRankedUsers}
        keyExtractor={(item, idx) => `${item.resolvedUid || item.uname || item.uid}-${idx}`}
        contentContainerStyle={styles.listContent}
        renderItem={({ item, index }) => {
          const key = item.uname || item.uid;
          const displayName =
            item.displayName || formatListenerDisplayName(key, usernames[key] || item.username);
          const isSelf = Boolean(item.isSelf);
          const pct = sanitizeCompatibilityScore(Math.round((Number(item.totalScore) || 0) * 100));
          const accent = getRankAccent(index);

          return (
            <Animated.View
              style={[
                styles.rankCard,
                {
                  borderColor: accent.border,
                  transform: [{ scale: animationValue }],
                },
              ]}
            >
              <TouchableOpacity
                style={styles.userLeftSection}
                activeOpacity={0.8}
                onPress={() => {
                  if (isSelf) {
                    navigation.navigate('Profile');
                  } else if (item.resolvedUid || userIds[key]) {
                    navigation.navigate('UserProfile', { userId: item.resolvedUid || userIds[key] });
                  }
                }}
              >
                <View style={[styles.rankBadgePill, { backgroundColor: accent.badgeBg }]}>
                  <Text style={[styles.rankBadgeText, { color: accent.badgeText }]}>
                    {accent.icon} #{index + 1}
                  </Text>
                </View>

                <UserAvatar
                  imageUrl={userImages[key]}
                  name={displayName}
                  size={48}
                  style={[styles.avatar, { borderColor: accent.border }]}
                />

                <View style={styles.nameColumn}>
                  <Text style={styles.usernameText} numberOfLines={1} ellipsizeMode="tail">
                    {displayName}
                    {isSelf ? ' (You)' : ''}
                  </Text>
                  <Text style={styles.subRoleText} numberOfLines={1}>
                    {pct >= 75
                      ? 'Top Vibe Match'
                      : pct >= 45
                        ? 'High Vibe Match'
                        : pct >= 20
                          ? 'Shared Groove'
                          : 'Fresh Discovery'}
                  </Text>
                </View>
              </TouchableOpacity>

              <View style={styles.rightActionsSection}>
                <View style={styles.scoreBadge}>
                  <Text style={styles.scoreValueText}>{pct}%</Text>
                  <Text style={styles.scoreLabelText}>Match</Text>
                </View>

                {!isSelf ? (
                  <TouchableOpacity
                    style={getFriendRequestButtonStyle(key)}
                    onPress={() => handleSendFriendRequest(key)}
                    disabled={friendStatuses[key] && friendStatuses[key] !== 'none'}
                  >
                    <Text style={styles.friendBtnText}>
                      {getFriendRequestButtonText(key)}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.selfBadge}>
                    <Text style={styles.selfBadgeText}>You</Text>
                  </View>
                )}
              </View>
            </Animated.View>
          );
        }}
      />
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerBar}>
        <TouchableOpacity
          style={styles.headerBackBtn}
          onPress={() => {
            if (navigation.canGoBack()) {
              navigation.goBack();
            } else {
              navigation.navigate('Home');
            }
          }}
        >
          <FontAwesome5 name="arrow-left" size={14} color="#FFFFFF" />
          <Text style={styles.headerBackText}>Back</Text>
        </TouchableOpacity>

        <View style={styles.headerTitleWrap}>
          <Text style={styles.title}>Vibe Check</Text>
          <Text style={styles.subtitle}>Ranked by Music Compatibility</Text>
        </View>

        <TouchableOpacity style={styles.headerGraphBtn} onPress={navigateToGraph}>
          <FontAwesome5 name="project-diagram" size={13} color="#000000" />
          <Text style={styles.headerGraphBtnText}>Radar</Text>
        </TouchableOpacity>
      </View>

      {hydrating && rankedUsers.length > 0 && (
        <View style={styles.hydratingBanner}>
          <ActivityIndicator size="small" color="#FF8C00" style={{ marginRight: 8 }} />
          <Text style={styles.hydratingText}>Syncing community profiles...</Text>
        </View>
      )}

      <View style={styles.contentArea}>{renderRanking()}</View>

      {!isGated && (
        <View style={styles.bottomBar}>
          <TouchableOpacity style={styles.primaryGraphCta} onPress={navigateToGraph}>
            <FontAwesome5 name="satellite-dish" size={16} color="#000000" style={{ marginRight: 8 }} />
            <Text style={styles.primaryGraphCtaText}>Launch Affinity Radar</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0E12',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E2330',
  },
  headerBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1E29',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 6,
  },
  headerBackText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  headerTitleWrap: {
    alignItems: 'center',
    flex: 1,
    paddingHorizontal: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 1,
  },
  headerGraphBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF8C00',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 6,
  },
  headerGraphBtnText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '800',
  },
  hydratingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    backgroundColor: '#141821',
  },
  hydratingText: {
    color: '#A0AEC0',
    fontSize: 12,
  },
  contentArea: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 20,
  },
  rankCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#161922',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 10,
    borderWidth: 1.5,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  userLeftSection: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10,
  },
  rankBadgePill: {
    paddingVertical: 4,
    paddingHorizontal: 7,
    borderRadius: 8,
    marginRight: 8,
    minWidth: 46,
    alignItems: 'center',
  },
  rankBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    marginRight: 10,
    borderWidth: 1.5,
    backgroundColor: '#232733',
  },
  nameColumn: {
    flex: 1,
    justifyContent: 'center',
  },
  usernameText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  subRoleText: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
  },
  rightActionsSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scoreBadge: {
    backgroundColor: '#1E2330',
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 10,
    alignItems: 'center',
    minWidth: 54,
  },
  scoreValueText: {
    color: '#FF8C00',
    fontSize: 14,
    fontWeight: '800',
  },
  scoreLabelText: {
    color: '#94A3B8',
    fontSize: 9,
    fontWeight: '600',
  },
  friendBtn: {
    backgroundColor: '#10B981',
    paddingVertical: 8,
    paddingHorizontal: 11,
    borderRadius: 10,
    minWidth: 82,
    alignItems: 'center',
  },
  friendBtnPending: {
    backgroundColor: '#2D3748',
  },
  friendBtnConnected: {
    backgroundColor: '#2563EB',
  },
  friendBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  selfBadge: {
    backgroundColor: 'rgba(255, 140, 0, 0.15)',
    borderWidth: 1,
    borderColor: '#FF8C00',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 10,
    minWidth: 82,
    alignItems: 'center',
  },
  selfBadgeText: {
    color: '#FF8C00',
    fontSize: 12,
    fontWeight: '800',
  },
  bottomBar: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#11131A',
    borderTopWidth: 1,
    borderTopColor: '#1E2330',
    alignItems: 'center',
  },
  primaryGraphCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF8C00',
    width: '100%',
    maxWidth: 480,
    paddingVertical: 12,
    borderRadius: 12,
  },
  primaryGraphCtaText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '800',
  },
  emptyBox: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySub: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 19,
    maxWidth: 320,
  },
  gateBox: {
    marginHorizontal: 20,
    marginTop: 40,
    padding: 28,
    borderRadius: 16,
    backgroundColor: '#151821',
    borderWidth: 1,
    borderColor: '#242936',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
  },
  gateTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  gateSub: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
    maxWidth: 300,
  },
  gateCtaBtn: {
    backgroundColor: '#FF8C00',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    maxWidth: 260,
  },
  gateCtaText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '800',
  },
});

export default RankedUsers;