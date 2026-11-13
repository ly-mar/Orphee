// UserSearchScreen.js — Case-Insensitive Listener Directory Search [VR-005]
import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  TextInput,
  FlatList,
  Text,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Image,
} from 'react-native';
import debounce from 'lodash.debounce';
import { Feather } from '@expo/vector-icons';
import { auth, db } from './firebaseConfig';
import { collection, query, limit, getDocs, getDoc, doc } from 'firebase/firestore';
import { useNavigation } from '@react-navigation/native';
import { filterUsersSafely } from './utils/userAndFeedbackUtils';
import { UserAvatar } from './utils/avatarUtils';

const UserSearchScreen = () => {
  const [queryText, setQueryText] = useState('');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [currentUsername, setCurrentUsername] = useState(null);
  const usersDirectoryRef = useRef(null);
  const searchTokenRef = useRef(0);
  const navigation = useNavigation();

  useEffect(() => {
    let isMounted = true;
    const loadDirectoryAndSelf = async () => {
      try {
        const currentUser = auth.currentUser;
        if (currentUser?.uid) {
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (userDoc.exists() && isMounted) {
            setCurrentUsername(userDoc.data()?.username || null);
          }
        }
      } catch (_) { }
    };

    loadDirectoryAndSelf();
    return () => {
      isMounted = false;
    };
  }, []);

  const loadDirectoryPool = async () => {
    if (Array.isArray(usersDirectoryRef.current) && usersDirectoryRef.current.length > 0) {
      return usersDirectoryRef.current;
    }
    const q = query(collection(db, 'users'), limit(150));
    const querySnapshot = await getDocs(q);
    const pool = querySnapshot.docs.map((docSnap) => {
      const data = docSnap.data() || {};
      return {
        id: docSnap.id,
        uid: docSnap.id,
        username: data.username || '',
        displayName: data.displayName || data.name || '',
        email: data.email || '',
        profileImageUrl: data.profileImageUrl || '',
      };
    });
    usersDirectoryRef.current = pool;
    return pool;
  };

  const executeSearch = async (rawQuery, token) => {
    const cleaned = String(rawQuery ?? '').trim();
    if (!cleaned) {
      setResults([]);
      setHasSearched(false);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const pool = await loadDirectoryPool();
      if (token !== searchTokenRef.current) return;

      const filteredUsers = filterUsersSafely(pool, cleaned, auth.currentUser?.uid);
      setResults(filteredUsers);
      setHasSearched(true);
    } catch (error) {
      if (token === searchTokenRef.current) {
        console.error('Error fetching users:', error);
        setResults([]);
        setHasSearched(true);
      }
    } finally {
      if (token === searchTokenRef.current) {
        setIsLoading(false);
      }
    }
  };

  const debouncedSearch = useMemo(
    () =>
      debounce((text, token) => {
        executeSearch(text, token);
      }, 280),
    []
  );

  useEffect(() => {
    return () => {
      debouncedSearch.cancel();
    };
  }, [debouncedSearch]);

  const handleSearch = (text) => {
    setQueryText(text);
    const nextToken = ++searchTokenRef.current;

    if (!text || !text.trim()) {
      debouncedSearch.cancel();
      setResults([]);
      setHasSearched(false);
      setIsLoading(false);
      return;
    }

    debouncedSearch(text, nextToken);
  };

  const handleClear = () => {
    handleSearch('');
  };

  const renderAvatar = (item) => {
    return (
      <UserAvatar
        imageUrl={item.profileImageUrl}
        name={item.displayName || item.username}
        size={44}
        style={styles.profileImage}
      />
    );
  };

  const renderItem = ({ item }) => {
    const handleText = item.username || 'listener';
    const primaryLabel = item.displayName || item.username || 'TuneHub Listener';

    return (
      <TouchableOpacity
        style={styles.item}
        activeOpacity={0.8}
        onPress={() => {
          if (item.id === auth.currentUser?.uid || (currentUsername && item.username === currentUsername)) {
            navigation.navigate('ProfileScreen');
          } else {
            navigation.navigate('UserProfile', { userId: item.id });
          }
        }}
      >
        {renderAvatar(item)}
        <View style={styles.textContainer}>
          <Text style={styles.username} numberOfLines={1}>
            {primaryLabel}
          </Text>
          <Text style={styles.handleSub} numberOfLines={1}>
            @{handleText.toLowerCase()}
          </Text>
        </View>
        <Feather name="chevron-right" size={18} color="#64748B" />
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topHeader}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          accessibilityLabel="Go back"
        >
          <Feather name="arrow-left" size={16} color="#FFFFFF" />
          <Text style={styles.backBtnText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Find Listeners</Text>
        <View style={{ width: 68 }} />
      </View>

      <View style={styles.searchBarWrap}>
        <Feather name="search" size={16} color="#FF8C00" style={{ marginRight: 10 }} />
        <TextInput
          style={styles.input}
          placeholder="Search listeners by name or @handle..."
          placeholderTextColor="#64748B"
          value={queryText}
          onChangeText={handleSearch}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        {queryText.length > 0 && (
          <TouchableOpacity
            onPress={handleClear}
            style={styles.clearBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Clear search"
          >
            <Feather name="x-circle" size={17} color="#94A3B8" />
          </TouchableOpacity>
        )}
      </View>

      {isLoading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color="#FF8C00" />
          <Text style={styles.stateSub}>Searching listeners...</Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={styles.centerState}>
              <Feather
                name={hasSearched ? 'user-x' : 'users'}
                size={34}
                color="#475569"
                style={{ marginBottom: 10 }}
              />
              <Text style={styles.stateTitle}>
                {hasSearched
                  ? `No listeners found matching "${queryText.trim()}"`
                  : 'Discover Music Twins & Friends'}
              </Text>
              <Text style={styles.stateSub}>
                {hasSearched
                  ? 'Try another spelling, display name, or @username.'
                  : 'Type a name or @username above (case-insensitive).'}
              </Text>
            </View>
          }
        />
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
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1E29',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 6,
  },
  backBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  searchBarWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#151821',
    borderWidth: 1,
    borderColor: '#242936',
    borderRadius: 12,
    margin: 16,
    paddingHorizontal: 14,
    height: 48,
  },
  input: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
  },
  clearBtn: {
    paddingLeft: 8,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#151821',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#222836',
    marginBottom: 10,
  },
  profileImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 14,
    backgroundColor: '#232733',
  },
  initialsAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 14,
    backgroundColor: '#1F2637',
    borderWidth: 1,
    borderColor: '#FF8C00',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialsText: {
    color: '#FF8C00',
    fontSize: 16,
    fontWeight: '800',
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  username: {
    fontWeight: '700',
    color: '#FFFFFF',
    fontSize: 16,
  },
  handleSub: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  centerState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  stateTitle: {
    color: '#E2E8F0',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
  },
  stateSub: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
});

export default UserSearchScreen;
