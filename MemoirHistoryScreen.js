// MemoirHistoryScreen.js
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { IconButton, Button, Modal, Portal } from 'react-native-paper';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { FontAwesome5, Feather } from '@expo/vector-icons';
import { auth, db } from './firebaseConfig';
import { normalizeTrack } from './services/musicApi';
import { loadUserMemoirHistory } from './utils/memoirUtils';
import { createAudioPreviewController } from './audioPreviewController';

export { loadUserMemoirHistory };

const getHighResImage = (imageUrl) => {
  if (!imageUrl) return 'https://via.placeholder.com/400';
  return imageUrl.replace('100x100', '400x400');
};

const isSameMemoir = (a, b) => {
  if (!a || !b) return false;
  if (a.id && b.id && a.id === b.id) return true;

  const secA = a.timestamp?.seconds ?? a.timestamp;
  const secB = b.timestamp?.seconds ?? b.timestamp;
  const trackA = a.item?.trackId || a.item?.id || a.item?.trackName;
  const trackB = b.item?.trackId || b.item?.id || b.item?.trackName;

  return secA === secB && a.comment === b.comment && trackA === trackB;
};

const MemoirHistoryScreen = ({ route, navigation }) => {
  const userId = route?.params?.userId || auth.currentUser?.uid;
  const initialMemoirs = route?.params?.pastMemoirs || [];

  const [pastMemoirs, setPastMemoirs] = useState(initialMemoirs);
  const [loading, setLoading] = useState(initialMemoirs.length === 0);
  const [memoirToDelete, setMemoirToDelete] = useState(null);
  const [visible, setVisible] = useState(false);
  const [playingTrackId, setPlayingTrackId] = useState(null);

  const audioControllerRef = useRef(null);
  if (!audioControllerRef.current) {
    audioControllerRef.current = createAudioPreviewController({
      onStatusChange: (status) => {
        if (status?.didJustFinish) {
          setPlayingTrackId(null);
        }
      },
      onError: () => {
        setPlayingTrackId(null);
      },
    });
  }

  useEffect(() => {
    const unsub = navigation?.addListener?.('blur', () => {
      audioControllerRef.current?.stop?.();
      setPlayingTrackId(null);
    });
    return () => {
      unsub?.();
      audioControllerRef.current?.dispose?.();
    };
  }, [navigation]);

  const togglePreview = async (track) => {
    const trackKey = track.trackId || track.id || track.trackName;
    const previewUrl = track.previewUrl || track.item?.previewUrl;
    if (!previewUrl) return;

    if (playingTrackId === trackKey) {
      await audioControllerRef.current?.stop?.();
      setPlayingTrackId(null);
      return;
    }

    setPlayingTrackId(trackKey);
    const started = await audioControllerRef.current.play(previewUrl);
    if (!started) {
      setPlayingTrackId(null);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const fetchMemoirsFromFirestore = async () => {
      if (!userId) {
        setLoading(false);
        return;
      }
      try {
        const history = await loadUserMemoirHistory({
          uid: userId,
          fetchUserDoc: (uid) => getDoc(doc(db, 'memoirs', uid)),
          fetchRootCollection: async (uid) => {
            const q = query(collection(db, 'memoirs'), where('userId', '==', uid));
            const snap = await getDocs(q);
            return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          },
        });
        if (isMounted) {
          setPastMemoirs(history);
        }
      } catch (error) {
        console.error('Error loading memoir history:', error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchMemoirsFromFirestore();
    return () => {
      isMounted = false;
    };
  }, [userId]);

  const deleteMemoir = async () => {
    if (!memoirToDelete || !userId) {
      hideDialog();
      return;
    }

    try {
      const userRef = doc(db, 'memoirs', userId);
      const snap = await getDoc(userRef);
      const serverMemoirs = snap.exists() ? snap.data()?.pastMemoirs || [] : pastMemoirs;

      const filteredMemoirs = serverMemoirs.filter(
        (m) => !isSameMemoir(m, memoirToDelete)
      );

      await setDoc(userRef, { pastMemoirs: filteredMemoirs }, { merge: true });

      setPastMemoirs((prev) => prev.filter((m) => !isSameMemoir(m, memoirToDelete)));
    } catch (error) {
      console.error('Error deleting memoir:', error);
    } finally {
      hideDialog();
    }
  };

  const showDeleteConfirmation = (memoir) => {
    setMemoirToDelete(memoir);
    setVisible(true);
  };

  const hideDialog = () => {
    setVisible(false);
    setMemoirToDelete(null);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.topHeader}>
        <TouchableOpacity onPress={() => navigation?.goBack()} style={styles.backBtn}>
          <FontAwesome5 name="arrow-left" size={14} color="#FFF" />
          <Text style={styles.backBtnText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.pageTitle}>Memoir History</Text>
        <View style={{ width: 64 }} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#FF8C00" style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.container}>
          {pastMemoirs.length > 0 ? (
            pastMemoirs.map((memoir, index) => {
              const track = normalizeTrack(memoir.item || memoir);
              const trackKey = track.trackId || track.id || track.trackName;
              const isPlaying = playingTrackId === trackKey;
              return (
                <View key={memoir.id || index} style={styles.memoirItemContainer}>
                  <View style={styles.cardHeaderRow}>
                    <TouchableOpacity
                      style={styles.coverAndTrackInfoContainer}
                      onPress={() => navigation?.navigate('SongDetails', { song: track })}
                    >
                      <Image
                        source={{ uri: getHighResImage(track.artworkUrl100 || track.imageUrl) }}
                        style={styles.coverImage}
                      />
                      <View style={styles.headerTextGroup}>
                        <Text style={styles.trackTitle} numberOfLines={1}>
                          {track.trackName}
                        </Text>
                        <Text style={styles.trackArtist} numberOfLines={1}>
                          {track.artistName}
                        </Text>
                      </View>
                    </TouchableOpacity>

                    <View style={styles.cardActionGroup}>
                      {Boolean(track.previewUrl) && (
                        <TouchableOpacity
                          style={[styles.playPreviewBtn, isPlaying && styles.playPreviewBtnActive]}
                          onPress={() => togglePreview(track)}
                          accessibilityLabel={isPlaying ? 'Stop preview' : 'Play 30s preview'}
                        >
                          <FontAwesome5
                            name={isPlaying ? 'stop' : 'play'}
                            size={11}
                            color={isPlaying ? '#0B0C10' : '#D4F458'}
                          />
                        </TouchableOpacity>
                      )}
                      <IconButton
                        icon="delete-outline"
                        iconColor="#FC8181"
                        size={20}
                        onPress={() => showDeleteConfirmation(memoir)}
                        style={{ margin: 0 }}
                      />
                    </View>
                  </View>

                  {/* Context Pill & Standout Line */}
                  <View style={styles.metaRow}>
                    <View style={styles.contextPill}>
                      <Text style={styles.contextPillText}>
                        {memoir.contextTag || 'Late Night'}
                      </Text>
                    </View>
                    {Boolean(memoir.standoutLine) && (
                      <Text style={styles.standoutLineText} numberOfLines={1}>
                        "{memoir.standoutLine}"
                      </Text>
                    )}
                  </View>

                  <View style={styles.commentDisplayContainer}>
                    <Text style={styles.commentDisplayText}>"{memoir.comment}"</Text>
                  </View>
                </View>
              );
            })
          ) : (
            <Text style={styles.noMemoirsText}>No memoirs archived yet.</Text>
          )}
        </ScrollView>
      )}

      <Portal>
        <Modal
          visible={visible}
          onDismiss={hideDialog}
          contentContainerStyle={styles.modalContainer}
        >
          <Text style={styles.modalText}>
            Are you sure you want to delete this memoir?
          </Text>
          <Button
            onPress={deleteMemoir}
            mode="contained"
            buttonColor="#E53E3E"
            textColor="#FFFFFF"
            style={styles.deleteButton}
          >
            Delete
          </Button>
          <Button onPress={hideDialog} mode="outlined" textColor="#CBD5E1">
            Cancel
          </Button>
        </Modal>
      </Portal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0D0E12',
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
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 6,
  },
  backBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  container: {
    padding: 16,
    paddingBottom: 90,
  },
  memoirItemContainer: {
    marginBottom: 14,
    backgroundColor: '#161922',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#242936',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  coverAndTrackInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  coverImage: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: '#1E2430',
  },
  headerTextGroup: {
    marginLeft: 12,
    flex: 1,
  },
  trackTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  trackArtist: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  cardActionGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  playPreviewBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#1E2430',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#D4F458',
  },
  playPreviewBtnActive: {
    backgroundColor: '#D4F458',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  contextPill: {
    backgroundColor: '#1E2430',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D4F458',
  },
  contextPillText: {
    color: '#D4F458',
    fontSize: 11,
    fontWeight: '700',
  },
  standoutLineText: {
    color: '#E2E8F0',
    fontSize: 12,
    fontStyle: 'italic',
    flex: 1,
  },
  commentDisplayContainer: {
    backgroundColor: '#0F1117',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  commentDisplayText: {
    fontSize: 13,
    color: '#CBD5E1',
    lineHeight: 19,
  },
  noMemoirsText: {
    textAlign: 'center',
    color: '#718096',
    marginTop: 40,
    fontSize: 15,
  },
  modalContainer: {
    backgroundColor: '#161922',
    padding: 20,
    borderRadius: 14,
    marginHorizontal: 30,
    borderWidth: 1,
    borderColor: '#2A3142',
  },
  modalText: {
    fontSize: 16,
    color: '#FFFFFF',
    marginBottom: 18,
    textAlign: 'center',
    fontWeight: '600',
  },
  deleteButton: {
    marginBottom: 10,
  },
  taskbarContainer: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    backgroundColor: '#0D1017',
  },
});

export default MemoirHistoryScreen;