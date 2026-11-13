// UploadProfilePicture.js
import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  SafeAreaView,
} from 'react-native';
import { Text } from 'react-native-paper';
import * as ImagePicker from 'expo-image-picker';
import { auth, db, storage } from './firebaseConfig';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { collection, addDoc, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { Feather } from '@expo/vector-icons';
import { compressImageForUpload } from './ProfileScreen';
import {
  uploadAvatarWithFallback,
  MAX_FIRESTORE_DATA_URL_BYTES,
} from './utils/avatarUtils';

export { uploadAvatarWithFallback, MAX_FIRESTORE_DATA_URL_BYTES };

export async function deleteImage(docId, imageUrl) {
  if (docId) {
    await deleteDoc(doc(db, 'images', docId));
  }
  if (imageUrl && typeof imageUrl === 'string' && imageUrl.includes('firebasestorage')) {
    try {
      const storageRef = ref(storage, imageUrl);
      await deleteObject(storageRef);
    } catch (_) {
      // Ignore already-deleted or external URL errors
    }
  }
}

export default function UploadProfilePicture({ navigation }) {
  const [selectedUri, setSelectedUri] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const pickImage = async () => {
    try {
      const permissionResult =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert(
          'Permission Required',
          'Please grant photo library access to upload a profile picture.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.75,
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        setSelectedUri(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Image Picker Error', 'Failed to select image from your device.');
    }
  };

  const handleUpload = async () => {
    const user = auth.currentUser;
    if (!user) {
      Alert.alert('Not Authenticated', 'Please sign in before uploading an avatar.');
      return;
    }
    if (!selectedUri) {
      Alert.alert('No Image Selected', 'Please select an image first.');
      return;
    }

    setUploading(true);
    setProgress(0);
    let compressed = null;

    try {
      compressed = await compressImageForUpload(selectedUri, 400, 0.72);
      const { blob, contentType } = compressed;

      const filename = `avatar_${user.uid}_${Date.now()}.jpg`;
      const storageRef = ref(storage, `images/${user.uid}/${filename}`);

      // Pass explicit MIME contentType metadata required by storage.rules
      const metadata = {
        contentType: contentType || 'image/jpeg',
        customMetadata: {
          userId: user.uid,
          uploadedAt: new Date().toISOString(),
        },
      };

      const uploadTask = uploadBytesResumable(storageRef, blob, metadata);

      const downloadUrl = await new Promise((resolve, reject) => {
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            if (snapshot.totalBytes > 0) {
              setProgress(
                Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)
              );
            }
          },
          (error) => reject(error),
          async () => {
            const url = await getDownloadURL(uploadTask.snapshot.ref);
            resolve(url);
          }
        );
      });

      await setDoc(
        doc(db, 'users', user.uid),
        {
          profileImageUrl: downloadUrl,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      await addDoc(collection(db, 'images'), {
        userId: user.uid,
        imageUrl: downloadUrl,
        createdAt: new Date().toISOString(),
      });

      Alert.alert('Success', 'Your profile picture has been updated.');
      if (navigation?.canGoBack()) {
        navigation.goBack();
      } else {
        navigation?.navigate('ProfileScreen');
      }
    } catch (error) {
      console.warn('Storage upload error:', error?.code || error?.message);

      if (compressed?.dataUrl) {
        if (compressed.dataUrl.length > MAX_FIRESTORE_DATA_URL_BYTES) {
          Alert.alert(
            'Image Too Large',
            'Selected image is too large for fallback storage. Please choose a smaller photo.'
          );
          return;
        }
        try {
          await setDoc(
            doc(db, 'users', user.uid),
            {
              profileImageUrl: compressed.dataUrl,
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          );
          Alert.alert(
            'Profile Updated (Optimized Fallback)',
            'Firebase Storage quota was reached, so your compressed 400x400 avatar was saved directly to your profile.'
          );
          if (navigation?.canGoBack()) {
            navigation.goBack();
          } else {
            navigation?.navigate('ProfileScreen');
          }
          return;
        } catch (fallbackErr) {
          console.error('Fallback save failed:', fallbackErr);
        }
      }

      Alert.alert(
        'Upload Failed',
        error?.code === 'storage/quota-exceeded'
          ? 'Firebase Storage daily quota has been exceeded.'
          : error?.message || 'Could not upload profile image.'
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Update Profile Portrait</Text>
        <Text style={styles.subtitle}>
          Images are automatically optimized to 400×400 JPEG for fast loading.
        </Text>

        <TouchableOpacity style={styles.avatarPreviewBox} onPress={pickImage}>
          {selectedUri ? (
            <Image source={{ uri: selectedUri }} style={styles.avatarImage} />
          ) : (
            <View style={styles.placeholderCenter}>
              <Feather name="camera" size={32} color="#D4F458" />
              <Text style={styles.placeholderText}>Tap to choose photo</Text>
            </View>
          )}
        </TouchableOpacity>

        {uploading && (
          <View style={styles.progressRow}>
            <ActivityIndicator size="small" color="#D4F458" />
            <Text style={styles.progressText}>Uploading... {progress}%</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.primaryBtn, (!selectedUri || uploading) && styles.btnDisabled]}
          onPress={handleUpload}
          disabled={!selectedUri || uploading}
        >
          <Text style={[styles.primaryBtnText, (!selectedUri || uploading) && styles.btnDisabledText]}>
            {uploading ? 'Saving Portrait...' : 'Save Profile Portrait'}
          </Text>
        </TouchableOpacity>

        {navigation && (
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0C10',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#151821',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 6,
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 20,
  },
  avatarPreviewBox: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: '#0E1016',
    borderWidth: 2,
    borderColor: '#D4F458',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  placeholderCenter: {
    alignItems: 'center',
  },
  placeholderText: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 8,
    fontWeight: '600',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  progressText: {
    color: '#D4F458',
    fontSize: 13,
    fontWeight: '700',
  },
  primaryBtn: {
    width: '100%',
    backgroundColor: '#D4F458',
    paddingVertical: 14,
    borderRadius: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D4F458',
  },
  btnDisabled: {
    backgroundColor: '#1E2430',
    borderColor: '#242936',
  },
  primaryBtnText: {
    color: '#0B0C10',
    fontSize: 14,
    fontWeight: '800',
  },
  btnDisabledText: {
    color: '#64748B',
  },
  cancelBtn: {
    marginTop: 14,
    paddingVertical: 8,
  },
  cancelBtnText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
  },
});