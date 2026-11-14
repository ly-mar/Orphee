// ProfileScreen.js
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Image,
  ImageBackground,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Dimensions,
} from 'react-native';
import { Text } from 'react-native-paper';
import { auth, db, storage } from './firebaseConfig';
import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
} from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import * as ImagePicker from 'expo-image-picker';
import { FontAwesome5, Feather, Ionicons } from '@expo/vector-icons';
import moment from 'moment';
import Taskbar from './Taskbar';
import { createAudioPreviewController } from './audioPreviewController';
import { normalizeYour13List } from './utils/playlistUtils';
import { normalizeAndSortMediaList } from './utils/avatarUtils';
import { confirm, toast } from './crossPlatformAlert';
import {
  getCachedUserProfile,
  setCachedUserProfile,
  getCachedMemoirs,
  setCachedMemoirs,
} from './utils/sessionCache';

const { width: WINDOW_WIDTH } = Dimensions.get('window');

const DEFAULT_AVATAR_BG =
  'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80';

const getHighResImage = (url) => {
  if (!url || typeof url !== 'string') {
    return null;
  }
  return url.replace('100x100bb', '600x600bb').replace('100x100', '600x600');
};

const normalizeGenreTag = (rawGenre) => {
  const cleaned = String(rawGenre || '').trim();
  if (!cleaned || /^music$/i.test(cleaned)) return '';
  if (/^(r&b|rnb|soul|neo-soul|contemporary r&b)/i.test(cleaned) || /r&b\s*\/\s*soul/i.test(cleaned)) {
    return 'R&B/Soul';
  }
  if (/hip[\s-]?hop|rap/i.test(cleaned)) {
    return 'Hip-Hop';
  }
  if (/k[\s-]?pop/i.test(cleaned)) {
    return 'K-Pop';
  }
  if (/afro/i.test(cleaned)) {
    return 'Afrobeats';
  }
  if (/kompa|konpa/i.test(cleaned)) {
    return 'Kompa';
  }
  return cleaned;
};

/**
 * Client-side image compressor for Web & Native to minimize Firebase Spark bandwidth
 * and generate a compact data-URI fallback if the bucket quota is exhausted.
 */
export const compressImageForUpload = async (uri, maxDim = 400, quality = 0.72) => {
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    return new Promise((resolve, reject) => {
      const img = new window.Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width || maxDim;
        let height = img.height || maxDim;

        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        canvas.toBlob(
          (blob) => {
            resolve({
              blob,
              dataUrl,
              contentType: 'image/jpeg',
            });
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = (err) => reject(err);
      img.src = uri;
    });
  }

  // Native fallback
  const response = await fetch(uri);
  const rawBlob = await response.blob();
  const contentType =
    rawBlob.type && rawBlob.type.startsWith('image/') ? rawBlob.type : 'image/jpeg';

  let dataUrl = uri;
  if (typeof FileReader !== 'undefined') {
    dataUrl = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result || uri);
      reader.onerror = () => resolve(uri);
      reader.readAsDataURL(rawBlob);
    });
  }

  return {
    blob: rawBlob,
    dataUrl,
    contentType,
  };
};

function ProfileScreen({ navigation }) {
  const currentUid = auth.currentUser?.uid;
  const cachedUser = currentUid ? getCachedUserProfile(currentUid) : null;
  const cachedMemoirsList = currentUid ? getCachedMemoirs(currentUid) : null;

  const [userInfo, setUserInfo] = useState(
    cachedUser || {
      username: auth.currentUser?.displayName || 'Sigma',
      displayName: auth.currentUser?.displayName || 'Sigma',
      email: auth.currentUser?.email || '',
      profileImageUrl: auth.currentUser?.photoURL || '',
      bio: 'Curating sonic worlds, 13 essential tracks & timeless music memoirs.',
    }
  );
  const [selectedSongs, setSelectedSongs] = useState(
    cachedUser?.songs || cachedUser?.your13 || []
  );
  const [memoirs, setMemoirs] = useState(cachedMemoirsList || []);
  const [mediaList, setMediaList] = useState(
    cachedUser?.profileImageUrl
      ? [{ id: 'primary', imageUrl: cachedUser.profileImageUrl, resolvedUrl: cachedUser.profileImageUrl }]
      : []
  );
  const [friendsCount, setFriendsCount] = useState(cachedUser?.friendsCount || 0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(!cachedUser && !auth.currentUser);
  const [uploading, setUploading] = useState(false);

  // UI/UX State matching attached reference designs
  const [activeTab, setActiveTab] = useState('your13'); // 'your13' | 'memoirs' | 'sonicTwin'
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const [activeGenreFilter, setActiveGenreFilter] = useState(null);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [selectedMemoir, setSelectedMemoir] = useState(null);
  const [deletingMemoirId, setDeletingMemoirId] = useState(null);

  // Audio Preview State
  const audioControllerRef = useRef(null);
  const [playingTrackId, setPlayingTrackId] = useState(null);
  const hasLoadedOnceRef = useRef(false);

  const carouselRef = useRef(null);
  const userId = auth.currentUser?.uid;

  if (!audioControllerRef.current) {
    audioControllerRef.current = createAudioPreviewController({
      onStatusChange: (status) => {
        if (status?.didJustFinish) {
          setPlayingTrackId(null);
        }
      },
      onError: (msg) => {
        setPlayingTrackId(null);
        Alert.alert('Preview Unavailable', msg || 'Could not play preview for this track.');
      },
    });
  }

  const stopAudio = useCallback(async () => {
    await audioControllerRef.current?.stop?.();
    setPlayingTrackId(null);
  }, []);

  useEffect(() => {
    const unsubscribeBlur = navigation?.addListener?.('blur', () => {
      stopAudio();
    });
    return () => {
      unsubscribeBlur?.();
      audioControllerRef.current?.dispose?.();
    };
  }, [navigation, stopAudio]);

  const handleTogglePreview = async (track) => {
    const previewUrl = track?.previewUrl || track?.audioUrl;
    const trackKey = track?.trackId || track?.id || track?.trackName || track?.title;

    if (!previewUrl) {
      Alert.alert('Preview Unavailable', 'No 30-second audio preview is available for this track.');
      return;
    }

    if (playingTrackId === trackKey) {
      await stopAudio();
      return;
    }

    setPlayingTrackId(trackKey);
    const started = await audioControllerRef.current.play(previewUrl);
    if (!started) {
      setPlayingTrackId(null);
    }
  };

  const fetchUserData = useCallback(async ({ silent = false } = {}) => {
    const currentUid = auth.currentUser?.uid;
    if (!currentUid) {
      setLoading(false);
      return;
    }

    try {
      if (!silent && !hasLoadedOnceRef.current) {
        setLoading(true);
      }
      const userDocRef = doc(db, 'users', currentUid);
      const userDocSnap = await getDoc(userDocRef);

      let userData = {
        username: auth.currentUser?.displayName || 'Sigma',
        email: auth.currentUser?.email || '',
        bio: 'Curating sonic worlds, 13 essential tracks & timeless music memoirs.',
        profileImageUrl: '',
      };

      if (userDocSnap.exists()) {
        userData = { ...userData, ...userDocSnap.data() };
      }

      // 1. Resolve Avatar & Media List sorted by newest first
      let resolvedAvatar = userData.profileImageUrl || '';
      const imgQuery = query(collection(db, 'images'), where('userId', '==', currentUid));
      const imgSnapshot = await getDocs(imgQuery);
      const uploadedImages = normalizeAndSortMediaList(
        imgSnapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
      ).map((item) => ({ ...item, imageUrl: item.resolvedUrl }));

      if (!resolvedAvatar && uploadedImages.length > 0) {
        resolvedAvatar = uploadedImages[0].resolvedUrl;
      }
      setMediaList(
        resolvedAvatar
          ? [{ id: 'primary', imageUrl: resolvedAvatar, resolvedUrl: resolvedAvatar }, ...uploadedImages]
          : uploadedImages
      );
      setUserInfo({ ...userData, profileImageUrl: resolvedAvatar });

      // 2. Dual-Lookup for "Your 13" Playlist:
      // Primary: playlists/{userId} -> Fallback: playlists/{username}
      let loadedSongs = [];
      const uidPlaylistRef = doc(db, 'playlists', currentUid);
      const uidPlaylistSnap = await getDoc(uidPlaylistRef);

      if (uidPlaylistSnap.exists()) {
        const rawUidSongs = uidPlaylistSnap.data()?.songs;
        const parsedUidSongs = Array.isArray(rawUidSongs)
          ? rawUidSongs
          : Object.values(rawUidSongs || {});
        if (parsedUidSongs.length > 0) {
          loadedSongs = parsedUidSongs;
        }
      }

      // Check username document for fallback or stale cleanup
      if (userData.username) {
        const usernamePlaylistRef = doc(db, 'playlists', userData.username);
        const usernamePlaylistSnap = await getDoc(usernamePlaylistRef);

        if (usernamePlaylistSnap.exists()) {
          const rawNameSongs = usernamePlaylistSnap.data()?.songs;
          const parsedNameSongs = Array.isArray(rawNameSongs)
            ? rawNameSongs
            : Object.values(rawNameSongs || {});

          if (loadedSongs.length === 0 && parsedNameSongs.length > 0) {
            // Migrate legacy username playlist to playlists/{uid}
            loadedSongs = parsedNameSongs;
            await setDoc(
              uidPlaylistRef,
              {
                userId: currentUid,
                username: userData.username,
                songs: loadedSongs,
                updatedAt: new Date().toISOString(),
              },
              { merge: true }
            );
          } else if (
            loadedSongs.length > 0 &&
            parsedNameSongs.length === 0 &&
            userData.username !== currentUid
          ) {
            // Clean up stale empty playlists/{username} placeholder (e.g. playlists/Sigma)
            try {
              await deleteDoc(usernamePlaylistRef);
            } catch (_) { }
          }
        }
      }

      setSelectedSongs(normalizeYour13List(loadedSongs).slice(0, 13));

      // 3. Fetch Memoirs by userId AND username to ensure complete history
      const memoirsMap = new Map();

      // Check legacy doc(db, 'memoirs', currentUid) holding pastMemoirs array
      try {
        const legacyDocSnap = await getDoc(doc(db, 'memoirs', currentUid));
        if (legacyDocSnap.exists()) {
          const lData = legacyDocSnap.data();
          if (Array.isArray(lData?.pastMemoirs)) {
            lData.pastMemoirs.forEach((pm, idx) => {
              const pmId = pm.id || `${currentUid}_${idx}`;
              memoirsMap.set(pmId, {
                id: pmId,
                title: pm.item?.trackName || pm.trackName || pm.title || 'Untitled Track',
                trackName: pm.item?.trackName || pm.trackName || pm.title || 'Untitled Track',
                artist: pm.item?.artistName || pm.artistName || pm.artist || 'Unknown Artist',
                artistName: pm.item?.artistName || pm.artistName || pm.artist || 'Unknown Artist',
                imageUrl: pm.item?.imageUrl || pm.item?.artworkUrl100 || pm.imageUrl || pm.artworkUrl100,
                artworkUrl100: pm.item?.artworkUrl100 || pm.artworkUrl100,
                previewUrl: pm.item?.previewUrl || pm.previewUrl,
                comment: pm.comment || '',
                timestamp: pm.timestamp,
                userId: currentUid,
              });
            });
          }
        }
      } catch (_) { }

      // Fetch individual memoir documents from 'memoirs' collection
      try {
        const uidMemoirQuery = query(
          collection(db, 'memoirs'),
          where('userId', '==', currentUid)
        );
        const uidMemoirSnap = await getDocs(uidMemoirQuery);
        uidMemoirSnap.forEach((docSnap) => {
          const data = docSnap.data();
          if (data && Array.isArray(data.pastMemoirs)) {
            data.pastMemoirs.forEach((pm, idx) => {
              const pmId = pm.id || `${docSnap.id}_${idx}`;
              memoirsMap.set(pmId, {
                id: pmId,
                title: pm.item?.trackName || pm.trackName || pm.title || 'Untitled Track',
                trackName: pm.item?.trackName || pm.trackName || pm.title || 'Untitled Track',
                artist: pm.item?.artistName || pm.artistName || pm.artist || 'Unknown Artist',
                artistName: pm.item?.artistName || pm.artistName || pm.artist || 'Unknown Artist',
                imageUrl: pm.item?.imageUrl || pm.item?.artworkUrl100 || pm.imageUrl || pm.artworkUrl100,
                artworkUrl100: pm.item?.artworkUrl100 || pm.artworkUrl100,
                previewUrl: pm.item?.previewUrl || pm.previewUrl,
                comment: pm.comment || '',
                timestamp: pm.timestamp,
                userId: currentUid,
              });
            });
          } else {
            memoirsMap.set(docSnap.id, { id: docSnap.id, ...data });
          }
        });
      } catch (_) { }

      if (userData.username) {
        try {
          const nameMemoirQuery = query(
            collection(db, 'memoirs'),
            where('username', '==', userData.username)
          );
          const nameMemoirSnap = await getDocs(nameMemoirQuery);
          nameMemoirSnap.forEach((docSnap) => {
            if (!memoirsMap.has(docSnap.id)) {
              memoirsMap.set(docSnap.id, { id: docSnap.id, ...docSnap.data() });
            }
          });
        } catch (_) { }
      }

      const sortedMemoirs = Array.from(memoirsMap.values()).sort((a, b) => {
        const timeA = a.timestamp?.seconds
          ? a.timestamp.seconds * 1000
          : new Date(a.timestamp || a.createdAt || 0).getTime();
        const timeB = b.timestamp?.seconds
          ? b.timestamp.seconds * 1000
          : new Date(b.timestamp || b.createdAt || 0).getTime();
        return timeB - timeA;
      });
      setMemoirs(sortedMemoirs);

      // 4. Fetch Friends (aligned with FriendsScreen requests doc) & Unread Notifications Count
      try {
        const reqSnap = await getDoc(doc(db, 'requests', currentUid));
        if (reqSnap.exists()) {
          const reqData = reqSnap.data() || {};
          const uniqueFriendIds = new Set([
            ...Object.keys(reqData.followers || {}),
            ...Object.keys(reqData.following || {}),
          ]);
          setFriendsCount(uniqueFriendIds.size);
        } else {
          const friendsSnap = await getDocs(collection(db, 'users', currentUid, 'friends'));
          setFriendsCount(friendsSnap.size);
        }
      } catch (_) { }

      try {
        const notifQuery = query(
          collection(db, 'notifications'),
          where('recipientId', '==', currentUid),
          where('read', '==', false)
        );
        const notifSnap = await getDocs(notifQuery);
        setUnreadCount(notifSnap.size);
      } catch (_) { }

      if (currentUid) {
        setCachedUserProfile(currentUid, {
          ...userData,
          profileImageUrl: resolvedAvatar,
          songs: loadedSongs,
          friendsCount,
        });
        setCachedMemoirs(currentUid, sortedMemoirs);
      }
    } catch (error) {
      console.error('Error fetching profile data:', error);
      if (!silent) {
        Alert.alert(
          'Profile Sync Notice',
          'Some profile details could not be refreshed. Please check your connection.'
        );
      }
    } finally {
      hasLoadedOnceRef.current = true;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUserData({ silent: false });
    const unsubscribe = navigation?.addListener?.('focus', () => {
      fetchUserData({ silent: true });
    });
    return unsubscribe;
  }, [fetchUserData, navigation]);

  // Avatar Picker & Upload with Explicit MIME Metadata + Quota Exceeded Fallback
  const handlePickAndUploadAvatar = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Permission Required',
          'Please allow access to your photo library to update your profile picture.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.75,
      });

      if (result.canceled || !result.assets?.[0]?.uri) {
        return;
      }

      await uploadAvatarWithFallback(result.assets[0].uri);
    } catch (error) {
      console.error('Error selecting image:', error);
      Alert.alert('Image Picker Error', 'Could not open your image library. Please try again.');
    }
  };

  const uploadAvatarWithFallback = async (uri) => {
    if (!userId) {
      Alert.alert('Authentication Required', 'Please log in to update your avatar.');
      return;
    }

    setUploading(true);
    let compressedPayload = null;

    try {
      compressedPayload = await compressImageForUpload(uri, 400, 0.72);
      const { blob, contentType } = compressedPayload;

      const filename = `profile_${userId}_${Date.now()}.jpg`;
      const storageRef = ref(storage, `images/${userId}/${filename}`);

      // Explicitly pass contentType metadata so storage.rules contentType.matches('image/.*') succeeds
      const metadata = {
        contentType: contentType || 'image/jpeg',
        customMetadata: {
          uploadedBy: userId,
          updatedAt: new Date().toISOString(),
        },
      };

      const uploadTask = uploadBytesResumable(storageRef, blob, metadata);

      const downloadUrl = await new Promise((resolve, reject) => {
        uploadTask.on(
          'state_changed',
          null,
          (error) => reject(error),
          async () => {
            const url = await getDownloadURL(uploadTask.snapshot.ref);
            resolve(url);
          }
        );
      });

      await setDoc(
        doc(db, 'users', userId),
        {
          profileImageUrl: downloadUrl,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      setUserInfo((prev) => ({ ...(prev || {}), profileImageUrl: downloadUrl }));
      Alert.alert('Profile Updated', 'Your new profile portrait is now live.');
    } catch (error) {
      console.warn('Firebase Storage upload error:', error?.code || error?.message);

      // Resilient Fallback for Spark Free Tier Quota Exhaustion (storage/quota-exceeded) or CORS block
      if (compressedPayload?.dataUrl) {
        if (compressedPayload.dataUrl.length > 700 * 1024) {
          Alert.alert(
            'Upload Failed',
            'Selected photo is too large for fallback storage. Please select a smaller image.'
          );
          return;
        }
        try {
          await setDoc(
            doc(db, 'users', userId),
            {
              profileImageUrl: compressedPayload.dataUrl,
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          );
          setUserInfo((prev) => ({
            ...(prev || {}),
            profileImageUrl: compressedPayload.dataUrl,
          }));
          Alert.alert(
            'Avatar Saved (Cloud Quota Fallback)',
            'Firebase Storage daily quota was reached, so a compressed 400x400 portrait was saved directly to your profile record.'
          );
        } catch (firestoreErr) {
          console.error('Firestore avatar fallback failed:', firestoreErr);
          Alert.alert(
            'Upload Failed',
            'Unable to save your profile picture right now. Please try a smaller image.'
          );
        }
      } else {
        Alert.alert(
          'Upload Error',
          error?.code === 'storage/quota-exceeded'
            ? 'Firebase Storage daily quota has been exceeded. Please try again later.'
            : error?.message || 'An unexpected error occurred while uploading your image.'
        );
      }
    } finally {
      setUploading(false);
    }
  };

  const executeDeleteMemoir = async (memoirId) => {
    if (!memoirId) return;
    try {
      setDeletingMemoirId(memoirId);
      const currentUid = auth.currentUser?.uid;

      // 1. Remove from pastMemoirs array on doc(db, 'memoirs', currentUid)
      if (currentUid) {
        try {
          const userMemoirRef = doc(db, 'memoirs', currentUid);
          const userMemoirSnap = await getDoc(userMemoirRef);
          if (userMemoirSnap.exists() && Array.isArray(userMemoirSnap.data()?.pastMemoirs)) {
            const filtered = userMemoirSnap.data().pastMemoirs.filter(
              (pm, idx) => (pm.id || `${currentUid}_${idx}`) !== memoirId
            );
            await setDoc(userMemoirRef, { pastMemoirs: filtered }, { merge: true });
          }
        } catch (legacyErr) {
          console.warn('Could not remove memoir from user document array:', legacyErr);
        }
      }

      // 2. Also remove individual memoir document if present
      try {
        await deleteDoc(doc(db, 'memoirs', memoirId));
      } catch (_) { }

      setMemoirs((prev) => prev.filter((m) => m.id !== memoirId));
      if (selectedMemoir?.id === memoirId) {
        setSelectedMemoir(null);
      }
      toast.show({ kind: 'info', message: 'Song memoir removed.' });
    } catch (error) {
      console.error('Error deleting memoir:', error);
      toast.show({ kind: 'error', message: 'Could not delete this memoir entry.' });
    } finally {
      setDeletingMemoirId(null);
    }
  };

  const handleDeleteMemoir = async (memoirId) => {
    if (!memoirId) return;
    const ok = await confirm({
      title: 'Delete Song Memoir?',
      message: 'This will permanently remove this memoir from your profile.',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      destructive: true,
    });
    if (ok) {
      await executeDeleteMemoir(memoirId);
    }
  };

  const formatMemoirDate = (rawTimestamp) => {
    if (!rawTimestamp) return 'Recently logged';
    if (rawTimestamp?.seconds) {
      const m = moment(rawTimestamp.seconds * 1000);
      return `${m.format('MMM D, YYYY')} • ${m.fromNow()}`;
    }
    const parsed = moment(rawTimestamp);
    return parsed.isValid()
      ? `${parsed.format('MMM D, YYYY')} • ${parsed.fromNow()}`
      : 'Recently logged';
  };

  // Preserve original #1..#13 slot rank even when filtered by genre
  const rankedSongs = useMemo(
    () => selectedSongs.map((song, idx) => ({ ...song, slotRank: idx + 1 })),
    [selectedSongs]
  );

  // Consolidated Genre Tags derived from User's 13 Songs
  const genreTags = useMemo(() => {
    const counts = {};
    rankedSongs.forEach((song) => {
      const genre = normalizeGenreTag(song?.primaryGenreName || song?.genre);
      if (genre) {
        counts[genre] = (counts[genre] || 0) + 1;
      }
    });
    const sorted = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
    return sorted.length > 0 ? sorted.slice(0, 5) : ['R&B/Soul', 'Hip-Hop', 'Kompa', 'Curator'];
  }, [rankedSongs]);

  const filteredSongs = useMemo(() => {
    if (!activeGenreFilter) return rankedSongs;
    return rankedSongs.filter(
      (s) => normalizeGenreTag(s.primaryGenreName || s.genre) === activeGenreFilter
    );
  }, [rankedSongs, activeGenreFilter]);

  const scrollCarousel = (direction) => {
    const nextIndex = Math.max(
      0,
      Math.min(filteredSongs.length - 1, carouselIndex + direction)
    );
    setCarouselIndex(nextIndex);
    if (carouselRef.current) {
      carouselRef.current.scrollTo({
        x: nextIndex * 108,
        animated: true,
      });
    }
  };

  const avatarUri =
    userInfo?.profileImageUrl ||
    mediaList[0]?.imageUrl ||
    getHighResImage(selectedSongs[0]?.artworkUrl100 || selectedSongs[0]?.imageUrl) ||
    DEFAULT_AVATAR_BG;

  const displayNameLabel = userInfo?.displayName || userInfo?.username || 'Sigma';
  const featuredTrack = rankedSongs[0] || null;
  const featuredTrackArt = getHighResImage(featuredTrack?.artworkUrl100 || featuredTrack?.imageUrl);
  const latestMemoir = memoirs[0] || null;

  if (loading && !userInfo) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <ActivityIndicator size="large" color="#D4F458" />
        <Text style={styles.loadingLabel}>Loading profile...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={(e) => {
          const scrollY = e.nativeEvent?.contentOffset?.y ?? 0;
          if (scrollY < 120 && activeTab === 'sonicTwin') {
            setActiveTab('your13');
          }
        }}
      >
        {/* TOP AMBIENT HEADER BAR (Design 3: Circular Avatar + Glassmorphic Utility Icons) */}
        <View style={styles.topUtilityHeader}>
          <TouchableOpacity
            style={styles.topMiniAvatarWrap}
            onPress={() => navigation.navigate('UploadProfilePicture')}
            activeOpacity={0.85}
            accessibilityLabel="Manage profile photos"
          >
            <Image source={{ uri: avatarUri }} style={styles.topMiniAvatar} />
            <View style={styles.cameraMiniBadge}>
              <Feather name="camera" size={10} color="#0B0C10" />
            </View>
          </TouchableOpacity>

          <View style={styles.topUtilityIconsRow}>
            <TouchableOpacity
              style={styles.glassCircleBtn}
              onPress={() => navigation.navigate('UserSearchScreen')}
              accessibilityLabel="Search users"
            >
              <Feather name="search" size={18} color="#FFFFFF" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.glassCircleBtn}
              onPress={() => navigation.navigate('NotifPage')}
              accessibilityLabel="Notifications"
            >
              <Feather name="bell" size={18} color="#FFFFFF" />
              {unreadCount > 0 && (
                <View style={styles.unreadDot}>
                  <Text style={styles.unreadDotText}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.glassCircleBtn}
              onPress={() => navigation.navigate('MainChatScreen')}
              accessibilityLabel="Messages"
            >
              <Feather name="message-circle" size={18} color="#FFFFFF" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.glassCircleBtn}
              onPress={() => navigation.navigate('SettingsScreen')}
              accessibilityLabel="Settings"
            >
              <Feather name="settings" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* GREETING & CHARTREUSE PILL TABS (Design 3: image_74650d.jpg) */}
        <View style={styles.greetingSection}>
          <Text style={styles.greetingTitle}>Hi, {displayNameLabel}</Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryPillsRow}
          >
            <TouchableOpacity
              style={[
                styles.categoryPill,
                activeTab === 'your13' && styles.categoryPillActive,
              ]}
              onPress={() => setActiveTab('your13')}
            >
              <Text
                style={[
                  styles.categoryPillText,
                  activeTab === 'your13' && styles.categoryPillTextActive,
                ]}
              >
                Your 13 ({selectedSongs.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.categoryPill,
                activeTab === 'memoirs' && styles.categoryPillActive,
              ]}
              onPress={() => setActiveTab('memoirs')}
            >
              <Text
                style={[
                  styles.categoryPillText,
                  activeTab === 'memoirs' && styles.categoryPillTextActive,
                ]}
              >
                Song Memoirs ({memoirs.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.categoryPill,
                activeTab === 'sonicTwin' && styles.categoryPillActive,
              ]}
              onPress={() => setActiveTab('sonicTwin')}
            >
              <Text
                style={[
                  styles.categoryPillText,
                  activeTab === 'sonicTwin' && styles.categoryPillTextActive,
                ]}
              >
                Vibe Check
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.categoryPill, styles.categoryLinkPill]}
              onPress={() => navigation.navigate('RankedMusicList')}
              accessibilityLabel="Explore Community Top Charts"
            >
              <Text style={styles.categoryLinkPillText}>Top Charts ↗</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* EDITORIAL HERO PORTRAIT & FROSTED GLASSMORPHIC SHEET (Design 1: image_740e61.png) */}
        <View style={styles.heroCardOuter}>
          <ImageBackground
            source={{ uri: avatarUri }}
            style={[
              styles.heroImageBackground,
              sheetExpanded && styles.heroImageBackgroundExpanded,
            ]}
            imageStyle={styles.heroImageRadius}
          >
            {/* Subtle top bar inside portrait card */}
            <View style={styles.heroTopOverlayBar}>
              <TouchableOpacity
                style={styles.heroCircleIconBtn}
                onPress={() => navigation.navigate('UploadProfilePicture')}
                accessibilityLabel="Upload profile photo"
              >
                <Feather name="camera" size={15} color="#FFFFFF" />
              </TouchableOpacity>

              <Text style={styles.heroHandleTopText}>
                @{(userInfo?.username || 'sigma').toLowerCase()}
              </Text>

              <TouchableOpacity
                style={styles.editProfilePillBtn}
                onPress={() => navigation.navigate('UpdateProfileScreen')}
              >
                <Text style={styles.editProfilePillText}>Edit Profile</Text>
              </TouchableOpacity>
            </View>

            {/* Dark Frosted Glassmorphic Sheet */}
            <View style={styles.frostedGlassSheet}>
              <View style={styles.sheetDragHandle} />

              <View style={styles.sheetHeaderRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sheetDisplayName}>
                    {displayNameLabel}
                  </Text>
                  <Text style={styles.sheetHandleSub}>
                    @{(userInfo?.username || 'sigma').toLowerCase()}
                  </Text>
                </View>

                <View style={styles.sheetQuickBadgesRow}>
                  <TouchableOpacity
                    style={styles.iridescentStarCircle}
                    onPress={() => navigation.navigate('UserGraph')}
                    accessibilityLabel="Open Affinity Radar"
                  >
                    <Ionicons name="sparkles" size={16} color="#FFFFFF" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.whiteActionCircle}
                    onPress={() => navigation.navigate('FriendsScreen')}
                    accessibilityLabel="Open Friends and Requests"
                  >
                    <Ionicons name="people" size={16} color="#0B0C10" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.seeProfileToggleBtn}
                    onPress={() => setSheetExpanded((prev) => !prev)}
                    accessibilityLabel={sheetExpanded ? 'Collapse profile bio' : 'Show full profile bio'}
                  >
                    <Text style={styles.seeProfileToggleText}>
                      {sheetExpanded ? 'Hide bio' : 'See bio'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <Text style={styles.sheetBioText} numberOfLines={sheetExpanded ? 4 : 2}>
                {userInfo?.bio ||
                  'Curating sonic worlds, 13 essential tracks & timeless music memoirs.'}
              </Text>

              {/* 3-Column Metrics Row */}
              <View style={styles.statsColumnsRow}>
                <TouchableOpacity
                  style={styles.statColumn}
                  onPress={() => navigation.navigate('FriendsScreen')}
                >
                  <Text style={styles.statNumber}>{friendsCount}</Text>
                  <Text style={styles.statLabel}>Friends</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.statColumn}
                  onPress={() => setActiveTab('your13')}
                >
                  <Text style={styles.statNumber}>{selectedSongs.length}</Text>
                  <Text style={styles.statLabel}>Your 13</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.statColumn}
                  onPress={() => setActiveTab('memoirs')}
                >
                  <Text style={styles.statNumber}>{memoirs.length}</Text>
                  <Text style={styles.statLabel}>Song Memoirs</Text>
                </TouchableOpacity>
              </View>

              {/* Genre & Curator Hashtag Pills */}
              <View style={styles.hashtagPillsWrap}>
                {genreTags.map((genre) => {
                  const isSelected = activeGenreFilter === genre;
                  return (
                    <TouchableOpacity
                      key={genre}
                      style={[
                        styles.hashtagPill,
                        isSelected && styles.hashtagPillSelected,
                      ]}
                      onPress={() =>
                        setActiveGenreFilter(isSelected ? null : genre)
                      }
                    >
                      <Text
                        style={[
                          styles.hashtagPillText,
                          isSelected && styles.hashtagPillTextSelected,
                        ]}
                      >
                        #{genre.toLowerCase().replace(/[^a-z0-9]+/g, '')}
                        {isSelected ? '  ✕' : ''}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Horizontal Rounded-Square Track Carousel inside Sheet */}
              {filteredSongs.length > 0 && (
                <View style={styles.sheetCarouselSection}>
                  <ScrollView
                    ref={carouselRef}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.sheetCarouselScroll}
                  >
                    {filteredSongs.map((song, idx) => {
                      const art = getHighResImage(song.artworkUrl100 || song.imageUrl);
                      return (
                        <TouchableOpacity
                          key={`${song.trackId || idx}`}
                          style={styles.sheetCarouselThumbCard}
                          onPress={() =>
                            navigation.navigate('SongDetails', { song })
                          }
                          activeOpacity={0.88}
                        >
                          {art ? (
                            <Image
                              source={{ uri: art }}
                              style={styles.sheetCarouselThumbImg}
                            />
                          ) : (
                            <View style={[styles.sheetCarouselThumbImg, { backgroundColor: '#1E2433', alignItems: 'center', justifyContent: 'center' }]}>
                              <Ionicons name="musical-notes" size={24} color="#64748B" />
                            </View>
                          )}
                          <View style={styles.sheetThumbRankBadge}>
                            <Text style={styles.sheetThumbRankText}>
                              #{song.slotRank || idx + 1}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>

                  <View style={styles.carouselArrowsRow}>
                    <TouchableOpacity
                      style={styles.carouselArrowCircle}
                      onPress={() => scrollCarousel(-2)}
                      accessibilityLabel="Scroll tracks left"
                    >
                      <Feather name="arrow-left" size={14} color="#0B0C10" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.carouselArrowCircle}
                      onPress={() => scrollCarousel(2)}
                      accessibilityLabel="Scroll tracks right"
                    >
                      <Feather name="arrow-right" size={14} color="#0B0C10" />
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Featured Memoir Quote Footer inside Frosted Sheet */}
              {latestMemoir ? (
                <TouchableOpacity
                  style={styles.sheetTestimonialRow}
                  onPress={() => setSelectedMemoir(latestMemoir)}
                  activeOpacity={0.85}
                >
                  {getHighResImage(latestMemoir.imageUrl || latestMemoir.artworkUrl100) ? (
                    <Image
                      source={{
                        uri: getHighResImage(
                          latestMemoir.imageUrl || latestMemoir.artworkUrl100
                        ),
                      }}
                      style={styles.sheetTestimonialAvatar}
                    />
                  ) : (
                    <View style={[styles.sheetTestimonialAvatar, { backgroundColor: '#1E2433', alignItems: 'center', justifyContent: 'center' }]}>
                      <Ionicons name="musical-notes" size={16} color="#94A3B8" />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sheetTestimonialQuote} numberOfLines={3}>
                      "{latestMemoir.comment}"
                    </Text>
                    <Text style={styles.sheetTestimonialAuthor}>
                      {latestMemoir.title || latestMemoir.trackName}
                    </Text>
                    <Text style={styles.sheetTestimonialHandle}>
                      {latestMemoir.artist || latestMemoir.artistName} •{' '}
                      {formatMemoirDate(latestMemoir.timestamp)}
                    </Text>
                  </View>
                </TouchableOpacity>
              ) : null}
            </View>
          </ImageBackground>
        </View>

        {/* TAB 1: YOUR 13 CURATED PLAYLIST */}
        {activeTab === 'your13' && (
          <View style={styles.tabSectionContainer}>
            {/* Curated & Trending Lavender Spotlight Card (Design 3: image_74650d.jpg) */}
            <Text style={styles.sectionHeading}>Curated & trending</Text>

            <View style={styles.lavenderSpotlightCard}>
              <View style={styles.lavenderLeftCol}>
                <Text style={styles.lavenderCardTitle} numberOfLines={1}>
                  {featuredTrack
                    ? featuredTrack.trackName || featuredTrack.title
                    : 'Build Your13'}
                </Text>
                <Text style={styles.lavenderCardSub} numberOfLines={2}>
                  {featuredTrack
                    ? `${featuredTrack.artistName || featuredTrack.artist} • #1 in ${userInfo?.username || 'Sigma'
                    }'s 13`
                    : 'Curate your 13 signature tracks to unlock Vibe Check matching.'}
                </Text>

                <View style={styles.lavenderActionsRow}>
                  <TouchableOpacity
                    style={styles.deepPurplePlayBtn}
                    onPress={() =>
                      featuredTrack
                        ? handleTogglePreview(featuredTrack)
                        : navigation.navigate('Your13')
                    }
                    accessibilityLabel={featuredTrack ? 'Play or stop featured track preview' : 'Curate Your 13'}
                  >
                    <FontAwesome5
                      name={
                        featuredTrack &&
                          playingTrackId ===
                          (featuredTrack.trackId || featuredTrack.trackName)
                          ? 'stop'
                          : 'play'
                      }
                      size={14}
                      color="#FFFFFF"
                    />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.lavenderOutlineCircle}
                    onPress={() => navigation.navigate('Your13')}
                    accessibilityLabel="Edit Your 13 playlist"
                  >
                    <Feather name="edit-2" size={15} color="#1A1026" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.lavenderOutlineCircle}
                    onPress={() =>
                      navigation.navigate(
                        'Memoir',
                        featuredTrack ? { song: featuredTrack } : undefined
                      )
                    }
                    accessibilityLabel="Write memoir for featured track"
                  >
                    <Feather name="book-open" size={15} color="#1A1026" />
                  </TouchableOpacity>
                </View>
              </View>

              {featuredTrack ? (
                featuredTrackArt ? (
                  <Image
                    source={{ uri: featuredTrackArt }}
                    style={styles.lavenderArtworkImg}
                  />
                ) : (
                  <View style={[styles.lavenderArtworkImg, { backgroundColor: '#2B1F3F', alignItems: 'center', justifyContent: 'center' }]}>
                    <Ionicons name="musical-notes" size={30} color="#D8C8F5" />
                  </View>
                )
              ) : (
                <Image
                  source={{ uri: avatarUri }}
                  style={styles.lavenderArtworkImg}
                />
              )}
            </View>

            {/* Top Curated Tracks List (Design 3: image_74650d.jpg) */}
            <View style={styles.listHeaderRow}>
              <Text style={styles.sectionHeading}>
                Your13 ({filteredSongs.length})
              </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Your13')}>
                <Text style={styles.seeAllLinkText}>Edit 13</Text>
              </TouchableOpacity>
            </View>

            {filteredSongs.length === 0 ? (
              <View style={styles.emptyCardBox}>
                <Ionicons name="musical-notes-outline" size={38} color="#D4F458" />
                <Text style={styles.emptyCardTitle}>No songs in your Your13</Text>
                <Text style={styles.emptyCardSubtitle}>
                  Select up to 13 tracks that define your musical identity.
                </Text>
                <TouchableOpacity
                  style={styles.chartreusePrimaryBtn}
                  onPress={() => navigation.navigate('Your13')}
                >
                  <Text style={styles.chartreusePrimaryBtnText}>
                    Curate Your 13 Songs
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              filteredSongs.map((song, idx) => {
                const trackKey = song.trackId || song.id || song.trackName || idx;
                const isPlaying = playingTrackId === trackKey;
                const artwork = getHighResImage(song.artworkUrl100 || song.imageUrl);
                const rankLabel = `#${song.slotRank || idx + 1}`;
                const normalizedGenre = normalizeGenreTag(song.primaryGenreName || song.genre);

                return (
                  <TouchableOpacity
                    key={`${trackKey}-${idx}`}
                    style={styles.trackRowCard}
                    onPress={() => navigation.navigate('SongDetails', { song })}
                    activeOpacity={0.85}
                  >
                    {artwork ? (
                      <Image
                        source={{ uri: artwork }}
                        style={styles.trackRowArtwork}
                      />
                    ) : (
                      <View style={[styles.trackRowArtwork, { backgroundColor: '#1E2433', alignItems: 'center', justifyContent: 'center' }]}>
                        <Ionicons name="musical-notes" size={20} color="#64748B" />
                      </View>
                    )}

                    <View style={styles.trackRowMeta}>
                      <Text style={styles.trackRowTitle} numberOfLines={1}>
                        {song.trackName || song.title || 'Unknown Track'}
                      </Text>
                      <Text style={styles.trackRowSub} numberOfLines={1}>
                        {rankLabel} • By {song.artistName || song.artist || 'Unknown Artist'}
                        {normalizedGenre ? ` • ${normalizedGenre}` : ''}
                      </Text>
                    </View>

                    <TouchableOpacity
                      style={[
                        styles.trackRowPlayCircle,
                        isPlaying && styles.trackRowPlayCircleActive,
                      ]}
                      onPress={() => handleTogglePreview(song)}
                      accessibilityLabel={isPlaying ? 'Stop 30s preview' : 'Play 30s preview'}
                    >
                      <FontAwesome5
                        name={isPlaying ? 'stop' : 'play'}
                        size={11}
                        color={isPlaying ? '#0B0C10' : '#FFFFFF'}
                      />
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              })
            )}

            {/* Floating Counter Pill (Design 2: image_7460ef.jpg) */}
            <View style={styles.floatingCounterPillWrap}>
              <TouchableOpacity
                style={styles.floatingCounterPill}
                onPress={() => navigation.navigate('Your13')}
              >
                <View style={styles.floatingCounterIconBox}>
                  <Feather name="disc" size={14} color="#D4F458" />
                </View>
                <Text style={styles.floatingCounterText}>
                  Curated {selectedSongs.length} / 13 Tracks
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* TAB 2: REFACTORED MEMOIR TAB */}
        {activeTab === 'memoirs' && (
          <View style={styles.tabSectionContainer}>
            <View style={styles.listHeaderRow}>
              <View>
                <Text style={styles.sectionHeading}>Song Memoirs</Text>
                <Text style={styles.memoirHeaderSub}>
                  Personal stories & timestamps attached to your soundtrack
                </Text>
              </View>

              <TouchableOpacity
                style={styles.addMemoirPillBtn}
                onPress={() => navigation.navigate('Memoir')}
              >
                <Feather name="plus" size={15} color="#0B0C10" />
                <Text style={styles.addMemoirPillText}>Add Song Memoir</Text>
              </TouchableOpacity>
            </View>

            {memoirs.length === 0 ? (
              <View style={styles.emptyCardBox}>
                <Feather name="Feather" size={34} color="#D4F458" />
                <Text style={styles.emptyCardTitle}>No Song Memoirs Logged Yet</Text>
                <Text style={styles.emptyCardSubtitle}>
                  Capture the memory, place, or feeling behind a song that matters to you.
                </Text>
                <TouchableOpacity
                  style={styles.chartreusePrimaryBtn}
                  onPress={() => navigation.navigate('Memoir')}
                >
                  <Text style={styles.chartreusePrimaryBtnText}>
                    + Write Your First Memoir
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              memoirs.map((item) => {
                const trackTitle = item.title || item.trackName || 'Untitled Track';
                const artistName = item.artist || item.artistName || 'Unknown Artist';
                const artwork = getHighResImage(item.imageUrl || item.artworkUrl100);

                return (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.memoirCard}
                    onPress={() => setSelectedMemoir(item)}
                    activeOpacity={0.88}
                  >
                    {artwork ? (
                      <Image source={{ uri: artwork }} style={styles.memoirArtwork} />
                    ) : (
                      <View style={[styles.memoirArtwork, { alignItems: 'center', justifyContent: 'center' }]}>
                        <Ionicons name="musical-notes" size={22} color="#64748B" />
                      </View>
                    )}

                    <View style={styles.memoirCardBody}>
                      <View style={styles.memoirTopMetaRow}>
                        <View style={{ flex: 1, marginRight: 8 }}>
                          <Text style={styles.memoirTrackTitle} numberOfLines={1}>
                            {trackTitle}
                          </Text>
                          <Text style={styles.memoirArtistName} numberOfLines={1}>
                            {artistName}
                          </Text>
                        </View>

                        <TouchableOpacity
                          style={styles.memoirDeleteIconBtn}
                          onPress={() => handleDeleteMemoir(item.id)}
                          disabled={deletingMemoirId === item.id}
                          accessibilityLabel="Delete memoir"
                        >
                          {deletingMemoirId === item.id ? (
                            <ActivityIndicator size="small" color="#EF4444" />
                          ) : (
                            <Feather name="trash-2" size={14} color="#94A3B8" />
                          )}
                        </TouchableOpacity>
                      </View>

                      <Text style={styles.memoirCommentText} numberOfLines={3}>
                        "{item.comment}"
                      </Text>

                      <View style={styles.memoirFooterRow}>
                        <Text style={styles.memoirTimestampText}>
                          {formatMemoirDate(item.timestamp)}
                        </Text>
                        <Text style={styles.memoirReadMoreText}>Read reflection →</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        )}

        {/* TAB 3: SONIC TWIN */}
        {activeTab === 'sonicTwin' && (
          <View style={styles.tabSectionContainer}>
            <Text style={styles.sectionHeading}>Sonic Compatibility</Text>

            <TouchableOpacity
              style={styles.lavenderSpotlightCard}
              onPress={() => navigation.navigate('UserGraph')}
              activeOpacity={0.9}
            >
              <View style={styles.lavenderLeftCol}>
                <Text style={styles.lavenderCardTitle}>Affinity Radar</Text>
                <Text style={styles.lavenderCardSub}>
                  Compare your 13 tracks against the Orphee community graph.
                </Text>
                <View style={styles.lavenderActionsRow}>
                  <View style={styles.deepPurplePlayBtn}>
                    <Ionicons name="analytics" size={16} color="#FFFFFF" />
                  </View>
                  <Text style={styles.exploreGraphText}>Launch Affinity Radar →</Text>
                </View>
              </View>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* MEMOIR FULL REFLECTION & AUDIO PREVIEW MODAL */}
      <Modal
        visible={!!selectedMemoir}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedMemoir(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            {selectedMemoir && (
              <>
                <View style={styles.modalHeaderRow}>
                  <Text style={styles.modalHeaderLabel}>SONG MEMOIR</Text>
                  <TouchableOpacity onPress={() => setSelectedMemoir(null)}>
                    <Feather name="x" size={20} color="#94A3B8" />
                  </TouchableOpacity>
                </View>

                <View style={styles.modalTrackSummary}>
                  {getHighResImage(selectedMemoir.imageUrl || selectedMemoir.artworkUrl100) ? (
                    <Image
                      source={{
                        uri: getHighResImage(
                          selectedMemoir.imageUrl || selectedMemoir.artworkUrl100
                        ),
                      }}
                      style={styles.modalTrackCover}
                    />
                  ) : (
                    <View style={[styles.modalTrackCover, { backgroundColor: '#1E2433', alignItems: 'center', justifyContent: 'center' }]}>
                      <Ionicons name="musical-notes" size={24} color="#64748B" />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalTrackTitle}>
                      {selectedMemoir.title || selectedMemoir.trackName}
                    </Text>
                    <Text style={styles.modalTrackArtist}>
                      {selectedMemoir.artist || selectedMemoir.artistName}
                    </Text>
                    <Text style={styles.modalTimestamp}>
                      {formatMemoirDate(selectedMemoir.timestamp)}
                    </Text>
                  </View>
                </View>

                <ScrollView style={styles.modalCommentScroll}>
                  <Text style={styles.modalCommentFullText}>
                    "{selectedMemoir.comment}"
                  </Text>
                </ScrollView>

                <View style={styles.modalActionsRow}>
                  {(selectedMemoir.previewUrl || selectedMemoir.audioUrl) && (
                    <TouchableOpacity
                      style={styles.chartreusePrimaryBtn}
                      onPress={() => handleTogglePreview(selectedMemoir)}
                    >
                      <Text style={styles.chartreusePrimaryBtnText}>
                        {playingTrackId ===
                          (selectedMemoir.trackId ||
                            selectedMemoir.id ||
                            selectedMemoir.title)
                          ? 'Stop Preview'
                          : '▶ Play 30s Preview'}
                      </Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={styles.deleteMemoirModalBtn}
                    onPress={() => handleDeleteMemoir(selectedMemoir.id)}
                  >
                    <Feather name="trash-2" size={14} color="#EF4444" />
                    <Text style={styles.deleteMemoirModalText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* FLOATING BOTTOM TASKBAR */}
      <Taskbar navigation={navigation} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#0B0C10',
  },
  loadingScreen: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#0B0C10',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingLabel: {
    color: '#94A3B8',
    fontSize: 14,
    marginTop: 12,
    fontWeight: '600',
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 125, // Prevents bottom Taskbar collision
    maxWidth: 540,
    width: '100%',
    alignSelf: 'center',
  },
  topUtilityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  topMiniAvatarWrap: {
    position: 'relative',
  },
  topMiniAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1.5,
    borderColor: '#D4F458',
    backgroundColor: '#181A20',
  },
  cameraMiniBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#D4F458',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topUtilityIconsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  glassCircleBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#171922',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  unreadDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#D4F458',
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  unreadDotText: {
    color: '#0B0C10',
    fontSize: 10,
    fontWeight: '800',
  },
  greetingSection: {
    marginBottom: 18,
  },
  greetingTitle: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.4,
    marginBottom: 14,
  },
  categoryPillsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 24,
  },
  categoryPill: {
    backgroundColor: '#171922',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  categoryPillActive: {
    backgroundColor: '#D4F458',
    borderColor: '#D4F458',
  },
  categoryPillText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
  },
  categoryPillTextActive: {
    color: '#0B0C10',
    fontWeight: '800',
  },
  categoryLinkPill: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#333B4F',
  },
  categoryLinkPillText: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '600',
  },
  heroCardOuter: {
    width: '100%',
    borderRadius: 28,
    overflow: 'hidden',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    backgroundColor: '#14161E',
  },
  heroImageBackground: {
    width: '100%',
    minHeight: 430,
    justifyContent: 'space-between',
  },
  heroImageBackgroundExpanded: {
    minHeight: 520,
  },
  heroImageRadius: {
    borderRadius: 28,
  },
  heroTopOverlayBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  heroCircleIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(11, 12, 16, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  heroHandleTopText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    backgroundColor: 'rgba(11, 12, 16, 0.5)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    overflow: 'hidden',
  },
  editProfilePillBtn: {
    backgroundColor: '#0B0C10',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  editProfilePillText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  frostedGlassSheet: {
    marginTop: 110,
    backgroundColor: 'rgba(15, 16, 22, 0.88)',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 18,
    borderTopWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
  },
  sheetDragHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    alignSelf: 'center',
    marginBottom: 12,
  },
  sheetHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  sheetDisplayName: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  sheetHandleSub: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 2,
  },
  sheetQuickBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iridescentStarCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#9333EA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  whiteActionCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  seeProfileToggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  seeProfileToggleText: {
    color: '#E2E8F0',
    fontSize: 11,
    fontWeight: '600',
  },
  sheetBioText: {
    color: '#CBD5E1',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 14,
  },
  statsColumnsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 28,
    marginBottom: 14,
  },
  statColumn: {
    alignItems: 'flex-start',
  },
  statNumber: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  statLabel: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  hashtagPillsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  hashtagPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  hashtagPillSelected: {
    backgroundColor: '#D4F458',
    borderColor: '#D4F458',
  },
  hashtagPillText: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '600',
  },
  hashtagPillTextSelected: {
    color: '#0B0C10',
    fontWeight: '800',
  },
  sheetCarouselSection: {
    marginTop: 4,
    marginBottom: 10,
  },
  sheetCarouselScroll: {
    gap: 10,
    paddingRight: 8,
  },
  sheetCarouselThumbCard: {
    width: 96,
    height: 96,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#222530',
    position: 'relative',
  },
  sheetCarouselThumbImg: {
    width: '100%',
    height: '100%',
  },
  sheetThumbRankBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(11, 12, 16, 0.78)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  sheetThumbRankText: {
    color: '#D4F458',
    fontSize: 10,
    fontWeight: '800',
  },
  carouselArrowsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginTop: 12,
  },
  carouselArrowCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetTestimonialRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 12,
    marginTop: 6,
    gap: 12,
  },
  sheetTestimonialAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#232734',
  },
  sheetTestimonialQuote: {
    color: '#F1F5F9',
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 6,
  },
  sheetTestimonialAuthor: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  sheetTestimonialHandle: {
    color: '#94A3B8',
    fontSize: 11,
  },
  tabSectionContainer: {
    width: '100%',
  },
  sectionHeading: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
  },
  lavenderSpotlightCard: {
    backgroundColor: '#CFAEF8',
    borderRadius: 24,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
    overflow: 'hidden',
  },
  lavenderLeftCol: {
    flex: 1,
    paddingRight: 12,
  },
  lavenderCardTitle: {
    color: '#140D1E',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 6,
  },
  lavenderCardSub: {
    color: '#2D1F42',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
  },
  lavenderActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  deepPurplePlayBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#481468',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lavenderOutlineCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    borderColor: '#2D1F42',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lavenderArtworkImg: {
    width: 108,
    height: 108,
    borderRadius: 18,
    backgroundColor: '#2D1F42',
  },
  listHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  seeAllLinkText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '600',
  },
  trackRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#13151C',
    borderRadius: 18,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  trackRowArtwork: {
    width: 60,
    height: 60,
    borderRadius: 14,
    backgroundColor: '#222634',
    marginRight: 14,
  },
  trackRowMeta: {
    flex: 1,
    marginRight: 10,
  },
  trackRowTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  trackRowSub: {
    color: '#94A3B8',
    fontSize: 13,
  },
  trackRowPlayCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#222530',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackRowPlayCircleActive: {
    backgroundColor: '#D4F458',
  },
  floatingCounterPillWrap: {
    alignItems: 'center',
    marginTop: 10,
  },
  floatingCounterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#171922',
    borderRadius: 24,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    gap: 10,
  },
  floatingCounterIconBox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(212, 244, 88, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingCounterText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  memoirHeaderSub: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: -8,
    marginBottom: 8,
  },
  addMemoirPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D4F458',
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 20,
    gap: 6,
  },
  addMemoirPillText: {
    color: '#0B0C10',
    fontSize: 12,
    fontWeight: '800',
  },
  memoirCard: {
    flexDirection: 'row',
    backgroundColor: '#151821',
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  memoirArtwork: {
    width: 68,
    height: 68,
    borderRadius: 14,
    backgroundColor: '#232734',
    marginRight: 14,
  },
  memoirCardBody: {
    flex: 1,
  },
  memoirTopMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  memoirTrackTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  memoirArtistName: {
    color: '#D4F458',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 1,
  },
  memoirDeleteIconBtn: {
    padding: 4,
  },
  memoirCommentText: {
    color: '#E2E8F0',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  memoirFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  memoirTimestampText: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '600',
  },
  memoirReadMoreText: {
    color: '#CFAEF8',
    fontSize: 11,
    fontWeight: '700',
  },
  emptyCardBox: {
    backgroundColor: '#151821',
    borderRadius: 22,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginVertical: 8,
  },
  emptyCardTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 6,
  },
  emptyCardSubtitle: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 18,
  },
  chartreusePrimaryBtn: {
    backgroundColor: '#D4F458',
    paddingVertical: 11,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  chartreusePrimaryBtnText: {
    color: '#0B0C10',
    fontSize: 13,
    fontWeight: '800',
  },
  exploreGraphText: {
    color: '#140D1E',
    fontSize: 14,
    fontWeight: '800',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 14,
  },
  modalCard: {
    width: '92%',
    maxWidth: 368,
    backgroundColor: '#151821',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalHeaderLabel: {
    color: '#D4F458',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  modalTrackSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  modalTrackCover: {
    width: 64,
    height: 64,
    borderRadius: 14,
  },
  modalTrackTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
  modalTrackArtist: {
    color: '#CBD5E1',
    fontSize: 14,
    marginTop: 2,
  },
  modalTimestamp: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 4,
  },
  modalCommentScroll: {
    maxHeight: 200,
    backgroundColor: '#0E1016',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  modalCommentFullText: {
    color: '#F1F5F9',
    fontSize: 15,
    lineHeight: 22,
  },
  modalActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  deleteMemoirModalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    gap: 6,
  },
  deleteMemoirModalText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '700',
  },
});

export default ProfileScreen;