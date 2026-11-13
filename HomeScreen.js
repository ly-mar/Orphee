// HomeScreen.js
import React, { useState, useEffect } from 'react';
import { ScrollView, StyleSheet, SafeAreaView, TouchableOpacity, ImageBackground, View } from 'react-native';
import { Text, Card, Button } from 'react-native-paper';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from './firebaseConfig';
import { subscribeSafeSnapshot } from './firestoreListenerUtils';
import { deriveHomeDashboardState } from './utils/homeDashboardUtils';
import Taskbar from './Taskbar';
import backgroundImage from './assets/bri-tucker-AJD3XJlvBZ8-unsplash.jpg';

function HomeScreen({ navigation }) {
  const [currentUser, setCurrentUser] = useState(auth.currentUser || null);
  const [userProfileDoc, setUserProfileDoc] = useState(null);
  const [userPlaylistDoc, setUserPlaylistDoc] = useState(null);
  const [safetyHydrate, setSafetyHydrate] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSafetyHydrate(true);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user || null);
      if (!user) {
        setUserProfileDoc(null);
        setUserPlaylistDoc(null);
      }
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    const uid = currentUser?.uid;
    return subscribeSafeSnapshot({
      isReady: Boolean(uid),
      buildQuery: () => doc(db, 'users', uid),
      onSnapshotFn: onSnapshot,
      onNext: (snapshot) => {
        setUserProfileDoc(snapshot && snapshot.exists() ? snapshot.data() : {});
      },
      onError: (err) => {
        setUserProfileDoc({});
        if (err?.code !== 'permission-denied') {
          console.warn('HomeScreen profile listener error:', err);
        }
      },
    });
  }, [currentUser?.uid]);

  useEffect(() => {
    const uid = currentUser?.uid;
    return subscribeSafeSnapshot({
      isReady: Boolean(uid),
      buildQuery: () => doc(db, 'playlists', uid),
      onSnapshotFn: onSnapshot,
      onNext: (snapshot) => {
        setUserPlaylistDoc(snapshot && snapshot.exists() ? snapshot.data() : {});
      },
      onError: (err) => {
        setUserPlaylistDoc({});
        if (err?.code !== 'permission-denied') {
          console.warn('HomeScreen playlist listener error:', err);
        }
      },
    });
  }, [currentUser?.uid]);

  const effectiveProfileDoc = userProfileDoc ?? (safetyHydrate ? {} : null);
  const dashboardState = deriveHomeDashboardState(currentUser, effectiveProfileDoc, userPlaylistDoc);

  return (
    <ImageBackground source={backgroundImage} style={styles.backgroundImage}>
      <View style={styles.overlay}>
        <SafeAreaView style={styles.container}>
          <ScrollView
            contentContainerStyle={styles.scrollContainer}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.contentWrapper}>
              <View style={styles.headerBlock}>
                <Text style={styles.headerText}>Shape Your Community with TuneHub</Text>
                {dashboardState.isAuthenticated && !dashboardState.isHydrated ? (
                  <View style={styles.skeletonSubHeader}>
                    <View style={styles.skeletonPill} />
                  </View>
                ) : (
                  <Text style={styles.subHeaderText}>
                    {dashboardState.isAuthenticated
                      ? `Welcome, ${dashboardState.displayName} • ${dashboardState.progressCount}/${dashboardState.requiredCount} Your13 tracks ready`
                      : 'The social platform designed for music lovers & party regulars'}
                  </Text>
                )}
              </View>

              {/* Your13 Card */}
              <TouchableOpacity
                style={styles.card}
                activeOpacity={0.88}
                onPress={() => navigation.navigate('Your13')}
              >
                <Card.Cover source={require('./assets/your13.jpg')} style={styles.cardCover} />
                <View style={styles.cardContent}>
                  <Text style={styles.cardTitle}>Your13</Text>
                  <Text style={styles.cardText}>
                    {dashboardState.isAuthenticated && dashboardState.progressCount > 0
                      ? `${dashboardState.progressCount}/${dashboardState.requiredCount} signature tracks curated • Find your musical twins`
                      : 'Curate your 13 signature tracks and find your musical twins'}
                  </Text>
                  <Button
                    mode="contained"
                    style={styles.cardButton}
                    buttonColor="#FF8C00"
                    textColor="#000000"
                    labelStyle={styles.buttonLabel}
                  >
                    Open Your13
                  </Button>
                </View>
              </TouchableOpacity>

              {/* The Collective Groove Card */}
              <TouchableOpacity
                style={styles.card}
                activeOpacity={0.88}
                onPress={() => navigation.navigate('TheCollective')}
              >
                <Card.Cover source={require('./assets/collective.jpg')} style={styles.cardCover} />
                <View style={styles.cardContent}>
                  <Text style={styles.cardTitle}>The Collective Groove</Text>
                  <Text style={styles.cardText}>Community-curated music shelves organized by mood & vibe</Text>
                  <Button
                    mode="outlined"
                    style={[styles.cardButton, styles.secondaryCardButton]}
                    buttonColor="#151821"
                    textColor="#FFFFFF"
                    labelStyle={styles.buttonLabel}
                  >
                    Explore The Collective
                  </Button>
                </View>
              </TouchableOpacity>
              {/* Shelved: AI Similarity Finder & Calculator Card (see future_features/) */}
              {/* <TouchableOpacity
                style={styles.card}
                activeOpacity={0.88}
                onPress={() => navigation.navigate('SimilarityFinder')}
              >
                <View style={styles.cardContent}>
                  <Text style={styles.cardTitle}>AI Similarity Finder & Calculator</Text>
                  <Text style={styles.cardText}>
                    Discover the 10 closest sonic matches to any song or compare two tracks across Audio, Lyrics & Metadata
                  </Text>
                  <Button
                    mode="contained"
                    style={styles.cardButton}
                    buttonColor="#10B981"
                    textColor="#000000"
                    labelStyle={styles.buttonLabel}
                    onPress={() => navigation.navigate('SimilarityFinder')}
                  >
                    Launch Similarity Finder
                  </Button>
                </View>
              </TouchableOpacity> */}
              {/* Community Charts Card */}
              {/* <TouchableOpacity
                style={styles.card}
                activeOpacity={0.88}
                onPress={() => navigation.navigate('RankedMusicList')}
              >
                <Card.Cover source={require('./assets/gabriel-bassino-zEawlLdVloo-unsplash.jpg')} style={styles.cardCover} />
                <View style={styles.cardContent}>
                  <Text style={styles.cardTitle}>Community Charts</Text>
                  <Text style={styles.cardText}>Top songs, artists & genres determined by everyone's 13 choices</Text>
                  <Button
                    mode="contained"
                    style={styles.cardButton}
                    buttonColor="#FF8C00"
                    textColor="#000000"
                    labelStyle={styles.buttonLabel}
                  >
                    View Charts
                  </Button>
                </View>
              </TouchableOpacity> */}

            </View>
          </ScrollView>

          <Taskbar />
        </SafeAreaView>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  overlay: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(10, 12, 16, 0.85)',
  },
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  scrollContainer: {
    paddingVertical: 16,
    paddingBottom: 116, // Clears floating bottom Taskbar dock
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  contentWrapper: {
    width: '100%',
    maxWidth: 480,
  },
  headerBlock: {
    marginBottom: 20,
    alignItems: 'center',
  },
  headerText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  subHeaderText: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  skeletonSubHeader: {
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  skeletonPill: {
    height: 12,
    width: 210,
    borderRadius: 6,
    backgroundColor: '#151821',
  },
  card: {
    backgroundColor: '#161922',
    borderRadius: 16,
    marginBottom: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#242B3B',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  cardCover: {
    height: 160,
    borderRadius: 0,
    backgroundColor: '#151821',
  },
  cardContent: {
    padding: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  cardText: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: 14,
    lineHeight: 18,
  },
  cardButton: {
    borderRadius: 10,
    paddingVertical: 2,
  },
  secondaryCardButton: {
    borderColor: '#FF8C00',
    borderWidth: 1,
  },
  buttonLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
});

export default HomeScreen;
