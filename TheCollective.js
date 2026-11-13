// TheCollective.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  View,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Text } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { db } from './firebaseConfig';
import {
  collection,
  getDocs,
  query,
  orderBy,
  limit,
  startAfter,
} from 'firebase/firestore';
import Taskbar from './Taskbar';
import { createAsyncActionLock } from './utils/actionLockUtils';

const PAGE_SIZE = 20;

const themeImages = {
  child_of_the_80s: require('./assets/80.jpg'),
  childhood_favorites: require('./assets/childhood.jpg'),
  ex_girlfriends_club: require('./assets/ex.jpg'),
  funny_rap: require('./assets/funnyrap.jpg'),
  yaaassss_girl: require('./assets/yaas.jpg'),
  laughing_crying: require('./assets/joie.jpg'),
  unfiltered: require('./assets/reality.jpg'),
  criminally_overlooked: require('./assets/underrated.jpg'),
  bad_day: require('./assets/badday.jpg'),
  not_friday: require('./assets/notfriday.jpg'),
  margarita_time: require('./assets/margarita.jpg'),
  half_good_music: require('./assets/halfgood.jpg'),
  best_of_worst: require('./assets/bestworst.jpg'),
  airplane_mode: require('./assets/Airplanemode.jpg'),
};

const FALLBACK_THEMES = Object.keys(themeImages).map((id) => ({
  id,
  name: id
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' '),
}));

function TheCollective() {
  const [themes, setThemes] = useState([]);
  const themesRef = useRef(themes);
  themesRef.current = themes;
  const [lastVisibleDoc, setLastVisibleDoc] = useState(null);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const navigation = useNavigation();
  const actionLockRef = useRef(createAsyncActionLock());

  const fetchInitialThemes = useCallback(async () => {
    try {
      if (themesRef.current.length === 0) {
        setLoadingInitial(true);
      }
      const q = query(collection(db, 'collective'), orderBy('name'), limit(PAGE_SIZE));
      const snap = await getDocs(q);

      if (!snap.empty) {
        const list = snap.docs.map((d) => ({
          id: d.id,
          name: d.data().name || d.id,
        }));
        setThemes(list);
        setLastVisibleDoc(snap.docs[snap.docs.length - 1]);
        setHasMore(snap.docs.length === PAGE_SIZE);
      } else {
        setThemes(FALLBACK_THEMES);
        setHasMore(false);
      }
    } catch (error) {
      console.warn('Using fallback themes:', error.message);
      setThemes(FALLBACK_THEMES);
      setHasMore(false);
    } finally {
      setLoadingInitial(false);
    }
  }, []);

  useEffect(() => {
    fetchInitialThemes();
  }, [fetchInitialThemes]);

  const handleLoadMore = () => {
    if (loadingMore || !hasMore || !lastVisibleDoc) return;
    return actionLockRef.current(async () => {
      try {
        setLoadingMore(true);
        const nextQ = query(
          collection(db, 'collective'),
          orderBy('name'),
          startAfter(lastVisibleDoc),
          limit(PAGE_SIZE)
        );
        const snap = await getDocs(nextQ);

        if (!snap.empty) {
          const nextItems = snap.docs.map((d) => ({
            id: d.id,
            name: d.data().name || d.id,
          }));
          setThemes((prev) => [...prev, ...nextItems]);
          setLastVisibleDoc(snap.docs[snap.docs.length - 1]);
          setHasMore(snap.docs.length === PAGE_SIZE);
        } else {
          setHasMore(false);
        }
      } catch (error) {
        console.error('Error paginating collective themes:', error);
        setHasMore(false);
      } finally {
        setLoadingMore(false);
      }
    });
  };

  const renderThemeItem = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() =>
        navigation.navigate('Pickerchoosers', { themeId: item.id, theme: item.name })
      }
      activeOpacity={0.8}
    >
      <View style={styles.cardContent}>
        <View style={styles.imageContainer}>
          <Image
            source={themeImages[item.id] || themeImages.child_of_the_80s}
            style={styles.cardImage}
          />
          <View style={styles.imageOverlay} />
        </View>
        <Text style={styles.cardTitle}>{item.name}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.headerText}>The Collective Groove</Text>
      {loadingInitial ? (
        <ActivityIndicator size="large" color="#FF8C00" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={themes}
          keyExtractor={(item) => item.id}
          renderItem={renderThemeItem}
          numColumns={2}
          contentContainerStyle={styles.flatListContainer}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator size="small" color="#FF8C00" style={{ marginVertical: 14 }} />
            ) : null
          }
        />
      )}

      <View style={styles.taskbarContainer}>
        <Taskbar />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 10,
    backgroundColor: '#0D0E12',
  },
  flatListContainer: {
    paddingBottom: 116, // Clears floating bottom Taskbar dock
  },
  headerText: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    marginVertical: 16,
    textAlign: 'center',
  },
  card: {
    flex: 1,
    margin: 8,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#161922',
    borderWidth: 1,
    borderColor: '#242936',
  },
  cardContent: {
    alignItems: 'center',
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
    height: 140,
  },
  cardImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 10,
    textAlign: 'center',
    paddingHorizontal: 8,
    paddingBottom: 12,
  },
  taskbarContainer: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    backgroundColor: '#0D1017',
  },
});

export default TheCollective;