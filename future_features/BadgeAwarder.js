import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, SafeAreaView, TouchableOpacity } from 'react-native';
import { db, auth } from '../firebaseConfig';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import FirstUploadBadge from '../assets/FirstUploadBadge.png';
import HipHopLoverBadge from '../assets/HipHopLoverBadge.png';
import TripleUploadBadge from '../assets/TripleUploadBadge.png';
import ProlificUploaderBadge from '../assets/ProlificUploaderBadge.png';
import LegendaryUploaderBadge from '../assets/LegendaryUploaderBadge.png';

const BadgeAwarder = ({ uid, route, navigation }) => {
  const userId = route?.params?.userId ?? auth.currentUser?.uid;
  const [badges, setBadges] = useState([]);
  const [username, setUsername] = useState(null);
  const badgeImages = {
    'First Upload Badge': FirstUploadBadge,
    'Hip-Hop Lover Badge': HipHopLoverBadge,
    'Triple Upload Badge': TripleUploadBadge,
    'Prolific Uploader Badge': ProlificUploaderBadge,
    'Legendary Uploader Badge': LegendaryUploaderBadge,
  };

  useEffect(() => {
    const fetchUsernameAndDocuments = async () => {
      try {
        // Step 1: Fetch the username from the users collection using the UID
        const userRef = doc(db, 'users', userId);
        const userDoc = await getDoc(userRef);
        const userData = userDoc.data();
        if (userData && userData.username) {
        setUsername(userData.username);
        } else {
          console.error('No such user document found');
          return;
        }

        // Step 2: Fetch the user's documents from the daily collection using the fetched username
        if (username) {
          const q = query(collection(db, 'daily'), where('username', '==', username));
          const querySnapshot = await getDocs(q);
          const userDocs = querySnapshot.docs;
          

          let badgeList = [];

          // Milestone 1: At least one document
          if (userDocs.length < 1) {
            badgeList.push('First Upload Badge');
          }

          // Milestone 2: At least one Hip-Hop/Rap genre song
          const hasHipHopSong = userDocs.some(doc => doc.data().music.genre === 'Hip-Hop/Rap');
          if (hasHipHopSong) {
            badgeList.push('Hip-Hop Lover Badge');
          }

          // Milestone 3: At least three documents
          if (userDocs.length >= 3) {
            badgeList.push('Triple Upload Badge');
          }

          // Milestone 4: At least five documents
          if (userDocs.length >= 5) {
            badgeList.push('Prolific Uploader Badge');
          }

          // Milestone 5: At least ten documents
          if (userDocs.length >= 10) {
            badgeList.push('Legendary Uploader Badge');
          }

          setBadges(badgeList);
        }
      } catch (error) {
        console.error('Error fetching user documents: ', error);
      }
    };

    if (userId) {
      fetchUsernameAndDocuments();
    }
  }, [uid, username]);
  console.log(username);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topHeader}>
        <TouchableOpacity onPress={() => navigation?.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Your Badges</Text>
        <View style={{ width: 60 }} />
      </View>
      <View style={styles.content}>
        <Text style={styles.header}>Earned Achievements</Text>
        {badges.length > 0 ? (
          badges.map((badge, index) => (
            <View key={index} style={styles.badgeContainer}>
              {badgeImages[badge] && <Image source={badgeImages[badge]} style={styles.badgeImage} />}
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.noBadgeText}>No badges yet. Start uploading music to earn badges! {username}</Text>
        )}
      </View>
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
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  header: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#111',
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    backgroundColor: '#f8f8f8',
    padding: 10,
    borderRadius: 10,
    width: '90%',
  },
  badgeImage: {
    width: 50,
    height: 50,
    marginRight: 14,
  },
  badgeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
  },
  noBadgeText: {
    fontSize: 16,
    color: 'gray',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
});

export default BadgeAwarder;
