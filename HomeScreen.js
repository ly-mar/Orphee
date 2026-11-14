// HomeScreen.js — Orphee Pulse Discovery Hub [WP-03, VR-004, VR-005]
import React, { useState, useEffect } from 'react';
import {
  ScrollView,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ImageBackground,
  View,
} from 'react-native';
import { Text, Button } from 'react-native-paper';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { Feather, Ionicons } from '@expo/vector-icons';
import { auth, db } from './firebaseConfig';
import { subscribeSafeSnapshot } from './firestoreListenerUtils';
import {
  deriveHomeDashboardState,
  deriveVibeMatchPreview,
} from './utils/homeDashboardUtils';
import Taskbar from './Taskbar';
import backgroundImage from './assets/bri-tucker-AJD3XJlvBZ8-unsplash.jpg';
import {
  getCachedUserProfile,
  setCachedUserProfile,
  getCachedUserPlaylist,
  setCachedUserPlaylist,
  getCachedRankedUsers,
  setCachedRankedUsers,
} from './utils/sessionCache';

function HomeScreen({ navigation }) {
  const currentUid = auth.currentUser?.uid;
  const cachedProfile = currentUid ? getCachedUserProfile(currentUid) : null;
  const cachedPlaylist = currentUid ? getCachedUserPlaylist(currentUid) : null;
  const initialRankedUsers = (currentUid ? getCachedRankedUsers(currentUid) : null) || [];

  const [currentUser, setCurrentUser] = useState(auth.currentUser || null);
  const [userProfileDoc, setUserProfileDoc] = useState(cachedProfile);
  const [userPlaylistDoc, setUserPlaylistDoc] = useState(cachedPlaylist);
  const [cachedRankedUsers, setCachedRankedUsersState] = useState(initialRankedUsers);
  const [safetyHydrate, setSafetyHydrate] = useState(Boolean(cachedProfile));

  useEffect(() => {
    const timer = setTimeout(() => {
      setSafetyHydrate(true);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const uid = currentUser?.uid;
    if (!uid) {
      setCachedRankedUsersState([]);
      return;
    }
    const cached = getCachedRankedUsers(uid);
    if (cached && cached.length > 0) {
      setCachedRankedUsersState(cached);
      return;
    }
    let isMounted = true;
    getDoc(doc(db, 'ranking', uid))
      .then((snap) => {
        if (!isMounted) return;
        if (snap.exists() && Array.isArray(snap.data()?.rankings)) {
          const list = snap.data().rankings;
          setCachedRankedUsers(uid, list);
          setCachedRankedUsersState(list);
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, [currentUser?.uid]);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user || null);
      if (!user) {
        setUserProfileDoc(null);
        setUserPlaylistDoc(null);
      } else {
        const p = getCachedUserProfile(user.uid);
        if (p) setUserProfileDoc(p);
        const pl = getCachedUserPlaylist(user.uid);
        if (pl) setUserPlaylistDoc(pl);
        if (p || pl) setSafetyHydrate(true);
      }
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    const uid = currentUser?.uid;
    return subscribeSafeSnapshot({
      isReady: Boolean(uid),
      buildQuery: () => doc(db, 'users', uid),
      onSnapshotFn: onSnapshot,
      onNext: (snapshot) => {
        const data = snapshot && snapshot.exists() ? snapshot.data() : {};
        setUserProfileDoc(data);
        if (uid) setCachedUserProfile(uid, data);
        setSafetyHydrate(true);
      },
      onError: (err) => {
        setUserProfileDoc({});
        setSafetyHydrate(true);
        if (err?.code !== 'permission-denied') {
          console.warn('HomeScreen profile listener error:', err);
        }
      },
    });
  }, [currentUser?.uid]);

  useEffect(() => {
    const uid = currentUser?.uid;
    return subscribeSafeSnapshot({
      isReady: Boolean(uid),
      buildQuery: () => doc(db, 'playlists', uid),
      onSnapshotFn: onSnapshot,
      onNext: (snapshot) => {
        const data = snapshot && snapshot.exists() ? snapshot.data() : {};
        setUserPlaylistDoc(data);
        if (uid) setCachedUserPlaylist(uid, data);
      },
      onError: (err) => {
        setUserPlaylistDoc({});
        if (err?.code !== 'permission-denied') {
          console.warn('HomeScreen playlist listener error:', err);
        }
      },
    });
  }, [currentUser?.uid]);

  const effectiveProfileDoc = userProfileDoc ?? (safetyHydrate ? {} : null);
  const dashboardState = deriveHomeDashboardState(currentUser, effectiveProfileDoc, userPlaylistDoc);
  const activeRankedUsers =
    cachedRankedUsers.length > 0
      ? cachedRankedUsers
      : effectiveProfileDoc?.rankedUsers || [];
  const vibePreviewText = deriveVibeMatchPreview(activeRankedUsers);

  return (
    <ImageBackground source={backgroundImage} style={styles.backgroundImage}>
      <View style={styles.overlay}>
        <SafeAreaView style={styles.container}>
          <ScrollView
            contentContainerStyle={styles.scrollContainer}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.contentWrapper}>
              {/* Top Quick Bar: Brand, Search, Friends, Notifications */}
              <View style={styles.topBarRow}>
                <View style={styles.brandTitleWrap}>
                  <Text style={styles.brandTitle}>Orphee</Text>
                  <Text style={styles.brandSubtitle}>Pulse</Text>
                </View>

                <View style={styles.topActionsRow}>
                  <TouchableOpacity
                    style={styles.iconBtn}
                    onPress={() => navigation.navigate('FriendsScreen')}
                    accessibilityLabel="Friends"
                    activeOpacity={0.8}
                  >
                    <Feather name="users" size={18} color="#CBD5E1" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.iconBtn}
                    onPress={() => navigation.navigate('NotifPage')}
                    accessibilityLabel="Notifications"
                    activeOpacity={0.8}
                  >
                    <Feather name="bell" size={18} color="#FF8C00" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Quick Search Bar */}
              <TouchableOpacity
                style={styles.searchBarBox}
                activeOpacity={0.85}
                onPress={() => navigation.navigate('UserSearchScreen')}
                accessibilityLabel="Find Listeners & Friends"
              >
                <Feather name="search" size={16} color="#FF8C00" style={{ marginRight: 10 }} />
                <Text style={styles.searchBarPlaceholder}>Find Listeners & Friends...</Text>
              </TouchableOpacity>

              {/* Greeting & Hydration Status Header */}
              <View style={styles.greetingBlock}>
                {dashboardState.isAuthenticated && !dashboardState.isHydrated ? (
                  <View style={styles.skeletonSubHeader}>
                    <View style={styles.skeletonPill} />
                  </View>
                ) : (
                  <Text style={styles.subHeaderText}>
                    {dashboardState.isAuthenticated
                      ? `Welcome, ${dashboardState.displayName} • ${dashboardState.progressCount}/${dashboardState.requiredCount} Your13 tracks ready`
                      : 'The social curation network designed for genuine music discovery'}
                  </Text>
                )}
              </View>

              {/* Module 1: Vibe Check & Affinity Graph (Hero Card) */}
              <View style={styles.card}>
                <View style={styles.cardContent}>
                  <View style={styles.tagRow}>
                    <Text style={styles.tagLabel}>⚡ VIBE CHECK & AFFINITY</Text>
                  </View>
                  <Text style={styles.cardTitle}>Find Your Vibe Matches</Text>
                  <Text style={styles.cardText}>
                    Discover listeners on your exact musical wavelength by comparing your 13 signature tracks across the community.
                  </Text>

                  <View style={styles.previewPill}>
                    <Feather name="zap" size={13} color="#FF8C00" style={{ marginRight: 6 }} />
                    <Text style={styles.previewPillText} numberOfLines={1}>
                      {vibePreviewText}
                    </Text>
                  </View>

                  <View style={styles.dualButtonRow}>
                    <Button
                      mode="contained"
                      style={[styles.actionBtn, styles.primaryActionBtn]}
                      buttonColor="#FF8C00"
                      textColor="#000000"
                      labelStyle={styles.actionBtnLabel}
                      onPress={() =>
                        navigation.navigate('RankedUsers', {
                          rankedUsers: activeRankedUsers,
                          selectedSongs: dashboardState.your13,
                          userId: currentUser?.uid,
                          fromScreen: 'Home',
                        })
                      }
                      icon="lightning-bolt"
                    >
                      Run Vibe Check
                    </Button>

                    <Button
                      mode="contained"
                      style={[styles.actionBtn, styles.secondaryActionBtn]}
                      buttonColor="#1E2430"
                      textColor="#FFFFFF"
                      labelStyle={styles.actionBtnLabel}
                      onPress={() =>
                        navigation.navigate('UserGraph', {
                          rankedUsers: activeRankedUsers,
                          userId: currentUser?.uid,
                          fromScreen: 'Home',
                        })
                      }
                      icon={() => (
                        <View style={styles.iridescentStarBadge}>
                          <Ionicons name="sparkles" size={12} color="#FFFFFF" />
                        </View>
                      )}
                    >
                      Affinity Graph
                    </Button>
                  </View>
                </View>
              </View>

              {/* Module 2: Daily Song Memoir Prompt */}
              <View style={styles.card}>
                <View style={styles.cardContent}>
                  <View style={styles.tagRow}>
                    <Text style={[styles.tagLabel, { color: '#D4F458' }]}>📖 DAILY SONG MEMOIR</Text>
                  </View>
                  <Text style={styles.cardTitle}>Capture Today's Song Memoir</Text>
                  <Text style={styles.cardText}>
                    Anchor your memories to music. Reflect on the single song defining your day and browse the community memoir feed.
                  </Text>

                  <View style={styles.dualButtonRow}>
                    <Button
                      mode="contained"
                      style={[styles.actionBtn, styles.memoirActionBtn]}
                      buttonColor="#D4F458"
                      textColor="#000000"
                      labelStyle={styles.actionBtnLabel}
                      onPress={() => navigation.navigate('Memoir')}
                      icon="book-open-page-variant"
                    >
                      Log Song Memoir
                    </Button>

                    <Button
                      mode="contained"
                      style={[styles.actionBtn, styles.secondaryActionBtn]}
                      buttonColor="#1E2430"
                      textColor="#FFFFFF"
                      labelStyle={styles.actionBtnLabel}
                      onPress={() => navigation.navigate('MemoirHistoryScreen')}
                      icon="history"
                    >
                      Memoir History
                    </Button>
                  </View>
                </View>
              </View>

              {/* Module 3: Community Charts & Rankings */}
              <View style={styles.card}>
                <View style={styles.cardContent}>
                  <View style={styles.tagRow}>
                    <Text style={styles.tagLabel}>🏆 COMMUNITY CHARTS</Text>
                  </View>
                  <Text style={styles.cardTitle}>Community Charts</Text>
                  <Text style={styles.cardText}>
                    Explore the top 13 tracks, trending artists, and mood shelves dominating community playlists.
                  </Text>

                  <Button
                    mode="outlined"
                    style={styles.chartsButton}
                    textColor="#FF8C00"
                    labelStyle={styles.actionBtnLabel}
                    onPress={() => navigation.navigate('RankedMusicList')}
                    icon="trophy"
                  >
                    View Community Charts
                  </Button>
                </View>
              </View>
            </View>
          </ScrollView>

          <Taskbar />
        </SafeAreaView>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  overlay: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(10, 12, 16, 0.88)',
  },
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  scrollContainer: {
    paddingVertical: 14,
    paddingBottom: 116, // Clears floating bottom Taskbar dock
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  contentWrapper: {
    width: '100%',
    maxWidth: 480,
  },
  topBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  brandTitleWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  brandTitle: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  brandSubtitle: {
    color: '#FF8C00',
    fontSize: 16,
    fontWeight: '700',
  },
  topActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#161922',
    borderWidth: 1,
    borderColor: '#242B3B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBarBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161922',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#242B3B',
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginBottom: 14,
  },
  searchBarPlaceholder: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '500',
  },
  greetingBlock: {
    marginBottom: 16,
  },
  subHeaderText: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 18,
  },
  skeletonSubHeader: {
    height: 18,
    justifyContent: 'center',
  },
  skeletonPill: {
    height: 12,
    width: 210,
    borderRadius: 6,
    backgroundColor: '#151821',
  },
  card: {
    backgroundColor: '#151821',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#242936',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  cardContent: {
    padding: 16,
  },
  tagRow: {
    marginBottom: 6,
  },
  tagLabel: {
    color: '#FF8C00',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  cardText: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: 12,
    lineHeight: 18,
  },
  previewPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1B202C',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#262E3E',
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 14,
  },
  previewPillText: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  dualButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 1,
  },
  primaryActionBtn: {},
  secondaryActionBtn: {
    borderWidth: 1,
    borderColor: '#2A3346',
  },
  memoirActionBtn: {},
  chartsButton: {
    borderColor: '#FF8C00',
    borderWidth: 1,
    borderRadius: 10,
    backgroundColor: '#181C26',
    paddingVertical: 1,
  },
  actionBtnLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  iridescentStarBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#9333EA',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 2,
  },
});

export default HomeScreen;
