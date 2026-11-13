// UpdateProfileScreen.js — Dark Obsidian Profile & Media Editor [VR-002]
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  FlatList,
  Image,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  StyleSheet,
  TouchableOpacity,
  Text,
  TextInput,
  ScrollView,
} from 'react-native';
import { deleteImage } from './UploadProfilePicture';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  getDoc,
  setDoc,
} from 'firebase/firestore';
import { Feather } from '@expo/vector-icons';
import { db, auth } from './firebaseConfig';
import { subscribeSafeSnapshot } from './firestoreListenerUtils';
import { createAsyncActionLock } from './utils/actionLockUtils';
import { toast } from './crossPlatformAlert';
import {
  MAX_BIO_LENGTH,
  MAX_DISPLAY_NAME_LENGTH,
  MAX_USERNAME_LENGTH,
  normalizeAndSortMediaList,
  validateAndNormalizeProfileUpdate,
} from './utils/avatarUtils';

const UpdateProfileScreen = ({ route, navigation }) => {
  const userId = route?.params?.userId ?? auth.currentUser?.uid;
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [profileImageUrl, setProfileImageUrl] = useState('');

  const [mediaList, setMediaList] = useState([]);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingMedia, setLoadingMedia] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const actionLockRef = useRef(createAsyncActionLock());

  // Load current user profile fields (reload on focus so avatar updates appear immediately)
  useEffect(() => {
    let isMounted = true;
    const loadProfile = async () => {
      if (!userId) {
        if (isMounted) setLoadingProfile(false);
        return;
      }
      try {
        const userSnap = await getDoc(doc(db, 'users', userId));
        if (userSnap.exists() && isMounted) {
          const data = userSnap.data() || {};
          setDisplayName(data.displayName || data.username || '');
          setUsername(data.username || '');
          setBio(data.bio || '');
          setProfileImageUrl(data.profileImageUrl || '');
        } else if (isMounted) {
          setDisplayName(auth.currentUser?.displayName || '');
        }
      } catch (err) {
        console.warn('Could not load user profile:', err?.message);
      } finally {
        if (isMounted) setLoadingProfile(false);
      }
    };

    loadProfile();
    const unsubFocus = navigation?.addListener?.('focus', loadProfile);
    return () => {
      isMounted = false;
      if (typeof unsubFocus === 'function') unsubFocus();
    };
  }, [userId, navigation]);

  // Fetch user's uploaded images without requiring a composite Firestore index [VR-002]
  useEffect(() => {
    if (!userId) {
      setLoadingMedia(false);
      return;
    }

    return subscribeSafeSnapshot({
      isReady: Boolean(userId),
      buildQuery: () => query(collection(db, 'images'), where('userId', '==', userId)),
      onSnapshotFn: onSnapshot,
      onNext: (snapshot) => {
        const docs = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));
        setMediaList(normalizeAndSortMediaList(docs));
        setLoadingMedia(false);
      },
      onError: (err) => {
        if (err?.code !== 'permission-denied') {
          console.warn('UpdateProfileScreen media listener error:', err);
        }
        setLoadingMedia(false);
      },
    });
  }, [userId]);

  const handleSaveProfile = () => {
    if (!userId) {
      Alert.alert('Not Authenticated', 'Please sign in to save your profile.');
      return;
    }

    const validation = validateAndNormalizeProfileUpdate({
      displayName,
      username,
      bio,
    });
    if (!validation.ok) {
      Alert.alert('Check Your Details', validation.error);
      return;
    }

    return actionLockRef.current(async () => {
      try {
        setSaving(true);
        await setDoc(
          doc(db, 'users', userId),
          {
            ...validation.data,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
        setDisplayName(validation.data.displayName);
        setUsername(validation.data.username);
        setBio(validation.data.bio);
        toast.show({
          kind: 'success',
          message: 'Your profile details have been updated.',
        });
        if (navigation?.canGoBack?.()) {
          navigation.goBack();
        }
      } catch (err) {
        console.error('Error updating profile:', err);
        toast.show({ kind: 'error', message: 'Unable to save profile updates right now.' });
      } finally {
        setSaving(false);
      }
    });
  };

  const handleSetAsAvatar = (imageUrl) => {
    if (!userId || !imageUrl) return;
    return actionLockRef.current(async () => {
      try {
        setSaving(true);
        await setDoc(
          doc(db, 'users', userId),
          {
            profileImageUrl: imageUrl,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
        setProfileImageUrl(imageUrl);
        toast.show({ kind: 'success', message: 'This photo is now your active profile portrait.' });
      } catch (err) {
        console.error('Error setting active avatar:', err);
        toast.show({ kind: 'error', message: 'Could not update your active avatar.' });
      } finally {
        setSaving(false);
      }
    });
  };

  const handleDelete = (docId, imageUrl) => {
    return actionLockRef.current(async () => {
      try {
        setDeleting(true);
        await deleteImage(docId, imageUrl);
        setMediaList((prev) => prev.filter((item) => item.id !== docId));
        toast.show({ kind: 'info', message: 'Photo removed from your gallery.' });
      } catch (error) {
        toast.show({ kind: 'error', message: 'Failed to delete image.' });
        console.error('Error deleting image:', error);
      } finally {
        setDeleting(false);
      }
    });
  };

  const initials = (displayName || username || 'U').slice(0, 2).toUpperCase();

  const renderMediaItem = ({ item }) => {
    const imgUrl = item.resolvedUrl || item.imageUrl || item.downloadURL;
    const isCurrent = profileImageUrl && imgUrl === profileImageUrl;
    return (
      <View style={styles.mediaCard}>
        <Image source={{ uri: imgUrl }} style={styles.mediaThumb} />
        <View style={styles.mediaActionsRow}>
          <TouchableOpacity
            style={[styles.useBtn, isCurrent && styles.useBtnActive]}
            onPress={() => handleSetAsAvatar(imgUrl)}
            disabled={saving || isCurrent}
          >
            <Text style={[styles.useBtnText, isCurrent && styles.useBtnTextActive]}>
              {isCurrent ? 'Active' : 'Use'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={() =>
              Alert.alert(
                'Delete Photo',
                'Are you sure you want to remove this photo from your gallery?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => handleDelete(item.id, imgUrl),
                  },
                ],
                { cancelable: true }
              )
            }
            disabled={deleting}
          >
            <Feather name="trash-2" size={13} color="#F87171" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topHeader}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={16} color="#FFFFFF" />
          <Text style={styles.backButtonText}>Profile</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <View style={{ width: 72 }} />
      </View>

      {loadingProfile ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#FF8C00" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* Avatar Card */}
          <View style={styles.avatarSection}>
            <TouchableOpacity
              style={styles.avatarWrapper}
              onPress={() => navigation.navigate('UploadProfilePicture')}
              activeOpacity={0.85}
            >
              {profileImageUrl ? (
                <Image source={{ uri: profileImageUrl }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarInitials}>{initials}</Text>
                </View>
              )}
              <View style={styles.avatarBadge}>
                <Feather name="camera" size={14} color="#0B0C10" />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.uploadPhotoBtn}
              onPress={() => navigation.navigate('UploadProfilePicture')}
            >
              <Feather name="upload" size={14} color="#0B0C10" />
              <Text style={styles.uploadPhotoBtnText}>Change Profile Photo</Text>
            </TouchableOpacity>
          </View>

          {/* Identity & Bio Form Card */}
          <View style={styles.formCard}>
            <Text style={styles.fieldLabel}>Display Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Your display name"
              placeholderTextColor="#64748B"
              value={displayName}
              onChangeText={setDisplayName}
              maxLength={MAX_DISPLAY_NAME_LENGTH}
            />

            <Text style={styles.fieldLabel}>Username</Text>
            <TextInput
              style={styles.input}
              placeholder="username"
              placeholderTextColor="#64748B"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={MAX_USERNAME_LENGTH}
            />

            <View style={styles.labelRow}>
              <Text style={styles.fieldLabel}>Bio</Text>
              <Text style={styles.charCount}>
                {bio.length}/{MAX_BIO_LENGTH}
              </Text>
            </View>
            <TextInput
              style={[styles.input, styles.bioInput]}
              placeholder="Tell listeners about your taste, scenes, or sonic identity..."
              placeholderTextColor="#64748B"
              value={bio}
              onChangeText={setBio}
              multiline
              maxLength={MAX_BIO_LENGTH}
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.btnDisabled]}
              onPress={handleSaveProfile}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#000000" />
              ) : (
                <Text style={styles.saveBtnText}>Save Profile Changes</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Uploaded Media Gallery */}
          <View style={styles.gallerySection}>
            <View style={styles.galleryHeader}>
              <Text style={styles.galleryTitle}>Uploaded Photos ({mediaList.length})</Text>
              <TouchableOpacity onPress={() => navigation.navigate('UploadProfilePicture')}>
                <Text style={styles.galleryAddLink}>+ Add Photo</Text>
              </TouchableOpacity>
            </View>

            {loadingMedia || deleting ? (
              <ActivityIndicator size="small" color="#FF8C00" style={{ marginVertical: 20 }} />
            ) : mediaList.length === 0 ? (
              <View style={styles.emptyGalleryCard}>
                <Feather name="image" size={28} color="#64748B" />
                <Text style={styles.emptyGalleryTitle}>No profile photos uploaded yet</Text>
                <Text style={styles.emptyGallerySub}>
                  Upload portraits to switch your look anytime.
                </Text>
                <TouchableOpacity
                  style={styles.emptyUploadBtn}
                  onPress={() => navigation.navigate('UploadProfilePicture')}
                >
                  <Text style={styles.emptyUploadBtnText}>Upload First Photo</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <FlatList
                data={mediaList}
                renderItem={renderMediaItem}
                keyExtractor={(item) => item.id}
                numColumns={3}
                scrollEnabled={false}
                columnWrapperStyle={styles.mediaRow}
              />
            )}
          </View>
        </ScrollView>
      )}
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
    backgroundColor: '#0D1017',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1E29',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 6,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    maxWidth: 500,
    width: '100%',
    alignSelf: 'center',
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 12,
  },
  avatarImage: {
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 2,
    borderColor: '#D4F458',
    backgroundColor: '#151821',
  },
  avatarFallback: {
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 2,
    borderColor: '#D4F458',
    backgroundColor: '#1B202C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    color: '#D4F458',
    fontSize: 30,
    fontWeight: '800',
  },
  avatarBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#D4F458',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#0A0C10',
  },
  uploadPhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D4F458',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 18,
    gap: 6,
  },
  uploadPhotoBtnText: {
    color: '#0B0C10',
    fontSize: 13,
    fontWeight: '800',
  },
  formCard: {
    backgroundColor: '#151821',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#242936',
    marginBottom: 20,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fieldLabel: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  charCount: {
    color: '#64748B',
    fontSize: 11,
  },
  input: {
    backgroundColor: '#0D1017',
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#262C3A',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    marginBottom: 14,
  },
  bioInput: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  saveBtn: {
    backgroundColor: '#FF8C00',
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '800',
  },
  gallerySection: {
    backgroundColor: '#151821',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#242936',
  },
  galleryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  galleryTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  galleryAddLink: {
    color: '#FF8C00',
    fontSize: 13,
    fontWeight: '700',
  },
  emptyGalleryCard: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 12,
    backgroundColor: '#0D1017',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#222836',
  },
  emptyGalleryTitle: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 10,
  },
  emptyGallerySub: {
    color: '#94A3B8',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 14,
  },
  emptyUploadBtn: {
    backgroundColor: '#1E2432',
    borderWidth: 1,
    borderColor: '#FF8C00',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  emptyUploadBtnText: {
    color: '#FF8C00',
    fontSize: 12,
    fontWeight: '700',
  },
  mediaRow: {
    justifyContent: 'flex-start',
    gap: 10,
    marginBottom: 12,
  },
  mediaCard: {
    width: '31%',
    backgroundColor: '#0D1017',
    borderRadius: 10,
    padding: 6,
    borderWidth: 1,
    borderColor: '#242936',
    alignItems: 'center',
  },
  mediaThumb: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 8,
    marginBottom: 6,
    backgroundColor: '#1B202C',
  },
  mediaActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    gap: 4,
  },
  useBtn: {
    flex: 1,
    backgroundColor: '#1E2432',
    paddingVertical: 5,
    borderRadius: 6,
    alignItems: 'center',
  },
  useBtnActive: {
    backgroundColor: 'rgba(212, 244, 88, 0.16)',
  },
  useBtnText: {
    color: '#E2E8F0',
    fontSize: 11,
    fontWeight: '700',
  },
  useBtnTextActive: {
    color: '#D4F458',
  },
  deleteBtn: {
    padding: 5,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderRadius: 6,
  },
});

export default UpdateProfileScreen;
