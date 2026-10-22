// MemoirHistoryScreen.js
import React, { useState, useEffect } from 'react';
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
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { FontAwesome5 } from '@expo/vector-icons';
import { auth, db } from './firebaseConfig';
import Taskbar from './Taskbar';
import { normalizeTrack } from './Memoir';

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

  useEffect(() => {
    const fetchMemoirsFromFirestore = async () => {
      if (!userId) {
        setLoading(false);
        return;
      }
      try {
        const userRef = doc(db, 'memoirs', userId);
        const snap = await getDoc(userRef);
        if (snap.exists() && Array.isArray(snap.data()?.pastMemoirs)) {
          const sorted = [...snap.data().pastMemoirs].sort(
            (a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0)
          );
          setPastMemoirs(sorted);
        }
      } catch (error) {
        console.error('Error loading memoir history:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMemoirsFromFirestore();
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
              const track = normalizeTrack(memoir.item || {});
              return (
                <View key={memoir.id || index} style={styles.memoirItemContainer}>
                  <TouchableOpacity
                    style={styles.coverAndTrackInfoContainer}
                    onPress={() => navigation?.navigate('SongDetails', { song: track })}
                  >
                    <Image
                      source={{ uri: getHighResImage(track.artworkUrl100) }}
                      style={styles.coverImage}
                    />
                    <Text style={styles.trackTitle} numberOfLines={2}>
                      {track.trackName} — {track.artistName}
                    </Text>
                  </TouchableOpacity>

                  <View style={styles.commentDisplayContainer}>
                    <Text style={styles.commentDisplayText}>"{memoir.comment}"</Text>
                  </View>

                  <IconButton
                    icon="delete-outline"
                    iconColor="#FC8181"
                    size={22}
                    onPress={() => showDeleteConfirmation(memoir)}
                  />
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

      <View style={styles.taskbarContainer}>
        <Taskbar />
      </View>
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
    flexDirection: 'row',
    marginBottom: 14,
    backgroundColor: '#161922',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#242936',
  },
  coverAndTrackInfoContainer: {
    width: 110,
    alignItems: 'center',
  },
  coverImage: {
    width: 88,
    height: 88,
    borderRadius: 8,
  },
  trackTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
    textAlign: 'center',
  },
  commentDisplayContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  commentDisplayText: {
    fontSize: 15,
    fontStyle: 'italic',
    color: '#E2E8F0',
    lineHeight: 20,
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