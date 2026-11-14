// Pickerchoosers.js — Collective Theme Music List & Voting [VR-001, VR-004, VR-006, VR-021]
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  ScrollView,
  StyleSheet,
  SafeAreaView,
  View,
  Alert,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { Text } from 'react-native-paper';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import { FontAwesome5, Feather } from '@expo/vector-icons';
import { db, auth } from './firebaseConfig';
import {
  collection,
  getDocs,
  updateDoc,
  doc,
  setDoc,
  getDoc,
  query,
  orderBy,
  increment,
} from 'firebase/firestore';
import { createAsyncActionLock } from './utils/actionLockUtils';
import { toast } from './crossPlatformAlert';
import { normalizeTrack, searchMusic } from './services/musicApi';
import {
  deriveUserDropQuota,
  validateCoSignAction,
  normalizeCollectiveTrack,
  resolveTrackSocialAttribution,
  buildCrateRadioQueue,
  resolveThemeTitle,
} from './utils/collectiveGrooveUtils';
import { UserAvatar } from './utils/avatarUtils';
import { createAudioPreviewController } from './audioPreviewController';
import { LockContext, useLock } from './LockContext';
import { appendTrackToYour13Safely } from './utils/playlistUtils';

const isUsableArtworkUrl = (url) =>
  typeof url === 'string' &&
  /^https?:\/\//i.test(url) &&
  !url.includes('example.com') &&
  !url.includes('via.placeholder.com');

function Pickerchoosers() {
  const route = useRoute();
  const navigation = useNavigation();
  const params = route?.params || {};
  const themeId = params.themeId || 'child_of_the_80s';
  const themeTitle = resolveThemeTitle(themeId, params.theme);

  const [songs, setSongs] = useState([]);
  const songsRef = useRef(songs);
  songsRef.current = songs;
  const [votedIds, setVotedIds] = useState({});
  const [failedArtIds, setFailedArtIds] = useState({});
  const [activeMenuSong, setActiveMenuSong] = useState(null);
  const [loading, setLoading] = useState(true);
  const userId = auth.currentUser?.uid;
  const lockCtx = useLock();
  const isLocked = Boolean(lockCtx?.isLocked);
  const actionLockRef = useRef(createAsyncActionLock());

  const loadSongs = useCallback(async () => {
    try {
      if (songsRef.current.length === 0) {
        setLoading(true);
      }
      const songsCollectionRef = collection(db, 'collective', themeId, 'songs');
      const songsQuery = query(songsCollectionRef, orderBy('score', 'desc'));
      const songsSnapshot = await getDocs(songsQuery);

      if (!songsSnapshot.empty) {
        const dedupMap = new Map();
        songsSnapshot.docs.forEach((docSnap, index) => {
          const raw = { id: docSnap.id, ...docSnap.data() };
          const normalized = normalizeCollectiveTrack(raw, index);
          const titleKey = String(normalized.trackName || '').trim().toLowerCase();
          const artistKey = String(normalized.artistName || '').trim().toLowerCase();
          const sigKey =
            normalized.trackId != null
              ? `id_${normalized.trackId}`
              : titleKey && artistKey
                ? `${titleKey}::${artistKey}`
                : docSnap.id;

          const existing = dedupMap.get(sigKey);
          if (!existing || (Number(normalized.score) || 0) > (Number(existing.score) || 0)) {
            dedupMap.set(sigKey, {
              ...existing,
              ...normalized,
              id: existing?.id || docSnap.id,
              score: Math.max(Number(normalized.score) || 0, Number(existing?.score) || 0),
              artworkUrl100: isUsableArtworkUrl(normalized.artworkUrl100)
                ? normalized.artworkUrl100
                : existing?.artworkUrl100 || normalized.imageUrl || null,
            });
          }
        });

        const sorted = Array.from(dedupMap.values()).sort(
          (a, b) => (Number(b.score) || 0) - (Number(a.score) || 0)
        );
        setSongs(sorted);

        if (userId) {
          const voteStates = {};
          await Promise.all(
            sorted.map(async (song) => {
              try {
                const voteSnap = await getDoc(
                  doc(db, 'collective', themeId, 'songs', song.id, 'votes', userId)
                );
                if (voteSnap.exists()) {
                  voteStates[song.id] = true;
                }
              } catch (_) { }
            })
          );
          setVotedIds(voteStates);
        }
      } else {
        setSongs([]);
      }
    } catch (error) {
      console.error('Error loading songs from Firestore:', error);
    } finally {
      setLoading(false);
    }
  }, [themeId, userId]);

  useFocusEffect(
    useCallback(() => {
      loadSongs();
    }, [loadSongs])
  );

  const [radioState, setRadioState] = useState({
    isPlaying: false,
    activeTrackId: null,
    activeTrack: null,
    queueIndex: 0,
    queueLength: 0,
    progressRatio: 0,
  });

  const audioControllerRef = useRef(null);
  if (!audioControllerRef.current) {
    audioControllerRef.current = createAudioPreviewController({
      onError: (msg) => toast.show({ kind: 'info', message: msg }),
    });
  }

  useEffect(() => {
    const unsubProgress = audioControllerRef.current.onProgress((state) => {
      setRadioState(state);
    });
    const unsubBlur = navigation?.addListener?.('blur', () => {
      audioControllerRef.current?.stopQueue();
    });
    return () => {
      unsubProgress?.();
      unsubBlur?.();
      audioControllerRef.current?.dispose();
    };
  }, [navigation]);

  const toggleCrateRadio = async () => {
    if (radioState.isPlaying) {
      audioControllerRef.current.stopQueue();
      return;
    }
    const queue = buildCrateRadioQueue(songs, 13);
    if (queue.length === 0) {
      toast.show({ kind: 'info', message: 'No tracks available to play in this crate.' });
      return;
    }
    await audioControllerRef.current.playQueue(queue, 0, { searchMusicFn: searchMusic });
  };

  const handleAddToYour13 = async (song) => {
    if (!userId) {
      toast.show({ kind: 'info', message: 'Please sign in to add tracks to Your13.' });
      return;
    }

    try {
      const userDocRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userDocRef);
      const userData = userSnap.exists() ? userSnap.data() : {};
      const currentList = userData.your13 || userData.songs || userData.playlist || [];

      const result = appendTrackToYour13Safely({
        currentList,
        candidateTrack: normalizeTrack(song),
        isLocked,
      });

      if (!result.ok) {
        if (result.reason === 'locked') {
          toast.show({ kind: 'info', message: 'Your13 is currently locked.' });
        } else if (result.reason === 'full') {
          toast.show({ kind: 'info', message: 'Your13 is full (13/13) — edit your slots in Your13.' });
        } else if (result.reason === 'duplicate') {
          toast.show({ kind: 'info', message: `"${song.trackName}" is already in your Your13.` });
        }
        return;
      }

      await updateDoc(userDocRef, { your13: result.nextList });
      try {
        const playlistDocRef = doc(db, 'playlists', userId);
        await setDoc(playlistDocRef, { songs: result.nextList, your13: result.nextList }, { merge: true });
      } catch (_) {}

      toast.show({
        kind: 'success',
        message: `Added "${song.trackName}" to Your13 (Slot #${result.slotNumber})!`,
      });
      setActiveMenuSong(null);
    } catch (err) {
      console.error('Error adding track to Your13:', err);
      toast.show({ kind: 'error', message: 'Could not add track to Your13.' });
    }
  };

  const handleWriteMemoir = (song) => {
    const normalized = normalizeTrack(song);
    setActiveMenuSong(null);
    navigation.navigate('Memoir', {
      song: normalized,
      preselectedTrack: normalized,
    });
  };

  const quota = deriveUserDropQuota(songs, userId);

  const addOrIncrementSong = (song) => {
    if (!userId) {
      toast.show({ kind: 'info', message: 'Please sign in before co-signing tracks.' });
      return;
    }

    const songId = song.id || `${song.trackName}-${song.artistName}`;
    if (votedIds[songId]) {
      return;
    }

    const validation = validateCoSignAction(songs, songId, userId);
    if (!validation.allowed) {
      if (validation.reason === 'quota_reached') {
        toast.show({ kind: 'info', message: 'All 3 Co-Signs used for this drop.' });
      } else if (validation.reason === 'already_cosigned') {
        toast.show({ kind: 'info', message: 'You have already co-signed this track.' });
      }
      return;
    }

    return actionLockRef.current(async () => {
      try {
        const songDocRef = doc(db, 'collective', themeId, 'songs', songId);
        const voteDocRef = doc(db, 'collective', themeId, 'songs', songId, 'votes', userId);
        const existingVote = await getDoc(voteDocRef);

        if (existingVote.exists()) {
          setVotedIds((prev) => ({ ...prev, [songId]: true }));
          return;
        }

        const curatorName = auth.currentUser?.displayName || 'Listener';
        const curatorAvatar = auth.currentUser?.photoURL || null;

        await setDoc(voteDocRef, { userId, votedAt: new Date().toISOString() });

        const existingSong = await getDoc(songDocRef);
        if (existingSong.exists()) {
          const currentData = existingSong.data() || {};
          const nextVoters = Array.from(new Set([...(currentData.voters || []), userId]));
          const nextCoSigners = [
            ...(currentData.coSigners || []),
            { uid: userId, username: curatorName, avatar: curatorAvatar },
          ];
          await updateDoc(songDocRef, {
            score: increment(1),
            voters: nextVoters,
            coSigners: nextCoSigners,
          });
        } else {
          await setDoc(songDocRef, {
            ...normalizeTrack(song),
            score: 1,
            voters: [userId],
            coSigners: [{ uid: userId, username: curatorName, avatar: curatorAvatar }],
            createdAt: new Date().toISOString(),
          });
        }

        setVotedIds((prev) => ({ ...prev, [songId]: true }));
        await loadSongs();
      } catch (error) {
        console.error('Error adding or updating song in Firestore:', error);
        toast.show({ kind: 'error', message: 'Unable to submit your Co-Sign right now.' });
      }
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Obsidian Top Header with Back Navigation */}
      <View style={styles.topHeader}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          accessibilityLabel="Go back"
        >
          <Feather name="arrow-left" size={16} color="#FFFFFF" />
          <Text style={styles.backBtnText}>Back</Text>
        </TouchableOpacity>

        <Text style={styles.headerTitle} numberOfLines={1}>
          {themeTitle}
        </Text>

        <TouchableOpacity
          onPress={() => {
            if (quota.submissionsRemaining === 0) {
              toast.show({ kind: 'info', message: 'You already nominated 1 track for this drop.' });
            } else {
              navigation.navigate('AddSong', { themeId, theme: themeTitle });
            }
          }}
          style={[styles.headerAddBtn, quota.submissionsRemaining === 0 && styles.headerAddBtnDisabled]}
          accessibilityLabel="Add a song to shelf"
        >
          <Feather name="plus" size={17} color={quota.submissionsRemaining === 0 ? '#64748B' : '#000000'} />
        </TouchableOpacity>
      </View>

      {/* Scarcity Status Bar (WP-01) */}
      <View style={styles.scarcityBar}>
        <View style={styles.quotaPill}>
          <Text style={styles.quotaLabel}>Nominations:</Text>
          <Text style={[styles.quotaValue, quota.submissionsRemaining === 0 && styles.quotaExhausted]}>
            {quota.submissionsRemaining}/1 left
          </Text>
        </View>
        <Text style={styles.quotaDivider}>•</Text>
        <View style={styles.quotaPill}>
          <Text style={styles.quotaLabel}>Co-Signs:</Text>
          <Text style={[styles.quotaValue, quota.coSignsRemaining === 0 && styles.quotaExhausted]}>
            {quota.coSignsRemaining}/3 left
          </Text>
        </View>
      </View>

      {/* Crate Radio Header Trigger & Active Deck (WP-03) */}
      <View style={styles.crateRadioControlsWrap}>
        <TouchableOpacity
          style={[styles.crateRadioBtn, radioState.isPlaying && styles.crateRadioBtnActive]}
          onPress={toggleCrateRadio}
          activeOpacity={0.85}
        >
          <Feather
            name={radioState.isPlaying ? 'square' : 'play'}
            size={15}
            color={radioState.isPlaying ? '#FFFFFF' : '#000000'}
          />
          <Text
            style={[
              styles.crateRadioBtnText,
              radioState.isPlaying && styles.crateRadioBtnTextActive,
            ]}
          >
            {radioState.isPlaying ? '■ Stop Crate Radio' : '▶ Play Crate (Top 13)'}
          </Text>
        </TouchableOpacity>
      </View>

      {radioState.isPlaying && radioState.activeTrack && (
        <View style={styles.miniPlayerCard}>
          <View style={styles.miniPlayerContent}>
            <View style={styles.miniPlayerInfo}>
              <Text style={styles.miniPlayerTag}>
                CRATE RADIO • #{radioState.queueIndex + 1} OF {radioState.queueLength}
              </Text>
              <Text style={styles.miniPlayerTitle} numberOfLines={1}>
                {radioState.activeTrack.trackName}
              </Text>
              <Text style={styles.miniPlayerArtist} numberOfLines={1}>
                {radioState.activeTrack.artistName}
              </Text>
            </View>

            <View style={styles.miniPlayerActions}>
              <TouchableOpacity
                onPress={() => addOrIncrementSong(radioState.activeTrack)}
                style={[
                  styles.miniCoSignBtn,
                  votedIds[radioState.activeTrack.id] && styles.miniCoSignBtnVoted,
                ]}
                disabled={Boolean(votedIds[radioState.activeTrack.id])}
              >
                <Feather
                  name={votedIds[radioState.activeTrack.id] ? 'check' : 'arrow-up'}
                  size={12}
                  color={votedIds[radioState.activeTrack.id] ? '#0B0C10' : '#000'}
                />
                <Text
                  style={[
                    styles.miniCoSignBtnText,
                    votedIds[radioState.activeTrack.id] && styles.miniCoSignBtnTextVoted,
                  ]}
                >
                  {votedIds[radioState.activeTrack.id]
                    ? '✓ Co-Signed'
                    : `▲ Co-Sign (${Number(radioState.activeTrack.score) || 0})`}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => audioControllerRef.current.skipNext({ searchMusicFn: searchMusic })}
                style={styles.miniSkipBtn}
                accessibilityLabel="Next preview track"
              >
                <Feather name="skip-forward" size={15} color="#FFFFFF" />
                <Text style={styles.miniSkipText}>Next</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* 3px animated progress bar */}
          <View style={styles.miniProgressBarTrack}>
            <View
              style={[
                styles.miniProgressBarFill,
                { width: `${Math.round(Math.min(1, Math.max(0, radioState.progressRatio)) * 100)}%` },
              ]}
            />
          </View>
        </View>
      )}

      <Text style={styles.subHeader}>Music List • Ranked by Community Votes</Text>

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#FF8C00" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          {songs.length === 0 ? (
            <View style={styles.emptyBox}>
              <FontAwesome5 name="compact-disc" size={34} color="#475569" />
              <Text style={styles.noSongsText}>No tracks on this shelf yet</Text>
              <Text style={styles.emptySub}>Be the first listener to add a track to {themeTitle}.</Text>
            </View>
          ) : (
            songs.map((song, index) => {
              const songId = song.id || `${song.trackName}-${song.artistName}`;
              const rawArt = song.artworkUrl100 || song.imageUrl;
              const showArtwork = isUsableArtworkUrl(rawArt) && !failedArtIds[songId];
              const highResUri = showArtwork ? rawArt.replace('100x100', '500x500') : null;
              const hasVoted = Boolean(votedIds[songId]);
              const attribution = resolveTrackSocialAttribution(song);
              const isActiveTrack =
                radioState.isPlaying &&
                (radioState.activeTrackId === songId ||
                  radioState.activeTrackId === song.id ||
                  (radioState.activeTrack?.trackId != null &&
                    String(radioState.activeTrack?.trackId) === String(song.trackId)));

              return (
                <View
                  key={songId || index}
                  style={[styles.songCard, isActiveTrack && styles.songCardActiveRadio]}
                >
                  <TouchableOpacity
                    style={styles.songRowMain}
                    activeOpacity={0.85}
                    onPress={() =>
                      navigation.navigate('SongDetails', { song: normalizeTrack(song) })
                    }
                  >
                    {showArtwork && highResUri ? (
                      <Image
                        source={{ uri: highResUri }}
                        style={styles.songCover}
                        onError={() =>
                          setFailedArtIds((prev) => ({ ...prev, [songId]: true }))
                        }
                      />
                    ) : (
                      <View style={styles.fallbackCover}>
                        <FontAwesome5 name="music" size={20} color="#FF8C00" />
                      </View>
                    )}

                    <View style={styles.songInfo}>
                      <Text style={styles.songName} numberOfLines={1}>
                        {song.trackName || song.title || 'Unknown Track'}
                      </Text>
                      <Text style={styles.artistName} numberOfLines={1}>
                        by {song.artistName || song.artist || 'Unknown Artist'}
                      </Text>
                      {Boolean(song.linerNote) && (
                        <Text style={styles.linerNoteText} numberOfLines={2}>
                          “{song.linerNote}”
                        </Text>
                      )}

                      {/* Social Attribution Row (WP-02) */}
                      <View style={styles.attributionRow}>
                        <TouchableOpacity
                          style={styles.curatorPill}
                          activeOpacity={attribution.curatorUid ? 0.75 : 1}
                          onPress={() => {
                            if (!attribution.curatorUid) return;
                            if (attribution.curatorUid === userId) {
                              navigation.navigate('ProfileScreen');
                            } else {
                              navigation.navigate('UserProfileScreen', {
                                userId: attribution.curatorUid,
                                username: attribution.curatorUsername,
                              });
                            }
                          }}
                          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        >
                          <Text style={styles.curatorLabelText}>
                            Curated by <Text style={styles.curatorHandleText}>{attribution.curatorHandle}</Text>
                          </Text>
                        </TouchableOpacity>

                        {attribution.coSignerAvatars.length > 0 && (
                          <View style={styles.coSignersWrap}>
                            {attribution.coSignerAvatars.map((signer, sIdx) => (
                              <View
                                key={signer.uid || sIdx}
                                style={[
                                  styles.miniAvatarSlot,
                                  sIdx > 0 && styles.miniAvatarOverlap,
                                ]}
                              >
                                <UserAvatar
                                  imageUrl={signer.avatar || signer.avatarUrl}
                                  name={signer.username || 'Listener'}
                                  size={20}
                                />
                              </View>
                            ))}
                            {attribution.overflowCount > 0 && (
                              <Text style={styles.overflowBadge}>
                                +{attribution.overflowCount}
                              </Text>
                            )}
                          </View>
                        )}
                      </View>

                      <Text style={styles.songScore}>
                        {Number(song.score) || 0} {Number(song.score) === 1 ? 'Co-Sign' : 'Co-Signs'}
                      </Text>
                    </View>
                  </TouchableOpacity>

                  <View style={styles.trackCardActionsRow}>
                    {hasVoted ? (
                      <TouchableOpacity
                        style={[styles.voteButton, styles.voteButtonVoted]}
                        disabled={true}
                        activeOpacity={1}
                        accessibilityLabel={`Co-signed (${song.score})`}
                      >
                        <Feather name="check" size={13} color="#0B0C10" />
                        <Text style={styles.voteButtonVotedLabel}>
                          ✓ Co-Signed ({Number(song.score) || 0})
                        </Text>
                      </TouchableOpacity>
                    ) : quota.coSignsRemaining === 0 ? (
                      <TouchableOpacity
                        onPress={() =>
                          toast.show({ kind: 'info', message: 'All 3 Co-Signs used for this drop.' })
                        }
                        style={[styles.voteButton, styles.voteButtonDisabled]}
                        activeOpacity={0.8}
                        accessibilityLabel="All 3 Co-Signs used"
                      >
                        <Feather name="arrow-up" size={13} color="#64748B" />
                        <Text style={styles.voteButtonDisabledLabel}>
                          ▲ Co-Sign ({Number(song.score) || 0})
                        </Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        onPress={() => addOrIncrementSong(song)}
                        style={styles.voteButton}
                        activeOpacity={0.8}
                        accessibilityLabel={`Co-sign ${song.trackName}`}
                      >
                        <Feather name="arrow-up" size={13} color="#000000" />
                        <Text style={styles.voteButtonLabel}>
                          ▲ Co-Sign ({Number(song.score) || 0})
                        </Text>
                      </TouchableOpacity>
                    )}

                    {/* Quick-Action Overflow Button (WP-04) */}
                    <TouchableOpacity
                      style={styles.overflowBtn}
                      onPress={() => setActiveMenuSong(song)}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      accessibilityLabel={`Options for ${song.trackName}`}
                    >
                      <Feather name="more-horizontal" size={18} color="#94A3B8" />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}

          {quota.submissionsRemaining === 0 ? (
            <TouchableOpacity
              style={[styles.addSongButton, styles.addSongButtonDisabled]}
              disabled={true}
              activeOpacity={1}
            >
              <Feather name="check-circle" size={18} color="#64748B" />
              <Text style={[styles.addSongButtonLabel, styles.addSongButtonDisabledLabel]}>
                ✓ Nomination Used (1/1)
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={() => navigation.navigate('AddSong', { themeId, theme: themeTitle })}
              style={styles.addSongButton}
              activeOpacity={0.85}
            >
              <Feather name="plus-circle" size={18} color="#000000" />
              <Text style={styles.addSongButtonLabel}>+ Nominate a Track</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      )}

      {/* 1-Tap Curation Bridge Action Sheet (WP-04) */}
      <Modal
        visible={Boolean(activeMenuSong)}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setActiveMenuSong(null)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setActiveMenuSong(null)}
        >
          <View style={styles.actionSheetCard}>
            <View style={styles.actionSheetHeader}>
              <Text style={styles.actionSheetTitle} numberOfLines={1}>
                {activeMenuSong?.trackName || 'Track Options'}
              </Text>
              <Text style={styles.actionSheetSubtitle} numberOfLines={1}>
                by {activeMenuSong?.artistName || 'Unknown Artist'}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.actionSheetItem}
              onPress={() => handleAddToYour13(activeMenuSong)}
              activeOpacity={0.8}
            >
              <Feather name="plus-circle" size={18} color="#FF8C00" />
              <View style={styles.actionItemTextWrap}>
                <Text style={styles.actionItemTitle}>+ Add to Your13</Text>
                <Text style={styles.actionItemSub}>Save to your personal 13 signature tracks</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionSheetItem}
              onPress={() => handleWriteMemoir(activeMenuSong)}
              activeOpacity={0.8}
            >
              <Feather name="book-open" size={18} color="#D4F458" />
              <View style={styles.actionItemTextWrap}>
                <Text style={styles.actionItemTitle}>📖 Write Song Memoir</Text>
                <Text style={styles.actionItemSub}>Capture a personal memory tied to this track</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionSheetCancelBtn}
              onPress={() => setActiveMenuSong(null)}
              activeOpacity={0.8}
            >
              <Text style={styles.actionSheetCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

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
    backgroundColor: '#0D1017',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1E29',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 6,
  },
  backBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    color: '#FFFFFF',
    paddingHorizontal: 8,
  },
  headerAddBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FF8C00',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAddBtnDisabled: {
    backgroundColor: '#1E2430',
  },
  scarcityBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#13161F',
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginHorizontal: 14,
    marginTop: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#242936',
    gap: 10,
  },
  crateRadioControlsWrap: {
    alignItems: 'center',
    marginTop: 10,
    marginHorizontal: 14,
  },
  crateRadioBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF8C00',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 22,
    width: '100%',
    gap: 8,
  },
  crateRadioBtnActive: {
    backgroundColor: '#1E2430',
    borderWidth: 1,
    borderColor: '#D4F458',
  },
  crateRadioBtnText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '800',
  },
  crateRadioBtnTextActive: {
    color: '#D4F458',
  },
  miniPlayerCard: {
    backgroundColor: '#151821',
    borderColor: '#FF8C00',
    borderWidth: 1,
    borderRadius: 12,
    marginHorizontal: 14,
    marginTop: 10,
    overflow: 'hidden',
  },
  miniPlayerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
  },
  miniPlayerInfo: {
    flex: 1,
    marginRight: 8,
  },
  miniPlayerTag: {
    color: '#D4F458',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  miniPlayerTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  miniPlayerArtist: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 1,
  },
  miniPlayerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  miniCoSignBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF8C00',
    paddingVertical: 6,
    paddingHorizontal: 9,
    borderRadius: 8,
    gap: 4,
  },
  miniCoSignBtnVoted: {
    backgroundColor: '#D4F458',
  },
  miniCoSignBtnText: {
    color: '#000000',
    fontSize: 11,
    fontWeight: '800',
  },
  miniCoSignBtnTextVoted: {
    color: '#0B0C10',
  },
  miniSkipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#202533',
    paddingVertical: 6,
    paddingHorizontal: 9,
    borderRadius: 8,
    gap: 4,
  },
  miniSkipText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  miniProgressBarTrack: {
    height: 3,
    backgroundColor: '#242936',
    width: '100%',
  },
  miniProgressBarFill: {
    height: '100%',
    backgroundColor: '#D4F458',
  },
  quotaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  quotaLabel: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  quotaValue: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '700',
  },
  quotaExhausted: {
    color: '#FF8C00',
  },
  quotaDivider: {
    color: '#333B4F',
    fontSize: 12,
  },
  subHeader: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 8,
  },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContainer: {
    paddingHorizontal: 14,
    paddingTop: 6,
    paddingBottom: 36,
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 20,
  },
  noSongsText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#E2E8F0',
    textAlign: 'center',
    marginTop: 12,
  },
  emptySub: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 4,
  },
  songCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#151821',
    padding: 12,
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#242936',
  },
  songCardActiveRadio: {
    borderLeftWidth: 3,
    borderLeftColor: '#D4F458',
    backgroundColor: '#181C26',
  },
  songRowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10,
  },
  songCover: {
    width: 54,
    height: 54,
    borderRadius: 10,
    marginRight: 12,
    backgroundColor: '#202534',
  },
  fallbackCover: {
    width: 54,
    height: 54,
    borderRadius: 10,
    marginRight: 12,
    backgroundColor: '#1C202E',
    borderWidth: 1,
    borderColor: '#2B3245',
    alignItems: 'center',
    justifyContent: 'center',
  },
  songInfo: {
    flex: 1,
  },
  songName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 3,
  },
  artistName: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: 3,
  },
  linerNoteText: {
    fontSize: 12,
    fontStyle: 'italic',
    color: '#E2E8F0',
    marginBottom: 4,
    lineHeight: 16,
  },
  attributionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginVertical: 4,
  },
  curatorPill: {
    backgroundColor: '#1E2430',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#2A3142',
  },
  curatorLabelText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
  },
  curatorHandleText: {
    color: '#FF8C00',
    fontWeight: '700',
  },
  coSignersWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 2,
  },
  miniAvatarSlot: {
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#151821',
  },
  miniAvatarOverlap: {
    marginLeft: -6,
  },
  overflowBadge: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '700',
    marginLeft: 4,
  },
  songScore: {
    fontSize: 12,
    color: '#FF8C00',
    fontWeight: '700',
  },
  voteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF8C00',
    minWidth: 64,
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 12,
    gap: 4,
  },
  trackCardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  overflowBtn: {
    minWidth: 38,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A1E29',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#262D3D',
    paddingHorizontal: 8,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 24,
    paddingHorizontal: 16,
  },
  actionSheetCard: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#151821',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#242936',
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
  },
  actionSheetHeader: {
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#242936',
    paddingBottom: 12,
  },
  actionSheetTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  actionSheetSubtitle: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 2,
  },
  actionSheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1B1E29',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#262E3E',
    gap: 12,
  },
  actionItemTextWrap: {
    flex: 1,
  },
  actionItemTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  actionItemSub: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
  },
  actionSheetCancelBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#202430',
    marginTop: 4,
  },
  actionSheetCancelText: {
    color: '#CBD5E1',
    fontSize: 14,
    fontWeight: '700',
  },
  voteButtonVoted: {
    backgroundColor: '#D4F458',
    borderWidth: 1,
    borderColor: '#D4F458',
  },
  voteButtonDisabled: {
    backgroundColor: '#1E2430',
    borderWidth: 1,
    borderColor: '#2A3142',
  },
  voteButtonLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#000000',
  },
  voteButtonVotedLabel: {
    color: '#0B0C10',
    fontWeight: '800',
  },
  voteButtonDisabledLabel: {
    color: '#64748B',
    fontWeight: '700',
  },
  addSongButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    paddingVertical: 14,
    backgroundColor: '#FF8C00',
    borderRadius: 14,
    gap: 8,
  },
  addSongButtonDisabled: {
    backgroundColor: '#1E2430',
    borderWidth: 1,
    borderColor: '#2A3142',
  },
  addSongButtonLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: '#000000',
  },
  addSongButtonDisabledLabel: {
    color: '#64748B',
  },
});

export default Pickerchoosers;
