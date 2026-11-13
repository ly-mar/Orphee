// ViewChoicesScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  FlatList,
  SafeAreaView,
  StyleSheet,
  Alert,
  TouchableOpacity,
  Image,
} from 'react-native';
import { Text, Card, IconButton, FAB } from 'react-native-paper';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { FontAwesome5 } from '@expo/vector-icons';
import { db, auth } from './firebaseConfig';
import { useLock } from './LockContext';
import { normalizeYour13List } from './utils/playlistUtils';

function ViewChoicesScreen({ route, navigation }) {
  const initialChoices = normalizeYour13List(route?.params?.selectedChoices || []);
  const parentRemoveChoice = route?.params?.removeChoice;
  const routeUserId = route?.params?.userId;

  const [choices, setChoices] = useState(initialChoices);
  const [userId, setUserId] = useState(routeUserId || auth.currentUser?.uid || null);
  const { isLocked, lockTime } = useLock();

  useEffect(() => {
    setChoices(normalizeYour13List(initialChoices));
  }, [initialChoices]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      const activeUid = routeUserId || user?.uid || null;
      setUserId(activeUid);

      if (activeUid && initialChoices.length === 0) {
        try {
          const snap = await getDoc(doc(db, 'playlists', activeUid));
          if (snap.exists() && Array.isArray(snap.data().songs)) {
            setChoices(normalizeYour13List(snap.data().songs));
          }
        } catch (err) {
          console.error('Error loading choices in ViewChoicesScreen:', err);
        }
      }
    });

    return () => unsubscribe();
  }, [routeUserId]);

  const confirmRemoveChoice = (item) => {
    if (isLocked && choices.length === 13) {
      return;
    }

    Alert.alert(
      'Remove Music',
      `Are you sure you want to remove "${item.trackName}" from your Your13?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => handleRemoveChoice(item),
        },
      ],
      { cancelable: true }
    );
  };

  const handleRemoveChoice = async (item) => {
    if (isLocked && choices.length === 13) return;

    const updatedChoices = choices.filter((choice) => choice.trackId !== item.trackId);
    setChoices(updatedChoices);

    if (typeof parentRemoveChoice === 'function') {
      parentRemoveChoice(item);
    }

    if (userId) {
      try {
        const playlistRef = doc(db, 'playlists', userId);
        await setDoc(
          playlistRef,
          {
            songs: updatedChoices,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      } catch (error) {
        console.error('Error removing music from Firestore:', error);
      }
    }
  };

  const getHighResImage = (imageUrl) => {
    if (!imageUrl) return 'https://via.placeholder.com/400';
    return imageUrl.replace('100x100', '400x400');
  };

  const renderChoice = ({ item, index }) => {
    const releaseYear = item.releaseDate
      ? new Date(item.releaseDate).getFullYear()
      : '';

    return (
      <Card style={styles.choiceCard}>
        <TouchableOpacity
          style={styles.cardRow}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('SongDetails', { song: item })}
        >
          <View style={styles.slotBadge}>
            <Text style={styles.slotBadgeText}>#{index + 1}</Text>
          </View>
          <Image
            source={{ uri: getHighResImage(item.artworkUrl100) }}
            style={styles.choiceCover}
          />
          <View style={styles.choiceInfo}>
            <Text style={styles.choiceTitle} numberOfLines={1}>
              {item.trackName}
            </Text>
            <Text style={styles.choiceSubtitle} numberOfLines={1}>
              {item.artistName}
            </Text>
            <Text style={styles.choiceMeta} numberOfLines={1}>
              {item.collectionName ? `${item.collectionName} • ` : ''}
              {item.primaryGenreName}
              {releaseYear ? ` • ${releaseYear}` : ''}
            </Text>
          </View>
          <IconButton
            icon="delete-outline"
            iconColor={isLocked && choices.length === 13 ? '#555' : '#FC8181'}
            size={22}
            disabled={isLocked && choices.length === 13}
            style={isLocked && choices.length === 13 ? { opacity: 0.35 } : null}
            onPress={() => {
              if (isLocked && choices.length === 13) return;
              confirmRemoveChoice(item);
            }}
          />
        </TouchableOpacity>
      </Card>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topHeader}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back to Your13</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Your Choices ({choices.length}/13)</Text>
        <View style={{ width: 60 }} />
      </View>

      {isLocked && choices.length === 13 && (
        <View style={styles.lockBanner}>
          <FontAwesome5 name="lock" size={13} color="#FFD700" style={{ marginRight: 6 }} />
          <Text style={styles.lockBannerText}>
            Selections locked for {lockTime}s
          </Text>
        </View>
      )}

      <FlatList
        data={choices}
        keyExtractor={(item, idx) => `${item.trackId || idx}`}
        renderItem={renderChoice}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>No songs selected yet.</Text>
          </View>
        }
      />

      <FAB
        icon="arrow-left"
        style={styles.fab}
        color="#000000"
        onPress={() => navigation.goBack()}
        label="Back to Search"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0E12',
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#20242E',
  },
  backButton: {
    backgroundColor: '#1A1D24',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  lockBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    borderColor: '#FFD700',
    borderWidth: 1,
    paddingVertical: 6,
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 8,
  },
  lockBannerText: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: '700',
  },
  listContent: {
    padding: 16,
    paddingBottom: 110,
  },
  choiceCard: {
    marginBottom: 10,
    backgroundColor: '#16181F',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#242834',
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
  },
  slotBadge: {
    backgroundColor: '#FF8C00',
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: 6,
    marginRight: 10,
  },
  slotBadgeText: {
    color: '#000000',
    fontSize: 11,
    fontWeight: '800',
  },
  choiceCover: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
    backgroundColor: '#23262F',
  },
  choiceInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  choiceTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  choiceSubtitle: {
    fontSize: 13,
    color: '#CBD5E1',
    marginBottom: 2,
  },
  choiceMeta: {
    fontSize: 11,
    color: '#718096',
  },
  emptyBox: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#718096',
    fontSize: 14,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 20,
    backgroundColor: '#FF8C00',
  },
});

export default ViewChoicesScreen;