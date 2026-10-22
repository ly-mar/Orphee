import React, { useState, useEffect } from 'react';
import { View, FlatList, Image, Button, Alert, ActivityIndicator, SafeAreaView, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { deleteImage } from './UploadProfilePicture'; // Import the deleteImage function
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db, auth } from './firebaseConfig';

const UpdateProfileScreen = ({ route, navigation }) => {
  const userId = route?.params?.userId ?? auth.currentUser?.uid;
  const [mediaList, setMediaList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  

  // Fetch user's images from Firestore
  useEffect(() => {

    if (!userId) {
    return; // Return early if userId is undefined
  }
    
    const imagesQuery = query(
      collection(db, 'images'),
      where('userId', '==', userId),
      orderBy('userId'),
      orderBy('uploadedAt', 'desc')
    );

    const unsubscribe = onSnapshot(imagesQuery, (snapshot) => {
      const userMedia = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setMediaList(userMedia);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userId]);

  // Handle deleting the image
  const handleDelete = async (docId, downloadURL) => {
    try {
      setDeleting(true);
      await deleteImage(docId, downloadURL, userId);
      Alert.alert('Success', 'Image deleted successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to delete image');
      console.error('Error deleting image:', error);
    } finally {
      setDeleting(false);
    }
  };

  // Render each item in the FlatList
  const renderItem = ({ item }) => (
    <View style={styles.imageContainer}>
      <Image source={{ uri: item.downloadURL }} style={styles.image} />
      <Button
        title="Delete"
        color="red"
        onPress={() =>
          Alert.alert(
            'Delete Image',
            'Are you sure you want to delete this image?',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete', onPress: () => handleDelete(item.id, item.downloadURL) },
            ],
            { cancelable: true }
          )
        }
      />
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topHeader}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back to Profile</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile Media</Text>
        <View style={{ width: 60 }} />
      </View>
      {loading || deleting ? (
        <ActivityIndicator size="large" color="#0000ff" />
      ) : (
        <FlatList
          data={mediaList}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          numColumns={3} // Display images in a grid of 3 columns
          contentContainerStyle={styles.flatList}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: {
    backgroundColor: '#f0f0f0',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#111',
    fontSize: 14,
    fontWeight: '600',
  },
  headerTitle: {
    color: '#111',
    fontSize: 18,
    fontWeight: '700',
  },
  flatList: {
    paddingHorizontal: 10,
    paddingBottom: 20,
  },
  imageContainer: {
    flex: 1,
    margin: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: 100,
    height: 100,
    marginBottom: 10,
    borderRadius: 10,
  },
});

export default UpdateProfileScreen;
