// UploadProfilePicture.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Button,
  ActivityIndicator,
  SafeAreaView,
  TouchableOpacity,
  Text,
  StyleSheet,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import {
  collection,
  addDoc,
  doc,
  onSnapshot,
  query,
  where,
  deleteDoc,
  getDocs,
  getDoc,
  setDoc,
} from 'firebase/firestore';
import { storage, db, auth } from './firebaseConfig';
import FadingCarousel from './FadingCarousel';

const DEFAULT_AVATAR =
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200';

export const pickImage = async () => {
  try {
    const result = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!result.granted) {
      Alert.alert('Permission Required', 'Permission to access gallery is required!');
      return null;
    }

    const pickerResult = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.85,
    });

    if (!pickerResult.canceled && pickerResult.assets && pickerResult.assets.length > 0) {
      return pickerResult.assets[0];
    }
    return null;
  } catch (error) {
    console.error('Error picking image:', error);
    return null;
  }
};

export const uploadImage = async (uri, userId) => {
  if (!uri || typeof uri !== 'string') {
    throw new Error('Invalid URI: URI is null or not a string');
  }
  if (!userId) {
    throw new Error('Cannot upload image without a valid userId');
  }

  const response = await fetch(uri);
  if (!response.ok) {
    throw new Error('Failed to fetch the image from the given URI');
  }
  const blob = await response.blob();

  const fileName = `${Date.now()}`;
  const storagePath = `profileImages/${userId}/${fileName}`;
  const storageRef = ref(storage, storagePath);
  const uploadTask = uploadBytesResumable(storageRef, blob);

  return new Promise((resolve, reject) => {
    uploadTask.on(
      'state_changed',
      null,
      (error) => {
        console.error('Upload failed:', error);
        reject(error);
      },
      async () => {
        try {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);

          await addDoc(collection(db, 'images'), {
            userId,
            downloadURL,
            storagePath,
            uploadedAt: Date.now(),
          });

          await setDoc(
            doc(db, 'users', userId),
            { profileImageUrl: downloadURL },
            { merge: true }
          );

          resolve(downloadURL);
        } catch (err) {
          reject(err);
        }
      }
    );
  });
};

export const deleteImage = async (docId, downloadURLOrPath, userId) => {
  try {
    if (downloadURLOrPath) {
      const storageRef = downloadURLOrPath.startsWith('http')
        ? ref(storage, downloadURLOrPath)
        : ref(
          storage,
          downloadURLOrPath.includes('profileImages/')
            ? downloadURLOrPath
            : `profileImages/${userId}/${downloadURLOrPath.split('/').pop()}`
        );
      try {
        await deleteObject(storageRef);
      } catch (storageErr) {
        console.warn('Storage object already removed or inaccessible:', storageErr.message);
      }
    }

    if (docId) {
      await deleteDoc(doc(db, 'images', docId));
    }
  } catch (error) {
    console.error('Error deleting image:', error);
    throw error;
  }
};

export const loadUserProfilePic = async (userId) => {
  if (!userId) return DEFAULT_AVATAR;

  try {
    // 1. O(1) direct lookup on users/{userId}
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (userDoc.exists() && userDoc.data()?.profileImageUrl) {
      return userDoc.data().profileImageUrl;
    }

    // 2. Fallback query on images collection without requiring a composite index
    const imagesQuery = query(
      collection(db, 'images'),
      where('userId', '==', userId)
    );
    const imagesSnapshot = await getDocs(imagesQuery);

    if (!imagesSnapshot.empty) {
      const sorted = imagesSnapshot.docs
        .map((d) => d.data())
        .sort((a, b) => {
          const timeA = a.uploadedAt?.seconds ? a.uploadedAt.seconds * 1000 : Number(a.uploadedAt) || 0;
          const timeB = b.uploadedAt?.seconds ? b.uploadedAt.seconds * 1000 : Number(b.uploadedAt) || 0;
          return timeB - timeA;
        });

      if (sorted[0]?.downloadURL) {
        return sorted[0].downloadURL;
      }
    }

    return DEFAULT_AVATAR;
  } catch (error) {
    return DEFAULT_AVATAR;
  }
};

const UploadProfilePicture = ({ route, navigation }) => {
  const [uploading, setUploading] = useState(false);
  const [mediaList, setMediaList] = useState([]);
  const [loading, setLoading] = useState(true);

  const userId = route?.params?.userId ?? auth.currentUser?.uid;

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const imagesQuery = query(
      collection(db, 'images'),
      where('userId', '==', userId)
    );

    const unsubscribe = onSnapshot(
      imagesQuery,
      (snapshot) => {
        const userMedia = snapshot.docs
          .map((d) => ({
            id: d.id,
            ...d.data(),
          }))
          .sort((a, b) => {
            const timeA = a.uploadedAt?.seconds
              ? a.uploadedAt.seconds * 1000
              : Number(a.uploadedAt) || 0;
            const timeB = b.uploadedAt?.seconds
              ? b.uploadedAt.seconds * 1000
              : Number(b.uploadedAt) || 0;
            return timeB - timeA;
          });

        setMediaList(userMedia);
        setLoading(false);
      },
      (error) => {
        console.warn('Error listening to user images:', error.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [userId]);

  const handlePickImage = async () => {
    try {
      const selectedAsset = await pickImage();
      if (selectedAsset?.uri && userId) {
        setUploading(true);
        await uploadImage(selectedAsset.uri, userId);
        setUploading(false);
      }
    } catch (error) {
      console.error('Error handling image upload:', error);
      setUploading(false);
      Alert.alert('Upload Failed', 'Could not upload the selected image.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topHeader}>
        <TouchableOpacity
          onPress={() => navigation?.goBack()}
          style={styles.backButton}
        >
          <Text style={styles.backButtonText}>← Back to Profile</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Upload Picture</Text>
        <View style={{ width: 60 }} />
      </View>
      <View style={styles.content}>
        <Button title="Pick an image from gallery" color="#FF8C00" onPress={handlePickImage} />
        {uploading && (
          <ActivityIndicator size="large" color="#FF8C00" style={{ marginTop: 15 }} />
        )}
        {loading ? (
          <ActivityIndicator size="large" color="#FF8C00" style={{ marginTop: 15 }} />
        ) : (
          mediaList.length > 0 && (
            <View style={{ marginTop: 20 }}>
              <FadingCarousel
                images={mediaList.map((item) => item.downloadURL)}
                duration={3000}
              />
            </View>
          )
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
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
    fontSize: 14,
    fontWeight: '600',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
});

export default UploadProfilePicture;